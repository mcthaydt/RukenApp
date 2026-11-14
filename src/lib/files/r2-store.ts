import type { ByteRange } from "./byte-range.ts";
import type { FileStore, StoredFile } from "./store.ts";

// The file store on Cloudflare R2. `R2Bucket` is a global type that `wrangler types` writes, so this file imports
// only the interface it fills and both Workers (the site and the game gate) can bundle it.

/** R2 knows the whole file's size even for a ranged read, and gives the tag already quoted for an HTTP header. */
function describe(object: R2Object): StoredFile {
  return { size: object.size, etag: object.httpEtag };
}

export function r2FileStore(bucket: R2Bucket): FileStore {
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
      await bucket.put(key, bytes);
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
