import { defineConfig } from "vitest/config";

// The tests need DATABASE_URL from the root .env
process.loadEnvFile("../.env");

export default defineConfig({
  test: { environment: "node" },
});
