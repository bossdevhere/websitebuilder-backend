import { Router } from "express";
import { LLMController } from "./llm.controller.js";

const router = Router();

router.get("/config", LLMController.getConfig);
router.post("/generate", LLMController.generate);

export default router;
