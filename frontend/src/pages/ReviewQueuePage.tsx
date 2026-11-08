import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { apiFetch } from "../auth";
import {
  formatAmount,
  formatDate,
  type InvoiceListItem,
  type Page,
} from "../invoices";

// Accountant: invoices waiting for review
export default function ReviewQueuePage() {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message;
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<InvoiceListItem> | null>(null);

  useEffect(() => {
    apiFetch(`/api/invoices?status=IN_REVIEW&page=${page}`)
      .then((res) => res.json())
      .then(setData);
  }, [page]);

  return (
    <>
      <h1>V pregledu {data && `(${data.total})`}</h1>
      {message && <p style={{ color: "green" }}>{message}</p>}
      {data?.items.length === 0 && <p>Ni računov za pregled.</p>}

      {!!data?.items.length && (
        <table
          border={1}
          cellPadding={6}
          style={{ borderCollapse: "collapse", width: "100%" }}
        >
          <thead>
            <tr>
              <th>Naloženo</th>
              <th>Stranka</th>
              <th>Izdajatelj</th>
              <th>Znesek</th>
              <th>Rok plačila</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.id}>
                <td>{formatDate(i.createdAt)}</td>
                <td>{i.client.name}</td>
                <td>{i.issuerName ?? "–"}</td>
                <td style={{ textAlign: "right" }}>
                  {formatAmount(i.amount, i.currency)}
                </td>
                <td>{formatDate(i.dueDate)}</td>
                <td>
                  <Link to={`/review/${i.id}`}>Preglej</Link>
                </td>
              </tr>
            ))}
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
