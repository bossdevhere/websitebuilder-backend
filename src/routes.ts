import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";

const apiRouter = Router();

// Health check endpoint
apiRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "websitebuilder-backend", timestamp: new Date().toISOString() });
});

// Module routes
apiRouter.use("/auth", authRoutes);

export default apiRouter;
