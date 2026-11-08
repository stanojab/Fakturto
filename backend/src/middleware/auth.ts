import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../db.js";

// CLIENT = user at a client company (firm_role is empty in the database)
export type Role = "ADMIN" | "ACCOUNTANT" | "CLIENT";
export type AuthUser = { id: string; role: Role };

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

// Every protected route: valid access token + the user still exists and is active
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  let userId: string | undefined;
  try {
    const payload = token ? jwt.verify(token, config.JWT_SECRET) : undefined;
    userId = typeof payload === "object" ? payload.sub : undefined;
  } catch {
    userId = undefined; // expired or forged token
  }

  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.user = { id: user.id, role: user.firmRole ?? "CLIENT" };
  next();
}

// Use after requireAuth: only the listed roles may continue, everybody else gets 403
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };

// The user set by requireAuth (routes behind requireAuth always have it)
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new Error("requireAuth must run before this route");
  return req.user;
}
