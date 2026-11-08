import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { prisma } from "../db.js";
import { createWorld, type World } from "../test/fixtures.js";

let w: World;
let ids: { late: string; soon: string; noDate: string; other: string };

beforeAll(async () => {
  w = await createWorld();
  const ready = (clientId: string, data: object) => w.invoice(clientId, "READY_FOR_PAYMENT", data);
  const second = await prisma.client.create({
    data: {
      name: `Fixture second ${w.clientA.id.slice(0, 8)}`,
      taxNumber: String(10_000_000 + Math.floor(Math.random() * 90_000_000)),
      address: "Testna ulica 2",
      iban: "SI56011001000012345",
      slug: `fixture-second-${w.clientA.id}`,
      assignments: { create: { accountantId: w.accountant.id } },
    },
  });
  ids = {
    soon: (
      await ready(w.clientA.id, {
        issuerName: "Elektro d.o.o.",
        dueDate: new Date("2026-12-20"),
        paymentReference: "SI12 777",
      })
    ).id,
    late: (await ready(second.id, { issuerName: "Voda d.o.o.", dueDate: new Date("2026-01-10") }))
      .id,
    noDate: (await ready(w.clientA.id, { issuerName: "Brez roka d.o.o." })).id,
    other: (
      await ready(w.clientB.id, { issuerName: "Tuja d.o.o.", dueDate: new Date("2026-01-01") })
    ).id,
  };
  // cleanup() removes only the world's clients – remove the second client's data ourselves
  w.cleanup = ((original) => async () => {
    await prisma.invoice.deleteMany({ where: { clientId: second.id } });
    await prisma.accountantAssignment.deleteMany({ where: { clientId: second.id } });
    await prisma.client.delete({ where: { id: second.id } });
    await original();
  })(w.cleanup);
});

afterAll(async () => {
  await w.cleanup();
  await prisma.$disconnect();
});

const list = (query: string) =>
  request(app)
    .get(`/api/invoices?status=READY_FOR_PAYMENT&sort=dueDate&${query}`)
    .set("Authorization", w.auth(w.accountant));
const idsOf = (res: request.Response) => res.body.items.map((i: { id: string }) => i.id);

describe("GET /api/invoices – list for payment", () => {
  it("lists only assigned clients, sorted by due date (no date last)", async () => {
    const res = await list("pageSize=100");

    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([ids.late, ids.soon, ids.noDate]);
    expect(idsOf(res)).not.toContain(ids.other);
  });

  it("filters by client", async () => {
    const res = await list(`clientId=${w.clientA.id}`);
    expect(idsOf(res)).toEqual([ids.soon, ids.noDate]);
  });

  it("searches by issuer and by payment reference", async () => {
    expect(idsOf(await list("search=voda"))).toEqual([ids.late]);
    expect(idsOf(await list("search=777"))).toEqual([ids.soon]);
  });

  it("pages the results", async () => {
    const res = await list("pageSize=2&page=2");
    expect(res.body.total).toBe(3);
    expect(res.body.totalPages).toBe(2);
    expect(idsOf(res)).toEqual([ids.noDate]);
  });

  it("does not include invoices in other statuses", async () => {
    const res = await list("pageSize=100");
    expect(idsOf(res)).not.toContain(w.invoiceA.id); // IN_REVIEW
  });
});
