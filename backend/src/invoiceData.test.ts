import { describe, expect, it } from "vitest";
import { confirmDataSchema, isValidIban, REQUIRED } from "./invoiceData.js";

const valid = {
  issuerName: "Dobavitelj d.o.o.",
  issuerIban: "SI56 2633 0001 2039 086",
  amount: "1.240,50",
  dueDate: "2026-12-01",
};

describe("isValidIban", () => {
  it("accepts valid IBANs with or without spaces", () => {
    expect(isValidIban("SI56 2633 0001 2039 086")).toBe(true);
    expect(isValidIban("si56263300012039086")).toBe(true);
    expect(isValidIban("DE89370400440532013000")).toBe(true);
  });

  it("rejects a wrong check digit or format", () => {
    expect(isValidIban("SI56 2633 0001 2039 087")).toBe(false);
    expect(isValidIban("SI56")).toBe(false);
    expect(isValidIban("hello world")).toBe(false);
  });
});

describe("confirmDataSchema", () => {
  it("normalizes the IBAN and the amount without floats", () => {
    const data = confirmDataSchema.parse(valid);
    expect(data.issuerIban).toBe("SI56263300012039086");
    expect(data.amount).toBe("1240.50");
    expect(data.dueDate.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(data.invoiceNumber).toBeNull();
  });

  it.each([
    ["1240", "1240.00"],
    ["1240,5", "1240.50"],
    ["1240.05", "1240.05"],
    ["0,01", "0.01"],
    ["9999999999.99", "9999999999.99"],
  ])("amount %s → %s", (input, expected) => {
    expect(confirmDataSchema.parse({ ...valid, amount: input }).amount).toBe(expected);
  });

  it.each(["0", "0,00", "-5", "12,345", "abc"])("rejects the amount %s", (input) => {
    expect(confirmDataSchema.safeParse({ ...valid, amount: input }).success).toBe(false);
  });

  it("reports every missing required field", () => {
    const result = confirmDataSchema.safeParse({ issuerName: " " });
    expect(result.success).toBe(false);
    const fields = result.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(
      expect.arrayContaining(["issuerName", "issuerIban", "amount", "dueDate"]),
    );
    expect(result.error!.issues.find((i) => i.path[0] === "issuerName")!.message).toBe(REQUIRED);
  });
});
