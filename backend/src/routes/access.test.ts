import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { prisma } from "../db.js";
import { createWorld, type World } from "../test/fixtures.js";

let w: World;

beforeAll(async () => {
  w = await createWorld();
});

afterAll(async () => {
  await w.cleanup();
  await prisma.$disconnect();
});

const ids = (res: request.Response) => res.body.items.map((i: { id: string }) => i.id);

describe("authentication", () => {
  it("returns 401 without an access token", async () => {
    expect((await request(app).get("/api/invoices")).status).toBe(401);
    expect((await request(app).get("/api/clients")).status).toBe(401);
  });

  it("returns 401 for a forged token", async () => {
    const res = await request(app).get("/api/invoices").set("Authorization", "Bearer abc.def.ghi");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a user deactivated after the token was issued", async () => {
    const u = await w.user("deactivated", "ACCOUNTANT");
    const header = w.auth(u);
    await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });

    const res = await request(app).get("/api/invoices").set("Authorization", header);
    expect(res.status).toBe(401);
  });
});

describe("client user", () => {
  it("sees only invoices of their own companies", async () => {
    const res = await request(app)
      .get("/api/invoices?pageSize=100")
      .set("Authorization", w.auth(w.clientUser));

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([w.invoiceA.id]);
  });

  it("gets 404 for an invoice of another company", async () => {
    const other = await request(app)
      .get(`/api/invoices/${w.invoiceB.id}`)
      .set("Authorization", w.auth(w.clientUser));
    const own = await request(app)
      .get(`/api/invoices/${w.invoiceA.id}`)
      .set("Authorization", w.auth(w.clientUser));

    expect(other.status).toBe(404);
    expect(own.status).toBe(200);
  });

  it("sees only their own companies and cannot create clients", async () => {
    const list = await request(app)
      .get("/api/clients?pageSize=100")
      .set("Authorization", w.auth(w.clientUser));
    const create = await request(app)
      .post("/api/clients")
      .set("Authorization", w.auth(w.clientUser))
      .send({});

    expect(ids(list)).toEqual([w.clientA.id]);
    expect(create.status).toBe(403);
  });
});

describe("accountant", () => {
  it("sees invoices of assigned clients only", async () => {
    const res = await request(app)
      .get(`/api/invoices?clientId=${w.clientA.id}`)
      .set("Authorization", w.auth(w.accountant));
    const other = await request(app)
      .get(`/api/invoices/${w.invoiceB.id}`)
      .set("Authorization", w.auth(w.accountant));

    expect(ids(res)).toEqual([w.invoiceA.id]);
    expect(other.status).toBe(404);
  });

  it("cannot deactivate a client", async () => {
    const res = await request(app)
      .delete(`/api/clients/${w.clientA.id}`)
      .set("Authorization", w.auth(w.accountant));
    expect(res.status).toBe(403);
  });
});

describe("administrator", () => {
  it("sees invoices of every client", async () => {
    const a = await request(app)
      .get(`/api/invoices/${w.invoiceA.id}`)
      .set("Authorization", w.auth(w.admin));
    const b = await request(app)
      .get(`/api/invoices/${w.invoiceB.id}`)
      .set("Authorization", w.auth(w.admin));

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body.client.id).toBe(w.clientB.id);
  });
});
