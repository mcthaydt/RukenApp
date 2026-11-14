// DIAGNOSTIC ONLY, never merged. Once a second it prints every Postgres session that is not idle (what it is
// running, how long, and what it waits on), so a request that hangs can be matched to a lock or a slow query.
// It serves /ready so Playwright can start it like the stand-in servers.
import { createServer } from "node:http";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await client.connect();

async function sample(): Promise<void> {
  const busy = await client.query(
    `SELECT pid, state, wait_event_type, wait_event, now() - xact_start AS xact_age, now() - query_start AS query_age, left(query, 110) AS query
     FROM pg_stat_activity
     WHERE datname = current_database() AND pid <> pg_backend_pid() AND state IS DISTINCT FROM 'idle'`,
  );
  const total = await client.query(
    "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()",
  );
  process.stderr.write(
    `PGSAMPLE ${new Date().toISOString()} sessions=${String((total.rows[0] as { n: number }).n)} busy=${JSON.stringify(busy.rows)}\n`,
  );
}

setInterval(() => {
  sample().catch((error: unknown) => process.stderr.write(`PGSAMPLE failed ${String(error)}\n`));
}, 1000);
createServer((_request, response) => response.end("ok")).listen(12113, "127.0.0.1");
