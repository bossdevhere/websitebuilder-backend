import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../config/supabase.js";
import { RuntimeManager } from "../runtime/runtime.manager.js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://kxwvdfdesqcnknfjfavd.supabase.co";

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_8CCXK_XdsYVqMc97fHi5MQ_GkKkaYxf";

export interface ProjectFile {
  id?: string;
  project_id?: string;
  path: string;
  content: string;
  updated_at?: string;
}

export class ProjectsService {
  // In-memory caches to guarantee project and file isolation across user sessions
  private static memoryProjects: Map<string, any> = new Map();
  private static memoryProjectFiles: Map<string, ProjectFile[]> = new Map();

  // Helper to create a user-authenticated Supabase client using their Bearer JWT token
  private static getClient(token?: string) {
    if (token) {
      return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    return supabaseAdmin;
  }

  // Generate clean, modern default starter code for a new project
  static getDefaultFiles(projectId: string, projectName: string = "New Project"): ProjectFile[] {
    const safeName = projectName?.trim() || "New Project";
    return [
      {
        project_id: projectId,
        path: "App.tsx",
        content: `import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Code2, Rocket, ArrowRight, CheckCircle2, Zap } from 'lucide-react';
import gsap from 'gsap';

export default function App() {
  const [count, setCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.gsap-badge', { opacity: 0, y: -16, duration: 0.6, ease: 'power2.out' });
      gsap.from('.gsap-hero', { opacity: 0, y: 24, duration: 0.8, delay: 0.15, ease: 'power3.out' });
      gsap.from('.gsap-card', { opacity: 0, scale: 0.95, duration: 0.7, delay: 0.3, stagger: 0.1, ease: 'back.out(1.4)' });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-x-hidden w-full max-w-full selection:bg-indigo-500/30 selection:text-indigo-300">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl text-white shadow-lg shadow-indigo-600/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">${safeName}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-400" /> GSAP & Tailwind Ready
          </span>
        </div>
      </header>

      {/* Hero Canvas */}
      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient Gradient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-3xl w-full text-center space-y-8 relative z-10">
          <div className="gsap-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
            <Rocket className="w-4 h-4 text-indigo-400" /> AI-Powered Next Gen Workspace
          </div>

          <div className="gsap-hero space-y-4">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
              Build stunning websites with <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">AI & GSAP</span>
            </h1>
            <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Your modern workspace is live. Describe any website, landing page, or web app to the AI assistant on the left to start generating production-ready code.
            </p>
          </div>

          {/* Interactive React State Widget */}
          <div className="gsap-card p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl max-w-md mx-auto shadow-2xl space-y-4 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <Code2 className="w-4 h-4 text-indigo-400" /> Interactive React State
              </span>
              <span className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Count: {count}</span>
            </div>
            <button
              onClick={() => setCount((c) => c + 1)}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Click to test reactivity</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Prompt Ideas */}
          <div className="pt-4 border-t border-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="gsap-card p-4 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-xl hover:border-indigo-500/40 transition-all">
              <p className="text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> SaaS Landing Page
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">Ask: "Build a sleek dark SaaS landing page with GSAP animations, pricing, and testimonials"</p>
            </div>
            <div className="gsap-card p-4 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-xl hover:border-indigo-500/40 transition-all">
              <p className="text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Modern Portfolio
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">Ask: "Create a modern developer portfolio with project showcase and smooth scroll anchors"</p>
            </div>
            <div className="gsap-card p-4 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-xl hover:border-indigo-500/40 transition-all">
              <p className="text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Coffee Roastery / E-commerce
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">Ask: "Build an artisan coffee shop website with animated menu, bento grid, and cart drawer"</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 py-4 text-center text-xs text-slate-500">
        AI Web Builder • Powered by Autonomous LLM Agent & GSAP
      </footer>
    </div>
  );
}
`,
      },
      {
        project_id: projectId,
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en" class="overflow-x-hidden scroll-smooth">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  </head>
  <body class="bg-slate-950 text-slate-100 font-sans overflow-x-hidden w-full max-w-full">
    <div id="root"></div>
  </body>
</html>`,
      },
    ];
  }

  // Create a new project with fresh default starter files
  static async createProject(userId: string, token: string, name: string, description?: string) {
    // Demo accounts are limited to exactly 1 project
    const isDemo = userId.startsWith("demo-user") || userId === "demo-guest-user";
    if (isDemo) {
      const existing = await this.getUserProjects(userId, token);
      if (existing && existing.length >= 1) {
        throw new Error(
          "Demo accounts are limited to 1 active project at a time. Sign up or log in to create unlimited projects!"
        );
      }
    }

    const client = this.getClient(token);
    let createdProject: any = null;

    try {
      const { data: project, error: projectError } = await client
        .from("projects")
        .insert({
          user_id: userId,
          name,
          description: description || "",
        })
        .select()
        .single();

      if (!projectError && project) {
        createdProject = project;
      }
    } catch (e) {}

    if (!createdProject) {
      // Fallback attempt with supabaseAdmin
      try {
        const adminFallback = await supabaseAdmin
          .from("projects")
          .insert({
            user_id: userId,
            name,
            description: description || "",
          })
          .select()
          .single();

        if (!adminFallback.error && adminFallback.data) {
          createdProject = adminFallback.data;
        }
      } catch (e) {}
    }

    if (!createdProject) {
      createdProject = {
        id: `proj-${Date.now()}`,
        user_id: userId,
        name,
        description: description || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Initialize fresh default files tailored to this project
    const defaultFiles = this.getDefaultFiles(createdProject.id, createdProject.name);

    // Save to in-memory store
    this.memoryProjects.set(createdProject.id, createdProject);
    this.memoryProjectFiles.set(createdProject.id, defaultFiles);

    // Persist default files in DB
    try {
      await client.from("project_files").upsert(defaultFiles, { onConflict: "project_id,path" });
    } catch (e) {
      try {
        await supabaseAdmin.from("project_files").upsert(defaultFiles, { onConflict: "project_id,path" });
      } catch (err) {}
    }

    // Initialize clean disk workspace
    try {
      await RuntimeManager.syncWorkspace(createdProject.id, defaultFiles);
    } catch (e) {}

    return {
      ...createdProject,
      files: defaultFiles,
    };
  }

  // Get all projects owned by a user
  static async getUserProjects(userId: string, token: string) {
    const client = this.getClient(token);
    const projectsMap = new Map<string, any>();

    // 1. Fetch from database
    try {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        data.forEach((p) => projectsMap.set(p.id, p));
      }
    } catch (e) {}

    if (projectsMap.size === 0) {
      try {
        const adminRes = await supabaseAdmin
          .from("projects")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (adminRes.data) {
          adminRes.data.forEach((p) => projectsMap.set(p.id, p));
        }
      } catch (e) {}
    }

    // 2. Merge in-memory projects for this user
    for (const [id, proj] of this.memoryProjects.entries()) {
      if (proj.user_id === userId) {
        if (!projectsMap.has(id)) {
          projectsMap.set(id, proj);
        }
      }
    }

    return Array.from(projectsMap.values());
  }

  // Get a single project by ID with isolated files
  static async getProjectById(userId: string, token: string, projectId: string) {
    const client = this.getClient(token);
    let project: any = null;

    try {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (!error && data) project = data;
    } catch (e) {}

    if (!project) {
      try {
        const globalRes = await supabaseAdmin
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();
        if (!globalRes.error && globalRes.data) {
          project = globalRes.data;
        }
      } catch (e) {}
    }

    if (!project && this.memoryProjects.has(projectId)) {
      project = this.memoryProjects.get(projectId);
    }

    if (!project) {
      project = {
        id: projectId,
        user_id: userId || "default-user",
        name: "New Project",
        description: "",
      };
    }

    let files: ProjectFile[] = [];

    // 1. Check Supabase project_files
    try {
      const { data: fileData } = await client
        .from("project_files")
        .select("*")
        .eq("project_id", projectId)
        .order("path", { ascending: true });
      if (fileData && fileData.length > 0) files = fileData;
    } catch (e) {}

    if (files.length === 0) {
      try {
        const adminFiles = await supabaseAdmin
          .from("project_files")
          .select("*")
          .eq("project_id", projectId)
          .order("path", { ascending: true });
        if (adminFiles.data && adminFiles.data.length > 0) files = adminFiles.data;
      } catch (e) {}
    }

    // 2. Check in-memory files cache
    if (files.length === 0 && this.memoryProjectFiles.has(projectId)) {
      const cached = this.memoryProjectFiles.get(projectId);
      if (cached && cached.length > 0) {
        files = cached;
      }
    }

    // 3. Check disk workspace files
    if (files.length === 0) {
      try {
        const wsDir = RuntimeManager.getWorkspacePath(projectId);
        if (fs.existsSync(wsDir)) {
          const diskFiles: ProjectFile[] = [];
          const readDirRecursive = (currentDir: string, relativeDir: string = "") => {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
              const fullPath = path.join(currentDir, entry.name);
              const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
              if (entry.isDirectory()) {
                readDirRecursive(fullPath, relPath);
              } else if (entry.isFile()) {
                const content = fs.readFileSync(fullPath, "utf-8");
                diskFiles.push({
                  project_id: projectId,
                  path: relPath,
                  content,
                });
              }
            }
          };
          readDirRecursive(wsDir);
          if (diskFiles.length > 0) {
            files = diskFiles;
          }
        }
      } catch (e) {}
    }

    // 4. If completely empty, generate fresh new default code for this project
    if (files.length === 0) {
      const defaultFiles = this.getDefaultFiles(projectId, project.name);
      files = defaultFiles;

      // Cache and persist
      this.memoryProjectFiles.set(projectId, defaultFiles);
      try {
        await supabaseAdmin.from("project_files").upsert(defaultFiles, { onConflict: "project_id,path" });
      } catch (e) {}
      try {
        await RuntimeManager.syncWorkspace(projectId, defaultFiles);
      } catch (e) {}
    } else {
      // Sync memory cache
      this.memoryProjectFiles.set(projectId, files);
    }

    return {
      ...project,
      files: files || [],
    };
  }

  // Save or update a single project file safely
  static async updateProjectFile(userId: string, token: string, projectId: string, filePath: string, content: string) {
    if (!filePath || filePath.includes("..")) {
      throw new Error("Invalid file path: path traversal detected");
    }

    // 1. Update in-memory files cache
    const currentFiles = this.memoryProjectFiles.get(projectId) || [];
    const existingIndex = currentFiles.findIndex((f) => f.path === filePath);
    const fileRecord: ProjectFile = {
      project_id: projectId,
      path: filePath,
      content,
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      currentFiles[existingIndex] = fileRecord;
    } else {
      currentFiles.push(fileRecord);
    }
    this.memoryProjectFiles.set(projectId, currentFiles);

    // 2. Update physical disk workspace
    try {
      const wsDir = RuntimeManager.getWorkspacePath(projectId);
      const absPath = path.join(wsDir, filePath);
      const parentDir = path.dirname(absPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(absPath, content, "utf-8");
    } catch (e) {}

    // 3. Persist to Supabase
    const client = this.getClient(token);
    try {
      const { data } = await client
        .from("project_files")
        .upsert(
          {
            project_id: projectId,
            path: filePath,
            content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,path" }
        )
        .select()
        .single();

      if (data) return data;
    } catch (e) {}

    try {
      const adminFallback = await supabaseAdmin
        .from("project_files")
        .upsert(
          {
            project_id: projectId,
            path: filePath,
            content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,path" }
        )
        .select()
        .single();
      if (adminFallback.data) return adminFallback.data;
    } catch (e) {}

    return fileRecord;
  }

  // Delete a project file safely
  static async deleteProjectFile(userId: string, token: string, projectId: string, filePath: string) {
    if (!filePath || filePath.includes("..")) {
      throw new Error("Invalid file path: path traversal detected");
    }

    // 1. Remove from in-memory files cache
    const currentFiles = this.memoryProjectFiles.get(projectId) || [];
    this.memoryProjectFiles.set(
      projectId,
      currentFiles.filter((f) => f.path !== filePath)
    );

    // 2. Remove from physical disk workspace
    try {
      const wsDir = RuntimeManager.getWorkspacePath(projectId);
      const absPath = path.join(wsDir, filePath);
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
    } catch (e) {}

    // 3. Delete from Supabase
    const client = this.getClient(token);
    try {
      await client.from("project_files").delete().eq("project_id", projectId).eq("path", filePath);
    } catch (e) {}

    try {
      await supabaseAdmin.from("project_files").delete().eq("project_id", projectId).eq("path", filePath);
    } catch (e) {}

    return { success: true };
  }

  // Delete a project by ID
  static async deleteProject(userId: string, token: string, projectId: string) {
    this.memoryProjects.delete(projectId);
    this.memoryProjectFiles.delete(projectId);

    const client = this.getClient(token);
    try {
      await client.from("projects").delete().eq("id", projectId);
    } catch (e) {}
    try {
      await supabaseAdmin.from("projects").delete().eq("id", projectId);
    } catch (e) {}

    // Cleanup runtime dev server and disk workspace
    try {
      RuntimeManager.stopDevServer(projectId);
      const wsDir = RuntimeManager.getWorkspacePath(projectId);
      if (fs.existsSync(wsDir)) {
        fs.rmSync(wsDir, { recursive: true, force: true });
      }
    } catch (e) {}

    return { success: true };
  }

  // Cleanup all projects for a user (used when demo user exits session)
  static async cleanupUserProjects(userId: string, token: string) {
    const userProjects = await this.getUserProjects(userId, token);
    for (const p of userProjects) {
      await this.deleteProject(userId, token, p.id);
    }
    return { success: true, count: userProjects.length };
  }

  // Claim/transfer demo projects into a registered user's account as "Demo Project 1", "Demo Project 2", etc.
  static async claimDemoProject(targetUserId: string, targetToken: string, demoToken: string) {
    if (!demoToken || !targetUserId) {
      throw new Error("Missing target user or demo token");
    }

    // Determine the demo user ID from the token
    const demoSuffix = demoToken.startsWith("demo-token-") ? demoToken.slice(11) : "guest";
    const demoUserId = `demo-user-${demoSuffix}`;

    // Get all projects created during this demo session
    const demoProjects = await this.getUserProjects(demoUserId, demoToken);
    if (!demoProjects || demoProjects.length === 0) {
      return { success: true, message: "No demo projects found to transfer", claimed: [] };
    }

    // Fetch registered user's existing projects to determine sequential numbering:
    // "Demo Project 1", "Demo Project 2", etc.
    const targetProjects = await this.getUserProjects(targetUserId, targetToken);

    let nextNum = 1;
    targetProjects.forEach((p) => {
      const match = (p.name || "").trim().match(/^demo project\s*(\d+)$/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val >= nextNum) {
          nextNum = val + 1;
        }
      }
    });

    const claimedProjects: any[] = [];

    for (const demoProj of demoProjects) {
      const newProjectName = `Demo Project ${nextNum}`;
      nextNum++;

      // 1. Get full files from the demo project
      const fullProj = await this.getProjectById(demoUserId, demoToken, demoProj.id);
      const projectFiles: ProjectFile[] = fullProj.files || [];

      // 2. Transfer ownership in-memory
      if (this.memoryProjects.has(demoProj.id)) {
        const memProj = this.memoryProjects.get(demoProj.id);
        memProj.user_id = targetUserId;
        memProj.name = newProjectName;
        memProj.updated_at = new Date().toISOString();
        this.memoryProjects.set(demoProj.id, memProj);
      } else {
        this.memoryProjects.set(demoProj.id, {
          ...demoProj,
          user_id: targetUserId,
          name: newProjectName,
          updated_at: new Date().toISOString(),
        });
      }

      if (projectFiles.length > 0) {
        this.memoryProjectFiles.set(demoProj.id, projectFiles);
      }

      // 3. Upsert into Supabase DB under targetUserId
      try {
        await supabaseAdmin.from("projects").upsert({
          id: demoProj.id,
          user_id: targetUserId,
          name: newProjectName,
          description: demoProj.description || "Transferred from demo workspace.",
          updated_at: new Date().toISOString(),
        });

        if (projectFiles.length > 0) {
          await supabaseAdmin
            .from("project_files")
            .upsert(projectFiles, { onConflict: "project_id,path" });
        }
      } catch (dbErr) {
        console.warn("[CLAIM_DEMO] Supabase upsert fallback to in-memory:", dbErr);
      }

      // 4. Ensure disk workspace exists and is synchronized
      try {
        await RuntimeManager.syncWorkspace(demoProj.id, projectFiles);
      } catch (wsErr) {}

      claimedProjects.push({
        id: demoProj.id,
        user_id: targetUserId,
        name: newProjectName,
        description: demoProj.description || "Transferred from demo workspace.",
        files: projectFiles,
      });
    }

    return {
      success: true,
      message: `Transferred ${claimedProjects.length} demo project(s) to your registered account.`,
      claimed: claimedProjects,
    };
  }
}
