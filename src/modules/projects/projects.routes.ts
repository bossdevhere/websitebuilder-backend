import { Router } from "express";
import { ProjectsController } from "./projects.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = Router();

// Protect all project routes with auth token validation
router.use(authenticateToken);

router.post("/", ProjectsController.createProject);
router.get("/", ProjectsController.getUserProjects);
router.get("/:id", ProjectsController.getProjectById);
router.delete("/:id", ProjectsController.deleteProject);
router.put("/:id/files", ProjectsController.updateProjectFile);
router.delete("/:id/files", ProjectsController.deleteProjectFile);

export default router;
