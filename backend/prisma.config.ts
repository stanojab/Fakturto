import { defineConfig, env } from "prisma/config";

// Load the .env from the repo root (one folder up)
process.loadEnvFile("../.env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"), // env() stops with an error if the variable is missing
  },
});
