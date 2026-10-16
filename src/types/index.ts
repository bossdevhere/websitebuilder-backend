import { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    is_demo?: boolean;
    [key: string]: any;
  };
  is_demo?: boolean;
  [key: string]: any;
}

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export interface ProjectDto {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  files?: ProjectFileDto[];
}

export interface ProjectFileDto {
  id?: string;
  project_id?: string;
  path: string;
  content: string;
  updated_at?: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
  timestamp?: string;
}
