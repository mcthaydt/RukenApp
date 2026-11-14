import { readdirSync, readFileSync } from "node:fs";
import { test } from "@playwright/test";

// DIAGNOSTIC ONLY, never merged: how much does each kind of request leave behind in workerd?
// For each kind it sends many requests, one after another, and prints the growth in every workerd process's
// resident memory and in the Worker's reported JavaScript heap, per request.
const REQUESTS = 300;

function workerdMemoryMb(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const pid of readdirSync("/proc").filter((name) => /^\d+$/.test(name))) {
    try {
      if (!readFileSync(`/proc/${pid}/comm`, "utf8").startsWith("workerd")) continue;
      const rss = /^VmRSS:\s*(\d+)/m.exec(readFileSync(`/proc/${pid}/status`, "utf8"))?.[1];
      if (rss !== undefined) found[pid] = Math.round(Number(rss) / 1024);
    } catch {
      /* the process ended */
    }
  }
  return found;
}

const line = (text: string) => process.stdout.write(`DIAG ${text}\n`);

test("what each kind of request leaves behind", async ({ request }) => {
  test.setTimeout(600_000);
  const kinds = ["none", "client", "connect-only", "adapter-only", "delegating", "client", "delegating"];
  for (const mode of kinds) {
    const before = workerdMemoryMb();
    let heapFirst = -1;
    let heapLast = -1;
    for (let i = 0; i < REQUESTS; i++) {
      const answer = (await (await request.get(`/diag/leak?mode=${mode}`)).json()) as { heapUsed: number };
      if (i === 0) heapFirst = answer.heapUsed;
      heapLast = answer.heapUsed;
    }
    const after = workerdMemoryMb();
    const growth = Object.keys(after).map(
      (pid) => `${pid}:${String((after[pid] ?? 0) - (before[pid] ?? 0))}MB`,
    );
    line(
      `mode=${mode} requests=${String(REQUESTS)} rssGrowth=[${growth.join(" ")}] heapUsedFirst=${String(heapFirst)} heapUsedLast=${String(heapLast)} perRequestBytes=${String(Math.round((heapLast - heapFirst) / (REQUESTS - 1)))}`,
    );
  }
});
