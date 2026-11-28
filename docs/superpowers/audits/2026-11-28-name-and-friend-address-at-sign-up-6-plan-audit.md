# Plan audit 6: a name and an address for every account

- Audited: PR #461, `docs/superpowers/specs/2026-11-28-name-and-friend-address-at-sign-up-design.md` at `ee89b3647c932b5a87b297a9a1b404ee7de2b275` (`ee89b36`), against `main` at `04689e5`.
- Auditor: fresh session, Opus 5.5, medium. Lane 3 plan audit, round 6. Read only except this file.
- Written 2026-11-28 09:04 UTC (`date -u`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**PASS.** Audit 5's R10 is fixed, and N24 and N25 are folded in. No red. Two notes below, neither blocks.

## Audit 5's red and notes

| Item | Fixed? | Where, and what I checked |
|---|---|---|
| R10 the address route and `pageByHandle` | Yes | Item 4 now says the route (`src/routes/[handle=handle]/+page.server.ts`) answers 404 when `listed` is false, before it counts a view or remembers an arrival, and that `pageByHandle` still finds an unlisted page. Unit B: "`pageByHandle` (and its `PublicPage` type) returns `listed` and still finds an unlisted page". Unit D: "404 when `listed` is false, before `countView` and the arrival". Checked against the code: the route's only lookup is `pageByHandle` (`:13-14`), and `countView` (`:19`) and `arrival.remember` (`:21`) come after it, so the 404 can sit between them. Every caller of `pageByHandle` (`grep -rn pageByHandle src`): the route, `follow/+server.ts:31` (signed-out POST) and `:59` (the GET back from sign-up), and `cookies/+page.server.ts:67`. With `pageByHandle` unchanged in what it finds, both follow checks still pass for an unlisted maker. |
| R10 check | Yes | Criterion 12 (signed-out plus on an unlisted maker's clip, sign-up, the question, back following; the address still 404) in `tests/browser/your-name.test.ts` (unit D), and a `service.pg.test.ts` case that `pageByHandle` finds an unlisted page with `listed` false (unit B). `follow/+server.ts` is a `+server.ts` folder, so it is an open endpoint in item 2, and the question carries `next` back to it. |
| N24 `service.pg.test.ts:490` | Yes | Unit B now names `cardOf`'s `toEqual` at `:490` (checked: `{ handle, name, oneLine, photoKey }`). |
| N25 `/cookies` | Yes | Item 4 and unit D: `/cookies` does not remember an arrival from an unlisted page's address; `src/routes/cookies/+page.server.ts` is in D's files. |

## Notes (do not block)

- **N26.** `tests/features/pages/service.pg.test.ts:273-282` pins `pageByHandle`'s keys exactly (`Object.keys(page).sort()` `toEqual` `["handle", "id", "links", "makerUserId", "name", "oneLine", "photoKey", "theme"]`). Adding `listed` to `PublicPage` breaks it. The file is unit B's and B says `pageByHandle` now returns `listed`, so the builder meets it at once; only `:306` and `:490` are named by line. The build names it in the pull request body as a changed test, with `listed` added to the list (the test guards against a public page leaking more, so the change is the one new key, nothing else).
- **N27.** The `/cookies` change (no arrival remembered for an unlisted address) has no named check. `grep -rln "routes/cookies" tests` finds no unit test of `rememberArrival`; `tests/browser/cookie-consent.test.ts` covers arrivals in the browser. It only affects who is credited with bringing a member, so a case there (answer the notice from an unlisted maker's address: no arrival) is a suggestion, not a gap against a criterion.

## What I checked and found consistent

- The diff `26ebdf2..ee89b36` touches only the spec (6 lines in, 5 out): the revision line, item 4, criteria 12 and 13 (the migration criterion renumbered), units B and D. Nothing else moved, so the parts audits 1 to 5 checked stand.
- `PublicPage` is used outside `service.ts` only through the re-export in `src/features/pages/pages.ts:3`; no other test stubs `pageByHandle`, so making `listed` required on it breaks no stub.
- `/[handle=handle]/out/[link]` uses `tapLink`, not `pageByHandle`. A page made by sign-up has no links, and the editor's stopgap marks a page listed before it can get any, so an unlisted page has no link to tap out to.

Requested by **McThayDT**
