import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import { clientScope, invoiceScope } from "../access.js";
import { prisma } from "../db.js";
import { InvoiceStatus, Prisma } from "../generated/prisma/client.js";
import { confirmDataSchema, markPaidSchema } from "../invoiceData.js";
import { checkTransition, isEditable, transitionInvoice } from "../invoiceStatus.js";
import { currentUser, requireAuth } from "../middleware/auth.js";
import { deleteFile, openFile, saveFile, storageKey } from "../storage.js";
import { acceptInvoiceFile } from "../upload.js";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

const statusList = z
  .string()
  .transform((s) => s.split(",").filter(Boolean))
  .pipe(z.array(z.enum(InvoiceStatus)));

// GET /api/invoices?status=IN_REVIEW,PAID&clientId=…&search=…&sort=dueDate&page=1
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: statusList.optional(),
  clientId: z.uuid().optional(),
  search: z.string().trim().optional(), // issuer or payment reference
  sort: z.enum(["newest", "dueDate"]).default("newest"),
});

const listSelect = {
  id: true,
  status: true,
  issuerName: true,
  issuerIban: true,
  invoiceNumber: true,
  issueDate: true,
  dueDate: true,
  amount: true,
  currency: true,
  paymentReference: true,
  paymentPurpose: true,
  statusReason: true,
  paidOn: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
} satisfies Prisma.InvoiceSelect;

