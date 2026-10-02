import { supabase, supabaseAdmin } from "../../config/supabase.js";

export class AuthService {
  static async signup(email: string, password: string, name?: string) {
    // 1. Create user with auto-confirmed email using admin client
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email.split("@")[0] },
    });

    if (createError) {
      // Fallback if admin API fails or user already exists
      const { data: fallbackData, error: fallbackError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (fallbackError) throw new Error(fallbackError.message);

      // Attempt instant login
      const loginAttempt = await supabase.auth.signInWithPassword({ email, password });
      return {
        user: fallbackData.user,
        session: loginAttempt.data?.session || fallbackData.session,
      };
    }

    // 2. Direct login to generate active session for immediate frontend access
    const { data: sessionData } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      user: createData.user,
      session: sessionData?.session || null,
    };
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
