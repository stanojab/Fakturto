import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { Prisma } from "../generated/prisma/client.js";

export const clientsRouter = Router();

// What the query parameters (?page=2&search=novak) may look like
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  includeInactive: z.stringbool().default(false),
});

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

  // WHERE condition: only active clients
  const where: Prisma.ClientWhereInput = {
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

  const client = await prisma.client.findUnique({
    where: { id: id.data },
    include: { _count: { select: { invoices: true } } },
  });

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(client);
});
