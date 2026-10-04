import { ProjectsService } from "../projects/projects.service.js";
import { RuntimeManager } from "../runtime/runtime.manager.js";

export class AgentTools {
  // List all files in a project workspace
  static async listFiles(userId: string, token: string, projectId: string): Promise<string[]> {
    const project = await ProjectsService.getProjectById(userId, token, projectId);
    return (project.files || []).map((f: any) => f.path);
  }

  // Read a file from a project workspace
  static async readFile(userId: string, token: string, projectId: string, filePath: string): Promise<string> {
    const project = await ProjectsService.getProjectById(userId, token, projectId);
    const file = (project.files || []).find((f: any) => f.path === filePath);
    if (!file) throw new Error(`File not found: ${filePath}`);
    return file.content;
  }

  // Search project files for keyword
  static async searchFiles(
    userId: string,
    token: string,
    projectId: string,
    query: string
  ): Promise<{ path: string; matchLine: string }[]> {
    const project = await ProjectsService.getProjectById(userId, token, projectId);
    const matches: { path: string; matchLine: string }[] = [];
    const q = query.toLowerCase();

    (project.files || []).forEach((f: any) => {
      const lines = f.content.split("\n");
      lines.forEach((line: string) => {
        if (line.toLowerCase().includes(q)) {
          matches.push({ path: f.path, matchLine: line.trim() });
        }
      });
    });

    return matches;
  }

  // Create or update a project file and sync disk workspace
  static async updateFile(
    userId: string,
    token: string,
    projectId: string,
    filePath: string,
    content: string
  ): Promise<{ path: string; content: string }> {
    const updated = await ProjectsService.updateProjectFile(userId, token, projectId, filePath, content);
    
    // Sync physical workspace on disk via RuntimeManager
    const project = await ProjectsService.getProjectById(userId, token, projectId);
    await RuntimeManager.syncWorkspace(projectId, project.files || []);

    return { path: updated.path, content: updated.content };
  }

  // Delete a project file
  static async deleteFile(userId: string, token: string, projectId: string, filePath: string): Promise<boolean> {
    await ProjectsService.deleteProjectFile(userId, token, projectId, filePath);
    return true;
  }

  // Get project runtime status
  static async getProjectStatus(projectId: string): Promise<{ previewUrl: string; status: string }> {
    const previewUrl = RuntimeManager.getPreviewUrl(projectId);
    return { previewUrl, status: "ready" };
  }
}
