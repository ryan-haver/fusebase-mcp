import { useEffect, useState } from "react";
import { REQUEST_TIMEOUT_MS } from "../lib/api";

/**
 * Floating environment panel (staff/debug surface).
 *
 * Reads `fusebase-env.json` baked into the bundle by `fusebase deploy` when
 * the project uses app environments. Shows which stage this deployment is
 * (env name, backend, org) with a red badge for protected (production)
 * environments, and links to the same app's counterpart deployments.
 *
 * Switching stages is NAVIGATION between deployments — a deployed bundle IS
 * an environment; nothing is flipped at runtime. Counterparts in a different
 * org require sign-in there; open records/state do not carry over.
 *
 * Visibility: hidden by default. Enabled with `?envpanel=1` in the URL (also
 * persists the choice) or `localStorage.fbsEnvPanel = "1"`; disable with
 * `?envpanel=0`. Keep it staff-only — gate rendering behind your app's role
 * check (e.g. only owner/manager from your auth context) before enabling in
 * client-facing apps. Renders nothing when `fusebase-env.json` is absent
 * (legacy deploys, local dev).
 */

interface EnvInfoCounterpart {
  env: string;
  backend: string;
  url: string;
  protected: boolean;
  sameOrg: boolean;
}

interface EnvInfo {
  env: string;
  protected: boolean;
  backend: string;
  orgId: string;
  productId?: string;
  appKey: string;
  appId?: string;
  subdomain?: string;
  url?: string;
  counterparts: EnvInfoCounterpart[];
}

function panelEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("envpanel");
    if (fromQuery === "1") {
      window.localStorage.setItem("fbsEnvPanel", "1");
      return true;
    }
    if (fromQuery === "0") {
      window.localStorage.removeItem("fbsEnvPanel");
      return false;
    }
    return window.localStorage.getItem("fbsEnvPanel") === "1";
  } catch {
    return false;
  }
}

const styles = {
  root: {
    position: "fixed",
    right: 12,
    bottom: 12,
    zIndex: 9999,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    lineHeight: 1.5,
    color: "#e5e7eb",
    background: "rgba(17, 24, 39, 0.92)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
    padding: "8px 10px",
    maxWidth: 320,
  } as const,
  badge: (isProtected: boolean) =>
    ({
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 4,
      fontWeight: 700,
      background: isProtected ? "#dc2626" : "#2563eb",
      color: "#fff",
      marginRight: 6,
    }) as const,
  row: { opacity: 0.85 } as const,
  link: {
    color: "#93c5fd",
    textDecoration: "none",
  } as const,
  close: {
    position: "absolute",
    top: 4,
    right: 8,
    cursor: "pointer",
    opacity: 0.6,
    background: "none",
    border: "none",
    color: "inherit",
    fontSize: 12,
  } as const,
};

export function EnvPanel() {
  const [info, setInfo] = useState<EnvInfo | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!panelEnabled()) return;
    // Synchronous global first (injected into index.html at deploy — no
    // race); fetch of the JSON asset is the fallback for older deploys.
    const injected = (window as { __FUSEBASE_ENV__?: EnvInfo }).__FUSEBASE_ENV__;
    if (injected && typeof injected.env === "string") {
      setInfo(injected);
      return;
    }
    let cancelled = false;
    // Every fetch gets a cold-start-aware deadline (see REQUEST_TIMEOUT_MS).
    fetch("/fusebase-env.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.env === "string") {
          setInfo(data as EnvInfo);
        }
      })
      .catch(() => {
        // No env info baked into this deployment — render nothing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info || hidden) return null;

  return (
    <div style={styles.root} data-testid="fbs-env-panel">
      <button
        style={styles.close}
        onClick={() => {
          setHidden(true);
          try {
            window.localStorage.removeItem("fbsEnvPanel");
          } catch {
            // ignore
          }
        }}
        aria-label="Close environment panel"
      >
        ✕
      </button>
      <div>
        <span
          style={styles.badge(info.protected)}
          data-testid="fbs-env-panel-name"
        >
          {info.protected ? `PROD · ${info.env}` : info.env}
        </span>
        <span style={styles.row}>{info.backend}</span>
      </div>
      <div style={styles.row}>org {info.orgId}</div>
      {info.appId && (
        <div style={styles.row} data-testid="fbs-env-panel-app-id">
          app {info.appId}
        </div>
      )}
      {info.counterparts.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {info.counterparts.map((c) => (
            <div key={c.env}>
              →{" "}
              <a style={styles.link} href={c.url}>
                {c.env}
              </a>{" "}
              <span style={styles.row}>
                {c.protected ? "· prod" : ""}
                {!c.sameOrg ? " · other org, sign-in required" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
