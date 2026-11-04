import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../src/config.js", () => ({ loadEnvironment: async () => {} }));
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callTool, verifyWrite, writes, confirmNotFound } from "../live/lib/harness.js";
const fake = (reply: () => Promise<unknown>) => ({ callTool: reply } as unknown as Client);
afterEach(() => { writes.length = 0; });
it("does not accept a failed read, caught by a verifier, as write evidence", async () => {
  writes.push({id:1,tool:"update_page",args:"",at:"test"});
  const client = fake(async () => ({isError:true, content:[{type:"text",text:"request failed"}]}));
  await expect(verifyWrite("update_page", "must read", async () => { await callTool(client, "get_page", {}).catch(() => {}); }, {timeoutMs:0})).rejects.toThrow();
  expect(writes[0].proof).toBeUndefined();
});
it("accepts a successful independent read", async () => {
  writes.push({id:1,tool:"update_page",args:"",at:"test"});
  const client = fake(async () => ({content:[{type:"text",text:'{"id":"page"}'}]}));
  await verifyWrite("update_page", "fresh value", async () => { expect((await callTool(client,"get_page",{})).id).toBe("page"); });
  expect(writes[0].proof).toContain("get_page");
});

it("requires explicit confirmation of a genuine 404 read to prove deletion", async () => {
  writes.push({id:1,tool:"delete_page",args:"",at:"test"});
  const client = fake(async () => ({isError:true,content:[{type:"text",text:"Error: Fusebase API error: 404 - entity absent"}]}));
  await verifyWrite("delete_page", "fresh absence", async () => {
    try { await callTool(client,"get_page",{}); throw new Error("still exists"); }
    catch(error) { expect(confirmNotFound(error)).toBe(true); }
  });
  expect(writes[0].proof).toContain("get_page");
});
it.each(["HTTP 403 not found", "HTTP 500", "Timeout 404ms", "not found"])("rejects ambiguous absence: %s", async text => {
  const client = fake(async () => ({isError:true,content:[{type:"text",text}]}));
  const error = await callTool(client,"get_page",{}).catch(error => error);
  expect(confirmNotFound(error)).toBe(false);
});
