import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
    // The full runner loads credentials before its live stages. Unit workers
    // must ignore both .env and inherited credentials; tests opt in with mocks.
    env: {
      FUSEBASE_NO_DOTENV: "1",
      FUSEBASE_GATE_TOKEN: "",
      FUSEBASE_DASHBOARDS_TOKEN: "",
      FUSEBASE_TOKEN: "",
      GATE_MCP_TOKEN: "",
      DASHBOARDS_MCP_TOKEN: "",
      FUSEBASE_COOKIE: "",
      FUSEBASE_SECRET_KEY: "",
    },
  },
});
