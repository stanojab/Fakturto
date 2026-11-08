import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { createWorld, type World } from "../test/fixtures.js";
import { FILE_ERROR } from "../upload.js";

let w: World;
beforeAll(async () => {
  w = await createWorld();
});
afterAll(async () => {
  await w.cleanup();
  await prisma.$disconnect();
});

const pdf = Buffer.from("%PDF-1.4\n% testni račun\n");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const upload = (auth: string) => request(app).post("/api/invoices").set("Authorization", auth);

describe("POST /api/invoices", () => {
  it("stores the file and creates an invoice in review with its original document", async () => {
    // the client user is a member of one company only → no clientId needed
    const res = await upload(w.auth(w.clientUser)).attach("file", pdf, {
      filename: "račun-123.pdf",
      contentType: "application/pdf",
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("IN_REVIEW");
    expect(res.body.client.id).toBe(w.clientA.id);

    const doc = await prisma.document.findFirstOrThrow({ where: { invoiceId: res.body.id } });
    expect(doc.kind).toBe("ORIGINAL");
    expect(doc.originalFilename).toBe("račun-123.pdf");
    expect(doc.sha256).toBe(createHash("sha256").update(pdf).digest("hex"));
    expect(doc.storageKey).toMatch(
      new RegExp(`^clients/${w.clientA.slug}/\\d{4}/\\d{2}/${doc.id}\\.pdf$`),
    );
    expect(await readFile(join(config.UPLOAD_DIR, doc.storageKey))).toEqual(pdf);
  });

  it("shows the new invoice first in the user's list", async () => {
    const res = await upload(w.auth(w.clientUser)).attach("file", png, "slika.png");
    const list = await request(app).get("/api/invoices").set("Authorization", w.auth(w.clientUser));

    expect(list.body.items[0].id).toBe(res.body.id);
  });

  it("rejects unsupported and fake files", async () => {
    const text = await upload(w.auth(w.clientUser)).attach("file", Buffer.from("hello"), {
      filename: "a.txt",
      contentType: "text/plain",
    });
    const fakePdf = await upload(w.auth(w.clientUser)).attach("file", Buffer.from("MZ..."), {
      filename: "virus.pdf",
      contentType: "application/pdf",
    });

    expect(text.status).toBe(400);
    expect(text.body.error).toBe(FILE_ERROR);
    expect(fakePdf.status).toBe(400);
  });

  it("rejects files over 10 MB", async () => {
    const big = Buffer.concat([pdf, Buffer.alloc(10 * 1024 * 1024)]);
    const res = await upload(w.auth(w.clientUser)).attach("file", big, {
      filename: "velik.pdf",
      contentType: "application/pdf",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(FILE_ERROR);
  });

  it("returns 400 without a file", async () => {
    const res = await upload(w.auth(w.clientUser)).field("clientId", w.clientA.id);
    expect(res.status).toBe(400);
  });

  it("does not let a user upload to a company they are not a member of", async () => {
    const res = await upload(w.auth(w.clientUser))
      .field("clientId", w.clientB.id)
      .attach("file", pdf, { filename: "a.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(404);
    expect(await prisma.invoice.count({ where: { clientId: w.clientB.id } })).toBe(1); // only the fixture
  });

  it("asks an administrator to choose the company", async () => {
    const res = await upload(w.auth(w.admin)).attach("file", pdf, {
      filename: "a.pdf",
      contentType: "application/pdf",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Izberite podjetje");
  });
});
