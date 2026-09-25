/**
 * SEC-11: FuseBase has returned whole internal request objects inside Gate error messages
 * (axios config with internal auth headers and a service secret). They must not be passed on
 * to MCP clients or logs. Values below are made up.
 */
import { describe, expect, it } from "vitest";
import { redactUpstreamDetail } from "../../src/gate-bridge.js";

const LEAKY =
  "HTTP 500 error for appendWorkspaceNoteContent (expected 200): " +
  JSON.stringify({
    message: "Request failed with status code 404",
    name: "AxiosError",
    stack: "AxiosError: Request failed\n    at settle (/app/node_modules/axios/dist/node/axios.cjs:2304:7)",
    config: { headers: { Authorization: "Internal 12345:auto", "X-Secret": "FAKE-SERVICE-SECRET", Accept: "application/json" }, url: "http://note-service/v1/x" },
    code: "ERR_BAD_REQUEST",
    status: 404,
  });

describe("redactUpstreamDetail (SEC-11)", () => {
  it("keeps the useful error fields and drops the request config and stack", () => {
    const out = redactUpstreamDetail(LEAKY);
    expect(out).toContain("HTTP 500 error for appendWorkspaceNoteContent");
    expect(out).toContain("Request failed with status code 404");
    expect(out).toContain("ERR_BAD_REQUEST");
    expect(out).not.toContain("FAKE-SERVICE-SECRET");
    expect(out).not.toContain("Internal 12345");
    expect(out).not.toContain("note-service");
    expect(out).not.toContain("node_modules");
  });

  it("redacts secret-looking values in text that isn't JSON", () => {
    const out = redactUpstreamDetail('failed: "X-Secret":"FAKE-SERVICE-SECRET", Authorization=Internal-abc, status 500');
    expect(out).not.toContain("FAKE-SERVICE-SECRET");
    expect(out).not.toContain("Internal-abc");
    expect(out).toContain("status 500");
  });

  it("caps very long details", () => {
    expect(redactUpstreamDetail("x".repeat(5000)).length).toBeLessThanOrEqual(501);
  });
});
