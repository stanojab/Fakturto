import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { INVALID_LOGIN, REFRESH_COOKIE } from "./auth.js";

const PASSWORD = "Testno-geslo-123";
const activeEmail = `vitest-${randomUUID()}@fakturko.test`;
const inactiveEmail = `vitest-${randomUUID()}@fakturko.test`;

// Returns the refresh cookie ("refresh_token=…") from a response, if it was set
const refreshCookie = (res: request.Response) => {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  return cookies?.find(
    (c) => c.startsWith(`${REFRESH_COOKIE}=`) && !c.startsWith(`${REFRESH_COOKIE}=;`),
  );
};

const login = (email: string, password: string) =>
  request(app).post("/api/auth/login").send({ email, password });

beforeAll(async () => {
  const passwordHash = await argon2.hash(PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: activeEmail, passwordHash, fullName: "Vitest Aktiven", firmRole: "ACCOUNTANT" },
      { email: inactiveEmail, passwordHash, fullName: "Vitest Neaktiven", isActive: false },
    ],
  });
});

// After all tests: remove ONLY the users (and their tokens) the tests created
afterAll(async () => {
  const where = { email: { in: [activeEmail, inactiveEmail] } };
  await prisma.refreshToken.deleteMany({ where: { user: where } });
  await prisma.user.deleteMany({ where });
  await prisma.$disconnect();
});

describe("POST /api/auth/login", () => {
  it("returns an access token and sets an httpOnly refresh cookie", async () => {
    const res = await login(activeEmail.toUpperCase(), PASSWORD); // email is case-insensitive

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: activeEmail, firmRole: "ACCOUNTANT" });
    expect(res.body.user.passwordHash).toBeUndefined();

    const payload = jwt.verify(res.body.accessToken, config.JWT_SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe(res.body.user.id);
    expect(payload.exp! - payload.iat!).toBe(15 * 60); // valid for 15 minutes

    const cookie = refreshCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it("gives the same message for a wrong password and an unknown email", async () => {
    const wrongPassword = await login(activeEmail, "napacno-geslo-123");
    const unknownEmail = await login(`nobody-${randomUUID()}@fakturko.test`, PASSWORD);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({ error: INVALID_LOGIN });
    expect(unknownEmail.body).toEqual({ error: INVALID_LOGIN });
    expect(refreshCookie(wrongPassword)).toBeUndefined();
  });

  it("does not let a deactivated user log in", async () => {
    const res = await login(inactiveEmail, PASSWORD);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: INVALID_LOGIN });
  });

  it("returns 400 when the password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: activeEmail });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/refresh and /api/auth/logout", () => {
  it("rotates the refresh token: the new one works, the old one is revoked", async () => {
    const first = refreshCookie(await login(activeEmail, PASSWORD))!;

    const refreshed = await request(app).post("/api/auth/refresh").set("Cookie", first);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    const second = refreshCookie(refreshed)!;
    expect(second).not.toBe(first);

    const reused = await request(app).post("/api/auth/refresh").set("Cookie", first);
    expect(reused.status).toBe(401);

    const again = await request(app).post("/api/auth/refresh").set("Cookie", second);
    expect(again.status).toBe(200);
  });

  it("returns 401 without a refresh cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");

    expect(res.status).toBe(401);
  });

  it("revokes the refresh token on logout", async () => {
    const cookie = refreshCookie(await login(activeEmail, PASSWORD))!;

    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(204);

    const refresh = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(refresh.status).toBe(401);
  });

  it("revokes all sessions of a user who was deactivated after logging in", async () => {
    const cookie = refreshCookie(await login(activeEmail, PASSWORD))!;
    await prisma.user.update({ where: { email: activeEmail }, data: { isActive: false } });

    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);

    expect(res.status).toBe(401);
    const open = await prisma.refreshToken.count({
      where: { user: { email: activeEmail }, revokedAt: null },
    });
    expect(open).toBe(0);
    await prisma.user.update({ where: { email: activeEmail }, data: { isActive: true } });
  });
});
