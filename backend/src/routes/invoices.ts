import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { clientScope, invoiceScope } from "../access.js";
import { prisma } from "../db.js";
import { InvoiceStatus, Prisma } from "../generated/prisma/client.js";
import { checkTransition } from "../invoiceStatus.js";
import { currentUser, requireAuth } from "../middleware/auth.js";
import { deleteFile, saveFile, storageKey } from "../storage.js";
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
