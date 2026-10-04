import { supabaseAdmin } from "../../config/supabase.js";
import { createClient } from "@supabase/supabase-js";
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

export interface Conversation {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DBMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at: string;
}

export class ConversationsService {
  private static getClient(token?: string) {
    if (token) {
      return createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return supabaseAdmin;
  }

  // Get or auto-create initial conversation for a project
  static async getProjectConversations(userId: string, token: string, projectId: string): Promise<Conversation[]> {
    const client = this.getClient(token);

    let { data, error } = await client
      .from("conversations")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    if (error || !data) {
      const adminFallback = await supabaseAdmin
        .from("conversations")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });
      data = adminFallback.data || [];
    }

    // Auto-create initial conversation if project has no conversations yet
    if (data.length === 0) {
      const initial = await this.createConversation(userId, token, projectId, "Initial Chat");
      return [initial];
    }

    return data;
  }

  // Create a new persistent conversation thread
  static async createConversation(
    userId: string,
    token: string,
    projectId: string,
    title: string = "New Chat"
  ): Promise<Conversation> {
    const client = this.getClient(token);

    const { data, error } = await client
      .from("conversations")
      .insert({ project_id: projectId, user_id: userId, title })
      .select()
      .single();

    if (error || !data) {
      const adminFallback = await supabaseAdmin
        .from("conversations")
        .insert({ project_id: projectId, user_id: userId, title })
        .select()
        .single();
      if (adminFallback.error || !adminFallback.data) {
        throw new Error(error?.message || adminFallback.error?.message || "Failed to create conversation");
      }
      return adminFallback.data;
    }

    return data;
  }

  // Get messages for a specific conversation
  static async getConversationMessages(userId: string, token: string, conversationId: string): Promise<DBMessage[]> {
    const client = this.getClient(token);

    let { data, error } = await client
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      const adminFallback = await supabaseAdmin
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      data = adminFallback.data || [];
    }

    return data;
  }

  // Add a message to a conversation thread
  static async addMessage(
    conversationId: string,
    role: "user" | "assistant" | "system" | "tool",
    content: string
  ): Promise<DBMessage> {
    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({ conversation_id: conversationId, role, content })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to persist message");
    }

    // Touch conversation updated_at timestamp
    await supabaseAdmin
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return data;
  }
}
