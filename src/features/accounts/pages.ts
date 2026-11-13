import type { Caller } from "./caller.ts";

export function signedInRedirect(caller: Caller, url: URL): { next: string } {
  throw new Error(`not built yet (${caller.kind} ${url.pathname})`);
}

export function signedInOnly(caller: Caller, url: URL): { userId: string; next: string } {
  throw new Error(`not built yet (${caller.kind} ${url.pathname})`);
}
