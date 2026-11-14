// What the host gives that code cannot get anywhere else: the database's address and a way to keep work
// alive after the answer. The host sets it once, in src/hooks.server.ts; tests set their own.

export interface Platform {
  /** The address of the database for this request. */
  databaseUrl(): string;
  /** Keeps the host running until the work settles, after the answer has gone out. */
  waitUntil(work: Promise<unknown>): void;
}

export function setPlatform(next: Platform): void {
  throw new Error(`not built yet: ${next.databaseUrl()}`);
}

export function platform(): Platform {
  throw new Error("not built yet");
}
