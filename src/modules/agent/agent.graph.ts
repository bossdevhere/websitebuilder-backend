import { StateGraph, END } from "@langchain/langgraph";
import { AgentAnnotation, AgentStateType } from "./agent.state.js";
import { getLLMClient } from "../llm/llm.factory.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// 1. Planner Node: High-speed planner analyzing request and file tree paths
async function plannerNode(state: AgentStateType) {
  const llm = getLLMClient();
  const filePaths = Object.keys(state.fileTree || {}).join(", ") || "App.tsx, index.html, package.json";

  const systemPrompt = `You are a fast, expert AI Web App Architect.
Analyze the user prompt with current files (${filePaths}).

Determine if prompt is:
1. CONVERSATIONAL (greetings, 'hi', 'how are you', advice, or questions without code requests).
   -> Set "isCodeRequest": false, "reply": "Warm helpful response", "plan": [].

2. CODE / WEBSITE CREATION REQUEST (e.g. 'build a portfolio', 'make a coffee site', 'add hero section').
   -> Set "isCodeRequest": true, "reply": "Explanation of planned website sections", "plan": ["Create components/Navbar.tsx", "Update App.tsx"].

Return ONLY JSON:
{
  "isCodeRequest": boolean,
  "reply": "Message to user",
  "plan": ["file steps..."]
}`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`User Prompt: ${state.userPrompt}`),
  ]);

  const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  let isCodeRequest = false;
  let replyText = "";
  let planSteps: string[] = [];

  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    isCodeRequest = Boolean(parsed.isCodeRequest);
    replyText = parsed.reply || "";
    planSteps = Array.isArray(parsed.plan) ? parsed.plan : [];
  } catch (e) {
    replyText = text.replace(/```[\s\S]*?```/g, "").trim() || `Processed: "${state.userPrompt}"`;
  }

  return {
    plan: isCodeRequest ? planSteps : [],
    assistantReply: replyText,
    logs: [replyText || `📋 Architecture plan generated (${planSteps.length} steps)`],
    status: isCodeRequest && planSteps.length > 0 ? "generating" : "done",
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

// 2. Code Generator Node: Fast modular code generation with Tailwind CSS & lucide-react icons
async function codeGeneratorNode(state: AgentStateType) {
  if (!state.plan || state.plan.length === 0) {
    return {
      fileChanges: [],
      logs: [state.assistantReply || "No code changes required."],
      status: "verifying",
    };
  }

  const llm = getLLMClient();

  const fileContext = Object.entries(state.fileTree || {})
    .map(([path, content]) => `--- FILE: ${path} ---\n${content}`)
    .join("\n\n");

  const systemPrompt = `You are an expert AI website designer & React/Tailwind engineer.
Write complete, modern, production-quality code.

DESIGN & REACT RULES:
1. Every section must look polished, intentional, and responsive (Desktop/Mobile).
2. AVOID: Plain default HTML, generic white cards, "Lorem Ipsum", or generic placeholders like "Feature 1".
3. USE: Strong visual hierarchy, distinct color theme, rounded corners, shadow effects, Tailwind styling, and lucide-react icons.
4. REACT COMPONENT EXPORTS: Always declare each component with 'export default function ComponentName(props) { ... }' so default imports in App.tsx ('import ComponentName from "./components/ComponentName"') resolve flawlessly.
5. REACT KEYS: When rendering array lists with .map((item, index) => ...), ALWAYS add a unique 'key' prop (e.g. key={item.id || item.title || index}) on the top-level returned JSX element to prevent React key console warnings.
6. Modular components: "components/Navbar.tsx", "components/Hero.tsx", "components/About.tsx", "components/Services.tsx", "components/CTA.tsx", "components/Footer.tsx", composed inside "App.tsx".

Return ONLY JSON:
{
  "summary": "Summary of updates",
  "deletedFiles": [],
  "files": {
    "components/Navbar.tsx": "code...",
    "components/Hero.tsx": "code...",
    "components/About.tsx": "code...",
    "components/Services.tsx": "code...",
    "components/CTA.tsx": "code...",
    "components/Footer.tsx": "code...",
    "App.tsx": "code..."
  }
}`;

  const userContent = `User Prompt: ${state.userPrompt}\nPlan: ${JSON.stringify(state.plan)}\n\nExisting Code:\n${fileContext}`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userContent),
  ]);

  const rawText = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const fileChanges: { path: string; content: string }[] = [];
  const deletedFiles: string[] = [];
  const updatedTree: Record<string, string> = { ...state.fileTree };
  let assistantReplyText = state.assistantReply || "";

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    const parsedData: any = JSON.parse(jsonStr);

    if (parsedData.summary && typeof parsedData.summary === "string") {
      assistantReplyText = parsedData.summary;
    }

    const toDelete = parsedData.deletedFiles || parsedData.deleteFiles || [];
    if (Array.isArray(toDelete)) {
      toDelete.forEach((pathStr: string) => {
        if (typeof pathStr === "string" && pathStr.trim().length > 0) {
          deletedFiles.push(pathStr.trim());
          delete updatedTree[pathStr.trim()];
        }
      });
    }

    const filesMap = parsedData.files || parsedData.fileChanges || parsedData;
    if (typeof filesMap === "object" && filesMap !== null) {
      for (const [path, content] of Object.entries(filesMap)) {
        if (path !== "deletedFiles" && path !== "deleteFiles" && path !== "summary" && typeof content === "string" && isCodeContent(content)) {
          fileChanges.push({ path, content });
          updatedTree[path] = content;
        }
      }
    }
  } catch (e) {
    const codeBlockMatch = rawText.match(/```(?:tsx|jsx|typescript|javascript|html|css)?\n([\s\S]*?)```/);
    if (codeBlockMatch && isCodeContent(codeBlockMatch[1])) {
      const code = codeBlockMatch[1].trim();
      fileChanges.push({ path: "App.tsx", content: code });
      updatedTree["App.tsx"] = code;
    } else {
      assistantReplyText = rawText.replace(/```[\s\S]*?```/g, "").trim() || assistantReplyText;
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
    assistantReply: assistantReplyText,
    logs,
    status: "verifying",
  };
}

// 3. Verifier Node
async function verifierNode(state: AgentStateType) {
  const fileCount = state.fileChanges?.length || 0;
  return {
    logs: state.logs || [fileCount > 0 ? `✅ Verification complete (${fileCount} files updated)` : "✅ Done"],
    status: "done",
  };
}

function routeAfterPlanner(state: AgentStateType) {
  if (!state.plan || state.plan.length === 0) {
    return "verifier";
  }
  return "code_generator";
}

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
