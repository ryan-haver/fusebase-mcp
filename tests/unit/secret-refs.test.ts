/**
 * 1Password op:// references in the environment are replaced by their secrets; failures
 * remove the variable instead of leaving the literal reference to be sent as a token.
 */
import { describe, expect, it, vi } from "vitest";
import { loadOnePasswordEnvironment, resolveSecretReferences } from "../../src/secret-refs.js";

describe("loadOnePasswordEnvironment", () => {
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});
  const vars = [
    { name: "FUSEBASE_SECRET_KEY", value: "k" },
    { name: "FUSEBASE_GATE_TOKEN", value: "from-1p" },
    { name: "FUSEBASE_HOST", value: "from-1p.example" },
  ];

  it("does nothing without FUSEBASE_OP_ENVIRONMENT_ID", async () => {
    const fetch = vi.fn();
    expect(await loadOnePasswordEnvironment({}, { fetch })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads variables with the FuseBase service account; the real env wins, .env values are replaced", async () => {
    const spy = quiet();
    const env: NodeJS.ProcessEnv = {
      FUSEBASE_OP_ENVIRONMENT_ID: "env123",
      FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN: "ops_fusebase",
      OP_SERVICE_ACCOUNT_TOKEN: "ops_other",
      FUSEBASE_GATE_TOKEN: "from-dotenv",
      FUSEBASE_HOST: "from-real-env",
    };
    const fetch = vi.fn(async () => vars);
    const loaded = await loadOnePasswordEnvironment(env, { fetch, overridable: new Set(["FUSEBASE_GATE_TOKEN"]) });
    spy.mockRestore();
    expect(fetch).toHaveBeenCalledWith("env123", "ops_fusebase"); // never OP_SERVICE_ACCOUNT_TOKEN
    expect(loaded).toEqual(["FUSEBASE_SECRET_KEY", "FUSEBASE_GATE_TOKEN"]);
    expect(env).toMatchObject({ FUSEBASE_SECRET_KEY: "k", FUSEBASE_GATE_TOKEN: "from-1p", FUSEBASE_HOST: "from-real-env" });
  });

  it("is not fetched again by a child process that inherited the variables", async () => {
    const spy = quiet();
    const env: NodeJS.ProcessEnv = { FUSEBASE_OP_ENVIRONMENT_ID: "env123", FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN: "t" };
    const fetch = vi.fn(async () => vars);
    await loadOnePasswordEnvironment(env, { fetch });
    await loadOnePasswordEnvironment({ ...env }, { fetch });
    spy.mockRestore();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("logs and continues when the Environment can't be read, without logging values", async () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((m: string) => { errors.push(m); });
    const env: NodeJS.ProcessEnv = { FUSEBASE_OP_ENVIRONMENT_ID: "env123", FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN: "ops_secret_token" };
    const loaded = await loadOnePasswordEnvironment(env, { fetch: async () => { throw new Error("forbidden"); } });
    spy.mockRestore();
    expect(loaded).toEqual([]);
    expect(errors.join("\n")).toMatch(/Could not load 1Password Environment env123 \(forbidden\)/);
    expect(errors.join("\n")).not.toContain("ops_secret_token");
  });
});

describe("resolveSecretReferences", () => {
  it("replaces op:// values and leaves other values alone", () => {
    const env: NodeJS.ProcessEnv = {
      GATE_MCP_TOKEN: "op://Vault/Gate/credential",
      FUSEBASE_HOST: "example.nimbusweb.me",
    };
    const read = vi.fn((ref: string) => `secret-for:${ref.split("/")[3]}\n`);
    expect(resolveSecretReferences(env, read)).toEqual([]);
    expect(env).toEqual({ GATE_MCP_TOKEN: "secret-for:Gate", FUSEBASE_HOST: "example.nimbusweb.me" });
  });

  it("reads each distinct reference once", () => {
    const env: NodeJS.ProcessEnv = { A: "op://v/i/f", B: "op://v/i/f" };
    const read = vi.fn(() => "s");
    resolveSecretReferences(env, read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(env).toEqual({ A: "s", B: "s" });
  });

  it("removes a variable whose reference can't be read, and never logs the reference's secret", () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((msg: string) => { errors.push(msg); });
    const env: NodeJS.ProcessEnv = { FUSEBASE_SECRET_KEY: "op://v/key/password", OK: "op://v/ok/f" };
    const failed = resolveSecretReferences(env, (ref) => {
      if (ref.includes("key")) throw new Error("[ERROR] 2026/09/23 isn't an item in the \"v\" vault");
      return "fine";
    });
    spy.mockRestore();
    expect(failed).toEqual(["FUSEBASE_SECRET_KEY"]);
    expect(env).toEqual({ OK: "fine" });
    expect(errors.join("\n")).toContain("FUSEBASE_SECRET_KEY");
    expect(errors.join("\n")).not.toContain("fine");
  });

  it("treats an empty secret as a failure", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const env: NodeJS.ProcessEnv = { T: "op://v/i/f" };
    expect(resolveSecretReferences(env, () => "  \n")).toEqual(["T"]);
    spy.mockRestore();
    expect(env.T).toBeUndefined();
  });
});
