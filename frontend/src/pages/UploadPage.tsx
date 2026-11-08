import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { apiFetch } from "../auth";
import { FILE_ERROR, isAllowedFile } from "../invoices";

type ClientOption = { id: string; name: string };

export default function UploadPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The companies the user may upload for (the API returns only the user's own)
  useEffect(() => {
    apiFetch("/api/clients?pageSize=100")
      .then((res) => res.json())
      .then((body) => {
        setClients(body.items);
        if (body.items.length === 1) setClientId(body.items[0].id);
      });
  }, []);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setError(null);

    if (!clientId) return setError("Najprej izberite podjetje");
    if (!isAllowedFile(file)) return setError(FILE_ERROR);

    const form = new FormData();
    form.append("clientId", clientId);
    form.append("file", file);
    setBusy(true);
    const res = await apiFetch("/api/invoices", { method: "POST", body: form });
    setBusy(false);

    if (res.ok) return navigate("/invoices");
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? `Nalaganje ni uspelo (HTTP ${res.status})`);
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
      <h1>Naloži račun</h1>

      {clients.length > 1 && (
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">– Izberite podjetje –</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {clients.length === 1 && <p>Podjetje: {clients[0].name}</p>}

      {/* On a phone, capture="environment" opens the back camera */}
      <label className="button">
        📷 Fotografiraj račun
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          disabled={busy}
          hidden
        />
      </label>
      <label className="button">
        📄 Izberi PDF ali sliko
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={handleFile}
          disabled={busy}
          hidden
        />
      </label>

      {busy && <p>Nalaganje …</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
