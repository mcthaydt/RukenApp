import { describe, expect, it } from "vitest";
import { tarEntries, type TarEntry } from "../../../src/lib/files/tar.ts";
import { tarGz } from "../../support/tar.ts";

/** The bytes as a stream cut into pieces of `size`: a reader must not depend on where the pieces end. */
function streamOf(bytes: Uint8Array, size = bytes.length): ReadableStream<Uint8Array<ArrayBuffer>> {
  let at = 0;
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      if (at >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(at, at + size));
      at += size;
    },
  });
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** Every entry, with its content read when it is a file. */
async function readAll(stream: ReadableStream<Uint8Array<ArrayBuffer>>, limit = 10_000_000) {
  const seen: { path: string; kind: TarEntry["kind"]; size: number; bytes: Uint8Array | null }[] = [];
  for await (const entry of tarEntries(stream)) {
    const bytes = entry.kind === "file" ? await entry.bytes(limit) : null;
    seen.push({ path: entry.path, kind: entry.kind, size: entry.size, bytes });
  }
  return seen;
}

describe("tarEntries", () => {
  it("answers each file's path, size and bytes, in order", async () => {
    const tar = await tarGz([
      { path: "top/index.html", content: "<html>" },
      { path: "top/img/dot.png", content: new Uint8Array([1, 2, 3, 4, 5]) },
      { path: "top/empty.txt", content: "" },
    ]);
    const seen = await readAll(streamOf(tar));
    expect(seen.map((entry) => [entry.path, entry.kind, entry.size])).toEqual([
      ["top/index.html", "file", 6],
      ["top/img/dot.png", "file", 5],
      ["top/empty.txt", "file", 0],
    ]);
    expect(text(seen[0]?.bytes ?? new Uint8Array())).toBe("<html>");
    expect(Array.from(seen[1]?.bytes ?? [])).toEqual([1, 2, 3, 4, 5]);
    expect(seen[2]?.bytes?.length).toBe(0);
  });

  it("answers a path of 150 characters whole", async () => {
    const path = `top/${"folder/".repeat(20)}file.txt`;
    expect(path.length).toBeGreaterThan(140);
    const seen = await readAll(streamOf(await tarGz([{ path, content: "x" }])));
    expect(seen.map((entry) => entry.path)).toEqual([path]);
  });

  it("calls a link a link, and has no content to read for it", async () => {
    const seen = await readAll(
      streamOf(await tarGz([{ path: "top/shortcut", content: "index.html", link: true }])),
    );
    expect(seen).toEqual([{ path: "top/shortcut", kind: "link", size: 0, bytes: null }]);
  });

  it("skips an entry nobody read, and the next one is still right", async () => {
    const tar = await tarGz([
      { path: "top/big.bin", content: new Uint8Array(3000).fill(7) },
      { path: "top/after.txt", content: "after" },
    ]);
    const paths: string[] = [];
    let after = "";
    for await (const entry of tarEntries(streamOf(tar))) {
      paths.push(entry.path);
      if (entry.path === "top/after.txt") after = text(await entry.bytes(100));
    }
    expect(paths).toEqual(["top/big.bin", "top/after.txt"]);
    expect(after).toBe("after");
  });

  it("refuses to read a file over the limit it was given, and says so before reading", async () => {
    const tar = await tarGz([{ path: "top/eleven.txt", content: "12345678901" }]);
    for await (const entry of tarEntries(streamOf(tar))) {
      expect(entry.size).toBe(11);
      await expect(entry.bytes(10)).rejects.toThrow(RangeError);
      await expect(entry.bytes(11)).resolves.toHaveLength(11);
    }
  });

  it("throws when the download ends in the middle", async () => {
    const tar = await tarGz([{ path: "top/index.html", content: "x".repeat(5000) }]);
    const cut = tar.slice(0, Math.floor(tar.length / 2));
    await expect(readAll(streamOf(cut))).rejects.toThrow("The download ended early.");
  });

  it("reads a 5 MB file the same however the stream is cut", async () => {
    const content = Uint8Array.from({ length: 5_000_000 }, (_, i) => (i * 31 + (i >> 8)) % 251);
    const tar = await tarGz([{ path: "top/big.bin", content }]);
    const seen = await readAll(streamOf(tar, 64 * 1024));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.bytes?.length).toBe(5_000_000);
    expect(seen[0]?.bytes?.every((byte, i) => byte === content[i])).toBe(true);
  });

  it("reads a header that is split across two pieces of the stream", async () => {
    const tar = await tarGz([
      { path: "top/a.txt", content: "first" },
      { path: "top/b.txt", content: "second" },
    ]);
    // Pieces of 100 bytes put a 512-byte header across at least five of them.
    const seen = await readAll(streamOf(tar, 100));
    expect(seen.map((entry) => [entry.path, text(entry.bytes ?? new Uint8Array())])).toEqual([
      ["top/a.txt", "first"],
      ["top/b.txt", "second"],
    ]);
  });
});
