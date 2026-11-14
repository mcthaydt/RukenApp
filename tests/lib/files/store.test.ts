import { describe, expect, it } from "vitest";
import { r2FileStore } from "../../../src/lib/files/r2-store.ts";
import type { FileStore } from "../../../src/lib/files/store.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";

const bytesOf = (...values: number[]) => new Uint8Array(values);
const readAll = async (body: ReadableStream<Uint8Array>) =>
  new Uint8Array(await new Response(body).arrayBuffer());

// The same rules for every store. The memory store is what every later test trusts, so it is held to them here.
describe("the memory file store", () => {
  const rules = (name: string, make: () => FileStore) => {
    describe(name, () => {
      it("answers null for a key nothing was stored under", async () => {
        const store = make();
        expect(await store.get("missing")).toBeNull();
        expect(await store.head("missing")).toBeNull();
      });

      it("answers the bytes and their size after a put", async () => {
        const store = make();
        await store.put("a", bytesOf(1, 2, 3, 4));

        const found = await store.get("a");

        expect(found?.file.size).toBe(4);
        expect(await readAll(found?.body as ReadableStream<Uint8Array>)).toEqual(bytesOf(1, 2, 3, 4));
      });

      it("answers only the asked-for bytes for a range, with the whole file's size", async () => {
        const store = make();
        await store.put("a", bytesOf(1, 2, 3, 4));

        const found = await store.get("a", { offset: 1, length: 2 });

        expect(found?.file.size).toBe(4);
        expect(await readAll(found?.body as ReadableStream<Uint8Array>)).toEqual(bytesOf(2, 3));
      });

      it("keeps the second of two puts to one key", async () => {
        const store = make();
        await store.put("a", bytesOf(1));
        await store.put("a", bytesOf(9, 9));

        const found = await store.get("a");

        expect(await readAll(found?.body as ReadableStream<Uint8Array>)).toEqual(bytesOf(9, 9));
      });

      it("changes the etag when the file is replaced", async () => {
        const store = make();
        await store.put("a", bytesOf(1));
        const before = await store.head("a");
        await store.put("a", bytesOf(1));

        expect((await store.head("a"))?.etag).not.toBe(before?.etag);
      });

      it("forgets a deleted file, and a delete of nothing is not an error", async () => {
        const store = make();
        await store.put("a", bytesOf(1));

        await store.delete("a");
        await store.delete("never-there");

        expect(await store.get("a")).toBeNull();
      });

      it("answers the size and the tag from head, without a body", async () => {
        const store = make();
        await store.put("a", bytesOf(1, 2, 3));

        const stored = await store.head("a");

        expect(stored?.size).toBe(3);
        expect(stored?.etag).toMatch(/^".+"$/);
        expect(stored).not.toHaveProperty("body");
      });
    });
  };

  rules("MemoryFileStore", () => new MemoryFileStore());

  it("lists its keys, for assertions", async () => {
    const store = new MemoryFileStore();
    await store.put("b", bytesOf(1));
    await store.put("a", bytesOf(1));
    await store.put("b", bytesOf(2));

    expect(store.keys()).toEqual(["b", "a"]);
  });
});

// R2 itself is exercised by the journeys (Miniflare's local bucket); this checks what the adapter asks of the
// binding and what it answers, with a stand-in that records the calls.
describe("r2FileStore", () => {
  function standIn() {
    const calls: unknown[][] = [];
    const object = { size: 7, httpEtag: '"r2-tag"', body: new ReadableStream<Uint8Array>() };
    const bucket = {
      head: (...args: unknown[]) =>
        Promise.resolve((calls.push(["head", ...args]), args[0] === "here" ? object : null)),
      get: (...args: unknown[]) =>
        Promise.resolve((calls.push(["get", ...args]), args[0] === "here" ? object : null)),
      put: (...args: unknown[]) => Promise.resolve(calls.push(["put", ...args])),
      delete: (...args: unknown[]) => Promise.resolve(calls.push(["delete", ...args])),
    };
    return { store: r2FileStore(bucket as unknown as R2Bucket), calls, object };
  }

  it("answers R2's size and its http etag, and null for a missing key", async () => {
    const { store } = standIn();

    expect(await store.head("here")).toEqual({ size: 7, etag: '"r2-tag"' });
    expect(await store.head("gone")).toBeNull();
    expect(await store.get("gone")).toBeNull();
  });

  it("asks for a range only when one is given, and hands on the body", async () => {
    const { store, calls, object } = standIn();

    const whole = await store.get("here");
    const part = await store.get("here", { offset: 2, length: 3 });

    expect(calls).toEqual([
      ["get", "here", undefined],
      ["get", "here", { range: { offset: 2, length: 3 } }],
    ]);
    expect(whole).toEqual({ file: { size: 7, etag: '"r2-tag"' }, body: object.body });
    expect(part?.body).toBe(object.body);
  });

  it("puts and deletes by key", async () => {
    const { store, calls } = standIn();
    const bytes = bytesOf(1, 2);

    await store.put("k", bytes);
    await store.delete("k");

    expect(calls).toEqual([
      ["put", "k", bytes],
      ["delete", "k"],
    ]);
  });
});
