import type { FileStore } from "../files/store.ts";

// The bucket the site keeps games and clips in. The host sets how to open it once, in src/hooks.server.ts, and
// every test sets its own, so no test needs Cloudflare. It is a setter of its own, not a member of `Platform`,
// so nothing that builds a `Platform` has to know about files.

// An opener, not a store: on Cloudflare the bucket binding belongs to the request that is running, so it is
// looked up each time it is asked for.
let current: (() => FileStore) | undefined;

export function setFileStore(open: () => FileStore): void {
  current = open;
}

export function fileStore(): FileStore {
  if (current === undefined) throw new Error("No file store is set. src/hooks.server.ts sets it.");
  return current();
}
