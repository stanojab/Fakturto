import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default defineConfig(
  { ignores: ["dist/", "src/generated/"] }, // don't check compiled code
  js.configs.recommended, // basic JavaScript rules
  tseslint.configs.recommended, // TypeScript rules
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  prettier, // last: turn off style rules that Prettier handles
);
