import express, { type NextFunction, type Request, type Response } from "express";
import { prisma } from "./db.js";
import { clientsRouter } from "./routes/clients.js";

// The Express app without app.listen – so tests can use it without starting a server
export const app = express();
app.use(express.json());
app.use("/api/clients", clientsRouter);

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
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
