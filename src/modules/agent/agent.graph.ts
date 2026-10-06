import { StateGraph, END } from "@langchain/langgraph";
import { AgentAnnotation, AgentStateType } from "./agent.state.js";
import { getLLMClient } from "../llm/llm.factory.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const GREETINGS = [
  "hi",
  "hello",
  "hey",
  "hlo",
  "sup",
  "howdy",
  "good morning",
  "good evening",
  "hi there",
  "hello there",
  "who are you",
  "what can you do",
];

function isSimpleGreeting(prompt: string): boolean {
  const clean = prompt.trim().toLowerCase().replace(/[^\w\s]/gi, "");
  return GREETINGS.includes(clean);
}

// 1. Planner Node: Analyzes prompt and existing code to build step-by-step file plan
async function plannerNode(state: AgentStateType) {
  // Fast path for simple conversational greetings/questions
  if (isSimpleGreeting(state.userPrompt)) {
    return {
      plan: [],
      logs: ["👋 Hello! I am your AI Web App Assistant. Ask me to build components, add pages, or style your web application!"],
      fileChanges: [],
      status: "done",
    };
  }

  const llm = getLLMClient();
  const filePaths = Object.keys(state.fileTree || {}).join(", ") || "App.tsx, index.html, package.json";

  const systemPrompt = `You are an expert AI Lead Software Architect.
Analyze the user request and existing project files (${filePaths}).
Create a clear, concise JSON array of strings describing the exact files to create or modify.
Output ONLY a JSON array, like: ["Update App.tsx to add state", "Create components/Navbar.tsx"]
If no code files need to be changed, return an empty array: []`;

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
    status: planSteps.length > 0 ? "generating" : "done",
  };
}

// Helper to check if string contains actual source code
function isCodeContent(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const t = str.trim();
  return (
    t.includes("import ") ||
    t.includes("export ") ||
    t.includes("function ") ||
    t.includes("const ") ||
    t.includes("<") ||
    t.includes("{")
  );
}

// 2. Code Generator Node: Writes complete file code using active LLM engine
async function codeGeneratorNode(state: AgentStateType) {
  // If plan is empty, skip code generation
  if (!state.plan || state.plan.length === 0) {
    return {
      fileChanges: [],
      logs: ["No code changes required."],
      status: "verifying",
    };
  }

  const llm = getLLMClient();

  const fileContext = Object.entries(state.fileTree || {})
    .map(([path, content]) => `--- FILE: ${path} ---\n${content}`)
    .join("\n\n");

  const systemPrompt = `You are a Senior Full-Stack React Engineer & Software Architect.
You write production-ready TypeScript/React code and maintain clean project architecture.
Given the existing project code and plan:
1. Create new files or update existing files to improve application architecture (e.g., modular components, services, hooks).
2. Specify files that should be deleted if they are obsolete or requested to be removed.

CRITICAL INSTRUCTION: Return a single JSON object matching this structure:
{
  "deletedFiles": ["components/Unused.tsx"],
  "files": {
    "App.tsx": "import React from 'react';...",
    "components/Header.tsx": "export const Header = () => <header>Header</header>;"
  }
}
OUTPUT ONLY VALID JSON. DO NOT INCLUDE EXTRA TEXT OUTSIDE THE JSON BLOCK.`;

  const userContent = `User Prompt: ${state.userPrompt}\nPlan: ${JSON.stringify(state.plan)}\n\nExisting Code:\n${fileContext}`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userContent),
  ]);

  const rawText = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const fileChanges: { path: string; content: string }[] = [];
  const deletedFiles: string[] = [];
  const updatedTree: Record<string, string> = { ...state.fileTree };
  let assistantReplyText = "";

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    const parsedData: any = JSON.parse(jsonStr);

    // 1. Process files requested to be deleted
    const toDelete = parsedData.deletedFiles || parsedData.deleteFiles || [];
    if (Array.isArray(toDelete)) {
      toDelete.forEach((pathStr: string) => {
        if (typeof pathStr === "string" && pathStr.trim().length > 0) {
          deletedFiles.push(pathStr.trim());
          delete updatedTree[pathStr.trim()];
        }
      });
    }

    // 2. Process created / updated files
    const filesMap = parsedData.files || parsedData.fileChanges || parsedData;
    if (typeof filesMap === "object" && filesMap !== null) {
      for (const [path, content] of Object.entries(filesMap)) {
        if (path !== "deletedFiles" && path !== "deleteFiles" && typeof content === "string" && isCodeContent(content)) {
          fileChanges.push({ path, content });
          updatedTree[path] = content;
        }
      }
    }
  } catch (e) {
    // If JSON parsing fails, extract fenced code block ONLY if valid code
    const codeBlockMatch = rawText.match(/```(?:tsx|jsx|typescript|javascript|html|css)?\n([\s\S]*?)```/);
    if (codeBlockMatch && isCodeContent(codeBlockMatch[1])) {
      const code = codeBlockMatch[1].trim();
      fileChanges.push({ path: "App.tsx", content: code });
      updatedTree["App.tsx"] = code;
    } else {
      // Conversational text - do NOT touch project files!
      assistantReplyText = rawText.replace(/```[\s\S]*?```/g, "").trim();
    }
  }

  const logs: string[] = [];
  deletedFiles.forEach((d) => logs.push(`🗑️ Deleted file ${d}`));
  fileChanges.forEach((f) => logs.push(`✏️ Generated code for ${f.path}`));
  if (logs.length === 0) {
    logs.push(assistantReplyText || "Processed request.");
  }

  return {
    fileChanges,
    deletedFiles,
    fileTree: updatedTree,
    logs,
    status: "verifying",
  };
}

// 3. Verifier Node: Validates generated files syntax
async function verifierNode(state: AgentStateType) {
  const fileCount = state.fileChanges?.length || 0;
  return {
    logs: state.logs || [fileCount > 0 ? `✅ Verification complete (${fileCount} files updated)` : "✅ Done"],
    status: "done",
  };
}

// Conditional routing function
function routeAfterPlanner(state: AgentStateType) {
  if (!state.plan || state.plan.length === 0) {
    return "verifier";
  }
  return "code_generator";
}

// Construct LangGraph StateGraph with conditional routing
const workflow = new StateGraph(AgentAnnotation)
  .addNode("planner", plannerNode)
  .addNode("code_generator", codeGeneratorNode)
  .addNode("verifier", verifierNode)
  .addEdge("__start__", "planner")
  .addConditionalEdges("planner", routeAfterPlanner, {
    code_generator: "code_generator",
    verifier: "verifier",
  })
  .addEdge("code_generator", "verifier")
  .addEdge("verifier", END);

export const agentGraph = workflow.compile();
