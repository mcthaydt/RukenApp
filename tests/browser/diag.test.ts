import { expect, test } from "@playwright/test";

// DIAGNOSTIC ONLY, never merged: does workerd abort a few seconds after the daily trigger runs?
// Asks the database every 250 ms for 12 seconds after each trigger and prints every answer with its time.
const WATCH_MS = 12_000;
const EVERY_MS = 250;

test("workerd survives repeated daily triggers", async ({ request }) => {
  test.setTimeout(240_000);
  const failures: string[] = [];
  const started = Date.now();
  const line = (text: string) => process.stdout.write(`DIAG +${String(Date.now() - started)}ms ${text}\n`);

  for (let round = 1; round <= 4; round++) {
    const trigger = await request.get("/cdn-cgi/local/scheduled");
    line(`round ${String(round)}: trigger answered ${String(trigger.status())}`);
    const watchFrom = Date.now();
    while (Date.now() - watchFrom < WATCH_MS) {
      let answer: string;
      try {
        answer = String((await request.get("/healthz")).status());
      } catch (error) {
        answer = `threw ${String(error)}`;
      }
      if (answer !== "200")
        failures.push(`round ${String(round)} +${String(Date.now() - watchFrom)}ms ${answer}`);
      line(`round ${String(round)} healthz ${answer}`);
      await new Promise((resolve) => setTimeout(resolve, EVERY_MS));
    }
  }
  expect(failures).toEqual([]);
});
