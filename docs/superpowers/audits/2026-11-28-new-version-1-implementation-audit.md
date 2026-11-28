# Open tabs load a newer version: implementation audit 1

- Pull request: #444. Reviewed head: e36639313c6b348251aaa755fe2f6c1151c6bb54 (e366393). Lane 2 (`src/lib/`, `src/routes/+layout.svelte`).
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-28 03:01 UTC.
- Verdict: **e366393 FAIL: 1 red**

## What ran

- `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`: exit 0.
- `pnpm test`: 170 files, 2442 tests passed.
- `tests/browser/new-version.test.ts` on the `computer` profile against the built Worker (`wrangler dev`, local Postgres 16): 3 of 3 passed. Not run: `phone` and `tablet` (WebKit is not installed in this container; the warm-WebKit global setup was skipped for the run). CI runs all three.
- A probe journey (not committed; text below) on the same build, 4 runs.

## Checked and fine

- Mid-game: coming back to `/g/[game]/play` never reloads; only exact route ids `/`, `/followed`, `/your-turn` do (sub-routes of `/your-turn` are excluded).
- Feed tabs hold no typed input (`YourFeed`, `FollowBadge`, `MarkedGames` carry only hidden inputs), so a reload there loses nothing typed.
- POST forms: `sendInApp` and `use:enhance` send the POST first; only the redirect that follows becomes a page load, so nothing sent is lost.
- Back/Forward: `popstate` is left alone; the next move after it loads the newer version.
- Reload loop: a reload needs a new `visibilitychange`, and a fresh page starts with `updated.current` false. SvelteKit's check sends `cache-control: no-cache` and treats a failed fetch as "no newer version". No loop found.
- `navigation.cancel()` in `beforeNavigate` makes `goto` return without throwing (kit `navigate` returns early; `complete` has a noop catch).
- Readiness: the "stayed" journeys wait on `html[data-version-checked="true"]`; the feed journey waits on the `load` event.
- CRUD: the change adds nothing a person makes.

## Red

**R1.** UNIT: `src/lib/new-version.ts` `movesAsPageLoad` (and its caller in `src/routes/+layout.svelte`). VERDICT: red. REQUIREMENT: the brief's own boundary ("no reload mid-form, unsaved input lost"; "on any other screen ... the newer version waits for the person's next move"), and the owner's rule against jarring page reloads. REASON: a `goto` the app makes while the person is still on the same screen is turned into a whole page load. Search runs `goto("/search?q=…", { replace: true, reset: false })` 250 ms after each pause in typing (`src/features/feed/Search.svelte:44`), so with a newer version out the search page reloads under the person's fingers. EVIDENCE: probe on `/search`, newer version out, type "ab", pause 260 ms, type "cdefgh": the page loaded again (`openedBefore` false), `history.length` went 2 → 3 (the `replace` was lost, so Back now steps through the search), and the field ended as `defghab` / `efghab` / `defghab` in three runs: keys typed during the load were dropped and the rest landed before the earlier text. The same applies to `stay-in-app.ts:54` (`goto(…, { replace: true })` back to the page the person is on, e.g. Up and Down on Your links): it becomes a page load and adds a history step. EXPECTED: a move that keeps the person on the same page (same pathname, only the query changes, or a redirect back to where they are) stays in the app; only a move to another page loads the newer version. FIX: in `movesAsPageLoad`, also leave alone a move whose `to.pathname` equals the current pathname (pass `from` pathname in `move`); add a unit case, and a journey in `tests/browser/new-version.test.ts` that types in Search with a newer version out and expects the page kept (`openedBefore` true), the field holding every key in order, and `history.length` unchanged. Files: `src/lib/new-version.ts`, `src/routes/+layout.svelte`, `tests/lib/new-version.test.ts`, `tests/browser/new-version.test.ts`.

## Notes (not blocking)

- N1. With a newer version out, each feed tab swipe (`FeedTop.svelte:53`, `goto(tab.href)`) is a whole page load, so the sideways slide is lost once. It follows the brief ("the next move loads it"), but the owner may notice the blink; on the feed the tab reloads on return anyway, so this mostly shows only when the version is learned from a data answer mid-session.
- N2. `data-version-checked` is set once and never cleared, so a journey that checks twice on one page cannot tell the second check finished. Fine for today's three journeys.
- N3. A bfcache return fires both `pageshow` (persisted) and `visibilitychange`, so the check runs twice; SvelteKit shares one fetch, harmless.

## Probe (not committed)

```ts
await page.goto("/search"); await pageHasSettled(page);
await page.evaluate(() => { (window as any).openedBefore = true; });
await page.route("**/_app/version.json", (r) => r.fulfill({ json: { version: "newer" } }));
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await expect(page.locator("html")).toHaveAttribute("data-version-checked", "true");
const field = page.getByRole("searchbox"); await field.click();
await field.pressSequentially("ab", { delay: 50 }); await page.waitForTimeout(260);
await page.keyboard.type("cdefgh", { delay: 40 }); await page.waitForTimeout(1500);
// → {"before":2,"opened":false,"len":3,"url":".../search?q=defghab","value":"defghab"}
```
