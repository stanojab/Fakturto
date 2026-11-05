import { z } from "zod";

// What the environment variables must look like, transforms port to number, default is 3000
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().startsWith("postgresql://"),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment variables:\n" + z.prettifyError(result.error));
  process.exit(1);
}

export const config = result.data;
