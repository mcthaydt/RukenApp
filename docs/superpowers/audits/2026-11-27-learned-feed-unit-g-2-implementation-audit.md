# Learned feed, unit G (Like, Save, Repost): implementation audit, round 2

- PR: #404. Commit examined: `11ffbe3666401a8c2eec5de2bc12497e90859f26` (merge base with `main` 67ba234; merges cleanly with `main` at 16f8996).
- Lane 3 (a migration). Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-27 02:27 UTC (from `date`).
- Round 1: `2026-11-27-learned-feed-unit-g-1-implementation-audit.md` (FAIL at 14c77a1, 2 red).

**Verdict: FAIL, 1 red.** Both round-1 findings are fixed. The fix for R1 opens a new hole: a link someone sends can make a signed-in person like, save or repost a game they never pressed, once they say "I agree" and sign in.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | pass |
| `pnpm typecheck` | pass, 0 errors |
| `pnpm test` (unit) | 157 files, 2254 tests, pass |
| `pnpm test:pg` | not run here; CI's `postgres (quick, draft)` passed on this head |
| `feed-marks.test.ts` on phone (WebKit, in `mcr.microsoft.com/playwright:v1.63.0-noble`) and computer | 20 of 20 pass |
| CI on this head (quick, draft): verify, postgres, 6 browser pieces, gate | all pass |
| Audit probe (`2026-11-27-learned-feed-unit-g-2-probe.test.ts.txt`) | fails on phone and computer: shows R1 below |

## Round-1 findings

- **R1 (G5, "I agree" carries on to the press): fixed.** With no yes, Like/Save/Repost goes to `/cookies?for=<kind>&next=/me/press?…`; "I agree" sets `rk_mark_pressed` (only after the yes, in the agree action) and goes on to `/me/press`, which signs the person in first and then makes the press and returns to `/?at=<slug>`. Signed out with the yes, the 401 answer sets the note and sends the person to sign in with the way back. Journeys `"I agree" carries on to sign in and to the press…` and `signed out, a press goes to sign in…` pass on phone WebKit and computer.
- **R2 (phone journeys covered by the cookie card): fixed.** The no-yes journeys press "Not now" first, as a person would; "Not now" stores nothing (`Notice.svelte:5`, `device-store.ts`). 12 of 12 phone runs that failed in round 1 now pass.

## Strict cookie consent

- Nothing is kept before "I agree": `/api/feed/marks` is gated (`consent/routes.ts`), and refuses with 403 without the yes (journey checks it for all three kinds). `rk_mark_pressed` is set only by the 401 answer (which needs the yes to get past the gate) and by the agree action after `agree()`. A cookie set before a yes is stripped by the gate anyway.
- `rk_mark_pressed` is named on `/privacy` with its 30 minutes, and is in `RUKEN_COOKIES`, so taking the yes back deletes it.

## Red

**R1**
- UNIT: `src/routes/cookies/+page.server.ts` (agree action, lines 81–85) with `src/features/feed/pressed.ts`.
- VERDICT: red.
- REQUIREMENT: the brief's G5 fix as the PR states it, `pressed.ts` header: "The way back makes the press only when the two agree, so a link to it from anywhere presses nothing." A repost is a public act by the person.
- REASON: the agree action sets the press note from `next` alone, so any link that reaches the notice with `next=/me/press?…` (or a link straight to `/me/press?…`, which the consent gate turns into the notice with that `next`) makes the press after "I agree" and sign-in, though the person pressed nothing.
- EVIDENCE: probe journey, a browser with no yes and an account: `page.goto("/me/press?game=<slug>&kind=repost")` lands on `/cookies?for=account&next=%2Fme%2Fpress…`; the notice says only "To go on, Ruken needs to keep a few small things in your browser." (it names neither the repost nor the game). "I agree", then sign in, lands on `/?at=<slug>`, and `/me/reposts` lists the game: `Expected: 0, Received: 1` on phone (WebKit) and on computer. The existing journey `a link to the way back presses nothing…` passes only because that browser already has the yes and no note.
- EXPECTED: a link to `/me/press` or to `/cookies?next=/me/press…` that the person did not start from a clip makes no mark, with or without the yes; a press the person did make before the yes still carries through "I agree" and sign-in.
- FIX: keep the press in the feed's own page across the yes, not in an address. For example, the feed opens the notice in place (the `Notice` component already takes a reason), and on "I agree" its script carries on: the press is sent to `/api/feed/marks` (signed in) or the 401 note and sign-in follow (signed out, now with the yes). Then the agree action stops calling `rememberPress`. Add the probe above, as a journey, to `feed-marks.test.ts` in the "without the cookie yes" block. Files: `src/features/feed/Feed.svelte`, `src/routes/cookies/+page.server.ts`, `src/features/feed/pressed.ts` (comment), `tests/browser/feed-marks.test.ts`. If the builder finds a different route that keeps the address out of it, that is fine, as long as the probe passes and the existing G5 journeys still pass.

## Re-check of the whole PR (no new red)

- Migration only adds a table, an enum, two indexes and two cascading keys; one row per person, game and kind (unique key); `skipDuplicates` settles double presses.
- Own game: no buttons on the clip, 403 from the site, and `/me/press` keeps nothing (`marks.set` answers "own").
- Adults-only refusal applies on `/api/feed/marks` and `/me/press`.
- CRUD: create, read (reload and lists), update (press again), delete (feed and the lists' Remove) are in `feed-marks.test.ts`; purge removes a person's marks and the marks on their games (`purge.pg.test.ts`).
- The `/me/press` GET changes data, but only with the matching note, which only the person's own press sets (apart from R1); the note is HttpOnly, SameSite=Lax, 30 minutes, and goes after one use.
- Saved and Your reposts are linked on You only once they hold a live game (`src/routes/me/+page.server.ts`).

## Notes (not blocking)

- N1: the notice the gate shows for a link to `/me/press` says "To go on…" because `actionOfRoute` maps `/me/*` to "account". Moot once R1's fix stops sending people there through the notice.
- N2: `/me/press` for a game already marked leaves it marked (it only turns marks on). That is what the person pressed, so fine.
