import { supabase, supabaseAdmin } from "../../config/supabase.js";

export class AuthService {
  static async signup(email: string, password: string, name?: string) {
    try {
      // Create user via admin API to auto-confirm email for seamless dev experience
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (error) {
        // Fallback to standard signUp
        const fallback = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (fallback.error) throw new Error(fallback.error.message);
        return fallback.data;
      }
      return data;
    } catch (err: any) {
      // Standard signup fallback if admin API fails
      const fallback = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (fallback.error) throw new Error(fallback.error.message);
      return fallback.data;
    }
  }

  static async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  static async logout(accessToken: string) {
    try {
      await supabase.auth.admin.signOut(accessToken);
    } catch (err) {
      await supabase.auth.signOut();
    }
    return { success: true };
  }

  static async getUserProfile(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split("@")[0],
      created_at: user.created_at,
    };
  }
}
