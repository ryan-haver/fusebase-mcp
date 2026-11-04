import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendApiLog, atomicWrite, cachePath } from "../../src/runtime-data.js";
import { downloadRoot } from "../../src/tools/helpers.js";
import { cleanOwned, ownedItems, paginate, paginateCursor } from "../live/lib/cleanup-policy.js";
import { coverageAttempt, journalMutation, readJournal, ownedFixtures } from "../live/lib/fixture-journal.js";
import { isReadOperation } from "../../src/tool-effects.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fusebase-remediation-"));
  vi.stubEnv("FUSEBASE_DATA_DIR", dir);
  vi.stubEnv("FUSEBASE_ORG_ID", "test-org");
  vi.stubEnv("FUSEBASE_WORKSPACE_ID", "test-workspace");
  vi.stubEnv("LIVE_FIXTURE_JOURNAL", join(dir, "fixtures.jsonl"));
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe("REV-04/05/11 fixture safety", () => {
  it("never selects a customer resource by a test-like name", () => {
    const remove = vi.fn();
    const candidates = [{ kind: "database", id: "customer", workspaceId: "ws", name: "Customer Validation", remove }, { kind: "database", id: "owned", workspaceId: "ws", name: "QA", remove }];
    expect(ownedItems(candidates, [{ kind: "database", id: "owned", workspaceId: "ws" }])).toEqual([candidates[1]]);
    expect(ownedItems(candidates, [{ kind: "database", id: "owned", workspaceId: "other" }])).toEqual([]);
  });
  it("fails cleanup on a rejected delete or a still-present object", async () => {
    const item = { kind: "page", id: "p", name: "QA", remove: vi.fn().mockRejectedValue(new Error("403")) };
    await expect(cleanOwned([item], async () => [])).rejects.toThrow("deletion failed");
    item.remove.mockResolvedValue(undefined);
    await expect(cleanOwned([item], async () => [item])).rejects.toThrow("still present");
  });
  it("exhausts pagination and rejects ignored offsets", async () => {
    const rows = ["a", "b", "c", "d", "e"];
    expect(await paginate(async (offset, limit) => ({ items: rows.slice(offset, offset + limit), total: rows.length }), x => x, 2)).toEqual(rows);
    await expect(paginate(async () => ({ items: ["a", "b"] }), x => x, 2)).rejects.toThrow("repeated");
  });
  it("journals a committed-but-timed-out mutation and never replays it", async () => {
    const mutations: string[] = [];
    const fallback = vi.fn(async () => { mutations.push("cookie"); return {}; });
    await expect(coverageAttempt(true, () => journalMutation("create_page", {}, async () => { mutations.push("token"); throw new Error("Timeout after commit"); }), fallback)).rejects.toThrow("not replayed");
    expect(mutations).toEqual(["token"]);
    expect(fallback).not.toHaveBeenCalled();
    expect(readJournal().map(e => e.event)).toEqual(["started", "uncertain"]);
    await expect(Promise.resolve().then(() => ownedFixtures(readJournal(), "test-workspace", "test-org"))).rejects.toThrow("uncertain");
  });
  it("records exact created IDs and refuses a different tenant journal", async () => {
    await journalMutation("create_page", {}, async () => ({ id: "owned-page" }));
    expect(ownedFixtures(readJournal(), "test-workspace", "test-org")).toEqual([{ kind: "page", id: "owned-page", workspaceId: "test-workspace" }]);
    expect(() => ownedFixtures(readJournal(), "other", "test-org")).toThrow("another workspace");
  });
  it("allows fallback only for read calls and treats unknown direct operations as writes", async () => {
    expect(await coverageAttempt(false, async () => { throw new Error("unavailable"); }, async () => 42)).toBe(42);
    expect(isReadOperation("fusebase_direct_tool_call", { opId: "sendOrgEmail" })).toBe(false);
    expect(isReadOperation("fusebase_direct_tool_call", { opId: "getDashboardView" })).toBe(true);
    expect(isReadOperation("new_unknown_operation")).toBe(false);
    expect(isReadOperation("query_isolated_sql")).toBe(true);
    expect(isReadOperation("execute_isolated_sql")).toBe(false);
    expect(isReadOperation("get_unknown_operation")).toBe(false);
    expect(isReadOperation("download_attachment", {})).toBe(true);
    expect(isReadOperation("download_attachment", {saveToDisk:true})).toBe(false);
  });
});

describe("REV-10 data paths and retention", () => {
  it("separates tenant/profile caches and honors the external writable directory", () => {
    const file = cachePath("tenant", "org", "profile");
    expect(file.startsWith(dir)).toBe(true);
    expect(file).not.toBe(cachePath("tenant", "org", "other"));
    expect(file).not.toBe(cachePath("other", "org", "profile"));
    expect(downloadRoot()).toBe(join(dir, "downloads"));
    atomicWrite(file, "old"); atomicWrite(file, "new");
    expect(readFileSync(file, "utf8")).toBe("new");
    expect(readdirSync(join(dir, "cache"))).toHaveLength(1);
  });
  it("bounds log storage to a current file and one rotation", () => {
    for (let i = 0; i < 20; i++) appendApiLog("x".repeat(50), 100);
    expect(readdirSync(dir).sort()).toEqual(["api_log.jsonl", "api_log.jsonl.1"]);
    expect(statSync(join(dir, "api_log.jsonl")).size).toBeLessThanOrEqual(100);
    expect(statSync(join(dir, "api_log.jsonl.1")).size).toBeLessThanOrEqual(100);
  });
});

it("follows every cursor and rejects loops or incomplete listings", async () => {
  const fetch = vi.fn(async (cursor?: string) => cursor ? { data: [{id:"two"}], next: null } : { data: [{id:"one"}], next: "second" });
  const parse = (value: unknown) => (value as {data: {id:string}[]}).data;
  expect(await paginateCursor(fetch, parse, item => item.id)).toHaveLength(2);
  expect(fetch).toHaveBeenLastCalledWith("second");
  await expect(paginateCursor(async () => ({data: [], next:"repeat"}), parse, item => item.id)).rejects.toThrow("cyclic");
  await expect(paginateCursor(async () => ({data: [], total:2}), parse, item => item.id)).rejects.toThrow("Incomplete");
});
it("bounds UTF-8 log bytes", () => {
  appendApiLog("😀".repeat(100), 100);
  expect(statSync(join(dir, "api_log.jsonl")).size).toBeLessThanOrEqual(100);
});

it("journals exact SQL row identities before sending and refuses non-QA targets",async()=>{
 const args={storeId:"store",stage:"dev",table:"qa_validation_events",row:{id:"run-123-1",run_id:"run-123"}};
 await journalMutation("insert_isolated_sql_row",args,async()=>({}));
 expect(readJournal()[0].fixtures?.[0].sql).toMatchObject({rowId:"run-123-1",runId:"run-123",stage:"dev"});
 expect(ownedFixtures(readJournal(),"test-workspace","test-org")).toHaveLength(1);
 const send=vi.fn(async()=>({}));
 await expect(journalMutation("insert_isolated_sql_row",{...args,stage:"prod"},send)).rejects.toThrow("QA table in dev");
 expect(send).not.toHaveBeenCalled();
});
