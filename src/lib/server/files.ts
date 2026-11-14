import type { FileStore } from "../files/store.ts";

// The bucket the site keeps games and clips in. The host sets how to open it once, in src/hooks.server.ts, and
// every test sets its own, so no test needs Cloudflare. It is a setter of its own, not a member of `Platform`,
// so nothing that builds a `Platform` has to know about files.

export function setFileStore(open: () => FileStore): void {
  throw new Error(`not built yet: ${String(open)}`);
}

export function fileStore(): FileStore {
  throw new Error("not built yet");
}
