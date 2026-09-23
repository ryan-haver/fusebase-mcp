import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
    // Unit tests must never pick up real credentials from .env
    env: { FUSEBASE_NO_DOTENV: "1" },
  },
});
