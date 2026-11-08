import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiFetch } from "../auth";
import {
  clientStatusLabel,
  formatAmount,
  formatDate,
  type InvoiceListItem,
  type Page,
} from "../invoices";

// Filter tabs → statuses sent to the API
const FILTERS = [
  { label: "Vsi", status: "" },
  { label: "V obdelavi", status: "UPLOADED,PROCESSING,IN_REVIEW" },
  { label: "Vrnjeni", status: "RETURNED" },
  { label: "Plačani", status: "PAID,ARCHIVED" },
];

export default function MyInvoicesPage() {
  const [filter, setFilter] = useState(FILTERS[0]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<InvoiceListItem> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      status: filter.status,
    });
    apiFetch(`/api/invoices?${params}`)
      .then((res) => res.json())
      .then(setData);
  }, [filter, page]);

  const showCompany = new Set(data?.items.map((i) => i.client.id)).size > 1;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <h1>Moji računi</h1>
        <Link to="/upload" className="button">
          + Naloži račun
        </Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            style={{ fontWeight: f === filter ? "bold" : "normal" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {data?.items.length === 0 && <p>Ni računov.</p>}
      {!!data?.items.length && (
        <table
          border={1}
          cellPadding={6}
          style={{ borderCollapse: "collapse", width: "100%" }}
        >
          <thead>
            <tr>
              <th>Naloženo</th>
              {showCompany && <th>Podjetje</th>}
              <th>Izdajatelj</th>
              <th>Znesek</th>
              <th>Rok plačila</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.id}>
                <td>{formatDate(i.createdAt)}</td>
                {showCompany && <td>{i.client.name}</td>}
                <td>{i.issuerName ?? "–"}</td>
                <td style={{ textAlign: "right" }}>
                  {formatAmount(i.amount, i.currency)}
                </td>
                <td>{formatDate(i.dueDate)}</td>
                <td>{clientStatusLabel(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && data.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            alignItems: "center",
          }}
        >
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
