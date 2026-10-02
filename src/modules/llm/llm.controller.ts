import { Request, Response, NextFunction } from "express";
import { LLMService } from "./llm.service.js";

export class LLMController {
  // GET /api/llm/config
  static async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = LLMService.getActiveConfig();
      res.status(200).json({
        provider: config.provider,
        modelName: config.modelName,
        temperature: config.temperature,
        status: "active",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch LLM config" });
    }
  }

  // POST /api/llm/generate
  static async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prompt, systemPrompt } = req.body;
      if (!prompt) {
        res.status(400).json({ error: "Prompt is required" });
        return;
      }
      const result = await LLMService.generateCompletion(prompt, systemPrompt);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "LLM generation failed" });
    }
  }
}
