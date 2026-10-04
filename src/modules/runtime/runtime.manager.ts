import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface WorkspaceFile {
  path: string;
  content: string;
}

export class RuntimeManager {
  private static baseDir = path.resolve(process.cwd(), "workspaces");
  private static activeServers: Map<string, any> = new Map();

  // Get physical disk path for a project workspace
  static getWorkspacePath(projectId: string): string {
    const dir = path.join(this.baseDir, `project-${projectId}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  // Sync project files from database to physical disk workspace
  static async syncWorkspace(projectId: string, files: WorkspaceFile[]): Promise<string> {
    const dir = this.getWorkspacePath(projectId);

    for (const file of files) {
      const filePath = path.join(dir, file.path);
      const parentDir = path.dirname(filePath);

      // Prevent path traversal outside workspace
      if (!filePath.startsWith(dir)) {
        throw new Error("Path traversal prohibited");
      }

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(filePath, file.content, "utf-8");
    }

    return dir;
  }

  // Get active preview URL for a project workspace
  static getPreviewUrl(projectId: string): string {
    return `/api/runtime/projects/${projectId}/preview`;
  }

  // Run CLI command inside workspace
  static async runCommand(projectId: string, command: string): Promise<{ stdout: string; stderr: string }> {
    const dir = this.getWorkspacePath(projectId);
    const { stdout, stderr } = await execAsync(command, { cwd: dir, timeout: 30000 });
    return { stdout, stderr };
  }
}
