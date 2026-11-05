import { useEffect, useState } from "react";

export default function ClientsPage() {
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients?pageSize=1")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setTotal(data.total))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) return <p>Napaka: {error}</p>;
  if (total === null) return <p>Nalaganje …</p>;
  return <h1>Stranke ({total})</h1>;
}
