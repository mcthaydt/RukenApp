import type { Handle } from "@sveltejs/kit/hooks";
import type { Copy } from "./copy.ts";

// The words a visitor sees when a copy is wired wrong. They say nothing about why: that goes to whoever runs the site.
const NOT_AVAILABLE = "Ruken is not available right now. Please try again in a few minutes.";

export interface CopyGuardDeps {
  /** Which copy this Worker is. */
  copy(): Copy;
  /** Which copy the database says it belongs to, or null when it has no stamp. */
  stamped(): Promise<Copy | null>;
  /** Tells whoever runs the site what is wrong. The visitor is never told. */
  report(message: string): void;
}

/**
 * Refuses every request while this Worker's copy and its database's stamp disagree, so a test Worker pointed at the
 * live database (or the other way round) reads and writes nothing but the stamp. Once one request finds them equal,
 * this Worker instance stops asking: the stamp never changes. A refusal remembers nothing, so a database that was
 * briefly down is asked again on the next request.
 */
export function copyGuard(deps: CopyGuardDeps): Handle {
  let matched = false;
  return async ({ event, resolve }) => {
    if (matched) return resolve(event);
    const problem = await whatIsWrong(deps);
    if (problem === null) {
      matched = true;
      return resolve(event);
    }
    deps.report(`copy guard: ${problem}`);
    return new Response(NOT_AVAILABLE, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  };
}

/** Why this Worker must not answer, or null when its copy and the database's stamp are the same. */
async function whatIsWrong(deps: CopyGuardDeps): Promise<string | null> {
  try {
    const copy = deps.copy();
    const stamp = await deps.stamped();
    if (stamp === copy) return null;
    return `this Worker is the ${copy} copy, but its database belongs to the ${stamp ?? "no"} copy`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
