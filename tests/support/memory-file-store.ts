import type { ByteRange } from "../../src/lib/files/byte-range.ts";
import type { FileStore, StoredFile } from "../../src/lib/files/store.ts";

/**
 * A file store in memory, for tests. `tests/lib/files/store.test.ts` holds it to the same rules as the real one, so
 * every later test can trust it. Its etag is `"<size>-<a counter>"`: it changes on every put, even for equal bytes.
 */
export class MemoryFileStore implements FileStore {
  readonly #files = new Map<string, { bytes: Uint8Array; etag: string }>();
  #puts = 0;
  /** Every key `head` or `get` was asked for, in order: a test checks that a refused request never reached the bucket. */
  readonly reads: string[] = [];

  head(key: string): Promise<StoredFile | null> {
    this.reads.push(key);
    const stored = this.#files.get(key);
    return Promise.resolve(stored === undefined ? null : { size: stored.bytes.length, etag: stored.etag });
  }

  get(
    key: string,
    range?: ByteRange,
  ): Promise<{ file: StoredFile; body: ReadableStream<Uint8Array> } | null> {
    this.reads.push(key);
    const stored = this.#files.get(key);
    if (stored === undefined) return Promise.resolve(null);
    const bytes =
      range === undefined ? stored.bytes : stored.bytes.slice(range.offset, range.offset + range.length);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    return Promise.resolve({ file: { size: stored.bytes.length, etag: stored.etag }, body });
  }

  put(key: string, bytes: Uint8Array): Promise<void> {
    this.#puts += 1;
    this.#files.set(key, { bytes: bytes.slice(), etag: `"${String(bytes.length)}-${String(this.#puts)}"` });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.#files.delete(key);
    return Promise.resolve();
  }

  /** Every key held, in the order they were first stored. For assertions only; the real store has no such call. */
  keys(): string[] {
    return [...this.#files.keys()];
  }
}
