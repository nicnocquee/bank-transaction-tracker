import { defineConfig } from "vitest/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/parsers/sinarmas-parser.ts",
        "src/lib/crypto/secret-box.ts",
        "src/lib/email/imap-sync.ts",
        "src/lib/auth/password.ts",
        "src/lib/transactions/persist-transaction.ts",
        "src/lib/format/money.ts",
      ],
      exclude: ["**/*.test.ts", "**/sinarmas-fixtures.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
