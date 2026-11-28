# Implementation audit 1: a name and an address for every account (#465)

- Examined: `claude/project-thread-adrwam` at `c9e220f` (full `c9e220f33160416abcd41325f31ba7aeb9fc609c`), against `docs/superpowers/specs/2026-11-28-name-and-friend-address-at-sign-up-design.md` (plan audit 6 PASS at `ee89b36`).
- Lane 3 (migration `prisma/migrations/20261128093000_page_listed`, additive). Auditor: Opus 5.5, medium, a fresh session that did not build it.
- Written 2026-11-28 11:36 UTC.

**Verdict: FAIL, 2 red.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

- In this cloud container, at `c9e220f`: `pnpm lint` (0), `pnpm typecheck` (0 errors, 0 warnings), `pnpm test` (2468 passed), `pnpm test:pg` on Postgres 16 (846 passed, `migrations.pg.test.ts` and `schema.pg.test.ts` among them).
- Browser journeys, computer and tablet profiles (no WebKit in this container): `your-name`, `friends-from-sign-up`, `controls-overlap`, `fits-the-screen`, `gamepad`, `edit-page`, `feed`, `game-page`, `play`, `sign-up`, `cookie-consent`, `legal-pages`, `adults-only`, `feed-controls`, `follow-a-maker`, `look-layout`, `real-buttons`: 471 passed, 9 skipped, 0 failed (11.7 min). The global WebKit warm-up was left out by a local config (`globalSetup: undefined`), since this container has no WebKit.
- CI at `c9e220f` (run 46138992778, quick draft run): `verify` and `postgres` passed; `browser shard 1 of 6 (quick, draft)` failed one journey on the phone profile, so the other five shards were cancelled and `gate` failed. The phone profile's journeys are therefore checked only up to that failure.
- Overlap: `controls-overlap.test.ts` measures every control pair at 320×568, 375×667 and 667×375, with `/me/name` among its signed-in screens and a new case for an unlisted maker's clip and game page; it passed on computer and tablet. A probe at the same three sizes (Chromium) measured `/me`'s six side links: two to a line at every size, each 48px tall, none overlapping (375×667: Your computers x28 and Your name x214 on y315).

## Red findings

### R1. The gamepad cannot reach "Your name" on Your account on the phone

- UNIT: `src/routes/me/+page.svelte` (the "Your name" link after "Your computers") with `src/lib/look.css`'s side-link layout.
- VERDICT: red.
- REQUIREMENT: spec criterion 10 (the keyboard and gamepad reach every control the change adds), the owner's gamepad rule (everything fully navigable with a gamepad), and green CI.
- REASON: in Safari's engine at the phone profile, moving with the pad on `/me` never lands on "Your name".
- EVIDENCE: CI run 46138992778, `browser shard 1 of 6 (quick, draft)`: `[phone] › tests/browser/gamepad.test.ts:381:1 › signed in, the pad reaches everything on You, Your name, …` failed with `Error: the pad cannot reach these on http://localhost:4173/me` / `+ "Your name"` (`support/pad.ts:195`). The same journey passed on tablet and computer here, and a probe of the pad on `/me` in Chromium at 375×667, 320×568 and 667×375 reached everything, so the miss is in the phone engine's layout of the shared line.
- EXPECTED: `padReachesEverything` on `/me` passes on the phone profile; `/me` still fits 320×568 with nothing to scroll and no overlap.
- FIX: make "Your name" reachable by the pad on the phone (its place in the list or the side-link layout, or the pad's move between two links sharing a line), with the journey above as the check, run on the phone profile in CI. Files: `src/routes/me/+page.svelte`, `src/lib/look.css`, and `src/lib/pad-moves.ts` with `tests/lib/pad-moves.test.ts` only if the cause is the pad's move.

### R2. Taking a page down can make the new unlisted page at the same address

- UNIT: `src/routes/make/page/take-down/+page.server.ts` (`takeDown`: `removePage`, then `makeUnlistedPage(userId, page.name)`).
- VERDICT: red.
- REQUIREMENT: the pull request's own reading ("a new unlisted page is made at once from the same name, at a new address, so the old address is free again as before"), and the behaviour the journey keeps (`edit-page.test.ts:323`, "taking it down frees the address"; the route's own comment, "its address is free for anyone … to take again").
- REASON: `makeUnlistedPage` tries the name's own address first, and that address was freed a moment before, so a page whose address is its name made into an address (the editor's first answer sets name = address, so this is the usual case) gets its old address back, unlisted. Nobody else can take it.
- EVIDENCE: probe `docs/superpowers/audits/2026-11-28-name-and-friend-address-at-sign-up-1-probe-takedown.pg.test.ts.txt` (run with `pnpm test:pg` against the service at `c9e220f`): a page `night-owl` named "Night Owl", taken down, is made again at `night-owl`, and a second account's `savePage` at `night-owl` is refused "That one is taken. Pick another." The journey misses it because its page's name ("Night Owl") does not match its address (`owl…x`).
- EXPECTED: after Take my page down, the old address answers 404 and another account can take it; the account keeps a page with its name, at another address.
- FIX: the page made again never takes the address just taken down (for example `makeUnlistedPage` accepts an address to leave out, or take-down passes the old address so it is skipped), with a `service.pg.test.ts` case for a page whose address equals its name, and an `edit-page.test.ts` step that a second account can take the freed address. Files: `src/features/pages/service.ts`, `src/routes/make/page/take-down/+page.server.ts`, `tests/features/pages/service.pg.test.ts`, `tests/browser/edit-page.test.ts`.

