import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildClient } from "../../src/client-factory.js";
import { resolveTokens } from "../../src/config.js";
import { loadEncryptedCookie, loadEncryptedToken } from "../../src/crypto.js";

vi.mock("../../src/crypto.js", async (original) => ({
  ...await original<typeof import("../../src/crypto.js")>(),
  loadEncryptedCookie: vi.fn(),
  loadEncryptedToken: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(loadEncryptedCookie).mockReturnValue(null);
  vi.mocked(loadEncryptedToken).mockReturnValue(null);
  for (const key of ["FUSEBASE_GATE_TOKEN", "FUSEBASE_DASHBOARDS_TOKEN", "FUSEBASE_TOKEN", "GATE_MCP_TOKEN", "DASHBOARDS_MCP_TOKEN"]) vi.stubEnv(key, "");
  vi.stubEnv("FUSEBASE_HOST", "unit-profile.invalid");
  vi.stubEnv("FUSEBASE_ORG_ID", "unit-org");
  vi.stubEnv("FUSEBASE_COOKIE", "default-cookie-fixture");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("REV-01: named profile credentials", () => {
  it("rejects a missing profile instead of borrowing the default cookie or tokens", () => {
    vi.stubEnv("FUSEBASE_GATE_TOKEN", "default-token-fixture");
    expect(() => buildClient("missing")).toThrow(/profile.*credentials/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps a named token-only profile cookieless and does not fill a missing gateway from env", async () => {
    vi.stubEnv("FUSEBASE_GATE_TOKEN", "default-gate-fixture");
    vi.stubEnv("FUSEBASE_DASHBOARDS_TOKEN", "default-dashboards-fixture");
    vi.mocked(loadEncryptedToken).mockReturnValue({ gateToken: "named-gate-fixture" });
    const client = buildClient("agent");
    expect(client.getCookie()).toBe("");
    expect(client.getTokens().gateToken).toBe("named-gate-fixture");
    expect(client.gateBridge?.hasDashboards).toBe(false);
    await client.getOrgUsage();
    const init = vi.mocked(fetch).mock.calls[0][1];
    expect(new Headers(init?.headers).get("cookie")).toBeNull();
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer named-gate-fixture");
  });

  it("keeps a named cookie-only profile free of environment tokens", () => {
    vi.stubEnv("FUSEBASE_TOKEN", "default-unified-fixture");
    vi.mocked(loadEncryptedCookie).mockReturnValue({ cookie: "named-cookie-fixture", meta: null, savedAt: new Date().toISOString() });
    const client = buildClient("agent");
    expect(client.getCookie()).toBe("named-cookie-fixture");
    expect(client.gateBridge).toBeUndefined();
    expect(client.getTokens().token).toBeUndefined();
  });

  it("uses both stored credentials for a named hybrid profile", () => {
    vi.mocked(loadEncryptedCookie).mockReturnValue({ cookie: "named-cookie-fixture", meta: null, savedAt: new Date().toISOString() });
    vi.mocked(loadEncryptedToken).mockReturnValue({ gateToken: "named-gate-fixture", host: "unit-profile.invalid", orgId: "unit-org" });
    const client = buildClient("agent");
    expect(client.getCookie()).toBe("named-cookie-fixture");
    expect(client.getTokens().gateToken).toBe("named-gate-fixture");
  });

  it.each([undefined, "default"])("preserves environment precedence for default profile %s", (profile) => {
    vi.stubEnv("FUSEBASE_GATE_TOKEN", "default-gate-fixture");
    const client = buildClient(profile);
    expect(client.getCookie()).toBe("default-cookie-fixture");
    expect(client.getTokens().gateToken).toBe("default-gate-fixture");
    expect(loadEncryptedCookie).not.toHaveBeenCalled();
    expect(loadEncryptedToken).not.toHaveBeenCalled();
  });

  it("still falls back to the default encrypted store without environment credentials", () => {
    vi.stubEnv("FUSEBASE_COOKIE", "");
    vi.mocked(loadEncryptedCookie).mockReturnValue({ cookie: "stored-default-fixture", meta: null, savedAt: new Date().toISOString() });
    vi.mocked(loadEncryptedToken).mockReturnValue({ gateToken: "stored-default-token-fixture" });
    expect(buildClient().getCookie()).toBe("stored-default-fixture");
    expect(resolveTokens().gateToken).toBe("stored-default-token-fixture");
  });

  it.each([{ host: "other.invalid" }, { orgId: "other-org" }])("rejects mismatched stored token tenant metadata %j", (metadata) => {
    vi.mocked(loadEncryptedToken).mockReturnValue({ gateToken: "named-gate-fixture", ...metadata });
    expect(() => buildClient("agent")).toThrow(/tenant|host|organization/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a cookie recorded for another host", () => {
    vi.mocked(loadEncryptedCookie).mockReturnValue({ cookie: "named-cookie-fixture", meta: { host: "other.invalid", cookieCount: 1, cookies: [] }, savedAt: new Date().toISOString() });
    expect(() => buildClient("agent")).toThrow(/host|tenant/i);
  });

  it("validates profile names even when environment credentials are available", () => {
    vi.stubEnv("FUSEBASE_TOKEN", "default-token-fixture");
    expect(() => resolveTokens("../invalid")).toThrow(/Invalid profile/);
  });
});
