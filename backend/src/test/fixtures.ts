import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import type { FirmRole, InvoiceStatus, User } from "../generated/prisma/client.js";
import { signAccessToken } from "../routes/auth.js";

const randomTaxNumber = () => String(10_000_000 + Math.floor(Math.random() * 90_000_000));

// A small, separate "world" for one test file: users of every role, two clients and invoices.
// Everything gets a unique tag, so test files can run in parallel on the development database.
export async function createWorld() {
  const tag = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const clientIds: string[] = [];

  async function user(name: string, firmRole: FirmRole | null) {
    const u = await prisma.user.create({
      data: {
        email: `vitest-${name}-${tag}@fakturko.test`,
        passwordHash: "!test-no-login",
        fullName: `Vitest ${name}`,
        firmRole,
      },
    });
    userIds.push(u.id);
    return u;
  }

  async function client(name: string) {
    const c = await prisma.client.create({
      data: {
        name: `VITEST ${name} ${tag}`,
        taxNumber: randomTaxNumber(),
        address: "Testna ulica 1, 1000 Ljubljana",
        iban: "SI56011001000012345",
        slug: `vitest-${name}-${tag}`,
      },
    });
    clientIds.push(c.id);
    return c;
  }

  const admin = await user("admin", "ADMIN");
  const accountant = await user("accountant", "ACCOUNTANT");
  const clientUser = await user("client", null);
  const clientA = await client("a");
  const clientB = await client("b");

  await prisma.clientMembership.create({ data: { userId: clientUser.id, clientId: clientA.id } });
  await prisma.accountantAssignment.create({
    data: { accountantId: accountant.id, clientId: clientA.id },
  });

  const invoice = (clientId: string, status: InvoiceStatus = "IN_REVIEW", data = {}) =>
    prisma.invoice.create({
      data: { clientId, uploadedById: clientUser.id, status, extractionMethod: "MANUAL", ...data },
    });

  const invoiceA = await invoice(clientA.id);
  const invoiceB = await invoice(clientB.id);

  return {
    admin,
    accountant,
    clientUser,
    clientA,
    clientB,
    invoiceA,
    invoiceB,
    invoice,
    user,
    // "Authorization" header value for a user
    auth: (u: User) => `Bearer ${signAccessToken(u)}`,
    // Removes everything this world created (test data only)
    async cleanup() {
      const invoiceWhere = { clientId: { in: clientIds } };
      await prisma.document.deleteMany({ where: { invoice: invoiceWhere } });
      await prisma.invoice.deleteMany({ where: invoiceWhere });
      await prisma.clientMembership.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.accountantAssignment.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    },
  };
}

export type World = Awaited<ReturnType<typeof createWorld>>;
