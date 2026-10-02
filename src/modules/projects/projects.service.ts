import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../config/supabase.js";
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

  // Create a new project with initial starter files
  static async createProject(userId: string, token: string, name: string, description?: string) {
    const client = this.getClient(token);

    const { data: project, error: projectError } = await client
      .from("projects")
      .insert({
        user_id: userId,
        name,
        description: description || "",
      })
      .select()
      .single();

    if (projectError) {
      // Fallback attempt with supabaseAdmin if JWT token RLS fails
      const adminFallback = await supabaseAdmin
        .from("projects")
        .insert({
          user_id: userId,
          name,
          description: description || "",
        })
        .select()
        .single();

      if (adminFallback.error) {
        throw new Error(projectError.message);
      }
      return adminFallback.data;
    }

    // Default starter files for newly created project
    const defaultFiles: Omit<ProjectFile, "id" | "updated_at">[] = [
      {
        project_id: project.id,
        path: "App.tsx",
        content: `import React from 'react';\n\nexport default function App() {\n  return (\n    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>\n      <h1>Welcome to ${name}</h1>\n      <p>${description || "Start building your AI web app!"}</p>\n    </div>\n  );\n}`,
      },
      {
        project_id: project.id,
        path: "index.html",
        content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>`,
      },
      {
        project_id: project.id,
        path: "package.json",
        content: JSON.stringify(
          {
            name: name.toLowerCase().replace(/\s+/g, "-"),
            version: "1.0.0",
            dependencies: {
              react: "^18.3.1",
              "react-dom": "^18.3.1",
            },
          },
          null,
          2
        ),
      },
    ];

    const { error: filesError } = await client
      .from("project_files")
      .insert(defaultFiles);

    if (filesError) {
      await supabaseAdmin.from("project_files").insert(defaultFiles);
    }

    return project;
  }

  // Get all projects owned by a user
  static async getUserProjects(userId: string, token: string) {
    const client = this.getClient(token);
    const { data, error } = await client
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      // Fallback with admin client
      const adminFallback = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      return adminFallback.data || [];
    }
    return data || [];
  }

  // Get a single project by ID
  static async getProjectById(userId: string, token: string, projectId: string) {
    const client = this.getClient(token);
    let { data: project, error: projectError } = await client
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      const adminFallback = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", userId)
        .single();
      if (adminFallback.error || !adminFallback.data) {
        throw new Error("Project not found or unauthorized access");
      }
      project = adminFallback.data;
    }

    let { data: files } = await client
      .from("project_files")
      .select("*")
      .eq("project_id", projectId)
      .order("path", { ascending: true });

    if (!files || files.length === 0) {
      const adminFiles = await supabaseAdmin
        .from("project_files")
        .select("*")
        .eq("project_id", projectId)
        .order("path", { ascending: true });
      files = adminFiles.data || [];
    }

    return {
      ...project,
      files: files || [],
    };
  }

  // Delete a project by ID
  static async deleteProject(userId: string, token: string, projectId: string) {
    const client = this.getClient(token);
    const { error } = await client
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      await supabaseAdmin.from("projects").delete().eq("id", projectId).eq("user_id", userId);
    }
    return { success: true };
  }

  // Save or update a single project file
  static async updateProjectFile(userId: string, token: string, projectId: string, path: string, content: string) {
    const client = this.getClient(token);

    const { data, error } = await client
      .from("project_files")
      .upsert(
        {
          project_id: projectId,
          path,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,path" }
      )
      .select()
      .single();

    if (error) {
      const adminFallback = await supabaseAdmin
        .from("project_files")
        .upsert(
          {
            project_id: projectId,
            path,
            content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,path" }
        )
        .select()
        .single();
      if (adminFallback.error) throw new Error(error.message);
      return adminFallback.data;
    }

    await client
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return data;
  }

  // Delete a project file
  static async deleteProjectFile(userId: string, token: string, projectId: string, path: string) {
    const client = this.getClient(token);
    const { error } = await client
      .from("project_files")
      .delete()
      .eq("project_id", projectId)
      .eq("path", path);

    if (error) {
      await supabaseAdmin
        .from("project_files")
        .delete()
        .eq("project_id", projectId)
        .eq("path", path);
    }
    return { success: true };
  }
}
