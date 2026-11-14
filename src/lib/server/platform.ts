// What the host gives that code cannot get anywhere else: the database's address and a way to keep work
// alive after the answer. The host sets it once, in src/hooks.server.ts; every test sets its own, so no test
// needs Cloudflare. This file imports nothing from the host, for the same reason.

export interface Platform {
  /** The address of the database for this request. */
  databaseUrl(): string;
  /** Keeps the host running until the work settles, after the answer has gone out. */
  waitUntil(work: Promise<unknown>): void;
}

let current: Platform | undefined;

export function setPlatform(next: Platform): void {
  current = next;
}

export function platform(): Platform {
  if (current === undefined) throw new Error("No platform is set. src/hooks.server.ts sets it.");
  return current;
}
