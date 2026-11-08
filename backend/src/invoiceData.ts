import { z } from "zod";

// The same rules are in the frontend (frontend/src/validation.ts)
export const REQUIRED = "Obvezen podatek";

// IBAN check digits (ISO 13616): move the first 4 characters to the end, letters → numbers, mod 97 must be 1
export function isValidIban(value: string) {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97; // piece by piece, no big numbers
  return rest === 1;
}

const required = z.string({ error: REQUIRED }).trim().min(1, REQUIRED);
// Optional text: "" → null
const optional = z
  .string()
  .trim()
  .nullish()
  .transform((s) => s || null);
const date = z.iso.date("Datum mora biti v obliki LLLL-MM-DD");
const optionalDate = z
  .union([z.literal(""), date])
  .nullish()
  .transform((s) => (s ? new Date(s) : null));

// Money as text, never as a float: "1.240,50", "1240,5" or "1240.50" → "1240.50"
const amount = z
  .union([z.string(), z.number()], { error: REQUIRED })
  .transform((v) => String(v).trim().replace(/\s/g, ""))
  .pipe(z.string().min(1, REQUIRED))
  .transform((s) => (s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s))
  .pipe(z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Neveljaven znesek"))
  .refine((s) => /[1-9]/.test(s), "Znesek mora biti večji od 0")
  .transform((s) => {
    const [whole, fraction = ""] = s.split(".");
    return `${BigInt(whole)}.${fraction.padEnd(2, "0")}`;
  });

// The data an accountant confirms on the review screen
export const confirmDataSchema = z.object({
  issuerName: required,
  issuerIban: required
    .transform((s) => s.replace(/\s+/g, "").toUpperCase())
    .refine(isValidIban, "Neveljaven IBAN"),
  amount,
  dueDate: z
    .string({ error: REQUIRED })
    .min(1, REQUIRED)
    .pipe(date)
    .transform((s) => new Date(s)),
  issuerTaxNumber: optional,
  recipientName: optional,
  invoiceNumber: optional,
  issueDate: optionalDate,
  paymentReference: optional,
  paymentPurpose: optional,
});
