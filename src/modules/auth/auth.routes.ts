import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = Router();

router.post("/signup", AuthController.signup);
router.post("/login", AuthController.login);
router.get("/me", authenticateToken, AuthController.me);
router.post("/logout", authenticateToken, AuthController.logout);

export default router;
