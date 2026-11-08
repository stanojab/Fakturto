// The same rules as the backend (backend/src/invoiceData.ts), so errors show before sending

export const REQUIRED = "Obvezen podatek";

// IBAN check digits (ISO 13616): first 4 characters to the end, letters → numbers, mod 97 must be 1
export function isValidIban(value: string) {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

// "1.240,50" / "1240.5" → "1240.50", or null if it is not a valid amount
export function normalizeAmount(value: string): string | null {
  let s = value.trim().replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, fraction = ""] = s.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export type InvoiceForm = {
  issuerName: string;
  issuerTaxNumber: string;
  issuerIban: string;
  recipientName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  paymentReference: string;
  paymentPurpose: string;
};

export function validateInvoiceForm(f: InvoiceForm) {
  const errors: Partial<Record<keyof InvoiceForm, string>> = {};
  if (!f.issuerName.trim()) errors.issuerName = REQUIRED;
  if (!f.issuerIban.trim()) errors.issuerIban = REQUIRED;
  else if (!isValidIban(f.issuerIban)) errors.issuerIban = "Neveljaven IBAN";
  if (!f.dueDate) errors.dueDate = REQUIRED;
  if (!f.amount.trim()) errors.amount = REQUIRED;
  else {
    const amount = normalizeAmount(f.amount);
    if (amount === null) errors.amount = "Neveljaven znesek";
    else if (!/[1-9]/.test(amount))
      errors.amount = "Znesek mora biti večji od 0";
  }
  return errors;
}
