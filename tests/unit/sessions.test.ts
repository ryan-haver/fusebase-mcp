/**
 * Per-session state (COR-13): the active profile belongs to one MCP session, and Gate
 * bridges are cached per token set.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createFusebaseServer } from "../../src/server.js";
import { bridgeFor } from "../../src/client-factory.js";
import { fakeClient } from "./helpers/server.js";

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of open.splice(0)) await close();
});

async function session(profilesSeen: Array<string | undefined>) {
  const { server } = createFusebaseServer({
    buildClient: (profile) => {
      profilesSeen.push(profile);
      return fakeClient({ listWorkspaces: async () => [] });
    },
    allTools: false,
  });
  const client = new Client({ name: "t", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  open.push(async () => { await client.close(); await server.close(); });
  return client;
}

describe("per-session active profile (COR-13)", () => {
  it("switching profile in one session does not affect another", async () => {
    const seenA: Array<string | undefined> = [];
    const seenB: Array<string | undefined> = [];
    const a = await session(seenA);
    const b = await session(seenB);

    await a.callTool({ name: "switch_active_profile", arguments: { profile: "agent-dev" } });
    await a.callTool({ name: "list_workspaces", arguments: {} });
    await b.callTool({ name: "list_workspaces", arguments: {} });

    expect(seenA.at(-1)).toBe("agent-dev");
    expect(seenB.at(-1)).toBeUndefined();

    const profilesB = await b.callTool({ name: "list_agent_profiles", arguments: {} });
    expect(JSON.parse((profilesB.content as any)[0].text).activeProfile).toBe("default");
  });
});

describe("Gate bridge cache", () => {
  it("reuses one bridge per token set and separates different tokens", () => {
    const one = bridgeFor({ gateToken: "token-one" });
    expect(bridgeFor({ gateToken: "token-one" })).toBe(one);
    expect(bridgeFor({ gateToken: "token-two" })).not.toBe(one);
    expect(bridgeFor({})).toBeUndefined();
  });
});
