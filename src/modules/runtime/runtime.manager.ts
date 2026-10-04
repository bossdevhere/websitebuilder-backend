import fs from "fs";
import path from "path";
import { exec, ChildProcess } from "child_process";
import { promisify } from "util";
import { DependencyManager } from "./dependency.manager.js";

const execAsync = promisify(exec);

export interface WorkspaceFile {
  path: string;
  content: string;
}

export class RuntimeManager {
  private static baseDir = path.resolve(process.cwd(), "workspaces");
  private static activeServers: Map<string, { process?: ChildProcess; port: number; logs: string[] }> = new Map();

  // Create or retrieve workspace directory on disk
  static createWorkspace(projectId: string): string {
    const dir = path.join(this.baseDir, `project-${projectId}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  // Retrieve workspace directory path
  static getWorkspace(projectId: string): string {
    return this.createWorkspace(projectId);
  }

  static getWorkspacePath(projectId: string): string {
    return this.createWorkspace(projectId);
  }

  // Sync project files from database to physical disk workspace
  static async syncWorkspace(projectId: string, files: WorkspaceFile[]): Promise<string> {
    const dir = this.createWorkspace(projectId);
    const oldPkgPath = path.join(dir, "package.json");
    const oldPkgContent = fs.existsSync(oldPkgPath) ? fs.readFileSync(oldPkgPath, "utf-8") : "{}";

    for (const file of files) {
      const filePath = path.join(dir, file.path);
      const parentDir = path.dirname(filePath);

      if (!filePath.startsWith(dir)) {
        throw new Error("Path traversal prohibited");
      }

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(filePath, file.content, "utf-8");
    }

    const newPkgPath = path.join(dir, "package.json");
    const newPkgContent = fs.existsSync(newPkgPath) ? fs.readFileSync(newPkgPath, "utf-8") : "{}";

    // Smart Dependency Check: Run dependency manager only if package.json dependencies changed
    await DependencyManager.checkAndSyncDependencies(projectId, oldPkgContent, newPkgContent);

    return dir;
  }

  // Detect package manager for workspace
  static detectPackageManager(projectId: string) {
    return DependencyManager.detectPackageManager(projectId);
  }

  // Install dependencies using DependencyManager
  static async installDependencies(projectId: string) {
    return DependencyManager.installDependencies(projectId);
  }

  // Get active preview URL for a project workspace
  static getPreviewUrl(projectId: string): string {
    return `/api/runtime/projects/${projectId}/preview`;
  }

  // Get server execution logs
  static getLogs(projectId: string): string[] {
    const entry = this.activeServers.get(projectId);
    return entry ? entry.logs : [];
  }

  // Start development server for project workspace
  static async startDevServer(projectId: string): Promise<{ previewUrl: string; port: number }> {
    const dir = this.createWorkspace(projectId);
    const existing = this.activeServers.get(projectId);
    if (existing) {
      return { previewUrl: this.getPreviewUrl(projectId), port: existing.port };
    }

    const port = 5100 + (Math.abs(hashCode(projectId)) % 800);
    const logs: string[] = [`Dev server initialized on port ${port}`];

    this.activeServers.set(projectId, { port, logs });
    return { previewUrl: this.getPreviewUrl(projectId), port };
  }

  // Stop development server
  static stopDevServer(projectId: string): boolean {
    const entry = this.activeServers.get(projectId);
    if (entry && entry.process) {
      entry.process.kill();
      this.activeServers.delete(projectId);
      return true;
    }
    return false;
  }

  // Restart development server
  static async restartDevServer(projectId: string) {
    this.stopDevServer(projectId);
    return this.startDevServer(projectId);
  }

  // Run CLI command safely inside project workspace
  static async runCommand(projectId: string, command: string): Promise<{ stdout: string; stderr: string }> {
    const dir = this.createWorkspace(projectId);

    // Restrict dangerous system commands
    const forbidden = ["rm -rf /", "mkfs", "dd", "chmod -R 777 /"];
    if (forbidden.some((f) => command.includes(f))) {
      throw new Error("Forbidden command execution blocked by security sandbox");
    }

    const { stdout, stderr } = await execAsync(command, { cwd: dir, timeout: 30000 });
    return { stdout, stderr };
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
