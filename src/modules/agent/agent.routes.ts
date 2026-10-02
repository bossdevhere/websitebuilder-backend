import { Router } from "express";
import { AgentController } from "./agent.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = Router();

// Protect all agent routes with auth token validation
router.use(authenticateToken);

router.get("/:id/stream", AgentController.stream);
router.post("/:id/prompt", AgentController.runPrompt);
router.get("/:id/messages", AgentController.getMessages);

export default router;
