import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The marks for the social icons are copied in from a published CC0 package (design: "Real icons"). These tests hold the
// files to what the rule says: one path per site, nothing else, the licence beside them, and no new dependency.

const LIBRARY = new URL("../../../src/features/pages/library/", import.meta.url);
const text = (name: string) => readFileSync(new URL(name, LIBRARY), "utf8");

const SITE_IDS = [
  "youtube",
  "twitch",
  "discord",
  "x",
  "bluesky",
  "instagram",
  "tiktok",
  "steam",
  "itchio",
  "github",
];

describe("the social marks", () => {
  const marks = JSON.parse(text("social-icons.json")) as Record<string, unknown>;

  it("holds one path for each of the ten sites and no other key", () => {
    expect(Object.keys(marks).sort()).toEqual([...SITE_IDS].sort());
  });

  it("holds paths that start with M and use only path letters, digits, spaces, commas, dots and minus signs", () => {
    for (const [id, d] of Object.entries(marks)) {
      expect(typeof d, id).toBe("string");
      expect(d as string, id).toMatch(/^M[MmLlHhVvCcSsQqTtAaZz0-9 ,.-]*$/);
    }
  });

  it("keeps the package's licence, which says CC0", () => {
    expect(text("social-icons-LICENSE.txt")).toMatch(/CC0 1\.0 Universal/);
  });

  it("names the package, its version, its tarball and its integrity", () => {
    const source = JSON.parse(text("social-icons-source.json")) as Record<string, string>;
    expect(source.package).toBe("simple-icons");
    expect(source.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(source.tarball).toBe(
      `https://registry.npmjs.org/simple-icons/-/simple-icons-${source.version ?? ""}.tgz`,
    );
    expect(source.integrity).toMatch(/^sha512-[A-Za-z0-9+/]{86}==$/);
  });

  it("is not a dependency", () => {
    const manifest = readFileSync(new URL("../../../package.json", import.meta.url), "utf8");
    expect(manifest).not.toContain("simple-icons");
  });
});
