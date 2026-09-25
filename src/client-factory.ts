/**
 * Builds FusebaseClient instances for a given agent profile.
 *
 * Gate bridges are cached per token set, so each profile uses the tokens stored for it
 * (COR-13) and bridges with the same tokens share one MCP session.
 */

import { FusebaseClient } from "./client.js";
import { FusebaseGateBridge } from "./gate-bridge.js";
import { loadEncryptedCookie } from "./crypto.js";
import { resolveTokens, hasAnyToken, type TokenConfig } from "./config.js";

const bridges = new Map<string, FusebaseGateBridge>();
let proxyRelayUrl: string | undefined;

/** Route every client created from now on through the local proxy relay. */
export function setProxyRelayUrl(url: string | undefined): void {
  proxyRelayUrl = url;
}

/** The Gate bridge for a token set, created once and reused. */
export function bridgeFor(tokens: TokenConfig): FusebaseGateBridge | undefined {
  if (!hasAnyToken(tokens)) return undefined;
  const key = `${tokens.gateToken ?? ""}\u0000${tokens.dashboardsToken ?? ""}\u0000${tokens.token ?? ""}`;
  let bridge = bridges.get(key);
  if (!bridge) {
    bridge = new FusebaseGateBridge({ gateToken: tokens.gateToken, dashboardsToken: tokens.dashboardsToken, token: tokens.token });
    bridges.set(key, bridge);
  }
  return bridge;
}

/** Create a client for `profile` (undefined = the default profile). */
export function buildClient(profile?: string): FusebaseClient {
  const tokens = resolveTokens(profile);
  const gateBridge = bridgeFor(tokens);

  const host = process.env.FUSEBASE_HOST;
  const orgId = process.env.FUSEBASE_ORG_ID;

  let cookie = process.env.FUSEBASE_COOKIE || "";
  // A profile always uses its own stored cookie; the default profile falls back to disk.
  if (!cookie || profile) {
    const stored = loadEncryptedCookie(profile);
    if (stored?.cookie) cookie = stored.cookie;
  }

  if (!host || !orgId) {
    // Throw rather than exit: this runs inside tool calls, and the SDK turns a thrown
    // error into an isError result instead of killing the server (COR-10).
    throw new Error(
      "FuseBase is not configured: FUSEBASE_HOST and FUSEBASE_ORG_ID are missing. " +
      "Set them in .env, or provide valid FUSEBASE_GATE_TOKEN / FUSEBASE_DASHBOARDS_TOKEN so they can be discovered.",
    );
  }

  if (!cookie && !gateBridge?.isConfigured) {
    console.error(`[fusebase] Warning: Neither cookie nor token found. Run 'npx tsx scripts/auth.ts${profile ? ` --profile ${profile}` : ""}' to authenticate.`);
  }

  return new FusebaseClient({
    host,
    orgId,
    cookie: cookie || undefined,
    token: tokens.token,
    gateToken: tokens.gateToken,
    dashboardsToken: tokens.dashboardsToken,
    gateBridge,
    autoRefresh: Boolean(cookie),
    profile,
    proxyRelayUrl,
  });
}
