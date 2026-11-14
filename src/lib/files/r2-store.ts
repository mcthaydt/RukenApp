import type { ByteRange } from "./byte-range.ts";
import type { FileStore, StoredFile } from "./store.ts";

// The file store on Cloudflare R2. `R2Bucket` is a global type that `wrangler types` writes, so this file imports
// only the interface it fills and both Workers (the site and the game gate) can bundle it.

const notBuilt = (what: string) => Promise.reject(new Error(`not built yet: ${what}`));

export function r2FileStore(bucket: R2Bucket): FileStore {
  return {
    head: (key: string): Promise<StoredFile | null> => notBuilt(`head ${key} ${typeof bucket}`),
    get: (key: string, range?: ByteRange) => notBuilt(`get ${key} ${String(range?.offset)}`),
    put: (key: string, bytes: Uint8Array): Promise<void> => notBuilt(`put ${key} ${String(bytes.length)}`),
    delete: (key: string): Promise<void> => notBuilt(`delete ${key}`),
  };
}
