// File storage for invoice files. MVP: local disk (ADR 0006).
// This is the ONLY module that touches the files – switching to MinIO means replacing this file.
import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { config } from "./config.js";

const root = resolve(config.UPLOAD_DIR);

// "clients/<slug>/<year>/<month>/<id>.pdf" → absolute path; never outside the upload folder
function pathFor(key: string) {
  const full = resolve(root, key);
  if (!full.startsWith(root + sep)) throw new Error(`Invalid storage key: ${key}`);
  return full;
}

// Storage key as in ADR 0002: clients/<slug>/<year>/<month>/<id>.<ext>
export function storageKey(clientSlug: string, id: string, ext: string, date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `clients/${clientSlug}/${date.getFullYear()}/${month}/${id}.${ext}`;
}

export async function saveFile(key: string, data: Buffer) {
  const path = pathFor(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data, { flag: "wx" }); // never overwrite an existing file
}

export function openFile(key: string) {
  return createReadStream(pathFor(key));
}

export async function deleteFile(key: string) {
  await rm(pathFor(key), { force: true });
}
