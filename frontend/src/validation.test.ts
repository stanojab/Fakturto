import { describe, it, expect } from "vitest";
import {
  isValidIban,
  normalizeAmount,
  validateInvoiceForm,
  type InvoiceForm,
} from "./validation";

describe("Preverjanje IBAN", () => {
  it("sprejme veljaven slovenski IBAN", () => {
    expect(isValidIban("SI56191000000123438")).toBe(true);
  });

  it("sprejme IBAN s presledki", () => {
    expect(isValidIban("SI56 1910 0000 0123 438")).toBe(true);
  });

  it("zavrne napačne kontrolne številke", () => {
    expect(isValidIban("SI00191000000123438")).toBe(false);
  });

  it("zavrne prekratek IBAN", () => {
    expect(isValidIban("SI1234")).toBe(false);
  });

  it("zavrne prazen IBAN", () => {
    expect(isValidIban("")).toBe(false);
  });
});

describe("Normalizacija zneskov", () => {
  it("pretvori slovenski zapis zneska", () => {
    expect(normalizeAmount("1.240,50")).toBe("1240.50");
  });

  it("doda manjkajočo decimalno ničlo", () => {
    expect(normalizeAmount("1240.5")).toBe("1240.50");
  });

  it("doda decimalke celemu številu", () => {
    expect(normalizeAmount("100")).toBe("100.00");
  });

  it("zavrne besedilo namesto zneska", () => {
    expect(normalizeAmount("abc")).toBeNull();
  });

  it("zavrne negativni znesek", () => {
    expect(normalizeAmount("-50")).toBeNull();
  });
});

describe("Validacija obrazca računa", () => {
  const veljavenObrazec: InvoiceForm = {
    issuerName: "Testno podjetje",
    issuerTaxNumber: "12345678",
    issuerIban: "SI56191000000123438",
    recipientName: "Testna stranka",
    invoiceNumber: "RAC-001",
    issueDate: "2026-11-21",
    dueDate: "2026-12-21",
    amount: "150.00",
    paymentReference: "SI00 123",
    paymentPurpose: "Plačilo računa",
  };

  it("sprejme pravilno izpolnjen obrazec", () => {
    expect(validateInvoiceForm(veljavenObrazec)).toEqual({});
  });

  it("zahteva ime izdajatelja", () => {
    const obrazec = { ...veljavenObrazec, issuerName: "" };
    expect(validateInvoiceForm(obrazec).issuerName).toBe("Obvezen podatek");
  });

  it("zavrne neveljaven IBAN", () => {
    const obrazec = { ...veljavenObrazec, issuerIban: "SI123" };
    expect(validateInvoiceForm(obrazec).issuerIban).toBe("Neveljaven IBAN");
  });

  it("zahteva datum zapadlosti", () => {
    const obrazec = { ...veljavenObrazec, dueDate: "" };
    expect(validateInvoiceForm(obrazec).dueDate).toBe("Obvezen podatek");
  });

  it("zavrne znesek nič", () => {
    const obrazec = { ...veljavenObrazec, amount: "0" };
    expect(validateInvoiceForm(obrazec).amount).toBe(
      "Znesek mora biti večji od 0",
    );
  });
});
