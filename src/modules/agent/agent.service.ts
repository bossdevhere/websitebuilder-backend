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

    this.broadcast(projectId, "status", { status: "planning", message: "🤔 AI Agent is planning project architecture..." });

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

      // 4. Save generated file changes to DB & sync RuntimeManager workspace
      const fileChanges = result.fileChanges || [];
      for (const change of fileChanges) {
        await ProjectsService.updateProjectFile(userId, token, projectId, change.path, change.content);
        this.broadcast(projectId, "file_updated", { path: change.path, content: change.content });
      }

      // Sync physical workspace on disk via RuntimeManager
      if (fileChanges.length > 0) {
        const updatedProj = await ProjectsService.getProjectById(userId, token, projectId);
        await RuntimeManager.syncWorkspace(projectId, updatedProj.files || []);
      }

      // 5. Persist assistant message in DB
      const assistantText =
        fileChanges.length > 0
          ? `I have updated your application code based on your request:\n${fileChanges.map((f: any) => `• ${f.path}`).join("\n")}`
          : (result.logs && result.logs[0]) || `Processed request: "${userPrompt}"`;

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
        message: "🎉 Agent completed code generation!",
        plan: result.plan,
        logs: result.logs,
        fileChanges,
      });

      return {
        userMessage: userMsg,
        message: savedMsg,
        changes: fileChanges,
        status: "completed",
        previewUrl: RuntimeManager.getPreviewUrl(projectId),
      };
    } catch (err: any) {
      console.error("[AGENT ERROR]", err);
      this.broadcast(projectId, "status", {
        status: "error",
        message: `Agent error: ${err.message}`,
      });
      throw err;
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
