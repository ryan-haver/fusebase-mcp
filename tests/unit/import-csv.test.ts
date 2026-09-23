import { afterEach, describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";

const CSV = "Name,Qty\nAlpha,1\n";

function client() {
  return new FusebaseClient({ host: "unit-test.invalid", orgId: "unit-org", cookie: "unit-cookie", autoRefresh: false });
}

afterEach(() => vi.unstubAllGlobals());

describe("FusebaseClient.importCSV (COR-3)", () => {
  // COR-3: a 200 on the preliminary GET is reported as success; the CSV is never sent.
  it.fails("uploads the CSV even when the preliminary GET returns 200", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(init?.method === "POST" ? '{"ok":true}' : '{"status":"ready"}', { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await client().importCSV(CSV, "db", "dash", "view");

    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
  });

  // COR-3: .json() consumes the body, then the .text() fallback throws "Body is unusable".
  it.fails("handles a non-JSON 200 response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>ok</html>", { status: 200 })));
    await expect(client().importCSV(CSV, "db", "dash", "view")).resolves.toMatchObject({ success: true });
  });
});
