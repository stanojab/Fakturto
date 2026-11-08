import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { clientScope } from "../access.js";
import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";

export const clientsRouter = Router();

// All client routes need a logged-in user; reading is limited to the user's clients,
// creating, editing and deactivating is for administrators only
clientsRouter.use(requireAuth);

// What the query parameters (?page=2&search=novak) may look like
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  includeInactive: z.stringbool().default(false),
});
// What a client in the request body must look like
const clientBodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  taxNumber: z.string().regex(/^\d{8}$/, "Davčna številka mora imeti 8 številk"),
  registrationNumber: z
    .string()
    .regex(/^\d{7,10}$/)
    .nullable()
    .optional(),
  address: z.string().trim().min(5).max(300),
  iban: z
    .string()
    .transform((s) => s.replace(/\s+/g, "").toUpperCase()) // "si56 0123 ..." → "SI560123..."
    .pipe(z.string().regex(/^SI56\d{15}$/, "IBAN mora biti slovenski (SI56 + 15 številk)")),
  paymentMode: z.enum(["ACCOUNTANT_PAYS", "CLIENT_PAYS"]).optional(), // new clients: database default ACCOUNTANT_PAYS
});

// For editing: every field is optional, and a client can also be reactivated
const clientUpdateSchema = clientBodySchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Helper: is this a Prisma error with a specific code?
const isPrismaError = (e: unknown, code: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;

// Slug for storage folders, e.g. "novak-servis-d-o-o-1a2b3c4d" – set once, never changed
const makeSlug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") + `-${randomUUID().slice(0, 8)}`;

// GET /api/clients – list with paging and search
clientsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid query", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const { page, pageSize, search, includeInactive } = parsed.data;

  // WHERE condition: only the user's clients, only active ones
  const where: Prisma.ClientWhereInput = {
    ...clientScope(currentUser(req)),
    ...(includeInactive ? {} : { isActive: true }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { taxNumber: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.client.count({ where }),
  ]);

  res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// GET /api/clients/:id – one client with the number of their invoices
clientsRouter.get("/:id", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  // another client's id behaves exactly like an unknown id → 404
  const client = await prisma.client.findFirst({
    where: { id: id.data, ...clientScope(currentUser(req)) },
    include: { _count: { select: { invoices: true } } },
  });

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(client);
});
// POST /api/clients – create a client
clientsRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = clientBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid data", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }

  try {
    const client = await prisma.client.create({
      data: { ...parsed.data, slug: makeSlug(parsed.data.name) },
    });
    res.status(201).json(client);
  } catch (e) {
    if (isPrismaError(e, "P2002")) {
      res.status(409).json({ error: "Stranka s to davčno številko že obstaja" });
      return;
    }
    throw e; // any other error → Express returns 500
  }
});

// PATCH /api/clients/:id – edit a client (only the fields that were sent)
clientsRouter.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  const parsed = clientUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid data", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }

  try {
    const client = await prisma.client.update({ where: { id: id.data }, data: parsed.data });
    res.json(client);
  } catch (e) {
    if (isPrismaError(e, "P2025")) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    if (isPrismaError(e, "P2002")) {
      res.status(409).json({ error: "Stranka s to davčno številko že obstaja" });
      return;
    }
    throw e;
  }
});
// DELETE /api/clients/:id – soft delete: the client is deactivated, never removed
clientsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  try {
    await prisma.client.update({ where: { id: id.data }, data: { isActive: false } });
    res.status(204).end();
  } catch (e) {
    if (isPrismaError(e, "P2025")) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    throw e;
  }
});
