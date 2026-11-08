import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { prisma } from "../db.js";
import { todayInSlovenia } from "../invoiceData.js";
import { createWorld, type World } from "../test/fixtures.js";

let w: World;
beforeAll(async () => {
  w = await createWorld();
});
afterAll(async () => {
  await w.cleanup();
  await prisma.$disconnect();
});

const ready = () => w.invoice(w.clientA.id, "READY_FOR_PAYMENT", { issuerName: "Dobavitelj" });
const markPaid = (id: string, auth: string) =>
  request(app).post(`/api/invoices/${id}/mark-paid`).set("Authorization", auth);

describe("POST /api/invoices/:id/mark-paid", () => {
  it("marks the invoice as paid and saves the bank confirmation", async () => {
    const inv = await ready();
    const pdf = Buffer.from("%PDF-1.4\n% potrdilo banke\n");

    const res = await markPaid(inv.id, w.auth(w.accountant))
      .field("paidOn", "2026-11-03")
      .attach("file", pdf, { filename: "potrdilo.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PAID");
    const saved = await prisma.invoice.findUniqueOrThrow({
      where: { id: inv.id },
      include: { documents: true },
    });
    expect(saved.paidOn!.toISOString().slice(0, 10)).toBe("2026-11-03");
    expect(saved.paidById).toBe(w.accountant.id);
    expect(saved.documents.map((d) => d.kind)).toEqual(["PAYMENT_CONFIRMATION"]);
  });

  it("works without a confirmation (JSON) and accepts today", async () => {
    const inv = await ready();
    const res = await markPaid(inv.id, w.auth(w.admin)).send({ paidOn: todayInSlovenia() });
    expect(res.status).toBe(200);
  });

  it("requires a payment date that is not in the future", async () => {
    const inv = await ready();

    const missing = await markPaid(inv.id, w.auth(w.accountant)).send({});
    const future = await markPaid(inv.id, w.auth(w.accountant)).send({ paidOn: "2999-01-01" });

    expect(missing.status).toBe(400);
    expect(missing.body.details.paidOn).toEqual(["Obvezen podatek"]);
    expect(future.status).toBe(400);
    expect(future.body.details.paidOn).toEqual(["Datum plačila ne sme biti v prihodnosti"]);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe(
      "READY_FOR_PAYMENT",
    );
  });

  it("returns 409 for an invoice that was not reviewed yet", async () => {
    const res = await markPaid(w.invoiceA.id, w.auth(w.accountant)).send({ paidOn: "2026-11-01" });
    expect(res.status).toBe(409);
  });

  it("does not let a client user mark an invoice as paid (403)", async () => {
    const inv = await ready();
    const res = await markPaid(inv.id, w.auth(w.clientUser)).send({ paidOn: "2026-11-01" });
    expect(res.status).toBe(403);
  });

  it("shows the client the payment date and removes the invoice from the payment list", async () => {
    const inv = await ready();
    await markPaid(inv.id, w.auth(w.accountant)).send({ paidOn: "2026-11-02" });

    const mine = await request(app)
      .get("/api/invoices?status=PAID&pageSize=100")
      .set("Authorization", w.auth(w.clientUser));
    const toPay = await request(app)
      .get("/api/invoices?status=READY_FOR_PAYMENT&pageSize=100")
      .set("Authorization", w.auth(w.accountant));

    const paid = mine.body.items.find((i: { id: string }) => i.id === inv.id);
    expect(paid.paidOn.slice(0, 10)).toBe("2026-11-02");
    expect(toPay.body.items.map((i: { id: string }) => i.id)).not.toContain(inv.id);
  });
});
