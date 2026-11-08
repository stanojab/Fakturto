import { prisma } from "./db.js";
import type { InvoiceStatus, Prisma } from "./generated/prisma/client.js";
import type { Role } from "./middleware/auth.js";

// Who changes a status: a user role, or the system itself (upload, background reading)
export type Actor = Role | "SYSTEM";

// THE ONLY PLACE with the status rules (table in docs/02-funkcionalnosti-in-obseg.md):
// from status → to status → who may do it
const STAFF: Actor[] = ["ACCOUNTANT", "ADMIN"];
export const TRANSITIONS: Record<InvoiceStatus, Partial<Record<InvoiceStatus, Actor[]>>> = {
  UPLOADED: { PROCESSING: ["SYSTEM"], IN_REVIEW: ["SYSTEM"] }, // MVP: straight to manual review
  PROCESSING: { IN_REVIEW: ["SYSTEM"] },
  IN_REVIEW: { READY_FOR_PAYMENT: STAFF, RETURNED: STAFF, REJECTED: STAFF },
  RETURNED: { PROCESSING: ["CLIENT", ...STAFF] }, // a corrected file was uploaded
  REJECTED: {},
  READY_FOR_PAYMENT: { PAID: STAFF },
  PAID: { ARCHIVED: ["SYSTEM", "ADMIN"] },
  ARCHIVED: {},
};

// 409 = this transition does not exist, 403 = it exists, but not for this role
export class TransitionError extends Error {
  constructor(
    public readonly status: 403 | 409,
    message: string,
  ) {
    super(message);
  }
}

export function checkTransition(from: InvoiceStatus, to: InvoiceStatus, actor: Actor) {
  const allowedActors = TRANSITIONS[from][to];
  if (!allowedActors) throw new TransitionError(409, `Prehod ${from} → ${to} ni dovoljen`);
  if (!allowedActors.includes(actor)) {
    throw new TransitionError(403, `Vloga ${actor} ne sme izvesti prehoda ${from} → ${to}`);
  }
}

// Statuses the actor may move an invoice to (e.g. which buttons to show)
export function allowedTransitions(from: InvoiceStatus, actor: Actor): InvoiceStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [InvoiceStatus, Actor[]][])
    .filter(([, actors]) => actors.includes(actor))
    .map(([to]) => to);
}

// Paid and archived invoices can no longer be edited
export const isEditable = (status: InvoiceStatus) => status !== "PAID" && status !== "ARCHIVED";

// Checks the rule and changes the status in one step. The update only succeeds if the status
// is still the one we checked – if somebody changed it in the meantime, the result is 409.
export async function transitionInvoice(
  invoice: { id: string; status: InvoiceStatus },
  to: InvoiceStatus,
  actor: Actor,
  data: Omit<Prisma.InvoiceUncheckedUpdateManyInput, "status"> = {},
  db: Prisma.TransactionClient = prisma, // pass a transaction to combine it with other writes
) {
  checkTransition(invoice.status, to, actor);
  const { count } = await db.invoice.updateMany({
    where: { id: invoice.id, status: invoice.status },
    data: { ...data, status: to },
  });
  if (count === 0) throw new TransitionError(409, "Status računa se je medtem spremenil");
}
