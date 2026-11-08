import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";

export const FILE_ERROR = "Podprte so datoteke PDF, JPG in PNG do 10 MB";
const MAX_SIZE = 10 * 1024 * 1024;

// Allowed types with the first bytes every real file of that type starts with
const TYPES = [
  { mime: "application/pdf", ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
];

// Type by the file content, not by the name (a renamed .exe is not a PDF)
function detectType(file: Express.Multer.File) {
  return TYPES.find(
    (t) => t.mime === file.mimetype && t.magic.every((byte, i) => file.buffer[i] === byte),
  );
}

const multerSingle = multer({
  storage: multer.memoryStorage(), // the file stays in memory until we save it
  limits: { fileSize: MAX_SIZE, files: 1 },
}).single("file");

export type UploadedFile = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  ext: string;
  size: number;
  sha256: string;
};

declare module "express-serve-static-core" {
  interface Request {
    uploaded?: UploadedFile;
  }
}

// Reads one file from the "file" field of a multipart form. With required = false the file is optional.
export const acceptInvoiceFile =
  ({ required }: { required: boolean }) =>
  (req: Request, res: Response, next: NextFunction) => {
    multerSingle(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: FILE_ERROR });
        return;
      }
      if (err) return next(err);

      const file = req.file;
      if (!file) {
        if (required) res.status(400).json({ error: FILE_ERROR });
        else next();
        return;
      }

      const type = detectType(file);
      if (!type) {
        res.status(400).json({ error: FILE_ERROR });
        return;
      }

      req.uploaded = {
        buffer: file.buffer,
        originalName: Buffer.from(file.originalname, "latin1").toString("utf8"), // keep č, š, ž
        mimeType: type.mime,
        ext: type.ext,
        size: file.size,
        sha256: createHash("sha256").update(file.buffer).digest("hex"),
      };
      next();
    });
  };
