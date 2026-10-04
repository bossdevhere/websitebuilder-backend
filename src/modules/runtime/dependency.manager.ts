import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { RuntimeManager } from "./runtime.manager.js";

const execAsync = promisify(exec);

export type PackageManagerType = "npm" | "pnpm" | "yarn" | "bun";

export class DependencyManager {
  // Detect package manager from project lockfiles
  static detectPackageManager(projectId: string): PackageManagerType {
    const dir = RuntimeManager.getWorkspacePath(projectId);

    if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) return "bun";
    return "npm";
  }

  // Get list of installed dependencies from workspace package.json
  static getInstalledDependencies(projectId: string): Record<string, string> {
    const dir = RuntimeManager.getWorkspacePath(projectId);
    const pkgPath = path.join(dir, "package.json");

    if (!fs.existsSync(pkgPath)) return {};

    try {
      const content = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(content);
      return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    } catch {
      return {};
    }
  }

  // Install workspace dependencies with package manager auto-detection and retry limit
  static async installDependencies(projectId: string): Promise<{ success: boolean; output: string; error?: string }> {
    const dir = RuntimeManager.getWorkspacePath(projectId);
    const pkgManager = this.detectPackageManager(projectId);

    let installCmd = `${pkgManager} install`;
    if (pkgManager === "npm") installCmd = "npm install --legacy-peer-deps";

    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const { stdout, stderr } = await execAsync(installCmd, { cwd: dir, timeout: 60000 });
        return { success: true, output: stdout + "\n" + stderr };
      } catch (err: any) {
        retries++;
        if (retries > maxRetries) {
          return {
            success: false,
            output: err.stdout || "",
            error: `Dependency installation failed after ${maxRetries} retries: ${err.message}`,
          };
        }
      }
    }

    return { success: false, output: "", error: "Installation failed" };
  }

  // Add dependency to package.json and trigger install only if new
  static async addDependency(
    projectId: string,
    packageName: string,
    version: string = "latest"
  ): Promise<{ installed: boolean; message: string }> {
    const installedDeps = this.getInstalledDependencies(projectId);

    if (installedDeps[packageName]) {
      return { installed: false, message: `Package '${packageName}' is already installed.` };
    }

    const dir = RuntimeManager.getWorkspacePath(projectId);
    const pkgPath = path.join(dir, "package.json");
    let pkgObj: any = { name: `project-${projectId}`, version: "1.0.0", dependencies: {} };

    if (fs.existsSync(pkgPath)) {
      try {
        pkgObj = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      } catch (e) {}
    }

    if (!pkgObj.dependencies) pkgObj.dependencies = {};
    pkgObj.dependencies[packageName] = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkgObj, null, 2), "utf-8");

    const result = await this.installDependencies(projectId);
    if (!result.success) {
      throw new Error(result.error || `Failed to install dependency ${packageName}`);
    }

    return { installed: true, message: `Successfully installed ${packageName}` };
  }

  // Check if package.json dependencies changed and run install if required
  static async checkAndSyncDependencies(
    projectId: string,
    oldPkgJson: string,
    newPkgJson: string
  ): Promise<boolean> {
    try {
      const oldDeps = Object.keys(JSON.parse(oldPkgJson).dependencies || {});
      const newDeps = Object.keys(JSON.parse(newPkgJson).dependencies || {});

      const hasNewDep = newDeps.some((dep) => !oldDeps.includes(dep));
      if (hasNewDep) {
        await this.installDependencies(projectId);
        return true;
      }
    } catch (e) {}
    return false;
  }
}
