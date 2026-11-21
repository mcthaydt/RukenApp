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

      it("deletes every file under a prefix, and only those", async () => {
        const store = make();
        await store.put("files/a/x", bytesOf(1));
        await store.put("files/a/y/z", bytesOf(2));
        await store.put("files/ab/x", bytesOf(3));

        const gone = await store.deleteAll("files/a/");

        expect(gone).toBe(2);
        expect(await store.head("files/a/x")).toBeNull();
        expect(await store.head("files/a/y/z")).toBeNull();
        expect(await store.head("files/ab/x")).not.toBeNull();
      });

      it("refuses a prefix that does not end in a slash, and deletes nothing", async () => {
        const store = make();
        await store.put("files/a/x", bytesOf(1));
        await store.put("files/ab/x", bytesOf(3));

        await expect(store.deleteAll("files/a")).rejects.toThrow("must end in a slash");

        expect(await store.head("files/a/x")).not.toBeNull();
        expect(await store.head("files/ab/x")).not.toBeNull();
      });

      it("answers 0 for a prefix with nothing under it", async () => {
        expect(await make().deleteAll("nothing/")).toBe(0);
      });

      it("knows whether anything is stored under a folder, and not under a longer sibling's name", async () => {
        const store = make();
        expect(await store.hasAny("files/ab/")).toBe(false);
        await store.put("files/abc/x", bytesOf(1));

        expect(await store.hasAny("files/ab/")).toBe(false);
        expect(await store.hasAny("files/abc/")).toBe(true);
        await store.deleteAll("files/abc/");
        expect(await store.hasAny("files/abc/")).toBe(false);
      });

      it("refuses to ask about a prefix that does not end in a slash", async () => {
        await expect(make().hasAny("files/a")).rejects.toThrow("must end in a slash");
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
      // R2 lists a page at a time; this stand-in has two keys under `files/a/`, listed in two pages of one.
      list: (...args: unknown[]) => {
        calls.push(["list", ...args]);
        const options = args[0] as { prefix: string; cursor?: string };
        return Promise.resolve(
          options.cursor === undefined
            ? { objects: [{ key: "files/a/x" }], truncated: true, cursor: "next" }
            : { objects: [{ key: "files/a/y" }], truncated: false },
        );
      },
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

  // Local R2 in the journeys is a Durable Object behind workerd, and a busy runner can drop the call to it: run
  // 44922343233 lost a clip that way ("Network connection lost."). Real R2 can fail a write for a moment too.
  describe("a put that fails for a moment", () => {
    function flakyBucket(failures: Error[]) {
      const tries: unknown[][] = [];
      const waits: number[] = [];
      const bucket = {
        put: (...args: unknown[]) => {
          tries.push(args);
          const failure = failures.shift();
          return failure === undefined ? Promise.resolve(null) : Promise.reject(failure);
        },
      };
      const store = r2FileStore(bucket as unknown as R2Bucket, {
        wait: (ms) => Promise.resolve(void waits.push(ms)),
      });
      return { store, tries, waits };
    }
    const lost = () => new Error("Network connection lost.");
    const markedRetryable = () => Object.assign(new Error("Internal error"), { retryable: true });

    it("is tried again after a dropped connection, with the same key and bytes", async () => {
      const { store, tries, waits } = flakyBucket([lost(), lost()]);
      const bytes = bytesOf(1, 2);

      await store.put("k", bytes);

      expect(tries).toEqual([
        ["k", bytes],
        ["k", bytes],
        ["k", bytes],
      ]);
      expect(waits).toEqual([100, 200]);
    });

    it("is tried again when Cloudflare marks the error as one to retry", async () => {
      const { store, tries } = flakyBucket([markedRetryable()]);

      await store.put("k", bytesOf(1));

      expect(tries).toHaveLength(2);
    });

    it("gives up after three tries and throws the last error", async () => {
      const { store, tries } = flakyBucket([lost(), lost(), lost(), lost()]);

      await expect(store.put("k", bytesOf(1))).rejects.toThrow("Network connection lost.");

      expect(tries).toHaveLength(3);
    });

    it("is not tried again for an error that does not pass, or when R2 is overloaded", async () => {
      const refused = flakyBucket([new Error("The key is too long.")]);
      const overloaded = flakyBucket([Object.assign(lost(), { retryable: true, overloaded: true })]);

      await expect(refused.store.put("k", bytesOf(1))).rejects.toThrow("The key is too long.");
      await expect(overloaded.store.put("k", bytesOf(1))).rejects.toThrow("Network connection lost.");

      expect(refused.tries).toHaveLength(1);
      expect(overloaded.tries).toHaveLength(1);
    });
  });

  it("lists a page at a time and deletes each page's keys in one call", async () => {
    const { store, calls } = standIn();

    expect(await store.deleteAll("files/a/")).toBe(2);

    expect(calls).toEqual([
      ["list", { prefix: "files/a/", cursor: undefined }],
      ["delete", ["files/a/x"]],
      ["list", { prefix: "files/a/", cursor: "next" }],
      ["delete", ["files/a/y"]],
    ]);
  });

  it("asks R2 for one key under the folder to know whether any is left", async () => {
    const { store, calls } = standIn();

    expect(await store.hasAny("files/a/")).toBe(true);

    expect(calls).toEqual([["list", { prefix: "files/a/", limit: 1 }]]);
  });

  it("refuses a prefix that does not end in a slash before it asks R2 anything", async () => {
    const { store, calls } = standIn();

    await expect(store.deleteAll("files/a")).rejects.toThrow("must end in a slash");

    expect(calls).toEqual([]);
  });
});
