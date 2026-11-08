import { useState, type FormEvent } from "react";
import { apiFetch } from "../auth";
import {
  FILE_ERROR,
  formatAmount,
  isAllowedFile,
  type InvoiceListItem,
} from "../invoices";

// Today in Slovenia as "YYYY-MM-DD" – default and latest allowed payment date
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Ljubljana" }).format(
    new Date(),
  );

type Props = {
  invoice: InvoiceListItem;
  onDone: () => void;
  onCancel: () => void;
};

export default function MarkPaidDialog({ invoice, onDone, onCancel }: Props) {
  const [paidOn, setPaidOn] = useState(today());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!paidOn) return setError("Obvezen podatek");
    if (paidOn > today())
      return setError("Datum plačila ne sme biti v prihodnosti");
    if (file && !isAllowedFile(file)) return setError(FILE_ERROR);

    const form = new FormData();
    form.append("paidOn", paidOn);
    if (file) form.append("file", file);
    setBusy(true);
    const res = await apiFetch(`/api/invoices/${invoice.id}/mark-paid`, {
      method: "POST",
      body: form,
    });
    setBusy(false);
    if (res.ok) return onDone();

    const body = await res.json().catch(() => ({}));
    setError(
      body.details?.paidOn?.[0] ?? body.error ?? `Napaka (HTTP ${res.status})`,
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <form
        role="dialog"
        aria-label="Označi kot plačano"
        onSubmit={handleSubmit}
        style={{
          background: "white",
          padding: 24,
          borderRadius: 8,
          display: "grid",
          gap: 8,
          minWidth: 320,
        }}
      >
        <h2 style={{ margin: 0 }}>Označi kot plačano</h2>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "4px 12px",
          }}
        >
          <dt>Stranka</dt>
          <dd style={{ margin: 0 }}>{invoice.client.name}</dd>
          <dt>Izdajatelj</dt>
          <dd style={{ margin: 0 }}>{invoice.issuerName}</dd>
          <dt>Znesek</dt>
          <dd style={{ margin: 0 }}>
            {formatAmount(invoice.amount, invoice.currency)}
          </dd>
          <dt>IBAN</dt>
          <dd style={{ margin: 0 }}>{invoice.issuerIban}</dd>
          <dt>Sklic</dt>
          <dd style={{ margin: 0 }}>{invoice.paymentReference ?? "–"}</dd>
        </dl>

        <label style={{ display: "grid", gap: 2 }}>
          Datum plačila *
          <input
            type="date"
            value={paidOn}
            max={today()}
            onChange={(e) => setPaidOn(e.target.value)}
            required
          />
        </label>
        <label style={{ display: "grid", gap: 2 }}>
          Potrdilo banke (neobvezno)
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={busy}>
            {busy ? "Shranjevanje …" : "Potrdi plačilo"}
          </button>
          <button type="button" onClick={onCancel}>
            Prekliči
          </button>
        </div>
      </form>
    </div>
  );
}
