import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { Router, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import type { User } from "../generated/prisma/client.js";

export const authRouter = Router();

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const REFRESH_COOKIE = "refresh_token";
// Always the same message, so nobody can find out which emails exist
export const INVALID_LOGIN = "Napačna e-pošta ali geslo";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

// Only the SHA-256 hash of a refresh token is stored in the database
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// For unknown emails we still verify against a dummy hash, so the response takes as long as for a real user
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= argon2.hash("dummy-password-for-timing"));

async function passwordMatches(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // not a valid Argon2 hash (e.g. seed users without a password)
  }
}

const publicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  firmRole: user.firmRole,
});

export const signAccessToken = (user: User) =>
  jwt.sign({ sub: user.id, firmRole: user.firmRole }, config.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

const cookieOptions = {
  httpOnly: true, // JavaScript in the browser cannot read it
  sameSite: "strict" as const,
  secure: config.NODE_ENV === "production", // HTTPS only in production
  path: "/api/auth", // the browser sends it only to the auth endpoints
};

// Creates a new refresh token, stores its hash and puts the token itself into the cookie
async function issueRefreshToken(res: Response, userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
}

const revokeAllTokens = (userId: string) =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

// POST /api/auth/login – email + password → access token (JSON) and refresh token (cookie)
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user
    ? await passwordMatches(user.passwordHash, password)
    : await passwordMatches(await getDummyHash(), password).then(() => false);

  // A deactivated user gets the same message as a wrong password
  if (!user || !valid || !user.isActive) {
    res.status(401).json({ error: INVALID_LOGIN });
    return;
  }

  await issueRefreshToken(res, user.id);
  res.json({ accessToken: signAccessToken(user), user: publicUser(user) });
});

// POST /api/auth/refresh – valid refresh cookie → new access token and a new refresh token (rotation)
authRouter.post("/refresh", async (req, res) => {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];
  const stored =
    typeof token === "string"
      ? await prisma.refreshToken.findUnique({
          where: { tokenHash: sha256(token) },
          include: { user: true },
        })
      : null;

  const usable =
    stored && !stored.revokedAt && stored.expiresAt > new Date() && stored.user.isActive;
  if (!stored || !usable) {
    // a deactivated user loses all sessions
    if (stored && !stored.user.isActive) await revokeAllTokens(stored.userId);
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Revoke the old token; if two requests race, only one of them wins
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  await issueRefreshToken(res, stored.userId);
  res.json({ accessToken: signAccessToken(stored.user), user: publicUser(stored.user) });
});

// POST /api/auth/logout – revoke the refresh token and delete the cookie
authRouter.post("/logout", async (req, res) => {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];
  if (typeof token === "string") {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.status(204).end();
});
