import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

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
