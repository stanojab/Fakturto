import { defineConfig, env } from "prisma/config";
import { existsSync } from "node:fs";

// Lokalno naloži .env, če datoteka obstaja.
// Na Renderju uporabi okoljske spremenljivke.
if (existsSync("../.env")) {
  process.loadEnvFile("../.env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
