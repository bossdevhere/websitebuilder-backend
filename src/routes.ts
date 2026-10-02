import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";
import projectsRoutes from "./modules/projects/projects.routes.js";
import llmRoutes from "./modules/llm/llm.routes.js";
import { supabase } from "./config/supabase.js";

const apiRouter = Router();

// Health check endpoint
apiRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "websitebuilder-backend", timestamp: new Date().toISOString() });
});

// Supabase connection test endpoint
apiRouter.get("/supabase-test", async (req, res) => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      res.status(500).json({
        status: "error",
        message: "Failed to connect to Supabase",
        error: error.message,
      });
      return;
    }
    res.status(200).json({
      status: "connected",
      message: "Successfully connected to Supabase!",
      supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: "Supabase connection exception",
      error: err.message,
    });
  }
});

// Module routes
apiRouter.use("/auth", authRoutes);
apiRouter.use("/projects", projectsRoutes);
apiRouter.use("/llm", llmRoutes);

export default apiRouter;
