/**
 * get_comment_threads returns each thread's comments with their text. The threadsInfo endpoint
 * only has counts, so its description ("nested comments") wasn't true, and a test couldn't
 * prove a posted comment was stored.
 */
import { afterEach, describe, expect, it } from "vitest";
import { deltaToPlainText } from "../../src/client.js";
import { fakeClient, startServer } from "./helpers/server.js";

describe("deltaToPlainText", () => {
  it("joins text inserts from a Delta JSON string and drops the trailing newline", () => {
    expect(deltaToPlainText('[{"insert":"Hello "},{"insert":"world","attributes":{"bold":true}},{"insert":"\\n"}]')).toBe("Hello world");
  });
  it("skips non-text inserts and accepts { ops }", () => {
    expect(deltaToPlainText({ ops: [{ insert: "a" }, { insert: { image: "x.png" } }, { insert: "b\n" }] })).toBe("ab");
  });
  it("returns non-JSON strings unchanged", () => {
    expect(deltaToPlainText("plain")).toBe("plain");
  });
});

describe("get_comment_threads", () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => { await close?.(); close = undefined; });

  it("includes each thread's comments as plain text", async () => {
    const s = await startServer(
      fakeClient({
        getCommentThreads: async () => [{ thread: { globalId: "t1", noteGlobalId: "p1", resolved: false }, comments: 2, unreadComments: 0 }],
        getThreadComments: async (_ws: string, threadId: string) => [
          { id: "c1", threadId, replyTo: null, text: "First comment" },
          { id: "c2", threadId, replyTo: "c1", text: "A reply" },
        ],
      }),
      { tier: "all" },
    );
    close = s.close;
    const { isError, text } = await s.callText("get_comment_threads", { workspaceId: "w1", pageId: "p1" });
    expect(isError).toBe(false);
    const [entry] = JSON.parse(text);
    expect(entry.comments).toBe(2);
    expect(entry.commentList.map((c: any) => c.text)).toEqual(["First comment", "A reply"]);
    expect(entry.commentList[1].replyTo).toBe("c1");
  });
});
