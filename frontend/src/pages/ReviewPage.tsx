import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { apiFetch } from "../auth";
import DocumentViewer from "../components/DocumentViewer";
import type { InvoiceStatus } from "../invoices";
import { validateInvoiceForm, type InvoiceForm } from "../validation";

type InvoiceDetail = {
  id: string;
  status: InvoiceStatus;
  extractionConfidence: Record<string, number> | null; // e.g. { issuer_iban: 0.72 }
  issuerName: string | null;
  issuerTaxNumber: string | null;
  issuerIban: string | null;
  recipientName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  amount: string | null;
  paymentReference: string | null;
  paymentPurpose: string | null;
  client: { id: string; name: string };
  documents: {
    id: string;
    kind: "ORIGINAL" | "PAYMENT_CONFIRMATION";
    mimeType: string;
    originalFilename: string;
  }[];
};

const FIELDS: { key: keyof InvoiceForm; label: string; type?: string }[] = [
  { key: "issuerName", label: "Izdajatelj *" },
  { key: "issuerTaxNumber", label: "Davčna številka izdajatelja" },
  { key: "issuerIban", label: "IBAN *" },
  { key: "amount", label: "Znesek (EUR) *" },
  { key: "dueDate", label: "Rok plačila *", type: "date" },
  { key: "paymentReference", label: "Sklic" },
  { key: "paymentPurpose", label: "Namen plačila" },
  { key: "invoiceNumber", label: "Številka računa" },
  { key: "issueDate", label: "Datum izdaje", type: "date" },
  { key: "recipientName", label: "Prejemnik" },
];

const LOW_CONFIDENCE = 0.8;
const snake = (key: string) =>
  key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function toForm(i: InvoiceDetail): InvoiceForm {
  return {
    issuerName: i.issuerName ?? "",
    issuerTaxNumber: i.issuerTaxNumber ?? "",
    issuerIban: i.issuerIban ?? "",
    recipientName: i.recipientName ?? i.client.name,
    invoiceNumber: i.invoiceNumber ?? "",
    issueDate: i.issueDate?.slice(0, 10) ?? "",
    dueDate: i.dueDate?.slice(0, 10) ?? "",
    amount: i.amount ? i.amount.replace(".", ",") : "",
    paymentReference: i.paymentReference ?? "",
    paymentPurpose: i.paymentPurpose ?? "",
  };
}

// Accountant: original on the left, data on the right; confirm → ready for payment
export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [form, setForm] = useState<InvoiceForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/invoices/${id}`).then(async (res) => {
      if (!res.ok)
        return setError("Račun ne obstaja ali do njega nimate dostopa.");
      const body: InvoiceDetail = await res.json();
      setInvoice(body);
      setForm(toForm(body));
    });
  }, [id]);

  if (error && !invoice) return <p>{error}</p>;
  if (!invoice || !form) return <p>Nalaganje …</p>;

  const original = invoice.documents
    .filter((d) => d.kind === "ORIGINAL")
    .at(-1);
  const editable = invoice.status === "IN_REVIEW";

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const found = validateInvoiceForm(form!);
    setErrors(found);
    if (Object.keys(found).length) return;

    const res = await apiFetch(`/api/invoices/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      return navigate("/review", {
        state: {
          message: "Podatki potrjeni – račun je pripravljen za plačilo.",
        },
      });
    }
    const body = await res.json().catch(() => ({}));
    // Field errors from the server next to the fields, everything else under the form
    if (body.details) {
      setErrors(
        Object.fromEntries(
          Object.entries(body.details as Record<string, string[]>).map(
            ([k, v]) => [k, v[0]],
          ),
        ),
      );
    }
    setError(body.error ?? `Napaka (HTTP ${res.status})`);
  }

  return (
    <>
      <p>
        <Link to="/review">← V pregledu</Link>
      </p>
      <h1>Pregled računa – {invoice.client.name}</h1>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 480px" }}>
          {original ? (
            <DocumentViewer invoiceId={invoice.id} document={original} />
          ) : (
            <p>Račun nima izvirnika.</p>
          )}
        </div>

        <form
          onSubmit={handleConfirm}
          style={{
            flex: "1 1 320px",
            display: "grid",
            gap: 8,
            alignContent: "start",
          }}
        >
          {FIELDS.map(({ key, label, type }) => {
            const confidence = invoice.extractionConfidence?.[snake(key)];
            const low = confidence !== undefined && confidence < LOW_CONFIDENCE;
            return (
              <label key={key} style={{ display: "grid", gap: 2 }}>
                {label}
                <input
                  type={type ?? "text"}
                  value={form[key]}
                  disabled={!editable}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  style={{ background: low ? "#fff3b0" : undefined }}
                />
                {low && (
                  <small style={{ color: "#8a6d00" }}>
                    Nizka zanesljivost branja – preverite na izvirniku
                  </small>
                )}
                {errors[key] && (
                  <small style={{ color: "crimson" }}>{errors[key]}</small>
                )}
              </label>
            );
          })}

          {error && <p style={{ color: "crimson" }}>{error}</p>}
          {editable ? (
            <button type="submit">Potrdi podatke</button>
          ) : (
            <p>Račun ni v pregledu, podatkov ni mogoče spreminjati.</p>
          )}
        </form>
      </div>
    </>
  );
}
