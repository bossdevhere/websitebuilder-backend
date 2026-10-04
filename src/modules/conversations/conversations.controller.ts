import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { ConversationsService } from "./conversations.service.js";
import { AgentService } from "../agent/agent.service.js";

export class ConversationsController {
  // GET /api/projects/:projectId/conversations - List persistent conversations
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.split(" ")[1] : "";

      const conversations = await ConversationsService.getProjectConversations(userId, token, projectId);
      res.json({ conversations });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // POST /api/projects/:projectId/conversations - Create a new conversation thread
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const { title } = req.body;
      const userId = req.user.id;
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.split(" ")[1] : "";

      const conversation = await ConversationsService.createConversation(
        userId,
        token,
        projectId,
        title || "New Chat"
      );
      res.status(201).json({ conversation });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // GET /api/projects/:projectId/conversations/:conversationId/messages - Get messages in a conversation
  static async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, conversationId } = req.params;
      const userId = req.user.id;
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.split(" ")[1] : "";

      const messages = await ConversationsService.getConversationMessages(userId, token, conversationId, projectId);
      res.json({ messages });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // POST /api/projects/:projectId/conversations/:conversationId/messages - Send message & run LangGraph agent
  static async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, conversationId } = req.params;
      const { content, prompt } = req.body;
      const userPrompt = content || prompt;

      if (!userPrompt || !userPrompt.trim()) {
        res.status(400).json({ error: "Message content or prompt is required" });
        return;
      }

      const userId = req.user.id;
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.split(" ")[1] : "";

      const result = await AgentService.runAgent(userId, token, projectId, userPrompt.trim(), conversationId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
