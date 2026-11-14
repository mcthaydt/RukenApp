// Asks an address once a second and exits 0 at the first 200, or 1 when the time is up. Playwright starts the game
// gate with this in front, so the gate opens its local storage only after the app has opened its own: two local
// Workers that open the same storage folder at the same moment stop with "database is locked".
//
// Usage: node tests/browser/support/when-up.ts <url>
// It waits as long as Playwright waits for the app (the app's `webServer` timeout, 180 seconds), so it never gives
// up on an app that Playwright would still be waiting for.

const GIVE_UP_AFTER_MS = 180_000;
const ASK_EVERY_MS = 1_000;

const url = process.argv[2];
if (url === undefined) {
  console.error("when-up: no address given");
  process.exit(1);
}

/** True when the address answers 200 now. A refused connection is the same as not yet. */
async function answers(address: string): Promise<boolean> {
  try {
    return (await fetch(address)).status === 200;
  } catch {
    return false;
  }
}

const deadline = Date.now() + GIVE_UP_AFTER_MS;
while (!(await answers(url))) {
  if (Date.now() > deadline) {
    console.error(`when-up: ${url} did not answer 200 within ${String(GIVE_UP_AFTER_MS / 1000)} seconds`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, ASK_EVERY_MS));
}
