import { useState, type FormEvent } from "react";
import { apiFetch } from "../auth";
import type { Client } from "../pages/ClientsPage";

type Props = {
  client?: Client; // if set → edit mode, otherwise → new client
  onSaved: () => void;
  onCancel: () => void;
};

export default function ClientForm({ client, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    name: client?.name ?? "",
    taxNumber: client?.taxNumber ?? "",
    registrationNumber: client?.registrationNumber ?? "",
    address: client?.address ?? "",
    iban: client?.iban ?? "",
    paymentMode: client?.paymentMode ?? "ACCOUNTANT_PAYS",
  });
  const [error, setError] = useState<string | null>(null);

  const set =
    (field: keyof typeof form) => (e: { target: { value: string } }) =>
      setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser from reloading the page
    setError(null);

    const res = await apiFetch(
      client ? `/api/clients/${client.id}` : "/api/clients",
      {
        method: client ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          registrationNumber: form.registrationNumber || null,
        }),
      },
    );

    if (res.ok) return onSaved();

    // Show the error the backend sent (400 validation, 409 duplicate)
    const body = await res.json();
    const details = body.details
      ? Object.entries(body.details)
          .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
          .join("; ")
      : "";
    setError(`${body.error}${details ? ` – ${details}` : ""}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: 8, maxWidth: 400, marginBottom: 16 }}
    >
      <h2>{client ? "Uredi stranko" : "Nova stranka"}</h2>
      <input
        placeholder="Naziv"
        value={form.name}
        onChange={set("name")}
        required
      />
      <input
        placeholder="Davčna številka (8 števk)"
        value={form.taxNumber}
        onChange={set("taxNumber")}
        required
      />
      <input
        placeholder="Matična številka (neobvezno)"
        value={form.registrationNumber}
        onChange={set("registrationNumber")}
      />
      <input
        placeholder="Naslov"
        value={form.address}
        onChange={set("address")}
        required
      />
      <input
        placeholder="IBAN (SI56 …)"
        value={form.iban}
        onChange={set("iban")}
        required
      />
      <select value={form.paymentMode} onChange={set("paymentMode")}>
        <option value="ACCOUNTANT_PAYS">Plača računovodja</option>
        <option value="CLIENT_PAYS">Plača stranka</option>
      </select>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit">Shrani</button>
        <button type="button" onClick={onCancel}>
          Prekliči
        </button>
      </div>
    </form>
  );
}
