import { useEffect, useState } from "react";

export type Client = {
  id: string;
  name: string;
  taxNumber: string;
  registrationNumber: string | null;
  address: string;
  iban: string;
  paymentMode: "ACCOUNTANT_PAYS" | "CLIENT_PAYS";
  isActive: boolean;
};

type ClientList = {
  items: Client[];
  total: number;
  page: number;
  totalPages: number;
};

export default function ClientsPage() {
  const [data, setData] = useState<ClientList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      search,
      includeInactive: String(showInactive),
    });
    fetch(`/api/clients?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(String(err)));
  }, [page, search, showInactive]);

  if (error) return <p>Napaka: {error}</p>;

  return (
    <>
      <h1>Stranke {data && `(${data.total})`}</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <input
          placeholder="Išči po nazivu ali davčni …"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <label>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => {
              setShowInactive(e.target.checked);
              setPage(1);
            }}
          />{" "}
          Pokaži neaktivne
        </label>
      </div>

      <table
        border={1}
        cellPadding={6}
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th>Naziv</th>
            <th>Davčna št.</th>
            <th>Naslov</th>
            <th>IBAN</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((c) => (
            <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.5 }}>
              <td>{c.name}</td>
              <td>{c.taxNumber}</td>
              <td>{c.address}</td>
              <td>{c.iban}</td>
              <td>{c.isActive ? "Aktivna" : "Neaktivna"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data && (
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
