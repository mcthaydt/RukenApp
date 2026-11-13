import pg from "pg";

/**
 * Forgets every rate-limit counter, so the next journey starts as a new visitor.
 *
 * Every journey reaches the site from the same address (the runner's), and the site limits sign-ups
 * to 5 an hour per address. Real visitors arrive from many addresses, so one test run would use up
 * the limit and fail for a reason no visitor would meet. The site's limits themselves are not
 * changed, loosened or turned off: only the counters are cleared, in the journeys' own database.
 */
export async function forgetRateLimits(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    throw new Error("TEST_DATABASE_URL is not set. The journeys run in CI's browser job.");
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('DELETE FROM "RateLimit"');
  } finally {
    await client.end();
  }
}
