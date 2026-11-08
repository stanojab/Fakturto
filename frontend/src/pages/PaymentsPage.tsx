import { useEffect, useState } from "react";
import { apiFetch } from "../auth";
import MarkPaidDialog from "../components/MarkPaidDialog";
import {
  formatAmount,
  formatDate,
  type InvoiceListItem,
  type Page,
} from "../invoices";

// Today in Slovenia as "YYYY-MM-DD"
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Ljubljana" }).format(
    new Date(),
  );

// Number of days the due date is in the past (0 or less = not overdue)
function daysOverdue(dueDate: string | null) {
  if (!dueDate) return 0;
  const ms = Date.parse(today()) - Date.parse(dueDate.slice(0, 10));
  return Math.round(ms / 86_400_000);
}

// Values for online banking: IBAN without spaces, amount as "1240,00"
const ibanForBank = (iban: string) => iban.replace(/\s+/g, "");
const amountForBank = (amount: string) => {
  const [whole, fraction = ""] = amount.split(".");
  return `${whole},${fraction.padEnd(2, "0")}`;
};

// Clipboard API; if the browser blocks it, the older "copy" command as a fallback
async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

type ClientOption = { id: string; name: string };

// Accountant: invoices ready for payment, with one-click copying into online banking
export default function PaymentsPage() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<InvoiceListItem> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paying, setPaying] = useState<InvoiceListItem | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    apiFetch("/api/clients?pageSize=500")
      .then((res) => res.json())
      .then((body) => setClients(body.items));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      status: "READY_FOR_PAYMENT",
      sort: "dueDate",
      page: String(page),
      search,
      ...(clientId ? { clientId } : {}),
    });
    apiFetch(`/api/invoices?${params}`)
      .then((res) => res.json())
      .then(setData);
  }, [page, search, clientId, reload]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }

  async function copy(value: string, what: string) {
    const ok = await copyToClipboard(value);
    showToast(ok ? `${what} kopiran` : "Kopiranje ni uspelo");
  }

  const copyButton = (value: string | null, what: string) =>
    value && (
      <button
        title={`Kopiraj ${what.toLowerCase()}`}
        onClick={() => copy(value, what)}
        style={{ marginLeft: 6 }}
      >
        📋
      </button>
    );

  return (
    <>
      <h1>Za plačilo {data && `(${data.total})`}</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <select
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Vse stranke</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Išči po izdajatelju ali sklicu …"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#333",
            color: "white",
            padding: "8px 16px",
            borderRadius: 4,
          }}
        >
          {toast}
        </div>
      )}

      {paying && (
        <MarkPaidDialog
          invoice={paying}
          onCancel={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            setReload(reload + 1);
            showToast("Račun označen kot plačan");
          }}
        />
      )}

      {data?.items.length === 0 && <p>Ni računov za plačilo.</p>}
      {!!data?.items.length && (
        <table
          border={1}
          cellPadding={6}
          style={{ borderCollapse: "collapse", width: "100%" }}
        >
          <thead>
            <tr>
              <th>Rok plačila</th>
              <th>Stranka</th>
              <th>Izdajatelj</th>
              <th>Znesek</th>
              <th>IBAN</th>
              <th>Sklic</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => {
              const overdue = daysOverdue(i.dueDate);
              return (
                <tr key={i.id}>
                  <td style={{ color: overdue > 0 ? "crimson" : undefined }}>
                    {formatDate(i.dueDate)}
                    {overdue > 0 && (
                      <div>
                        <small>Zapadel pred {overdue} dnevi</small>
                      </div>
                    )}
                  </td>
                  <td>{i.client.name}</td>
                  <td>{i.issuerName}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {formatAmount(i.amount, i.currency)}
                    {copyButton(i.amount && amountForBank(i.amount), "Znesek")}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {i.issuerIban}
                    {copyButton(
                      i.issuerIban && ibanForBank(i.issuerIban),
                      "IBAN",
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {i.paymentReference ?? "–"}
                    {copyButton(i.paymentReference, "Sklic")}
                  </td>
                  <td>
                    <button onClick={() => setPaying(i)}>
                      Označi kot plačano
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {data && data.totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Nazaj
          </button>
          <span>
            Stran {data.page} / {data.totalPages}
          </span>
          <button
            disabled={page >= data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Naprej →
          </button>
        </div>
      )}
    </>
  );
}
