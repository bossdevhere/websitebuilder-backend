import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.js";
import { ProjectsService } from "./projects.service.js";

function getToken(req: AuthenticatedRequest): string {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return "";
}

export class ProjectsController {
  // POST /api/projects
  static async createProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user.id;
      const token = getToken(req);
      const { name, description } = req.body;
      if (!name) {
        res.status(400).json({ error: "Project name is required" });
        return;
      }
      const project = await ProjectsService.createProject(userId, token, name, description);
      res.status(201).json({ project });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create project" });
    }
  }

  // GET /api/projects
  static async getUserProjects(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user.id;
      const token = getToken(req);
      const projects = await ProjectsService.getUserProjects(userId, token);
      res.status(200).json({ projects });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch projects" });
    }
  }

  // GET /api/projects/:id
  static async getProjectById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user.id;
      const token = getToken(req);
      const projectId = req.params.id;
      const project = await ProjectsService.getProjectById(userId, token, projectId);
      res.status(200).json({ project });
    } catch (error: any) {
      res.status(404).json({ error: error.message || "Project not found" });
    }
  }

  // DELETE /api/projects/:id
  static async deleteProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user.id;
      const token = getToken(req);
      const projectId = req.params.id;
      await ProjectsService.deleteProject(userId, token, projectId);
      res.status(200).json({ message: "Project deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete project" });
    }
  }

  // PUT /api/projects/:id/files
  static async updateProjectFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user.id;
      const token = getToken(req);
      const projectId = req.params.id;
      const { path, content } = req.body;

      if (!path) {
        res.status(400).json({ error: "File path is required" });
        return;
      }

      // Security check: prevent path traversal out of project root
      if (path.includes("..")) {
        res.status(400).json({ error: "Invalid path traversal sequence in path" });
        return;
      }

      const file = await ProjectsService.updateProjectFile(userId, token, projectId, path, content ?? "");
      res.status(200).json({ file });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to save file" });
    }
  }

  // DELETE /api/projects/:id/files
  static async deleteProjectFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user.id;
      const token = getToken(req);
      const projectId = req.params.id;
      const { path } = req.body;

      if (!path) {
        res.status(400).json({ error: "File path is required" });
        return;
      }

      await ProjectsService.deleteProjectFile(userId, token, projectId, path);
      res.status(200).json({ message: "File deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete file" });
    }
  }
}
