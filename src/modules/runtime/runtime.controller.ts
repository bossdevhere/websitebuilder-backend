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
        try {
          const project = await ProjectsService.getProjectById("admin", "", projectId);
          if (project && project.files && project.files.length > 0) {
            await RuntimeManager.syncWorkspace(projectId, project.files);
          }
        } catch (dbErr: any) {
          console.warn("[RuntimeController] DB Sync fallback:", dbErr.message);
        }
      }

      if (!fs.existsSync(filePath)) {
        filePath = path.join(workspaceDir, "index.html");
      }

      // If index.html still doesn't exist on disk, create default HTML template
      if (!fs.existsSync(filePath)) {
        const defaultHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Website Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script>
      window.exports = {};
      window.module = { exports: window.exports };
      window.require = function(m) {
        if (m === 'react') return window.React;
        if (m === 'react-dom' || m === 'react-dom/client') return window.ReactDOM;
        return window.exports;
      };
    </script>
  </head>
  <body class="bg-slate-900 text-slate-100 font-sans min-h-screen">
    <div id="root"></div>
    <script type="text/babel">
      function App() {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
            <h1 className="text-3xl font-bold text-indigo-400 mb-4">Web Application Preview</h1>
            <p className="text-slate-300 max-w-md">Your project workspace is ready. Use the AI Agent Assistant on the left to generate and modify components!</p>
          </div>
        );
      }
      ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    </script>
  </body>
</html>`;
        fs.mkdirSync(workspaceDir, { recursive: true });
        fs.writeFileSync(filePath, defaultHtml, "utf-8");
      }

      res.sendFile(filePath);
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
