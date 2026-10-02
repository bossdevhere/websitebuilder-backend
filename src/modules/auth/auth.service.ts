import { supabase } from "../../config/supabase.js";

export class AuthService {
  static async signup(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
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
    const { error } = await supabase.auth.admin.signOut(accessToken);
    if (error) {
      // Fallback signout
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
