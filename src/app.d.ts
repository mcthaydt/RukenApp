import type { Caller } from "./features/accounts/accounts.ts";

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** Who sent this request, set by the hook in hooks.server.ts before any route runs. */
      caller: Caller;
    }
  }
}

export {};
