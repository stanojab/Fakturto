import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

// The tests need DATABASE_URL from the root .env
process.loadEnvFile("../.env");
// Files uploaded by tests go to a temporary folder, not to backend/uploads
process.env.UPLOAD_DIR = join(tmpdir(), "fakturko-test-uploads");

export default defineConfig({
  test: { environment: "node" },
});
