import express, { type NextFunction, type Request, type Response } from "express";
import { prisma } from "./db.js";
import { config } from "./config.js";
import { clientsRouter } from "./routes/clients.js";
const app = express();
app.use(express.json());
app.use("/api/clients", clientsRouter);

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`; //checks is the database reachab;e
  //a  check if the backend is running
  res.json({ status: "ok", database: "ok" });
});
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
app.listen(config.PORT, () => {
  console.log(`Backend running on http://localhost:${config.PORT}`);
});
