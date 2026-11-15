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

/**
 * One SQL statement with its values, answering its rows. Prisma's client and `pg`'s pool can each be wrapped as one:
 * the site reads the stamp through Prisma, and the deploy command writes it through `pg`, before Prisma's client
 * has been generated.
 */
export type RunSql = (sql: string, values: readonly string[]) => Promise<readonly Record<string, unknown>[]>;

const READ_STAMP = `SELECT "copy" FROM "CopyStamp" WHERE "id" = 1`;
// The row's id is always 1 (a CHECK keeps it so), so a second claim, even one started at the same moment, finds the
// first one's row and adds nothing.
const ADD_STAMP = `INSERT INTO "CopyStamp" ("id", "copy") VALUES (1, $1) ON CONFLICT ("id") DO NOTHING`;

/** The copy the database says it belongs to, or null when nothing has claimed it yet. */
export async function stampedCopy(run: RunSql): Promise<Copy | null> {
  const rows = await run(READ_STAMP, []);
  const copy = rows[0]?.copy;
  if (copy === undefined) return null;
  if (copy === "test" || copy === "live") return copy;
  // The table's CHECK allows nothing else, so this is a database someone changed by hand.
  throw new Error(`The database's stamp says ${String(copy)}, which is not a copy of Ruken.`);
}

/**
 * Stamps an unstamped database as `copy`'s, and does nothing when it already is. When it belongs to the other copy it
 * throws, so a deploy pointed at the wrong database stops before any code goes out.
 */
export async function claimCopy(run: RunSql, copy: Copy): Promise<void> {
  await run(ADD_STAMP, [copy]);
  const found = await stampedCopy(run);
  if (found !== copy) {
    throw new Error(
      `This database belongs to the ${String(found)} copy of Ruken, and this is the ${copy} copy. Nothing was changed.`,
    );
  }
}
