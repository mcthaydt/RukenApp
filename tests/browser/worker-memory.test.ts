import { existsSync, readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The Worker must not keep memory from one request to the next. A database client made for every request left
// about 2.8 MB behind each time, until the Worker's heap filled and workerd aborted in the middle of a run
// (about 1,000 database requests; Cloudflare's own limit is 128 MB, so the live site would have met it far sooner).
// This sends 300 requests that each ask the database and measures what the Worker's processes (and the game
// gate's, which stays idle) hold before and after.
const REQUESTS = 300;
// What 300 requests may add. A client per request added about 835 MB; one shared client adds about 50 MB, which is
// mostly the one-off cost of the first requests, so the bar sits between the two.
const MOST_GROWTH_MB = 250;
const WARM_UP_REQUESTS = 10;

/** Resident memory, in MB, of every workerd process on this machine. Linux only: the journeys run on CI's. */
function workerdMemoryMb(): number {
  let kilobytes = 0;
  for (const pid of readdirSync("/proc").filter((name) => /^\d+$/.test(name))) {
    try {
      if (!readFileSync(`/proc/${pid}/comm`, "utf8").startsWith("workerd")) continue;
      const resident = /^VmRSS:\s*(\d+)/m.exec(readFileSync(`/proc/${pid}/status`, "utf8"))?.[1];
      if (resident !== undefined) kilobytes += Number(resident);
    } catch {
      // The process ended between listing it and reading it.
    }
  }
  return kilobytes / 1024;
}

test("300 requests that ask the database leave the Worker's memory where it was", async ({
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "computer",
    "The Worker's memory is the same for both devices; measure it once.",
  );
  test.skip(!existsSync("/proc/self/status"), "Needs Linux's /proc, which CI has.");

  const ask = async () => {
    // /healthz makes one query through the same client every page uses.
    expect((await request.get("/healthz")).status()).toBe(200);
  };
  // The first requests pay for the one-off work (loading Prisma's query compiler), which is not a leak.
  for (let i = 0; i < WARM_UP_REQUESTS; i++) await ask();

  const before = workerdMemoryMb();
  for (let i = 0; i < REQUESTS; i++) await ask();
  const grewMb = workerdMemoryMb() - before;

  expect(
    grewMb,
    `the Worker's memory grew ${grewMb.toFixed(0)} MB over ${String(REQUESTS)} requests`,
  ).toBeLessThan(MOST_GROWTH_MB);
});
