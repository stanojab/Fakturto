import { describe, expect, it } from "vitest";
import { InvoiceStatus } from "./generated/prisma/enums.js";
import {
  allowedTransitions,
  checkTransition,
  isEditable,
  TRANSITIONS,
  TransitionError,
  type Actor,
} from "./invoiceStatus.js";

const ACTORS: Actor[] = ["ADMIN", "ACCOUNTANT", "CLIENT", "SYSTEM"];
const STATUSES = Object.values(InvoiceStatus);

// [from, to, actor] for every allowed transition in the table
const allowed = STATUSES.flatMap((from) =>
  Object.entries(TRANSITIONS[from]).flatMap(([to, actors]) =>
    actors!.map((actor) => [from, to as InvoiceStatus, actor] as const),
  ),
);

const errorOf = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e as TransitionError;
  }
  return undefined;
};

describe("allowed transitions", () => {
  it.each(allowed)("%s → %s is allowed for %s", (from, to, actor) => {
    expect(() => checkTransition(from, to, actor)).not.toThrow();
  });
});

describe("transitions that do not exist → 409", () => {
  // From every status: going back to UPLOADED is never allowed
  it.each(STATUSES)("%s → UPLOADED is rejected with 409", (from) => {
    for (const actor of ACTORS) {
      const err = errorOf(() => checkTransition(from, "UPLOADED", actor));
      expect(err).toBeInstanceOf(TransitionError);
      expect(err!.status).toBe(409);
    }
  });

  it("a paid invoice cannot go back to review", () => {
    expect(errorOf(() => checkTransition("PAID", "IN_REVIEW", "ADMIN"))!.status).toBe(409);
  });

  it("an invoice cannot be paid without review", () => {
    expect(errorOf(() => checkTransition("IN_REVIEW", "PAID", "ACCOUNTANT"))!.status).toBe(409);
  });
});

describe("existing transitions with the wrong role → 403", () => {
  it("a client cannot confirm the data", () => {
    expect(errorOf(() => checkTransition("IN_REVIEW", "READY_FOR_PAYMENT", "CLIENT"))!.status).toBe(
      403,
    );
  });

  it("a client cannot mark an invoice as paid", () => {
    expect(errorOf(() => checkTransition("READY_FOR_PAYMENT", "PAID", "CLIENT"))!.status).toBe(403);
  });

  it("only the system starts processing an upload", () => {
    expect(errorOf(() => checkTransition("UPLOADED", "IN_REVIEW", "ADMIN"))!.status).toBe(403);
  });
});

describe("helpers", () => {
  it("lists the transitions an accountant may do from review", () => {
    expect(allowedTransitions("IN_REVIEW", "ACCOUNTANT").sort()).toEqual(
      ["READY_FOR_PAYMENT", "REJECTED", "RETURNED"].sort(),
    );
    expect(allowedTransitions("IN_REVIEW", "CLIENT")).toEqual([]);
  });

  it("paid and archived invoices are not editable", () => {
    expect(isEditable("PAID")).toBe(false);
    expect(isEditable("ARCHIVED")).toBe(false);
    expect(isEditable("IN_REVIEW")).toBe(true);
  });
});
