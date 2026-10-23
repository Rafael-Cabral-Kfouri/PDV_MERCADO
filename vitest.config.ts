import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Configuração do Vitest com alias `@/` igual ao `tsconfig.json`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