## Checked and passing

- Criteria 1 to 13: each named check exists, asserts what the spec says, and passed here (database tests for 1, 3, 13; journeys for 1, 2, 4 to 12 on computer and tablet). Criterion 10 fails on the phone only (R1).
- The four readings in the body:
  1. The gate is `nameGate` in `src/features/pages/people-screens.ts`, last in `sequence()`, by `event.route.id`, one lookup for signed-in people on a people screen, with SvelteKit's `redirect` (the tap from `/help` to Home lands on `/me/name?next=%2F`). `tests/hooks/people-screens.test.ts` places every route folder in exactly one list. Matches the spec.
  2. "Back to your account" instead of the two ways out for an account that has a page: sensible; the ways out are for the stuck case the spec names.
  3. The editor treats an unlisted page as not made (`page === null || !page.listed` in `/make/page` and `own-page.server.ts`); `listInEditor` keeps the name, sets the address and `listed`; `edit-page.test.ts` checks it. Matches criterion 11.
  4. Take-down remaking a page: keeping "every account has a page" is the right reading (otherwise the gate would ask the name again straight after Take down), but the address claim is wrong (R2).
  5. "Your name" after "Your computers": `/me` keeps its lines at 320×568 (six links two to a line by the new `look.css` rule; with Saved and Reposts it is seven, the same four lines as before), `fits-the-screen.test.ts` passed unchanged, no overlap measured. The pad miss on the phone is R1.
- Migration: one `ALTER TABLE … ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT true`, so every existing page stays listed; no backfill and no write to anyone's data.
- Unlisted: the address route answers 404 before `countView` and the arrival; `/cookies` remembers no arrival for an unlisted page; the clip's maker and "Made by" are words, not links, when unlisted; search gives no maker row and does not match the address (games still found by the maker's name).
- CRUD: the name is created at sign-up (`your-name`), read on Your turn and the share sheet (`friends-from-sign-up`), updated from `/me` → Your name (`your-name`), and deleted with the account (`friends-from-sign-up`); the address is created at sign-up and deleted with the account; changing it is out of scope by the spec (slice 4).
- Keyboard and touch: the field, Save, Sign out and Delete my account are reached by Tab with focus showing, and pressed by tap (computer, tablet).
- Words: match the spec's Words section; the teen line shows for a 15 year old and not for an adult.
- Main merge `aa9b829` (main at `7d058b7`): the only conflict was `tests/browser/controls-overlap.test.ts`; `git show --remerge-diff` shows both tests kept whole (the unlisted maker case and main's "maker's own games and Live screen"), nothing else hand-edited.
- No feature beyond the spec: "Your name" on `/me` is spec item 5; nothing else new for players.

## Notes (not blocking)

- N1. `main` has moved to `2bef4f6` (#453, #456) since `7d058b7`, changing `src/features/feed/Feed.svelte`, `src/routes/g/[game]/+page.svelte`, `src/lib/look.css`, `tests/browser/controls-overlap.test.ts` and `tests/browser/game-page.test.ts`, which this change also touches. `git merge-tree` merges it cleanly, but the merge session reads those parts again after integrating.
- N2. `/me/name`'s rename returns the name as typed (`return { saved: true, name }`), so the field shows leading or trailing spaces that were not saved; returning the cleaned name would match what is kept.
- N3. The phone profile (WebKit) runs only in CI for this change; its first full run is after R1's fix.
