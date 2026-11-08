import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { prisma } from "./db.js";
import { TransitionError } from "./invoiceStatus.js";
import { authRouter } from "./routes/auth.js";
import { clientsRouter } from "./routes/clients.js";
import { invoicesRouter } from "./routes/invoices.js";

// The Express app without app.listen – so tests can use it without starting a server
export const app = express();
app.use(express.json());
app.use(cookieParser()); // reads cookies into req.cookies (refresh token)
app.use("/api/auth", authRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/invoices", invoicesRouter);

// a check if the backend is running and the database is reachable
app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "ok" });
});

// Unknown URL → 404 as JSON
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Unexpected errors → log them, and send the user only a generic message
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // A forbidden or impossible status change → 403 / 409 with the reason
  if (err instanceof TransitionError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
