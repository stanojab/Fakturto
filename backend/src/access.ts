import type { Prisma } from "./generated/prisma/client.js";
import type { AuthUser } from "./middleware/auth.js";

// Which clients a user may see – added to every query, so other clients' data never leaves the database:
// administrator → all, accountant → assigned clients, client user → companies they are a member of
export function clientScope(user: AuthUser): Prisma.ClientWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "ACCOUNTANT") return { assignments: { some: { accountantId: user.id } } };
  return { memberships: { some: { userId: user.id } } };
}

// Invoices the user may see = invoices of the clients they may see
export function invoiceScope(user: AuthUser): Prisma.InvoiceWhereInput {
  return user.role === "ADMIN" ? {} : { client: clientScope(user) };
}
