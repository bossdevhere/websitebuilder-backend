import { supabase } from "../../config/supabase.js";

export interface ProjectFile {
  id?: string;
  project_id?: string;
  path: string;
  content: string;
  updated_at?: string;
}

export class ProjectsService {
  // Create a new project with initial starter files (e.g. App.tsx, index.html, package.json)
  static async createProject(userId: string, name: string, description?: string) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        name,
        description: description || "",
      })
      .select()
      .single();

    if (projectError) {
      throw new Error(projectError.message);
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

    const { error: filesError } = await supabase
      .from("project_files")
      .insert(defaultFiles);

    if (filesError) {
      console.error("Failed to insert default starter files:", filesError.message);
    }

    return project;
  }

  // Get all projects owned by a user
  static async getUserProjects(userId: string) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return data || [];
  }

  // Get a single project by ID (verifying ownership)
  static async getProjectById(userId: string, projectId: string) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      throw new Error("Project not found or unauthorized access");
    }

    const { data: files, error: filesError } = await supabase
      .from("project_files")
      .select("*")
      .eq("project_id", projectId)
      .order("path", { ascending: true });

    if (filesError) {
      throw new Error(filesError.message);
    }

    return {
      ...project,
      files: files || [],
    };
  }

  // Delete a project by ID
  static async deleteProject(userId: string, projectId: string) {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
    return { success: true };
  }

  // Save or update a single project file
  static async updateProjectFile(userId: string, projectId: string, path: string, content: string) {
    // Verify ownership
    await this.getProjectById(userId, projectId);

    const { data, error } = await supabase
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
      throw new Error(error.message);
    }

    // Touch project updated_at timestamp
    await supabase
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return data;
  }

  // Delete a project file
  static async deleteProjectFile(userId: string, projectId: string, path: string) {
    // Verify ownership
    await this.getProjectById(userId, projectId);

    const { error } = await supabase
      .from("project_files")
      .delete()
      .eq("project_id", projectId)
      .eq("path", path);

    if (error) {
      throw new Error(error.message);
    }
    return { success: true };
  }
}
