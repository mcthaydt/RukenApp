import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { keepBackgroundWorkAlive, runAfterAnswer } from "../../../src/lib/server/background.ts";

// Mail is sent after the answer goes out. On Netlify Functions the instance can be frozen once the
// answer is out, so the work is handed to the platform's waitUntil, which keeps it running to the end.

type Resolve = Parameters<typeof keepBackgroundWorkAlive>[0]["resolve"];

function eventOn(platform: unknown): RequestEvent {
  return { platform } as unknown as RequestEvent;
}

describe("runAfterAnswer", () => {
  it("hands the work to the request's waitUntil, so the platform waits for it", async () => {
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    let finished = false;
    const resolve: Resolve = () => {
      runAfterAnswer(async () => {
        await Promise.resolve();
        finished = true;
      });
      return Promise.resolve(new Response("ok"));
    };

    await keepBackgroundWorkAlive({ event: eventOn({ context: { waitUntil } }), resolve });

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0]?.[0];
    expect(finished).toBe(true);
  });

  it("calls waitUntil on its own context, as Netlify's needs", async () => {
    const context = {
      kept: [] as Promise<unknown>[],
      waitUntil(promise: Promise<unknown>) {
        this.kept.push(promise);
      },
    };
    const resolve: Resolve = () => {
      runAfterAnswer(() => Promise.resolve());
      return Promise.resolve(new Response("ok"));
    };

    await keepBackgroundWorkAlive({ event: eventOn({ context }), resolve });

    expect(context.kept).toHaveLength(1);
  });

  it("still runs the work where there is no waitUntil (a long-lived server, tests)", async () => {
    let ran = false;
    const resolve: Resolve = () => {
      runAfterAnswer(() => {
        ran = true;
        return Promise.resolve();
      });
      return Promise.resolve(new Response("ok"));
    };

    await keepBackgroundWorkAlive({ event: eventOn(undefined), resolve });
    runAfterAnswer(() => Promise.resolve());

    expect(ran).toBe(true);
  });
});
