import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { prisma } from "../db.js";

const PREFIX = "VITEST ";
const randomTaxNumber = () => String(10_000_000 + Math.floor(Math.random() * 90_000_000));
const validClient = () => ({
  name: `${PREFIX}d.o.o.`,
  taxNumber: randomTaxNumber(),
  address: "Testna ulica 1, 1000 Ljubljana",
  iban: "SI56 0110 0100 0012 345",
  paymentMode: "ACCOUNTANT_PAYS",
});

// After all tests: remove ONLY the clients the tests created, then close the connection
afterAll(async () => {
  await prisma.client.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("POST /api/clients", () => {
  it("creates a client and normalizes the IBAN", async () => {
    const res = await request(app).post("/api/clients").send(validClient());

    expect(res.status).toBe(201);
    expect(res.body.iban).toBe("SI56011001000012345");
    expect(res.body.isActive).toBe(true);
  });

  it("rejects an invalid tax number with 400", async () => {
    const res = await request(app)
      .post("/api/clients")
      .send({ ...validClient(), taxNumber: "123" });

    expect(res.status).toBe(400);
    expect(res.body.details.taxNumber).toBeDefined();
  });

  it("rejects a non-Slovenian IBAN with 400", async () => {
    const res = await request(app)
      .post("/api/clients")
      .send({ ...validClient(), iban: "DE89370400440532013000" });

    expect(res.status).toBe(400);
    expect(res.body.details.iban).toBeDefined();
  });

  it("returns 409 for a duplicate tax number", async () => {
    const body = validClient();
    await request(app).post("/api/clients").send(body).expect(201);

    const res = await request(app).post("/api/clients").send(body);
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/clients/:id", () => {
  it("updates only the fields that were sent", async () => {
    const created = await request(app).post("/api/clients").send(validClient());

    const res = await request(app)
      .patch(`/api/clients/${created.body.id}`)
      .send({ address: "Nova ulica 2, 2000 Maribor" });

    expect(res.status).toBe(200);
    expect(res.body.address).toBe("Nova ulica 2, 2000 Maribor");
    expect(res.body.taxNumber).toBe(created.body.taxNumber);
  });
});

describe("DELETE /api/clients/:id", () => {
  it("deactivates the client instead of deleting it", async () => {
    const created = await request(app).post("/api/clients").send(validClient());
    const { id, taxNumber } = created.body;

    await request(app).delete(`/api/clients/${id}`).expect(204);

    // It disappears from the normal list ...
    const list = await request(app).get("/api/clients").query({ search: taxNumber });
    expect(list.body.total).toBe(0);

    // ... but it is still in the database, with is_active = false
    const row = await prisma.client.findUnique({ where: { id } });
    expect(row?.isActive).toBe(false);
  });

  it("returns 404 for an unknown client", async () => {
    await request(app).delete(`/api/clients/${randomUUID()}`).expect(404);
  });
});
