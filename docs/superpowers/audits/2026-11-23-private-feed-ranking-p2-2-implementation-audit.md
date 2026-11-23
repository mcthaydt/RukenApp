# Private feed ranking, unit P2 (the seam): implementation audit 2

PR #361, head `41526ea42bcf2b29dfc1444160b4eb5f1c54254b` (branch `claude/project-thread-1wvtua`). Lane 2. Re-review after audit 1 (FAIL at `49a6dab`). Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 13:59 UTC.

**Verdict: 41526ea PASS.**

## What ran (on 41526ea)

- `pnpm install --frozen-lockfile`: exit 0. `pnpm lint`: exit 0. `pnpm typecheck`: exit 0. `pnpm test`: 148 files, 2154 tests, exit 0.
- CI on 41526ea: browser shards 1 to 6, gate, postgres, verify, commit-authors, pr-rules-run all success (quick, draft runs).
- Not run here: `pnpm test:pg`, `pnpm test:browser` (CI ran them green).
- A probe test (below), kept out of the branch.

## R1 (feed stuck on its first page during a private outage): fixed

- Change: `src/features/feed/service.ts`, the fallback branch now calls `open.page(request(cursor?.made === "open" ? cursor.rest : null))`, the same rule as the no-binding branch.
- Evidence: the audit-1 probe, widened to a ranker that throws and one that answers a bad shape, with six live games. Page 2 from page 1's `next` has keys page 1 did not. On 41526ea: 2 passed. With `service.ts` put back to its 49a6dab version: 2 failed. So the probe fails by itself and the fix turns it green.
- The builder's two new tests in `tests/features/feed/ranker.test.ts` (outage keeps scrolling with `o.` next for pages 2 and 3, equal to the open feed's page 2; `o.garbage` during an outage is null) also both fail against the 49a6dab `service.ts` and pass on 41526ea.
- An `o.` cursor the open ranker rejects during an outage is now a 400, as it already was with no binding. A `p.` cursor during an outage still starts fresh (existing test). Consistent with C3 as written in the PR body.

## R2 (help page comment pointed at deleted order.ts): fixed

- `src/routes/help/how-the-feed-works/+page.svelte` source comment now names `src/features/feed/public-ranker.ts` and states that a private ranking change making the page untrue merges only after a RukenApp PR changes the page (spec section 3). Only the HTML comment changed; no visitor-facing words.
- The PR body no longer says the page is not on `main`.

## Main merge and regressions

- `origin/main` (`ffab7fc`) is an ancestor of 41526ea. The merge (`395fb0a`) brought only docs: `git diff 49a6dab 41526ea` outside `docs/` touches only `service.ts`, `services.ts` (comment), the help page comment and `ranker.test.ts`.
- Consent gate: `src/hooks.server.ts` unchanged since audit 1; `consentGate(allowWrites)` still third in `sequence`, after `httpsOnly` and `databasePerRequest`, before `createHandle`.
- Launch screen: `src/routes/+page.server.ts` unchanged since audit 1; `launch` still from `launchServices().screenFor(...)`, `first` from `feed.service.page(null, feed.askingOf(locals.caller))`.
- `wrangler.jsonc`, `src/features/consent/`, `src/features/launch/` unchanged since audit 1.

## No private values leak

- The diff against `main` adds no weight, setting value, `signals/` code or `FEED_SETTINGS` outside `tests/feed-private-boundary.test.ts`, which names already-public names only to forbid them (as in audit 1). The new log line and comments name no viewer or value.

## Notes (not blocking)

- N1 from audit 1 (stale consent comment in `services.ts`) is reworded; the value stays `consented: false`, the safe side.
- N2 from audit 1 stands: P4 should not redo `FEED_PUBLIC`'s reader, the `PRIVATE?` type or the binding hand-in.

## Probe used for R1

```ts
// tests/features/feed/probe-outage.test.ts (not committed): ranker.test.ts lines 1-66 (helpers), then
for (const [name, answer] of [["threw", () => Promise.reject(new Error("down"))], ["bad answer", () => Promise.resolve({ nonsense: true })]] as const) {
  it(`binding present but ${name}: the second page has new keys`, async () => {
    const { ranker } = stubRanker(answer);
    const { service } = serviceWith({ privateRanker: () => ranker }, [listed("a", 20), listed("b", 21), listed("c", 22), listed("d", 23), listed("e", 24), listed("f", 25)]);
    const first = await service.page(null);
    const second = await service.page(first.next ?? "");
    const have = new Set(first.clips.map((c) => c.key));
    expect(second?.clips.some((c) => !have.has(c.key))).toBe(true);   // passes on 41526ea, fails on 49a6dab
  });
}
```
