import { Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";
import { AuthenticatedRequest } from "../types/index.js";

export { AuthenticatedRequest };

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({ error: "Missing or invalid authorization token" });
      return;
    }

    // Handle demo guest token seamlessly without external auth calls
    if (token.startsWith("demo-token-") || token === "demo-guest-token") {
      const demoSuffix = token.startsWith("demo-token-") ? token.slice(11) : "guest";
      req.user = {
        id: `demo-user-${demoSuffix}`,
        email: "demo@aiwebstudio.dev",
        user_metadata: { name: "Demo User", is_demo: true },
        is_demo: true,
      };
      return next();
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired access token" });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: "Internal server error during authentication" });
  }
}
