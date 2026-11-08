import { useEffect, useState } from "react";
import { apiFetch } from "../auth";

type Props = {
  invoiceId: string;
  document: { id: string; mimeType: string; originalFilename: string };
};

// Shows the original invoice file. The file needs the access token, so it is loaded with
// apiFetch and shown from a temporary blob: URL.
export default function DocumentViewer({ invoiceId, document }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let objectUrl: string | null = null;
    apiFetch(`/api/invoices/${invoiceId}/documents/${document.id}/file`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setError(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoiceId, document.id]);

  if (error) return <p>Datoteke ni mogoče naložiti.</p>;
  if (!url) return <p>Nalaganje datoteke …</p>;

  // The browser's PDF viewer has its own zoom
  if (document.mimeType === "application/pdf") {
    return (
      <iframe
        src={url}
        title={document.originalFilename}
        style={{ width: "100%", height: "80vh", border: "1px solid #ccc" }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>−</button>
        <span>{Math.round(zoom * 100)} %</span>
        <button onClick={() => setZoom(Math.min(4, zoom + 0.25))}>+</button>
      </div>
      <div
        style={{ overflow: "auto", height: "75vh", border: "1px solid #ccc" }}
      >
        <img
          src={url}
          alt={document.originalFilename}
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
    </div>
  );
}
