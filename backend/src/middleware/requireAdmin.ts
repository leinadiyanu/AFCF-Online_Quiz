import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

export interface AdminRequest extends Request {
  admin?: { id: string; email: string; role: string };
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: "Admin authentication required" });

  try {
    req.admin = jwt.verify(token, JWT_SECRET) as AdminRequest["admin"];
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired admin token" });
  }
}

export { JWT_SECRET };