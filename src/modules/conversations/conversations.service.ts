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

    try {
      let { data, error } = await client
        .from("conversations")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }

      const adminFallback = await supabaseAdmin
        .from("conversations")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });

      if (adminFallback.data && adminFallback.data.length > 0) {
        return adminFallback.data;
      }
    } catch (err) {
      console.warn("Conversations query error, using fallback thread:", err);
    }

    // Default Fallback Thread
    return [
      {
        id: projectId,
        project_id: projectId,
        user_id: userId,
        title: "Main Chat",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  // Create a new persistent conversation thread
  static async createConversation(
    userId: string,
    token: string,
    projectId: string,
    title: string = "New Chat"
  ): Promise<Conversation> {
    const client = this.getClient(token);

    try {
      const { data } = await client
        .from("conversations")
        .insert({ project_id: projectId, user_id: userId, title })
        .select()
        .single();

      if (data) return data;

      const adminFallback = await supabaseAdmin
        .from("conversations")
        .insert({ project_id: projectId, user_id: userId, title })
        .select()
        .single();

      if (adminFallback.data) return adminFallback.data;
    } catch (e) {
      console.warn("Conversations insert error, using fallback conversation object:", e);
    }

    return {
      id: projectId,
      project_id: projectId,
      user_id: userId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Get messages for a specific conversation with chat_messages fallback
  static async getConversationMessages(
    userId: string,
    token: string,
    conversationId: string,
    projectId?: string
  ): Promise<DBMessage[]> {
    const client = this.getClient(token);
    const targetProject = projectId || conversationId;

    // 1. Try querying messages table by conversation_id
    try {
      let { data, error } = await client
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {}

    // 2. Fallback: Query chat_messages table by project_id
    try {
      const { data: chatMsgs } = await supabaseAdmin
        .from("chat_messages")
        .select("*")
        .eq("project_id", targetProject)
        .order("created_at", { ascending: true });

      if (chatMsgs && chatMsgs.length > 0) {
        return chatMsgs.map((m) => ({
          id: m.id,
          conversation_id: conversationId,
          role: m.role as any,
          content: m.content,
          created_at: m.created_at,
        }));
      }
    } catch (e) {}

    return [];
  }

  // Add a message to a conversation thread with chat_messages fallback
  static async addMessage(
    conversationId: string,
    role: "user" | "assistant" | "system" | "tool",
    content: string,
    projectId?: string
  ): Promise<DBMessage> {
    const targetProject = projectId || conversationId;

    // 1. Save to messages table if present
    try {
      const { data, error } = await supabaseAdmin
        .from("messages")
        .insert({ conversation_id: conversationId, role, content })
        .select()
        .single();

      if (!error && data) {
        await supabaseAdmin
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }
    } catch (e) {}

    // 2. Always sync to chat_messages table as reliable fallback
    let fallbackResult: DBMessage | null = null;
    try {
      const { data: legacyMsg } = await supabaseAdmin
        .from("chat_messages")
        .insert({
          project_id: targetProject,
          role: role === "tool" ? "system" : role,
          content,
        })
        .select()
        .single();

      if (legacyMsg) {
        fallbackResult = {
          id: legacyMsg.id,
          conversation_id: conversationId,
          role: legacyMsg.role as any,
          content: legacyMsg.content,
          created_at: legacyMsg.created_at,
        };
      }
    } catch (e) {}

    return (
      fallbackResult || {
        id: `msg-${Date.now()}`,
        conversation_id: conversationId,
        role,
        content,
        created_at: new Date().toISOString(),
      }
    );
  }
}
