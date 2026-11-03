import { describe, expect, it } from "vitest";
import { parseGuideUrl } from "../../src/guide-url.js";

describe("official guide URLs", () => {
  it("preserves nested guide paths", () => {
    expect(parseGuideUrl("/guides/basics/hint-object/")).toEqual({ section: "basics", slug: "hint-object", url: "https://thefusebase.com/guides/basics/hint-object/" });
  });
  it("includes flat CLI guides without inventing a general/ URL", () => {
    expect(parseGuideUrl("https://thefusebase.com/guides/update/?ref=docs#flags")).toEqual({ section: "general", slug: "update", url: "https://thefusebase.com/guides/update/" });
  });
  it.each(["https://other.invalid/guides/update/", "/guides/", "/guides/a/b/c/", "/guides/a/../../secret", "/guides/a/b.exe"])("rejects non-guide or unsafe URL %s", (url) => {
    expect(parseGuideUrl(url)).toBeNull();
  });
});
