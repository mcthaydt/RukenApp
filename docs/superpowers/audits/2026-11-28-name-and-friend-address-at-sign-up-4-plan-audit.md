# Plan audit 4: a name and an address for every account

- Audited: PR #461, `docs/superpowers/specs/2026-11-28-name-and-friend-address-at-sign-up-design.md` at `c892c868db8d0619ee4ccace2005117af7284659` (`c892c86`), against `main` at `04689e5`.
- Auditor: fresh session, Opus 5.5, medium. Lane 3 plan audit, round 4. Read only except this file.
- Written 2026-11-28 08:58 UTC (`date -u`).

## Verdict

**FAIL: 1 red.** Audit 3's R7 and R8 are fixed, and so are notes N15 and N16. One gap of the same kind as R7 and R8 is left: adding `listed` to the clip's maker and the game page's maker breaks unit tests that pin those shapes exactly, and the plan does not name them.

## Audit 3's reds and notes

| Item | Fixed? | Where |
|---|---|---|
| R7 `listed` reaches the clip and the game page | Yes | B: "`cardOf` returns `listed`". D owns `src/features/feed/service.ts` (the clip's maker type at `:93`, the mapping at `:429-451`, and `FeedServiceDeps.makersOf` at `:49`) and `src/routes/g/[game]/+page.server.ts` (`maker` at `:93-101`, from `cardOf` at `:54`). |
| R8 `game-page.test.ts` | Yes | Unit G and "Every account has a page now". `game-page.test.ts:162-166` is rewritten, the no-page case is kept with `removePage`, and "More from" is decided: it shows, linking only to `/g/<game>` (`+page.svelte:241-250`). |
| N15 route folders | Yes | Item 2 places `/join/done`, every `+server.ts` route as an endpoint, `/your-turn/stopped` as gated, and the signed-out follow's `next`. I checked every folder under `src/routes`, and each one falls in a list (but see N19). |
| N16 a redirect after a load's side effect | Yes | The check is in `src/hooks.server.ts` (unit C owns it), before any load, so `[handle=handle]/+page.server.ts:19`'s `countView` never runs for a redirected request. |
| N17 a lookup per move | Kept | Item 2: "one indexed lookup per request, for signed-in people only". |

## Red

### R9. Unit tests pin the exact maker shapes that `listed` changes, and no unit names them
- UNIT: D (and B's `makersOf`).
- REQUIREMENT: CLAUDE.md says "the diff touches only files in the plan". `review` says a change that edits an existing test names each one and why. This is the same rule as R7 and R8.
- REASON: D adds `listed` to the clip's `maker` and to the game page's `maker`, and B makes `makersOf` and `cardOf` return it. Several existing unit tests check those objects with `toEqual`, or stub `makersOf` and `cardOf` with the old shape. None of those files is in any unit.
- EVIDENCE:
  - `tests/features/feed/service.test.ts:100-119`, `:198` and `:452` call `toEqual` on `clip.maker` as `{ handle, name, photo, following, mine }`. Its stub (`:41`, `:56-60`) returns makers without `listed`.
  - `tests/routes/g/[game]/page.server.test.ts:114` has `expect(data.maker).toEqual({ handle, name, oneLine, photo })`, and its `cardOf` stub is at `:72`.
  - `tests/features/feed/ranker.test.ts:61-62` and `tests/features/feed/worlds.ts:57-62` stub `FeedServiceDeps.makersOf` as `{ handle, name, photoKey }`. If `listed` is a required field of that type, `pnpm typecheck` fails on them.
  - `tests/features/pages/service.pg.test.ts:306-311` calls `toEqual` on `makersOf`'s answer. That file is already one of B's checks, so it is covered. It is listed here only so the fix names it too.
- EXPECTED: the plan names every existing test file the change has to edit, says why, and sets what each one now asserts (including `listed` true and false on the clip and the game page), so the builder neither edits files outside the plan nor gets around the strict checks by leaving `listed` undefined.
- FIX (spec only): add `tests/features/feed/service.test.ts` (the clip's maker carries `listed`, one case true and one false), `tests/routes/g/[game]/page.server.test.ts` (`data.maker.listed`, true and false), `tests/features/feed/ranker.test.ts` and `tests/features/feed/worlds.ts` (stubs give `listed: true`) to unit D's files and checks. Name `service.pg.test.ts:306` under B as changed to expect `listed`. Add a line to "The journeys the new step changes" or "Every account has a page now" naming these files.

## Notes (not blocking)

- N18. The unit test in item 2 that "lists every route folder" has no file named in unit C's check column. Name it (for example `tests/hooks/people-screens.test.ts`) so a program can find it.
- N19. Some route folders are in both lists. `/me/press` is named as a people screen, but it is only a `+server.ts` (`src/routes/me/press/+server.ts`), and item 2 also keeps "every `+server.ts` route" open. `/make/github`, `/make/github/callback` and `/make/github/branches` sit under "`/make` and its screens" and are also only `+server.ts`. The spec should say which list wins: "endpoints stay open" is the general rule, and it is harmless here (`/me/press` sends on to `/`, which is gated). The unit test should also fail on a folder that is in both lists.
- N20. The redirect in `hooks.server.ts` needs to throw `redirect(303, …)` instead of returning a hand-made 303 `Response`. SvelteKit turns a thrown redirect into its JSON redirect for a `__data.json` request, and that request is how a tap between screens loads. Criterion 2's tap from `/help` to the feed is the check that catches a wrong choice. Gate on `event.route.id`, so the list matches the route folders the unit test reads.
- N21. Keep the unlisted 404 in `src/routes/[handle=handle]/+page.server.ts`, not in `pageByHandle`. The follow endpoint (`[handle=handle]/follow/+server.ts:29,57`) and sends use `pageByHandle`, and an unlisted page must still be followable (item 4). The plan already puts it in the route, so this is only a warning for the builder.
- N22. Criterion 8's check is `tests/routes/privacy/`, but that folder holds only `cookies.test.ts`, which checks cookie names. Nothing fails if the new privacy lines are missing. Add an assertion for the name, the address and "not public yet", for example in `legal-pages.test.ts` (already in the journeys list) or a new test in `tests/routes/privacy/`.
- N23. Criterion 5 says "A follows B from B's clip or game page". The game page has no follow plus (`src/routes/g/[game]/+page.svelte`), so the journey has to use the clip.

## What holds

- The owner's choices are kept: the question right after the code, the address made by code from the name, existing accounts asked once with no backfill, unlisted with no public page until slice 4, and a rename that never changes the address.
- Sign-up's finish is one redirect, `redirect(303, safeNextPath(form.next))` in `src/features/accounts/forms.ts:396`, so sending it through `/me/name` with `next` is a one-line change in the file unit C owns. `/join` sends a signed-out person through `/sign-up?next=…` (`src/routes/join/+page.server.ts:80`), so joiners meet the question too.
- Only three places link to `/<address>` outside the editor and the page itself (`Feed.svelte:712`, `Search.svelte:122`, `g/[game]/+page.svelte:232`), and D owns all three. The follow plus posts to `/<address>/follow`, which keeps working for an unlisted page. Your turn and the share sheet show names and never link to an address. The taste chips (`taste.ts:101-107`) show a maker's name as words.
- `isKnownAdult` is at `src/features/accounts/age.ts:111`. `HANDLE`, `HANDLE_MIN`, `HANDLE_MAX` and `RESERVED_HANDLES` are in `src/features/pages/handle.ts:5-13`, and `NAME_MAX` (40) is at `service.ts:11`.
- Every other file the plan names exists on `main` at `04689e5`. `tests/golden/` does not exist, so no golden moves.
- CRUD for the name: create (criterion 1), read (5, 6), update (6), delete (7).
- Never stuck: Sign out and Delete my account are on the question, by keyboard and gamepad (criteria 2 and 10).
- Migration: `listed` defaults to true (criterion 12). No new dependency, tool or spend.
