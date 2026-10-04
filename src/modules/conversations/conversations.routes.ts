import { Router } from "express";
import { ConversationsController } from "./conversations.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = Router({ mergeParams: true });

router.use(authenticateToken);

router.get("/", ConversationsController.list);
router.post("/", ConversationsController.create);
router.get("/:conversationId/messages", ConversationsController.getMessages);
router.post("/:conversationId/messages", ConversationsController.sendMessage);

export default router;
