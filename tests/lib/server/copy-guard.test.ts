import { describe, expect, it, vi } from "vitest";
import type { Copy } from "../../../src/lib/server/copy.ts";
import { copyGuard, type CopyGuardDeps } from "../../../src/lib/server/copy-guard.ts";

const REFUSAL = "Ruken is not available right now. Please try again in a few minutes.";

type GuardInput = Parameters<ReturnType<typeof copyGuard>>[0];

/** A request through the guard, with a `resolve` that answers 200 "the page". */
async function ask(guard: ReturnType<typeof copyGuard>) {
  const resolve = vi.fn(() => Promise.resolve(new Response("the page")));
  const url = new URL("https://site.test/");
  const input = { event: { request: new Request(url), url }, resolve } as unknown as GuardInput;
  const response = await guard(input);
  return { response, resolve };
}

function deps(copy: Copy, stamped: () => Promise<Copy | null>) {
  return {
    copy: vi.fn<CopyGuardDeps["copy"]>(() => copy),
    stamped: vi.fn<CopyGuardDeps["stamped"]>(stamped),
    report: vi.fn<CopyGuardDeps["report"]>(),
  };
}

describe("copyGuard", () => {
  it("lets every request through when the copies are the same, and asks the database once", async () => {
    const both = deps("live", () => Promise.resolve("live"));
    const guard = copyGuard(both);
    for (let request = 0; request < 3; request += 1) {
      const { response, resolve } = await ask(guard);
      expect(resolve).toHaveBeenCalledOnce();
      expect(await response.text()).toBe("the page");
    }
    expect(both.stamped).toHaveBeenCalledOnce();
    expect(both.report).not.toHaveBeenCalled();
  });

  it("answers 503 and says why when the database belongs to the other copy", async () => {
    const wrong = deps("test", () => Promise.resolve("live"));
    const { response, resolve } = await ask(copyGuard(wrong));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(REFUSAL);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(resolve).not.toHaveBeenCalled();
    expect(wrong.report).toHaveBeenCalledWith(
      "copy guard: this Worker is the test copy, but its database belongs to the live copy",
    );
  });

  it("answers 503 when the database has no stamp", async () => {
    const unstamped = deps("live", () => Promise.resolve(null));
    const { response } = await ask(copyGuard(unstamped));
    expect(response.status).toBe(503);
    expect(unstamped.report.mock.calls[0]?.[0]).toMatch(/belongs to the no copy$/);
  });

  it("answers 503 when the database cannot be asked, and asks again on the next request", async () => {
    const answers: (() => Promise<Copy | null>)[] = [
      () => Promise.reject(new Error("connection refused")),
      () => Promise.resolve("live"),
    ];
    const flaky = deps("live", () => (answers.shift() ?? (() => Promise.resolve("live")))());
    const guard = copyGuard(flaky);

    const first = await ask(guard);
    expect(first.response.status).toBe(503);
    expect(first.resolve).not.toHaveBeenCalled();
    expect(flaky.report).toHaveBeenCalledWith("copy guard: connection refused");

    const second = await ask(guard);
    expect(second.resolve).toHaveBeenCalledOnce();
    expect(await second.response.text()).toBe("the page");
  });

  it("answers 503 when the Worker cannot say which copy it is", async () => {
    const unsure = deps("live", () => Promise.resolve("live"));
    unsure.copy.mockImplementation(() => {
      throw new Error('RUKEN_COPY must be "test" or "live". wrangler.jsonc sets it.');
    });
    const { response } = await ask(copyGuard(unsure));
    expect(response.status).toBe(503);
    expect(unsure.report).toHaveBeenCalledWith(
      'copy guard: RUKEN_COPY must be "test" or "live". wrangler.jsonc sets it.',
    );
  });

  it("tells no cache to keep a refusal", async () => {
    const { response } = await ask(copyGuard(deps("test", () => Promise.resolve("live"))));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