// GET /api/invoices – the user's invoices with filters and paging
invoicesRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid query", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const { page, pageSize, status, clientId, search, sort } = parsed.data;

  const where: Prisma.InvoiceWhereInput = {
    AND: [
      invoiceScope(currentUser(req)),
      status?.length ? { status: { in: status } } : {},
      clientId ? { clientId } : {},
      search
        ? {
            OR: [
              { issuerName: { contains: search, mode: "insensitive" } },
              { paymentReference: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  const orderBy: Prisma.InvoiceOrderByWithRelationInput[] =
    sort === "dueDate"
      ? [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]
      : [{ createdAt: "desc" }];

  const [items, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      orderBy,
      select: listSelect,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// GET /api/invoices/:id – one invoice with its files; an invoice of another client → 404
invoicesRouter.get("/:id", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const invoice = id.success
    ? await prisma.invoice.findFirst({
        where: { id: id.data, ...invoiceScope(currentUser(req)) },
        include: {
          client: { select: { id: true, name: true, iban: true } },
          uploadedBy: { select: { fullName: true } },
          reviewedBy: { select: { fullName: true } },
          paidBy: { select: { fullName: true } },
          documents: {
            select: {
              id: true,
              kind: true,
              originalFilename: true,
              mimeType: true,
              sizeBytes: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      })
    : null;

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(invoice);
});

const uploadBodySchema = z.object({ clientId: z.uuid().optional() });

// POST /api/invoices – upload an invoice file (multipart: "file" + optional "clientId")
invoicesRouter.post("/", acceptInvoiceFile({ required: true }), async (req, res) => {
  const user = currentUser(req);
  const body = uploadBodySchema.safeParse(req.body);
  if (!body.success) {
    res
      .status(400)
      .json({ error: "Invalid data", details: z.flattenError(body.error).fieldErrors });
    return;
  }
  const { clientId } = body.data;

  // The company must be one of the user's (active) clients; without clientId only if there is exactly one
  const clients = await prisma.client.findMany({
    where: { ...clientScope(user), isActive: true, ...(clientId ? { id: clientId } : {}) },
    select: { id: true, slug: true },
    take: 2,
  });
  if (clientId && clients.length === 0) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  if (clients.length !== 1) {
    res.status(400).json({ error: "Izberite podjetje" });
    return;
  }
  const client = clients[0];

  // MVP: no automatic reading – the system moves the invoice straight to manual review
  checkTransition("UPLOADED", "IN_REVIEW", "SYSTEM");

  const file = req.uploaded!;
  const documentId = randomUUID();
  const key = storageKey(client.slug, documentId, file.ext);
  await saveFile(key, file.buffer);

  try {
    const invoice = await prisma.invoice.create({
      data: {
        clientId: client.id,
        uploadedById: user.id,
        status: "IN_REVIEW",
        extractionMethod: "MANUAL",
        documents: {
          create: {
            id: documentId,
            kind: "ORIGINAL",
            storageKey: key,
            originalFilename: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: file.size,
            sha256: file.sha256,
            uploadedById: user.id,
          },
        },
      },
      select: listSelect,
    });
    res.status(201).json(invoice);
  } catch (e) {
    await deleteFile(key); // no database record → remove the file again
    throw e;
  }
});

// Finds an invoice the user may see (another client's invoice → null → 404)
async function findVisibleInvoice(req: Request, id: string) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return null;
  return prisma.invoice.findFirst({
    where: { id: parsed.data, ...invoiceScope(currentUser(req)) },
  });
}

// GET /api/invoices/:id/documents/:documentId/file – the file itself, only after the access check.
// (Instead of a presigned MinIO link – ADR 0006.)
invoicesRouter.get("/:id/documents/:documentId/file", async (req, res) => {
  const invoice = await findVisibleInvoice(req, req.params.id);
  const documentId = z.uuid().safeParse(req.params.documentId);
  const doc =
    invoice && documentId.success
      ? await prisma.document.findFirst({ where: { id: documentId.data, invoiceId: invoice.id } })
      : null;
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(doc.originalFilename)}`,
  );
  res.setHeader("Cache-Control", "private, no-store");
  openFile(doc.storageKey)
    .on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "File missing in storage" });
      else res.end();
    })
    .pipe(res);
});

// POST /api/invoices/:id/confirm – the accountant confirms the (corrected) data → ready for payment
invoicesRouter.post("/:id/confirm", async (req, res) => {
  const user = currentUser(req);
  const invoice = await findVisibleInvoice(req, req.params.id);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  // First the status rules (403 / 409), then the data
  checkTransition(invoice.status, "READY_FOR_PAYMENT", user.role);
  if (!isEditable(invoice.status)) {
    res.status(409).json({ error: "Plačanega računa ni mogoče urejati" });
    return;
  }

  const parsed = confirmDataSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid data", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }

  await transitionInvoice(invoice, "READY_FOR_PAYMENT", user.role, {
    ...parsed.data,
    reviewedById: user.id,
    reviewedAt: new Date(),
  });
  const updated = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoice.id },
    select: listSelect,
  });
  res.json(updated);
});

// POST /api/invoices/:id/mark-paid – payment date + optional bank confirmation (multipart or JSON)
invoicesRouter.post("/:id/mark-paid", acceptInvoiceFile({ required: false }), async (req, res) => {
  const user = currentUser(req);
  const invoice = await findVisibleInvoice(req, String(req.params.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  checkTransition(invoice.status, "PAID", user.role); // 403 / 409 before anything is saved

  const parsed = markPaidSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid data", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }

  // The bank confirmation is saved as a PAYMENT_CONFIRMATION document
  const file = req.uploaded;
  let key: string | undefined;
  const documentId = randomUUID();
  if (file) {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: invoice.clientId } });
    key = storageKey(client.slug, documentId, file.ext);
    await saveFile(key, file.buffer);
  }

  try {
    // Status change and document in one transaction: both or nothing
    await prisma.$transaction(async (tx) => {
      await transitionInvoice(
        invoice,
        "PAID",
        user.role,
        { paidOn: parsed.data.paidOn, paidById: user.id },
        tx,
      );
      if (file && key) {
        await tx.document.create({
          data: {
            id: documentId,
            invoiceId: invoice.id,
            kind: "PAYMENT_CONFIRMATION",
            storageKey: key,
            originalFilename: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: file.size,
            sha256: file.sha256,
            uploadedById: user.id,
          },
        });
      }
    });
  } catch (e) {
    if (key) await deleteFile(key);
    throw e;
  }

  const updated = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoice.id },
    select: listSelect,
  });
  res.json(updated);
});
