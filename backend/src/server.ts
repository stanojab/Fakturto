import express from "express";
import { config } from "./config.js";
const app = express();

app.get("/health", (_req, res) => {
  //a  check if the backend is running
  res.json({ status: "ok" });
});
app.listen(config.PORT, () => {
  console.log(`Backend running on http://localhost:${config.PORT}`);
});
