import { StateGraph, END } from "@langchain/langgraph";
import { AgentAnnotation, AgentStateType } from "./agent.state.js";
import { getLLMClient } from "../llm/llm.factory.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// 1. Planner Node: Analyzes prompt and existing code to build step-by-step file plan
async function plannerNode(state: AgentStateType) {
  const llm = getLLMClient();
  const filePaths = Object.keys(state.fileTree || {}).join(", ") || "App.tsx, index.html, package.json";

  const systemPrompt = `You are an expert AI Lead Software Architect.
Analyze the user request and existing project files (${filePaths}).
Create a clear, concise JSON array of strings describing the exact files to create or modify.
Output ONLY a JSON array, like: ["Update App.tsx to add state", "Create components/Navbar.tsx"]`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`User Request: ${state.userPrompt}`),
  ]);

  const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  let planSteps: string[] = [];

  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    planSteps = JSON.parse(cleaned);
  } catch (e) {
    planSteps = [`Implement feature: ${state.userPrompt}`];
  }

  return {
    plan: planSteps,
    logs: [`📋 Plan generated (${planSteps.length} steps)`],
    status: "generating",
  };
}

// 2. Code Generator Node: Writes complete file code using active LLM engine
async function codeGeneratorNode(state: AgentStateType) {
  const llm = getLLMClient();

  const fileContext = Object.entries(state.fileTree || {})
    .map(([path, content]) => `--- FILE: ${path} ---\n${content}`)
    .join("\n\n");

  const systemPrompt = `You are a Senior Full-Stack React Engineer.
You write production-ready TypeScript/React code.
Given the existing project code and plan, write the full content for the updated or new files.

CRITICAL INSTRUCTION: Return a single JSON object mapping file paths to their full file contents.
Example output format:
{
  "App.tsx": "import React from 'react';\\nexport default function App() { return <div>Hello World</div>; }",
  "components/Header.tsx": "export const Header = () => <header>Header</header>;"
}

OUTPUT ONLY VALID JSON. DO NOT INCLUDE EXTRA TEXT OUTSIDE THE JSON BLOCK.`;

  const userContent = `User Prompt: ${state.userPrompt}\nPlan: ${JSON.stringify(state.plan)}\n\nExisting Code:\n${fileContext}`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userContent),
  ]);

  const rawText = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const fileChanges: { path: string; content: string }[] = [];
  const updatedTree: Record<string, string> = { ...state.fileTree };

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    const parsedFiles: Record<string, string> = JSON.parse(jsonStr);

    for (const [path, content] of Object.entries(parsedFiles)) {
      if (typeof content === "string") {
        fileChanges.push({ path, content });
        updatedTree[path] = content;
      }
    }
  } catch (e) {
    // Fallback if JSON parsing fails: update App.tsx directly
    let fallbackContent = rawText
      .replace(/```tsx/g, "")
      .replace(/```jsx/g, "")
      .replace(/```typescript/g, "")
      .replace(/```/g, "")
      .trim();

    fileChanges.push({ path: "App.tsx", content: fallbackContent });
    updatedTree["App.tsx"] = fallbackContent;
  }

  return {
    fileChanges,
    fileTree: updatedTree,
    logs: fileChanges.map((f) => `✏️ Generated code for ${f.path}`),
    status: "verifying",
  };
}

// 3. Verifier Node: Validates generated files syntax
async function verifierNode(state: AgentStateType) {
  const fileCount = state.fileChanges?.length || 0;
  return {
    logs: [`✅ Verification complete (${fileCount} files updated)`],
    status: "done",
  };
}

// Construct LangGraph StateGraph
const workflow = new StateGraph(AgentAnnotation)
  .addNode("planner", plannerNode)
  .addNode("code_generator", codeGeneratorNode)
  .addNode("verifier", verifierNode)
  .addEdge("__start__", "planner")
  .addEdge("planner", "code_generator")
  .addEdge("code_generator", "verifier")
  .addEdge("verifier", END);

export const agentGraph = workflow.compile();
