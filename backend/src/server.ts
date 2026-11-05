import express from "express";
import { prisma } from "./db.js";
import { config } from "./config.js";
const app = express();

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`; //checks is the database reachab;e
  //a  check if the backend is running
  res.json({ status: "ok", database: "ok" });
});
app.listen(config.PORT, () => {
  console.log(`Backend running on http://localhost:${config.PORT}`);
});
