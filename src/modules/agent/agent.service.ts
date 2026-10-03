import { Response } from "express";
import { agentGraph } from "./agent.graph.js";
import { ProjectsService } from "../projects/projects.service.js";
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

  // Execute Agent Workflow for a user prompt
  static async runAgent(userId: string, token: string, projectId: string, userPrompt: string) {
    // 1. Fetch current project & file tree
    const project = await ProjectsService.getProjectById(userId, token, projectId);
    const fileTree: Record<string, string> = {};
    (project.files || []).forEach((f: any) => {
      fileTree[f.path] = f.content;
    });

    // 2. Save user message to chat history
    await supabaseAdmin.from("chat_messages").insert({
      project_id: projectId,
      role: "user",
      content: userPrompt,
    });

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

      // 4. Save generated file changes to DB
      const fileChanges = result.fileChanges || [];
      for (const change of fileChanges) {
        await ProjectsService.updateProjectFile(userId, token, projectId, change.path, change.content);
        this.broadcast(projectId, "file_updated", { path: change.path, content: change.content });
      }

      // 5. Save assistant message to chat history
      const summary =
        fileChanges.length > 0
          ? `Generated and updated ${fileChanges.length} file(s) for prompt: "${userPrompt}"`
          : (result.logs && result.logs[0]) || `Processed prompt: "${userPrompt}"`;

      await supabaseAdmin.from("chat_messages").insert({
        project_id: projectId,
        role: "assistant",
        content: summary,
      });

      this.broadcast(projectId, "status", {
        status: "done",
        message: "🎉 Agent completed code generation!",
        plan: result.plan,
        logs: result.logs,
        fileChanges,
      });

      return result;
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
