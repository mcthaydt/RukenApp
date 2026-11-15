// Which copy of Ruken this is, and which copy a database belongs to. The deploy command loads this file in plain
// Node, before any build, so it imports nothing: not even this folder's own helpers.

/** Which copy of Ruken a Worker is: the test copy, filled with made-up content, or the live one people use. */
export type Copy = "test" | "live";

/**
 * The copy this Worker is, from RUKEN_COPY. wrangler.jsonc writes it for each Worker, so a missing or misspelt
 * value is a broken config, and the site refuses it rather than guess which copy it is.
 */
export function readCopy(source: Readonly<Record<string, string | undefined>> = process.env): Copy {
  const value = source.RUKEN_COPY;
  if (value === "test" || value === "live") return value;
  throw new Error('RUKEN_COPY must be "test" or "live". wrangler.jsonc sets it.');
}

/** One SQL statement with its values, answering its rows. */
export type RunSql = (sql: string, values: readonly string[]) => Promise<readonly Record<string, unknown>[]>;

/** The copy the database says it belongs to, or null when nothing has claimed it yet. */
export function stampedCopy(run: RunSql): Promise<Copy | null> {
  return Promise.reject(new Error(`not built yet (${typeof run})`));
}

/** Stamps an unstamped database as `copy`'s. */
export function claimCopy(run: RunSql, copy: Copy): Promise<void> {
  return Promise.reject(new Error(`not built yet (${typeof run}, ${copy})`));
}
