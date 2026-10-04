import { Request, Response, NextFunction } from "express";
import { RuntimeManager } from "./runtime.manager.js";
import { ProjectsService } from "../projects/projects.service.js";
import fs from "fs";
import path from "path";

export class RuntimeController {
  // GET /api/runtime/projects/:projectId/preview - Serve physical disk workspace preview
  static async servePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      let requestedFile = req.params[0] || "index.html";

      const workspaceDir = RuntimeManager.getWorkspacePath(projectId);
      let filePath = path.join(workspaceDir, requestedFile);

      // If physical workspace files don't exist yet, fetch from database and sync
      if (!fs.existsSync(filePath)) {
        const project = await ProjectsService.getProjectById("admin", "", projectId);
        if (project && project.files) {
          await RuntimeManager.syncWorkspace(projectId, project.files);
        }
      }

      if (!fs.existsSync(filePath)) {
        filePath = path.join(workspaceDir, "index.html");
      }

      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).send("Workspace preview file not found.");
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // GET /api/runtime/projects/:projectId/info - Get workspace runtime info
  static async getInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const previewUrl = RuntimeManager.getPreviewUrl(projectId);
      res.json({ projectId, previewUrl, status: "ready" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
