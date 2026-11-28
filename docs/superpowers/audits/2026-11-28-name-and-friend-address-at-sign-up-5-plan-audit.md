# Plan audit 5: a name and an address for every account

- Audited: PR #461, `docs/superpowers/specs/2026-11-28-name-and-friend-address-at-sign-up-design.md` at `26ebdf2610f0670b56f084c7f519974465cc2bea` (`26ebdf2`), against `main` at `04689e5`.
- Auditor: fresh session, Opus 5.5, medium. Lane 3 plan audit, round 5. Read only except this file.
- Written 2026-11-28 09:02 UTC (`date -u`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 1 red.** Audit 4's R9 is fixed, and so are N18, N19, N20, N22 and N23. N21 (keep the 404 in the route, not in `pageByHandle`) was not folded in: the spec never says how the address route learns that a page is unlisted, and the natural shortcut breaks the signed-out follow plus for every maker who only signed up.

## Audit 4's red and notes

| Item | Fixed? | Where |
|---|---|---|
| R9 unit tests that pin the maker shape | Yes | Unit D names `tests/features/feed/service.test.ts` (`:100-119`, `:198`, `:452`; checked, each is a `toEqual` on `clip.maker`), `tests/routes/g/[game]/page.server.test.ts` (`cardOf` stub `:72`, `toEqual` `:114`; checked), `tests/features/feed/ranker.test.ts:61` and `tests/features/feed/worlds.ts:57` (checked, both stub `makersOf`). Unit B names `service.pg.test.ts:306`. No other test builds a clip maker (`grep -rln "mine: false" tests src`: only `service.test.ts` and `ranker.test.ts`). `search.test.ts:42` stubs `makersOf` and is already D's. `sends.pg.test.ts:50` stubs `makersOf` for `src/features/sends/service.ts`, whose dep type does not need `listed`, so it stays green. |
| N18 route-list test file | Yes | `tests/hooks/people-screens.test.ts` (new), in unit C's checks. |
| N19 `+server.ts` folders | Yes | Item 2: a folder that is only `+server.ts` is an open endpoint, whichever list names its parent. I listed every folder under `src/routes` (`find src/routes -name "+page.svelte" -o -name "+server.ts" -o -name "+page.server.ts"`); each falls in exactly one list. |
| N20 redirect on a tap | Yes | Item 2: SvelteKit's own redirect for the `__data.json` request, checked by criterion 2's tap from `/help` to the feed. |
| N21 404 in the route | **No** | See R10. `pageByHandle` appears nowhere in the spec. |
| N22 privacy lines checked | Yes | Criterion 8: `legal-pages.test.ts` asserts the three lines and the nickname line. |
| N23 game page has no follow plus | Yes | Criterion 5: "A follows B from B's clip (the game page has no follow plus)". |

## Red

### R10. The address route can't tell an unlisted page without `pageByHandle`, and putting the check there breaks the signed-out follow
- UNIT: B (`src/features/pages/service.ts`) and D (`src/routes/[handle=handle]/+page.server.ts`).
- REQUIREMENT: item 4 ("An unlisted page's address is the missing page for everyone"; "Everywhere else an unlisted page works as a page does today: it can be followed"), item 2 ("The signed-out follow comes back through `GET /<handle>/follow` after sign-up"), and CLAUDE.md "the diff touches only files in the plan", the same rule as R7.
- REASON: the route's only lookup is `pageByHandle`, which does not return `listed`, and unit B's list of what now returns `listed` (`makersOf`, `pageOf`, `cardOf`) leaves it out. The two ways a builder can close that gap differ: making `pageByHandle` answer null for an unlisted page also 404s the follow endpoint, which calls `pageByHandle` for a signed-out press and on the way back from sign-up.
- EVIDENCE:
  - `src/routes/[handle=handle]/+page.server.ts:13-14`: `const page = await pages.pageByHandle(params.handle); if (page === null) error(404);`. Nothing else in the load knows about the page row.
  - `src/features/pages/service.ts:247-281`: `pageByHandle` selects `id, userId, handle, name, oneLine, themeId, photoKey, links`, not `listed`, and its `PublicPage` type has no `listed`.
  - `src/routes/[handle=handle]/follow/+server.ts:31` (POST, signed out: `if (pageByHandle(...) === null) error(404)` before sending to sign-up) and `:59` (GET, the way back: the same check before it follows).
  - `src/routes/cookies/+page.server.ts:67` also calls `pageByHandle` to remember an arrival from `/<address>`.
  - No check covers the signed-out plus on an unlisted maker: criterion 5 is signed in, and `follow-a-maker.test.ts` makes its maker with `givePage`, which the spec now marks `listed` true.
- EXPECTED: a signed-out person who presses the plus on the clip of a maker who only signed up is sent to sign-up, answers the question, and comes back following that maker; `/<that address>` is the missing page for everyone.
- FIX (spec only): unit B adds "`pageByHandle` returns `listed` and still finds an unlisted page (the follow endpoint and `/cookies` use it)"; unit D's route answers 404 when `listed` is false, before `countView` and `arrival.remember`; add a check, in `tests/browser/your-name.test.ts` or `follow-a-maker.test.ts`, that the signed-out plus on an unlisted maker's clip follows them after sign-up, and a `service.pg.test.ts` case that `pageByHandle` finds an unlisted page with `listed` false. Files: the spec only.

## Notes (do not block)

- **N24.** `tests/features/pages/service.pg.test.ts:490` is a `toEqual` on `cardOf`'s answer (`{ handle, name, oneLine, photoKey }`); it breaks once `cardOf` returns `listed`. The file is B's and the "Unit tests that pin the maker's shape" bullet names `cardOf`, so the builder will meet it, but only `:306` is named by line.
- **N25.** `/cookies`' `rememberArrival` (`src/routes/cookies/+page.server.ts:66-68`) would remember an arrival from `/<address>` of an unlisted page, a page the visitor never saw. With R10's fix the builder can skip it when `listed` is false; it only matters for who brought a member, so it is a note.

## What I checked and found consistent

- The route lists in item 2 against every folder under `src/routes` (95 folders, counting the root): every page folder is in one list; `/legal` covers `/legal/maker-agreement`; `/settings` covers `/settings/feed`; `/me/press`, `/make/github*` and every other `+server.ts` folder is an open endpoint.
- `src/hooks.server.ts` today is `sequence(httpsOnly, databasePerRequest, consentGate, createHandle)`; the new check must come after `createHandle` (it needs `locals.caller`). The spec says it lives in the hook and runs before any load, which fits.
- Address rules: `HANDLE_MAX` 30 and the 23 + hyphen + 6 digits arithmetic (30) hold.

Requested by **McThayDT**
