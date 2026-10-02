import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { AgentService } from "./agent.service.js";

function getToken(req: AuthenticatedRequest): string {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return "";
}

export class AgentController {
  // GET /api/projects/:id/stream - SSE connection endpoint
  static async stream(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const projectId = req.params.id;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    res.write(`event: connected\ndata: ${JSON.stringify({ projectId, timestamp: new Date().toISOString() })}\n\n`);

    AgentService.addClient(projectId, res);
  }

  // POST /api/projects/:id/prompt - Trigger agent run
  static async runPrompt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user.id;
      const token = getToken(req);
      const projectId = req.params.id;
      const { prompt } = req.body;

      if (!prompt) {
        res.status(400).json({ error: "Prompt is required" });
        return;
      }

      // Start agent run asynchronously in background
      AgentService.runAgent(userId, token, projectId, prompt).catch((err) => {
        console.error("Async Agent Run Failed:", err);
      });

      res.status(202).json({
        message: "Agent prompt execution started",
        projectId,
        status: "processing",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to trigger agent" });
    }
  }

  // GET /api/projects/:id/messages - Fetch chat history
  static async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = req.params.id;
      const messages = await AgentService.getChatMessages(projectId);
      res.status(200).json({ messages });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch messages" });
    }
  }
}
