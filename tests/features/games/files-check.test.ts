import { describe, expect, it } from "vitest";
import {
  checkGameFiles,
  connectHostsFrom,
  MAX_FILE_BYTES,
  MAX_GAME_BYTES,
  MAX_GAME_FILES,
  type PulledFile,
} from "../../../src/features/games/files-check.ts";

const file = (path: string, size = 100): PulledFile => ({ path, size, kind: "file" });

const tiny: PulledFile[] = [file("index.html", 100), file("main.js", 200), file("img/a.png", 300)];
const INDEX = '<script src="main.js"></script>';

describe("the limits", () => {
  it("are FloorFifty's measured build times four, rounded up", () => {
    expect(MAX_GAME_BYTES).toBe(400_000_000);
    expect(MAX_GAME_FILES).toBe(1_500);
    expect(MAX_FILE_BYTES).toBe(50_000_000);
  });
});

describe("checkGameFiles", () => {
  it("accepts a game and answers its count and its bytes", () => {
    expect(checkGameFiles(tiny, INDEX)).toEqual({ ok: true, fileCount: 3, totalBytes: 600 });
  });

  it("refuses a folder with no files", () => {
    expect(checkGameFiles([], null)).toEqual({
      ok: false,
      problem: "We couldn't find that folder in your repository. Check the folder's name and pull again.",
    });
  });

  it("refuses a game with no index.html at the top", () => {
    expect(checkGameFiles([file("main.js")], null)).toEqual({
      ok: false,
      problem:
        "We couldn't find an index.html at the top of that folder. Ruken starts a game from index.html.",
    });
  });

  it("refuses a link to another file, naming it", () => {
    const files: PulledFile[] = [...tiny, { path: "assets/shortcut", size: 10, kind: "link" }];
    expect(checkGameFiles(files, INDEX)).toEqual({
      ok: false,
      problem:
        "assets/shortcut is a link to another file. Ruken copies real files only. Replace it with the file itself.",
    });
  });

  // Review Focus 5: a repository that keeps its big files in Git LFS, or holds a link, is refused by name.
  it("refuses a file kept in Git LFS, naming it", () => {
    const files: PulledFile[] = [...tiny, { path: "sound/theme.ogg", size: 130, kind: "lfs" }];
    expect(checkGameFiles(files, INDEX)).toEqual({
      ok: false,
      problem:
        "sound/theme.ogg is kept in Git LFS, and Ruken can't pull those yet. Add the real file to the repository.",
    });
  });

  it("names the link before the LFS file: the first failing rule wins", () => {
    const files: PulledFile[] = [
      ...tiny,
      { path: "b-lfs", size: 130, kind: "lfs" },
      { path: "a-link", size: 10, kind: "link" },
    ];
    expect(checkGameFiles(files, INDEX)).toEqual({
      ok: false,
      problem:
        "a-link is a link to another file. Ruken copies real files only. Replace it with the file itself.",
    });
  });

  it.each(["../x.js", "a//b.js", "a\\b.js", "a%2fb.js", "x/./y.js", "a".repeat(301)])(
    "refuses the file name %j that Ruken cannot serve",
    (path) => {
      expect(checkGameFiles([...tiny, file(path)], INDEX)).toEqual({
        ok: false,
        problem: `One of your files has a name Ruken can't serve: ${path}. Rename it and pull again.`,
      });
    },
  );

  it("refuses more files than the limit", () => {
    const many = [
      file("index.html", 1),
      ...Array.from({ length: MAX_GAME_FILES }, (_, i) => file(`f/${String(i)}.js`, 1)),
    ];
    expect(checkGameFiles(many, INDEX)).toEqual({
      ok: false,
      problem: "Your game has 1,501 files. The most Ruken takes is 1,500.",
    });
  });

  it("refuses one file over its limit, in whole megabytes rounded up", () => {
    const files = [...tiny, file("assets/big.bin", MAX_FILE_BYTES + 1)];
    expect(checkGameFiles(files, INDEX)).toEqual({
      ok: false,
      problem: "assets/big.bin is 51 MB. The biggest single file Ruken takes is 50 MB.",
    });
  });

  it("refuses a game that is too big in all", () => {
    // Nine files of 45 MB are each under the file limit and 405 MB together (the index is empty, so the sum is exact).
    const files = [
      file("index.html", 0),
      ...Array.from({ length: 9 }, (_, i) => file(`d/${String(i)}.bin`, 45_000_000)),
    ];
    expect(checkGameFiles(files, INDEX)).toEqual({
      ok: false,
      problem: "Your game's files add up to 405 MB. The most Ruken takes is 400 MB.",
    });
  });

  it("accepts an address that starts with two slashes or a scheme", () => {
    const html = '<script src="//cdn.example/x.js"></script><link href="https://example/x.css">';
    expect(checkGameFiles(tiny, html)).toEqual({ ok: true, fileCount: 3, totalBytes: 600 });
  });

  // Review Focus 4: a game whose index.html loads /assets/main.js from the top of the site is refused at the
  // pull, with words that say how to fix it, and is never live and broken.
  it("names the first address that starts at the top of the site", () => {
    expect(checkGameFiles(tiny, '<script src="/assets/main.js"></script>')).toEqual({
      ok: false,
      problem:
        "index.html loads /assets/main.js from the top of the site. On Ruken a game lives in a folder, so write it without the first slash: assets/main.js.",
    });
  });

  it("finds a top-of-site address in href and in single quotes, and takes the first", () => {
    const html = "<link href='/css/a.css'><script src=\"/js/b.js\"></script>";
    expect(checkGameFiles(tiny, html)).toEqual({
      ok: false,
      problem:
        "index.html loads /css/a.css from the top of the site. On Ruken a game lives in a folder, so write it without the first slash: css/a.css.",
    });
  });
});

describe("connectHostsFrom", () => {
  const PROBLEM = "Write each server as a name like api.example.com, one per line, five at most.";

  it("lower-cases, drops blank lines and keeps a port", () => {
    expect(connectHostsFrom("API.Example.com\n\nrt.example.com:8443")).toEqual({
      hosts: ["api.example.com", "rt.example.com:8443"],
    });
  });

  it("reads Windows line ends too", () => {
    expect(connectHostsFrom("a.example.com\r\nb.example.com\r\n")).toEqual({
      hosts: ["a.example.com", "b.example.com"],
    });
  });

  it("answers no hosts for an empty text", () => {
    expect(connectHostsFrom("")).toEqual({ hosts: [] });
    expect(connectHostsFrom("  \n \n")).toEqual({ hosts: [] });
  });

  it.each([
    "https://api.example.com",
    "api.example.com/x",
    "*.example.com",
    "localhost",
    "api example.com",
    "api.example.com:abc",
    "-bad.example.com",
  ])("refuses %j with the problem's words", (text) => {
    expect(connectHostsFrom(text)).toEqual({ problem: PROBLEM });
  });

  it("refuses six names", () => {
    const six = ["a", "b", "c", "d", "e", "f"].map((name) => `${name}.example.com`).join("\n");
    expect(connectHostsFrom(six)).toEqual({ problem: PROBLEM });
  });

  it("accepts five names", () => {
    const five = ["a", "b", "c", "d", "e"].map((name) => `${name}.example.com`);
    expect(connectHostsFrom(five.join("\n"))).toEqual({ hosts: five });
  });

  it("refuses a repeated name, whatever its letter case", () => {
    expect(connectHostsFrom("a.example.com\nA.example.com")).toEqual({ problem: PROBLEM });
  });
});
