import { afterEach, describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";

const CSV = "Name,Qty\nAlpha,1\n";

function client() {
  return new FusebaseClient({ host: "unit-test.invalid", orgId: "unit-org", cookie: "unit-cookie", autoRefresh: false });
}

afterEach(() => vi.unstubAllGlobals());

describe("FusebaseClient.importCSV (COR-3)", () => {
  // COR-3 regression: a 200 on a preliminary GET used to count as success without sending the CSV.
  it("uploads the CSV as multipart form data and sends no GET", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(init?.method === "POST" ? '{"ok":true}' : '{"status":"ready"}', { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(client().importCSV(CSV, "db", "dash", "view")).resolves.toEqual({ success: true, data: { ok: true } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    const body = init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(await (body.get("file") as Blob).text()).toBe(CSV);
    // fetch must set the multipart boundary itself
    expect((init?.headers as Record<string, string>)["content-type"]).toBeUndefined();
  });

  it("surfaces an API error instead of reporting success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad mapping", { status: 400 })));
    await expect(client().importCSV(CSV, "db", "dash", "view")).rejects.toThrow(/400/);
  });

  // COR-3 regression: .json() then .text() on the same body threw "Body is unusable".
  it("handles a non-JSON 200 response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>ok</html>", { status: 200 })));
    await expect(client().importCSV(CSV, "db", "dash", "view")).resolves.toMatchObject({ success: true });
  });
});
