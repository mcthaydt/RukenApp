import pg from "pg";

/** The documentation range (192.0.2.0/24) the journeys' client addresses come from. */
const JOURNEY_ADDRESS_PREFIX = "192.0.2.";

/**
 * The client address this worker's journeys reach the site from.
 *
 * The site counts sign-ups per client address (5 an hour). Without this every journey arrives from the runner's own
 * address, so journeys running side by side in different workers share one counter: their sign-ups add up and a
 * journey is told "Too many tries" for a reason no visitor would meet. Each worker gets its own address, sent as the
 * CF-Connecting-IP header, which `wrangler dev` passes on as it stands and the site reads through SvelteKit's
 * getClientAddress(). On the real site Cloudflare sets that header itself, so a visitor cannot choose it.
 *
 * Playwright numbers the workers that run at the same time from 0 (TEST_PARALLEL_INDEX); a worker that takes over
 * from a finished one reuses its number, and never runs beside it. The config is also read outside any worker, where
 * there is no number; that copy makes no requests.
 */
export function journeyClientAddress(): string {
  const parallelIndex = Number(process.env.TEST_PARALLEL_INDEX ?? "0");
  return `${JOURNEY_ADDRESS_PREFIX}${String(parallelIndex + 1)}`;
}

/** The header that carries {@link journeyClientAddress}. Playwright gives it to every page, even one made by hand. */
export function journeyClientHeaders(): Record<string, string> {
  return { "CF-Connecting-IP": journeyClientAddress() };
}

/** Any journey address, as a pattern. */
const ANY_JOURNEY_ADDRESS = String.raw`192\.0\.2\.[0-9]+`;

/** Matches a counter key that holds an address, as "<address>|path", "...:<address>:..." or "...:<address>". */
function keyHolding(addressPattern: string): string {
  return `(^|:)${addressPattern}([|:]|$)`;
}

/**
 * Forgets this worker's rate-limit counters, so the next journey starts as a new visitor.
 *
 * A worker's journeys run one after another from the worker's own address (see above), and the site limits sign-ups
 * to 5 an hour per address, so a run would still use up the limit and fail for a reason no visitor would meet. The
 * site's limits themselves are not changed, loosened or turned off: only the counters are cleared, in the journeys'
 * own database. Counters that hold another worker's address are left alone, because that worker's journey may be
 * counting on them right now. Counters with no address in them (per person or per email) are cleared as before.
 */
export async function forgetRateLimits(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    throw new Error("TEST_DATABASE_URL is not set. The journeys run in CI's browser job.");
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('DELETE FROM "RateLimit" WHERE key !~ $1 OR key ~ $2', [
      keyHolding(ANY_JOURNEY_ADDRESS),
      keyHolding(journeyClientAddress().replaceAll(".", String.raw`\.`)),
    ]);
  } finally {
    await client.end();
  }
}
