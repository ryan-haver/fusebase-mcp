import js from "@eslint/js";
import json from "@eslint/json";
import tseslint from "typescript-eslint";
import globals from "globals";

const jsonRecommended = json.configs.recommended.rules;

export default tseslint.config(
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Strict JSON (RFC 8259): invalid syntax — e.g. an unescaped newline inside a string — is a parse error.
  {
    files: ["**/*.json"],
    ignores: [
      "**/package-lock.json",
      "**/node_modules/**",
      "**/tsconfig.json",
      "**/tsconfig.*.json",
      "**/mcp.json",
      "**/.vscode/**",
      "**/.cursor/**",
    ],
    plugins: { json },
    language: "json/json",
    rules: jsonRecommended,
  },
  // JSONC: comments and trailing commas (tsconfig, IDE MCP configs).
  {
    files: [
      "**/tsconfig.json",
      "**/tsconfig.*.json",
      "**/mcp.json",
      "**/.vscode/**/*.json",
      "**/.cursor/**/*.json",
    ],
    plugins: { json },
    language: "json/jsonc",
    languageOptions: {
      allowTrailingCommas: true,
    },
    rules: jsonRecommended,
  },
  {
    ignores: [
      "node_modules/**",
      "**/dist/**",
      "**/build/**",
      "scripts/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      "coverage/**",
      ".claude/**",
      ".codex/**",
      ".agents/**",
      // Vendored SDK sources are third-party code — not subject to app lint.
      "vendor/**"
    ],
  }
);
