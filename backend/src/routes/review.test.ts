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

const data = {
  issuerName: "Dobavitelj d.o.o.",
  issuerIban: "SI56 2633 0001 2039 086",
  amount: "1240,50",
  dueDate: "2026-12-01",
  paymentReference: "SI12 2026-15",
};

const confirm = (id: string, auth: string, body: object = data) =>
  request(app).post(`/api/invoices/${id}/confirm`).set("Authorization", auth).send(body);

describe("POST /api/invoices/:id/confirm", () => {
  it("saves the data, sets READY_FOR_PAYMENT and the reviewer", async () => {
    const inv = await w.invoice(w.clientA.id);

    const res = await confirm(inv.id, w.auth(w.accountant));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("READY_FOR_PAYMENT");
    const saved = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(saved.amount!.toFixed(2)).toBe("1240.50"); // exact Decimal(12,2), no float rounding
    expect(saved.issuerIban).toBe("SI56263300012039086");
    expect(saved.reviewedById).toBe(w.accountant.id);
    expect(saved.reviewedAt).not.toBeNull();
  });

  it("returns 400 with field errors and keeps the status", async () => {
    const inv = await w.invoice(w.clientA.id);

    const res = await confirm(inv.id, w.auth(w.accountant), {
      issuerName: "",
      issuerIban: "SI56 2633 0001 2039 087",
      amount: "0",
    });

    expect(res.status).toBe(400);
    expect(res.body.details.issuerName).toEqual(["Obvezen podatek"]);
    expect(res.body.details.issuerIban).toEqual(["Neveljaven IBAN"]);
    expect(res.body.details.amount).toEqual(["Znesek mora biti večji od 0"]);
    expect(res.body.details.dueDate).toEqual(["Obvezen podatek"]);
    const saved = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(saved.status).toBe("IN_REVIEW");
  });

  it("does not let a client user confirm (403)", async () => {
    const inv = await w.invoice(w.clientA.id);
    const res = await confirm(inv.id, w.auth(w.clientUser));
    expect(res.status).toBe(403);
  });

  it("returns 409 when the invoice is not in review anymore", async () => {
    const inv = await w.invoice(w.clientA.id);
    await confirm(inv.id, w.auth(w.accountant));

    const again = await confirm(inv.id, w.auth(w.accountant));
    expect(again.status).toBe(409);
  });

  it("returns 404 for an invoice of a client that is not assigned", async () => {
    const res = await confirm(w.invoiceB.id, w.auth(w.accountant));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/invoices/:id/documents/:documentId/file", () => {
  it("returns the original file to users who may see the invoice, 404 to others", async () => {
    const pdf = Buffer.from("%PDF-1.4\n% pregled\n");
    const up = await request(app)
      .post("/api/invoices")
      .set("Authorization", w.auth(w.clientUser))
      .attach("file", pdf, { filename: "račun.pdf", contentType: "application/pdf" });
    const detail = await request(app)
      .get(`/api/invoices/${up.body.id}`)
      .set("Authorization", w.auth(w.accountant));
    const url = `/api/invoices/${up.body.id}/documents/${detail.body.documents[0].id}/file`;

    const ok = await request(app).get(url).set("Authorization", w.auth(w.accountant));
    const outsider = await w.user("outsider", "ACCOUNTANT");
    const denied = await request(app).get(url).set("Authorization", w.auth(outsider));

    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.from(ok.body)).toEqual(pdf);
    expect(denied.status).toBe(404);
  });
});
