# Private feed ranking, unit P2 (the seam): implementation audit 1

PR #361, head `49a6dab1e1c468af7e39705e81c634a8f8386998` (branch `claude/project-thread-1wvtua`). Lane 2. Spec: `docs/superpowers/specs/2026-11-22-private-feed-ranking-design.md` on `main` (#360, `ffab7fc`), section 4 row P2 and checks C1 to C5. Reviewer: fresh session, Opus 5.5, medium.

**Verdict: 49a6dab FAIL: 2 red.**

## What ran (on 49a6dab)

- `pnpm install --frozen-lockfile`, `pnpm lint`: exit 0. `pnpm typecheck`: exit 0. `pnpm test`: 148 files, 2152 tests, exit 0.
- Not run here: `pnpm test:pg`, `pnpm test:browser` (left to CI; at review time CI's browser shards 1, 3, 5, 6 were green, 2, 4, postgres and verify still running; `pr-rules-run` red, waiting on this verdict).
- A probe test (below), kept out of the branch.

## Checked and fine

- **Merge clash 1, `src/hooks.server.ts`.** Both behaviours kept: `consentGate(allowWrites)` stays third in `sequence` (after `httpsOnly`, `databasePerRequest`, before `createHandle`), and `setPrivateRanker(cloudflarePrivateFeed)` is set at module load beside `setPlatform`/`setFileStore`. Nothing else in the file moved.
- **Merge clash 2, `src/routes/+page.server.ts`.** Both kept: `launch` still comes from `launchServices().screenFor(userId | null, cookies)`, and `first` is `feed.service.page(null, feed.askingOf(locals.caller))`.
- **Public fallback with no private ranker.** `cloudflarePrivateFeed` answers `env.PRIVATE?.feed ?? null`; `wrangler.jsonc` is untouched, so dev, CI and the journeys have no binding. With `null`, `service.page` uses the open ranker and logs nothing (tests "a private address while the private ranker is gone", "an open page's own address goes on"). `PRIVATE?` is optional in `src/private-env.d.ts`.
- **C1.** `feed-329-pages.json` against the open ranker for worlds 0, 1, 2, 3, 60: same clips, keys, `next` with `o.`. `public-ranker.ts` is `order.ts` plus #329's paging moved unchanged.
- **C2, C3 (single page), C4, C5** are each tested (`ranker.test.ts`, `feed-public.test.ts`, `feed-private-boundary.test.ts`).
- **No private values leak.** The diff names no weight, setting value, `signals/` code or `FEED_SETTINGS` outside the boundary test, which lists names already public in #342 only to forbid them. `FEED_PUBLIC` defaults are safe sides (off, off, 7 days). Log lines name no viewer or value.

## Red

### R1. A lasting outage of the private Worker stalls the feed

- UNIT: `src/features/feed/service.ts`, the fallback branch of `page`.
- VERDICT: red.
- REQUIREMENT: spec section 1, "It has failed ... if the feed errors or stalls when the private Worker is down"; C3.
- REASON: when a binding is present but failing, the open ranker is always asked for a fresh first page (`open.page(request(null))`), even when the cursor is the open ranker's own `o.` address. So during an outage every "next page" is round 0 again, with the same keys.
- EVIDENCE: probe (copied below), binding present and throwing: `first = page(null)`, `second = page(first.next)`; every key of `second` is already in `first` (assertion `second.clips.some(new key)` fails; the same probe with no binding passes). `Feed.svelte:156-161` drops clips whose key it already has and keeps `next`, and its `$effect` (line 146) asks again at once, so the person sits on the spinner while the app asks for the same page over and over, each ask waiting on the failing Worker.
- EXPECTED: during an outage, an `o.` cursor goes on in the open order (as it does with no binding); only a `p.` cursor during an outage, or an `o.` cursor once the private ranker answers, starts fresh.
- FIX: in the fallback, call `open.page(request(cursor?.made === "open" ? cursor.rest : null))` (an open cursor the open ranker calls `bad-cursor` there should still be a fresh first page or a 400, the implementer's call, tested). Add a test in `tests/features/feed/ranker.test.ts`: binding present and throwing, page 2 from page 1's `next` has new keys and an `o.` next. Files: `service.ts`, `ranker.test.ts`.

### R2. "How the feed works" still says it follows the deleted `order.ts`

- UNIT: `src/routes/help/how-the-feed-works/+page.svelte:3`.
- VERDICT: red.
- REQUIREMENT: spec section 3 "How the feed works stays true" and the P2 row: "the source comment of `src/routes/help/how-the-feed-works/+page.svelte` if that page has merged". It has (#350; it is on `main` and in this head).
- REASON: the comment says "today is `src/features/feed/order.ts`", which this PR deletes, and does not carry the spec's rule that a private ranking change making the page untrue merges only after a RukenApp PR changes the page.
- EVIDENCE: `git show 49a6dab:src/routes/help/how-the-feed-works/+page.svelte | sed -n 3p`. The PR body's "For later units" says the page "is not on `main`", which was true before the merge with main and is not now.
- EXPECTED: the comment points at `src/features/feed/public-ranker.ts` and states the "page changes first" rule.
- FIX: edit that comment only (no words a visitor sees), and correct the PR body's line. Files: that `+page.svelte`, the PR body.

## Notes (not blocking, not fixed here)

- N1. `services.ts` `askingOf`: the comment "Nobody has said yes to cookies until the consent work merges" is stale; consent is on `main`. Passing `consented: false` is still the safe side (everyone `crowd`), and reading `rk_consent` belongs with the learned-feed unit that reads age, so leave the value; the comment could say that.
- N2. The PR brings forward parts the spec's table gives P4 (`FEED_PUBLIC`'s reader, the `PRIVATE?` type, `hooks.server.ts` handing in the binding). They do nothing while no binding exists, they are declared in the PR body, and `wrangler.jsonc` is untouched, so the lane stays 2. Recorded so P4 does not redo them.
- N3. The head does not hold `main`'s `ffab7fc` (#360: spec, learned spec, `progress.md`, docs only). No code clash; the next merge with main brings it.

## Probe used for R1

```ts
// tests/features/feed/probe-outage.test.ts (not committed)
const down = { page: () => Promise.reject(new Error("down")), notes: ..., health: ... } as unknown as Ranker;
it("binding present but down: the second page has new keys", async () => {
  const s = make(() => down);            // createFeedService with three live games
  const first = await s.page(null);
  const second = await s.page(first.next ?? "");
  const have = new Set(first.clips.map((c) => c.key));
  expect(second?.clips.some((c) => !have.has(c.key))).toBe(true);   // fails on 49a6dab
});
```
