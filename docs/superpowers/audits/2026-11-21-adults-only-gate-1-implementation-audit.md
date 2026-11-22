6c54cff PASS

# 18+ age gate, implementation review 1 (lane 2)

- Branch: `claude/project-thread-e9hkx3`, examined at **6c54cff** against `main` 91f769c. PR #277 head **55e20c3** is 6c54cff plus a merge of `main` (baef48a, #275): `git diff 91f769c 6c54cff -- src tests` and `git diff baef48a 55e20c3 -- src tests` are byte-identical, so this verdict holds for 55e20c3 too.
- Brief: owner's "Yes do the fix" (2026-11-21 19:16 UTC) plus AO1–AO9 in `pr-drafts/adults-only-gate-pr-body.md`.
- Reviewer: fresh session, read only. Written 2026-11-21 19:49 UTC (from `date`).
- Graphify: not used (`list_repositories` not needed; routes were inventoried from `find src/routes` and `grep` on the checked-out commit).

## What ran (in this container, at 6c54cff)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors |
| `pnpm lint` | exit 0 |
| `pnpm test` | 117 files, 1695 tests passed |
| `pnpm test:browser` on a local Postgres 16 (the whole suite ran, not just the new file) | tablet + computer: 957 passed, 0 failed (incl. all 5 `adults-only` journeys on both). Phone: all 424 failures are `[phone]` at 0–25 ms: WebKit is not installed here, the same limit the builder reported. 130 skipped, 55 did not run. CI must cover phone. |

## Every route that can serve an 18+ game

| Route | Gated? | Evidence |
|---|---|---|
| `/g/[game]` page (and its `__data.json`, same load) | Yes, 403 before anything else is read or the arrival cookie is set | `src/routes/g/[game]/+page.server.ts:33-34` |
| "More from" on another game's page | Yes, 18+ siblings filtered unless known adult | same file `:55-57` |
| `/g/[game]/play` | Yes, 403 before `startPlay`, so no session and no pass | `src/routes/g/[game]/play/+page.server.ts:20-21`; journeys assert session count unchanged |
| `/g/[game]/play/beat` | Needs a session token that only `startPlay` makes | `beat/+server.ts` |
| Game files (games gate, `src/features/play/gate.ts`) | Need a play pass, made only by `startPlay` | as above |
| `/join?next=` backdrop video | Yes | `src/routes/join/+page.server.ts:41` |
| Maker page `/[handle]` | Yes, pre-existing filter, now asserted in e2e | `src/routes/[handle=handle]/+page.server.ts:25` |
| Feed | Service filters 18+ (`src/features/feed/service.ts:41`, unit test `tests/features/feed/service.test.ts:105`). No route serves the feed yet. | — |
| API | Only `/api/auth/[...path]`; no game data | `find src/routes` |
| `/make/*`, `/jobs/review` | Maker's own games; staff job behind the jobs secret. Not public. | — |
| Clip files `/media/clips/...` | **Not gated** (disclosed in the brief, needs `cloudflare/`, lane 3). Addresses are now only written into pages for allowed people. | note N2 |

## Criteria

| | Verdict | Evidence |
|---|---|---|
| AO1 | PASS | 403, heading + "Sign in to play it.", one "Sign in" link, Tab focus with outline, no name, no video: `adults-only.test.ts:105` passed on tablet and computer |
| AO2 | PASS | under-18 and `adultOn` null journeys (`:125`, `:137`), "Back to Ruken" href `/` |
| AO3 | PASS | play 403, no iframe, session count unchanged |
| AO4 | PASS | no `video` on `/join?next=…` |
| AO5 | PASS | no link to the 18+ game on the sibling's page |
| AO6 | PASS | maker page asserted in e2e; feed asserted by the existing unit test (see N3) |
| AO7 | PASS | `yearsAgo(18)` is 18 years and 2 days ago; page, "More from" and play (frame `data-loaded=yes`) |
| AO8 | PASS | 12+ open, 18+ closed at once (page and play), back open, taken off with the maker's real button: 404 for under-18 and adult (see N4) |
| AO9 | PASS | `isAdultOn` unit tests at Chicago midnight, future, past, null |

Lane 2 is right: the diff touches `src/features/accounts/`, three routes, `+error.svelte`, `tests/browser/support/database.ts` and tests. No `prisma/`, `cloudflare/`, `.github/`, `src/features/money/` or `src/features/membership/` file, no migration, no CI change, no new dependency. The live-state file is not in the diff.

Red findings: **none.**

## Notes (not blocking, follow-ups)

- **N1. Sign in does not bring the person back to the game.** UNIT: `src/routes/+error.svelte` / `src/routes/sign-in`. EVIDENCE: the button is `href="/sign-in"`; `src/routes/sign-in/+page.server.ts` reads no `next`, so after signing in an adult lands on `/` and has to find the game again. EXPECTED: land back on the game. FIX: a later change adding `next` to sign-in (touches sign-in and the error page). Not in AO1, so not red.
- **N2. Clip file addresses stay open to anyone who has one.** Disclosed in the brief; closing it is a `cloudflare/` (lane 3) change. Owner-visible follow-up.
- **N3. The e2e helper's comment says "the maker's page and the feed leave it out too"** (`adults-only.test.ts:99`), but only the maker page is checked there; no feed route exists yet. When the feed route ships, its journey should assert 18+ games are absent for these three callers.
- **N4. AO8's rating changes use the `changeGame` database helper,** not the maker's edit screens; only take-off uses the real button. The gate reads the stored rating, so this tests the gate's behavior correctly; the maker's own rating edit is covered by the make journeys.
- **N5.** On a game page with 18+ siblings an adult's age is read twice (`adultsOnlyRefusal` then `isKnownAdultCaller`). One extra small query; no change needed.
