import { Response } from "express";
import { agentGraph } from "./agent.graph.js";
import { ProjectsService } from "../projects/projects.service.js";
import { ConversationsService } from "../conversations/conversations.service.js";
import { RuntimeManager } from "../runtime/runtime.manager.js";
import { supabaseAdmin } from "../../config/supabase.js";

interface SSEClient {
  id: string;
  projectId: string;
  res: Response;
}

export class AgentService {
  private static sseClients: SSEClient[] = [];

  // Register SSE stream client
  static addClient(projectId: string, res: Response): string {
    const id = `${projectId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.sseClients.push({ id, projectId, res });

    reqCloseHandler(res, () => {
      this.sseClients = this.sseClients.filter((c) => c.id !== id);
    });

    return id;
  }

  // Broadcast event payload to all listening SSE clients for a project
  static broadcast(projectId: string, event: string, data: any) {
    const clients = this.sseClients.filter((c) => c.projectId === projectId);
    clients.forEach((client) => {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
  }

  // Execute Agent Workflow for a user prompt within a conversation
  static async runAgent(
    userId: string,
    token: string,
    projectId: string,
    userPrompt: string,
    conversationId?: string
  ) {
    // 1. Fetch current project & file tree
    const project = await ProjectsService.getProjectById(userId, token, projectId);
    const fileTree: Record<string, string> = {};
    (project.files || []).forEach((f: any) => {
      fileTree[f.path] = f.content;
    });

    // 2. Persist user message in DB
    let userMsg: any = null;
    if (conversationId) {
      userMsg = await ConversationsService.addMessage(conversationId, "user", userPrompt, projectId);
    } else {
      userMsg = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userPrompt,
        created_at: new Date().toISOString(),
      };
      await supabaseAdmin.from("chat_messages").insert({
        project_id: projectId,
        role: "user",
        content: userPrompt,
      });
    }

    this.broadcast(projectId, "status", { status: "planning", message: "🤔 AI Agent is thinking..." });

    // 3. Execute LangGraph Workflow
    try {
      const result = await agentGraph.invoke(
        {
          projectId,
          userPrompt,
          fileTree,
          plan: [],
          logs: [],
          fileChanges: [],
          errorCount: 0,
          status: "planning",
        },
        { recursionLimit: 15 }
      );

      // 4. Process file deletions & save generated file changes to DB
      const deletedFiles = result.deletedFiles || [];
      for (const delPath of deletedFiles) {
        try {
          await ProjectsService.deleteProjectFile(userId, token, projectId, delPath);
          this.broadcast(projectId, "file_deleted", { path: delPath });
        } catch (delErr: any) {
          console.warn(`[AgentService] Delete file fallback warning for ${delPath}:`, delErr.message);
        }
      }

      const fileChanges = result.fileChanges || [];
      for (const change of fileChanges) {
        await ProjectsService.updateProjectFile(userId, token, projectId, change.path, change.content);
        this.broadcast(projectId, "file_updated", { path: change.path, content: change.content });
      }

      // Sync physical workspace on disk via RuntimeManager
      if (fileChanges.length > 0 || deletedFiles.length > 0) {
        const updatedProj = await ProjectsService.getProjectById(userId, token, projectId);
        await RuntimeManager.syncWorkspace(projectId, updatedProj.files || []);
      }

      // 5. Build assistant message text for chat UI
      let assistantText = result.assistantReply || "";
      if (!assistantText) {
        const changeLogs: string[] = [];
        if (deletedFiles.length > 0) {
          changeLogs.push(`Deleted files:\n${deletedFiles.map((d: string) => `• ${d}`).join("\n")}`);
        }
        if (fileChanges.length > 0) {
          changeLogs.push(`Updated files:\n${fileChanges.map((f: any) => `• ${f.path}`).join("\n")}`);
        }
        assistantText = changeLogs.length > 0 ? changeLogs.join("\n\n") : (result.logs && result.logs[0]) || `Processed: "${userPrompt}"`;
      }

      let savedMsg = null;
      if (conversationId) {
        savedMsg = await ConversationsService.addMessage(conversationId, "assistant", assistantText, projectId);
      } else {
        savedMsg = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: assistantText,
          created_at: new Date().toISOString(),
        };
        await supabaseAdmin.from("chat_messages").insert({
          project_id: projectId,
          role: "assistant",
          content: assistantText,
        });
      }

      this.broadcast(projectId, "status", {
        status: "done",
        message: assistantText,
        plan: result.plan,
        logs: result.logs,
        fileChanges,
        deletedFiles,
      });

      return {
        userMessage: userMsg,
        message: savedMsg,
        changes: fileChanges,
        deletedFiles,
        status: "completed",
        previewUrl: RuntimeManager.getPreviewUrl(projectId),
      };
    } catch (err: any) {
      console.error("[AGENT ERROR]", err);

      let friendlyErrMsg = err.message || "Agent execution error";
      if (err.status === 429 || friendlyErrMsg.includes("429") || friendlyErrMsg.includes("Quota exceeded") || friendlyErrMsg.includes("quota")) {
        friendlyErrMsg = "⚠️ Google Gemini API Quota Exceeded (429). The provided Gemini API Key has reached its free tier daily request limit. Please provide a fresh API key from https://aistudio.google.com/app/apikey or switch to another LLM provider.";
      } else if (err.status === 503 || friendlyErrMsg.includes("503") || friendlyErrMsg.includes("high demand") || friendlyErrMsg.includes("temporarily unavailable")) {
        friendlyErrMsg = "⚠️ Google Gemini API Busy (503). Google AI servers are experiencing temporary high demand. Please try sending your prompt again in a few seconds!";
      }

      this.broadcast(projectId, "status", {
        status: "error",
        message: friendlyErrMsg,
      });

      const errAssistantMsg = {
        id: `asst-err-${Date.now()}`,
        role: "assistant" as const,
        content: friendlyErrMsg,
        created_at: new Date().toISOString(),
      };

      if (conversationId) {
        try {
          await ConversationsService.addMessage(conversationId, "assistant", friendlyErrMsg, projectId);
        } catch (e) {}
      }

      return {
        userMessage: userMsg,
        message: errAssistantMsg,
        changes: [],
        deletedFiles: [],
        status: "error",
        error: friendlyErrMsg,
        previewUrl: RuntimeManager.getPreviewUrl(projectId),
      };
    }
  }

  // Fetch project chat messages
  static async getChatMessages(projectId: string) {
    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }
}

function reqCloseHandler(res: Response, callback: () => void) {
  res.on("close", callback);
  res.on("finish", callback);
}
