# Plan audit 3: a name and an address for every account

- Audited: PR #461, `docs/superpowers/specs/2026-11-28-name-and-friend-address-at-sign-up-design.md` at `d3a575cabeaf0ddbe68c11cf02f1c9c0a62ef90c` (`d3a575c`), against `main` at `04689e5`.
- Auditor: fresh session, Opus 5.5, medium. Lane 3 plan audit, round 3, read-only except this file.
- Written 2026-11-28 08:54 UTC (`date -u`).

## Verdict

**FAIL: 2 red.** Audit 2's R6 and its notes N9 to N14 are fixed in the spec. Two smaller gaps of the same kind remain: the `listed` flag cannot reach the feed clip and the game page through the files the plan owns, and one more journey that assumes a maker with no page (`game-page.test.ts`) is not named.

## Audit 2's red and notes

| Item | Fixed? | Where |
|---|---|---|
| R6 (a) `givePage` | Yes | "Every account has a page now": `givePage` updates the existing page, `listed` true; 20 files call it (`grep -rln "givePage(" tests/browser` gives 20), unchanged. |
| R6 (b) no-page journeys | Yes, for the two named | `feed.test.ts:154` and `play.test.ts:120` named, with `removePage`; gamepad and overlap re-run. One more is missed: R8 below. |
| R6 (c) the editor | Yes | Item 4 "The page editor until #459", `listInEditor`, criterion 11, unit G. Every room goes through `ownPage` (`own-page.server.ts`), take-down included, so "unlisted counts as not made" covers them all. |
| N9 Sign out is a POST | Yes | Item 2, a form with a quiet button. |
| N10 `isKnownAdult` | Yes | Words; `src/features/accounts/age.ts:111`. |
| N11 tenth taken address | Yes | Item 3, "We couldn't save that. Try again." |
| N12 layout reads `url.pathname` | Yes | Item 2; criterion 2 reaches the feed by a tap from `/help`. |
| N13 routes in neither list | Yes | Named, plus a unit test that fails on a route folder in neither list (see N15). |
| N14 invisible characters | Yes | Item 3, first bullet. |

## Red

### R7. `listed` cannot reach the clip's credit or the game page's "Made by" through the files the plan owns
- UNIT: B and D ("Files it owns").
- REQUIREMENT: CLAUDE.md "the diff touches only files in the plan"; spec item 4 "On a clip and on a game's page ("Made by"), an unlisted maker's name is words, not a link".
- REASON: the screens D owns read a maker shape built in two files no unit owns, and one service function B does not name.
- EVIDENCE:
  - Feed clip: `Feed.svelte:709-712` links `clip.maker.handle`. `clip.maker` is built in `src/features/feed/service.ts`: its type at `:93` (`{ handle; name; photo; following; mine }`) and the mapping at `:429-451` copy only `handle` and `name` from `makersOf`. B makes `makersOf` return `listed`, but it is dropped here, so `Feed.svelte` cannot tell an unlisted maker.
  - Game page: `src/routes/g/[game]/+page.svelte:232` links `data.maker.handle`; `data.maker` is built in `src/routes/g/[game]/+page.server.ts:93-101` from `cardOf` (`service.ts:237-241`, selects `handle, name, oneLine, photoKey`). B names `makersOf` and `pageOf` as returning `listed`, not `cardOf`, and D owns the `.svelte` only.
- EXPECTED: the plan owns every file the flag passes through, so the builder does not touch unplanned files or invent where it comes from.
- FIX (spec only): in B, add "`cardOf` returns `listed`"; in D, add `src/features/feed/service.ts` (the clip's maker carries `listed`) and `src/routes/g/[game]/+page.server.ts` (`maker.listed`).

### R8. `game-page.test.ts` assumes a game's maker has no page, and is not named
- UNIT: G ("Every account has a page now").
- REQUIREMENT: `review`: a change that edits an existing test names each one and why; CLAUDE.md "the diff touches only files in the plan".
- REASON: game makers sign up through `signUp` (`tests/browser/support/game.ts:86,94`), so after this change they have an unlisted page, and the game page shows "Made by <name>" for them (spec item 4).
- EVIDENCE: `tests/browser/game-page.test.ts:162-166` "a maker with no page is not shown" expects `getByText("Made by")` count 0 and no "More from". `src/routes/g/[game]/+page.svelte:226` shows "Made by" whenever `data.maker !== null` and `:241` shows "More from <name>" whenever the maker has other live games. The spec does not say whether "More from <name>" shows for an unlisted maker.
- EXPECTED: the plan names `game-page.test.ts` and says what the game page shows for an unlisted maker, as it does for `feed.test.ts` and `play.test.ts`.
- FIX (spec only): add `tests/browser/game-page.test.ts` to unit G and "Every account has a page now": the no-page case becomes "an unlisted maker's name is words, not a link" (and states whether "More from <name>" shows; showing it, as for any maker, is the smallest change), and the no-page case is kept with `removePage(account)` for an account from before this change.

## Notes (not blocking)

- N15. Route folders the two lists in item 2 do not name, for the builder to place (the unit test will catch them): `/join/done`, `/g/[game]/report`, `/g/[game]/wishlist`, `/g/[game]/play/beat`, `/your-turn/remove`, `/seen`, `/send`, `/stop`, `/stopped`, `/[handle]/follow`, `/[handle]/out`, `/[handle]/out/[link]`. Those that are only `+server.ts` (`report`, `wishlist`, `your-turn/send`, `[handle]/follow`) are endpoints, which item 2 keeps open; the signed-out follow comes back through `GET /<handle>/follow` after sign-up (`src/routes/[handle=handle]/follow/+server.ts:31-37`), so it must stay open and the question must carry that `next`.
- N16. A redirect from the root layout load runs alongside the page's own load unless that load awaits `parent()`, so a page load's side effect still happens once before the redirect: for example `[handle=handle]/+page.server.ts:19` counts a view. Harmless for this change; the builder may prefer the check in `hooks.server.ts` (lane 2 file, already in the lane 3 change) or keep people-screen loads free of writes.
- N17. Reading `url.pathname` in the root layout load reruns it, and its page lookup, on every move between screens. One indexed `findUnique` per move; acceptable, noted for the speed budget.

## What holds

- The owner's choices are kept: the question right after the code, the address made by code from the name, existing accounts asked once with no backfill, unlisted with no public page until slice 4, a rename never changes the address.
- Follows and sends point at the account, not the address (`MakerFollow.makerId` references `User`, `prisma/schema/pages.prisma`; the comment says "so a follow outlives a page being saved again"), so `listInEditor` giving the page a new address breaks no follow.
- Only three places link to `/<address>` outside the editor and the page itself (`Feed.svelte:712`, `Search.svelte:122`, `g/[game]/+page.svelte:232`); the play screen's "by <name>" is already words (`PlayScreen.svelte:380`). With R7 fixed, no dead link is left.
- CRUD for the name: create (criterion 1), read (5, 6), update (6), delete (7).
- Never stuck: Sign out and Delete my account on the question, by keyboard and gamepad (criteria 2, 10).
- Every file and test the plan names exists on `main` at `04689e5`; no goldens exist (`tests/golden/` is absent), so none moves.
- Migration: `listed` default true; no new dependency, tool or spend.
