import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOCIAL_SITES } from "../../../src/features/pages/links.ts";

// The social marks are copied in from a published package (spec unit K, K1): it is not a dependency. These tests hold
// the files to the shape the page draws from and to the record of where they came from.

const LIBRARY = new URL("../../../src/features/pages/library/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, LIBRARY), "utf8");
const icons = () => JSON.parse(read("social-icons.json")) as Record<string, unknown>;

describe("the social marks", () => {
  it("hold one path per site and no other key", () => {
    expect(Object.keys(icons()).sort()).toEqual(SOCIAL_SITES.map((site) => site.id).sort());
  });

  it("are path data only: M first, then path letters, digits, spaces, commas, dots and minus signs", () => {
    for (const [id, path] of Object.entries(icons())) {
      expect(typeof path, id).toBe("string");
      expect(path, id).toMatch(/^M[MmZzLlHhVvCcSsQqTtAa0-9 ,.-]+$/);
    }
  });

  it("come with the package's licence, which is CC0", () => {
    const licence = read("social-icons-LICENSE.txt");
    expect(licence.split("\n")[0]).toBe("# CC0 1.0 Universal");
  });

  it("name their package, version, tarball and integrity, and the package is not a dependency", () => {
    const source = JSON.parse(read("social-icons-source.json")) as Record<string, unknown>;
    expect(source).toMatchObject({
      package: "simple-icons",
      version: expect.stringMatching(/^\d+\.\d+\.\d+$/) as unknown,
      tarball: expect.stringMatching(
        /^https:\/\/registry\.npmjs\.org\/simple-icons\/-\/simple-icons-[\d.]+\.tgz$/,
      ) as unknown,
      integrity: expect.stringMatching(/^sha512-[A-Za-z0-9+/]{86}==$/) as unknown,
      licence: "CC0-1.0",
    });
    const manifest = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect({ ...manifest.dependencies, ...manifest.devDependencies }).not.toHaveProperty("simple-icons");
  });

  it("record where in the package each mark came from", () => {
    const source = JSON.parse(read("social-icons-source.json")) as { paths: Record<string, string> };
    expect(Object.keys(source.paths).sort()).toEqual(Object.keys(icons()).sort());
    for (const path of Object.values(source.paths)) expect(path).toMatch(/^package\/icons\/[a-z]+\.svg$/);
  });
});
