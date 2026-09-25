/**
 * Prompts that pull workspace context must read the client's real response shapes
 * (listPages → { items }, getRecentPages → { notes }, getTags → { tags }); they treated
 * each as a bare array, so the context was always empty.
 */
import { afterEach, describe, expect, it } from "vitest";
import { fakeClient, startServer } from "./helpers/server.js";

let close: (() => Promise<void>) | undefined;
afterEach(async () => { await close?.(); close = undefined; });

async function promptText(overrides: Record<string, unknown>, name: string, args: Record<string, string>) {
  const s = await startServer(fakeClient(overrides));
  close = s.close;
  const res = await s.mcp.getPrompt({ name, arguments: args });
  return res.messages.map((m: any) => m.content?.text ?? "").join("\n");
}

describe("prompt workspace context", () => {
  it("launch-client-portal lists workspace pages", async () => {
    const text = await promptText(
      { listPages: async () => ({ items: [{ globalId: "pg1", title: "Onboarding Guide" }], total: 1 }) },
      "launch-client-portal",
      { portalName: "P", clientCompany: "C", workspaceId: "ws1" },
    );
    expect(text).toContain('"Onboarding Guide" (ID: pg1)');
  });

  it("workspace-activity-digest lists recent pages", async () => {
    const text = await promptText(
      {
        getActivityStream: async () => null,
        getTasksWorkspaceSummary: async () => null,
        getRecentPages: async () => ({ notes: [{ globalId: "pg2", title: "Sprint Notes" }], count: 1 }),
      },
      "workspace-activity-digest",
      { workspaceId: "ws1" },
    );
    expect(text).toContain('"Sprint Notes" (pg2)');
  });

  it("audit-page-governance lists workspace tags", async () => {
    const text = await promptText(
      { getPageContent: async () => "<p>x</p>", getTags: async () => ({ workspaceId: "ws1", tags: ["roadmap", "q3"] }) },
      "audit-page-governance",
      { workspaceId: "ws1", pageId: "pg1" },
    );
    expect(text).toContain("roadmap");
    expect(text).toContain("q3");
  });
});
