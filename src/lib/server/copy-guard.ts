import type { Handle } from "@sveltejs/kit/hooks";
import type { Copy } from "./copy.ts";

export interface CopyGuardDeps {
  /** Which copy this Worker is. */
  copy(): Copy;
  /** Which copy the database says it belongs to, or null when it has no stamp. */
  stamped(): Promise<Copy | null>;
  /** Tells whoever runs the site what is wrong. The visitor is never told. */
  report(message: string): void;
}

/** Refuses every request while this Worker's copy and its database's stamp disagree. */
export function copyGuard(deps: CopyGuardDeps): Handle {
  return () => Promise.reject(new Error(`not built yet (${typeof deps})`));
}
