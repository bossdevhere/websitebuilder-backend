import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

export class AuthController {
  static async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }
      const data = await AuthService.signup(email, password, name);
      res.status(201).json({
        message: "User registered successfully",
        user: data.user,
        session: data.session,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Signup failed" });
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }
      const data = await AuthService.login(email, password);
      res.status(200).json({
        message: "Login successful",
        user: data.user,
        session: data.session,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message || "Invalid credentials" });
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await AuthService.getUserProfile(req.user);
      res.status(200).json({ user: profile });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error: any) {
      res.status(500).json({ error: "Logout failed" });
    }
  }
}
