// Shared types and formatting for invoices

export type InvoiceStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "IN_REVIEW"
  | "RETURNED"
  | "REJECTED"
  | "READY_FOR_PAYMENT"
  | "PAID"
  | "ARCHIVED";

export type InvoiceListItem = {
  id: string;
  status: InvoiceStatus;
  issuerName: string | null;
  issuerIban: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  amount: string | null; // Decimal from the API comes as a string, e.g. "1240.5"
  currency: string;
  paymentReference: string | null;
  paymentPurpose: string | null;
  statusReason: string | null;
  paidOn: string | null;
  createdAt: string;
  client: { id: string; name: string };
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
};

// The same rules as the backend (FILE_ERROR in backend/src/upload.ts)
export const FILE_ERROR = "Podprte so datoteke PDF, JPG in PNG do 10 MB";
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const isAllowedFile = (f: File) =>
  ALLOWED_TYPES.includes(f.type) && f.size <= 10 * 1024 * 1024;

// "2026-11-08T00:00:00.000Z" → "8. 11. 2026"
export function formatDate(iso: string | null) {
  if (!iso) return "–";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

// "1240.5" → "1.240,50 €" (formatted from the string, never through a float)
export function formatAmount(amount: string | null, currency = "EUR") {
  if (amount === null) return "–";
  const [whole, fraction = ""] = amount.split(".");
  const withDots = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots},${fraction.padEnd(2, "0")} ${currency === "EUR" ? "€" : currency}`;
}

// How a client user sees the status
export function clientStatusLabel(i: InvoiceListItem) {
  switch (i.status) {
    case "UPLOADED":
    case "PROCESSING":
    case "IN_REVIEW":
      return "V obdelavi";
    case "READY_FOR_PAYMENT":
      return "Pripravljen za plačilo";
    case "PAID":
    case "ARCHIVED":
      return `Plačan dne ${formatDate(i.paidOn)}`;
    case "RETURNED":
      return `Vrnjen: ${i.statusReason ?? ""}`;
    case "REJECTED":
      return "Zavrnjen";
  }
}
