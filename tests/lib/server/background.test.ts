import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { runAfterAnswer } from "../../../src/lib/server/background.ts";
import { setPlatform } from "../../../src/lib/server/platform.ts";

// Mail is sent after the answer goes out. A Worker can be stopped once the answer is out, so the work
// is handed to the platform's waitUntil, which keeps it running to the end.

describe("runAfterAnswer", () => {
  it("hands the started work to the platform, so the host waits for it", async () => {
    const waitUntil = vi.fn<(work: Promise<unknown>) => void>();
    setPlatform({ databaseUrl: () => "", waitUntil });
    let finished = false;

    runAfterAnswer(async () => {
      await Promise.resolve();
      finished = true;
    });

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0]?.[0];
    expect(finished).toBe(true);
  });
});

describe("the background work's wiring", () => {
  it("hooks.server.ts sets the platform before it exports the handle", () => {
    const hooks = readFileSync(new URL("../../../src/hooks.server.ts", import.meta.url), "utf8");
    const setAt = hooks.indexOf("setPlatform(");
    expect(setAt).toBeGreaterThan(-1);
    expect(setAt).toBeLessThan(hooks.indexOf("export const handle"));
  });
});
