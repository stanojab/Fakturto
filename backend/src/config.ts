import { z } from "zod";

// What the environment variables must look like, transforms port to number, default is 3000
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  UPLOAD_DIR: z.string().default("uploads"), // MVP file storage on disk (ADR 0006)
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment variables:\n" + z.prettifyError(result.error));
  process.exit(1);
}

export const config = result.data;
