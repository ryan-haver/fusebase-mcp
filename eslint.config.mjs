// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "apps/**", "_archive/**", "scratch/**", "artifacts/**", "docs/**", "data/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { process: "readonly", console: "readonly", Buffer: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly", URL: "readonly", fetch: "readonly", AbortSignal: "readonly", AbortController: "readonly", TextDecoder: "readonly", TextEncoder: "readonly", Response: "readonly", Blob: "readonly", FormData: "readonly", RequestInit: "readonly", Headers: "readonly" },
    },
    rules: {
      // Tracked as MNT-2 (docs/PLAN-review-remediation.md); tighten to "error" once typed.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
);
