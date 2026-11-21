import type { ByteRange } from "./byte-range.ts";
import { checkFolderPrefix, type FileStore, type StoredFile } from "./store.ts";

// The file store on Cloudflare R2. `R2Bucket` is a global type that `wrangler types` writes, so this file imports
// only the interface it fills and both Workers (the site and the game gate) can bundle it.

/** R2 knows the whole file's size even for a ranged read, and gives the tag already quoted for an HTTP header. */
function describe(object: R2Object): StoredFile {
  return { size: object.size, etag: object.httpEtag };
}

/** How many times a put is tried before its error is thrown. */
const PUT_TRIES = 3;

/**
 * Whether an R2 error is one that passes. The local R2 the journeys run on is a Durable Object inside workerd, and on a
 * busy machine the call to it can drop with "Network connection lost." (run 44922343233 lost a clip so); Cloudflare
 * marks such errors `retryable`, and asks that an `overloaded` one is not tried again, since that adds to the load.
 */
function passes(problem: unknown): boolean {
  if (!(problem instanceof Error)) return false;
  const marks = problem as Error & { retryable?: boolean; overloaded?: boolean };
  if (marks.overloaded === true) return false;
  return marks.retryable === true || problem.message.startsWith("Network connection lost");
}

const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** `wait` is how a retry pauses; tests pass one that does not. */
export function r2FileStore(
  bucket: R2Bucket,
  options: { wait?: (ms: number) => Promise<void> } = {},
): FileStore {
  const wait = options.wait ?? pause;

  return {
    async head(key) {
      const object = await bucket.head(key);
      // R2 types its stream as `ReadableStream<any>`; what it yields is bytes.
      return object === null ? null : describe(object);
    },
    async get(key, range?: ByteRange) {
      const object = await bucket.get(key, range === undefined ? undefined : { range });
      // R2 types its stream as `ReadableStream<any>`; what it yields is bytes.
      return object === null
        ? null
        : { file: describe(object), body: object.body as ReadableStream<Uint8Array> };
    },
    async put(key, bytes) {
      // R2 refuses a stream of unknown length, which is why a file is held whole, in bytes, before it is stored.
      // Holding the bytes also makes a retry safe: the same bytes go to the same key, and a second write of them
      // changes nothing. A maker's clip is not lost to a moment's failure; one that keeps failing still throws.
      for (let attempt = 1; ; attempt++) {
        try {
          await bucket.put(key, bytes);
          return;
        } catch (problem) {
          if (attempt >= PUT_TRIES || !passes(problem)) throw problem;
          await wait(100 * 2 ** (attempt - 1));
        }
      }
    },
    async delete(key) {
      await bucket.delete(key);
    },
    async deleteAll(prefix) {
      checkFolderPrefix(prefix);
      let gone = 0;
      let cursor: string | undefined;
      // R2 lists a page at a time (at most 1000 keys) and deletes up to 1000 keys in one call, so a page is one delete.
      do {
        // exactOptionalPropertyTypes: the first page has no cursor to pass, not an undefined one.
        const page = await bucket.list(cursor === undefined ? { prefix } : { prefix, cursor });
        const keys = page.objects.map((object) => object.key);
        if (keys.length > 0) await bucket.delete(keys);
        gone += keys.length;
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor !== undefined);
      return gone;
    },
    async hasAny(prefix) {
      checkFolderPrefix(prefix);
      return (await bucket.list({ prefix, limit: 1 })).objects.length > 0;
    },
  };
}
