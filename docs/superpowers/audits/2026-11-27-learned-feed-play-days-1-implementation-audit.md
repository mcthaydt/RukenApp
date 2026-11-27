# Learned feed, unit A, public half 1 (who played what): implementation audit 1

Pull request #436, head examined `5312177` (lane 2, one fresh review). Reviewer: Opus 5.5, medium.
Brief: the pull request's acceptance criteria 1 to 7, the learned feed spec
(`docs/superpowers/specs/2026-11-22-learned-feed-design.md`, sections 3, 4.1, 10, A5, A9, A13, D1, D6) and its private
twin (RukenPrivate `feed/2026-11-22-learned-feed-design.md`, A10).

**Verdict: FAIL, 1 red.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran, on `5312177`

- `pnpm install --frozen-lockfile`: ok (Node 22.23.5 in this container, not 24).
- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0 (2,383 files, 0 errors).
- `pnpm test`: 169 files, 2,417 tests passed.
- `tests/features/play/sessions.pg.test.ts` on a local Postgres 16: 35 passed (the four new "playDays" tests among them).
- A probe (not committed; a copy of the test file with one extra block, removed after the run, lint re-run clean):
  - who is in the rows: one play each by a person of unknown age (`adultOn` null), an under-18 (`adultOn` 2030-01-01),
    an adult with Learn from what I do off (`feedPersonal` false), and an adult whose play came before Start over
    (`feedResetAt` one day ago). `playDays` returned **all four**: `['learning off', 'played before Start over',
    'unknown age', 'under 18']`.
  - A10's scale (250 games, 1,000 players, 20,000 play days, 5 beats each, after `ANALYZE`): 20,000 rows, 2,400,001
    bytes as JSON, read median 114.6 ms, max 137.1 ms over 7 runs.

## Criteria

| # | Criterion | Result |
|---|---|---|
| 1 | `playDays` per person, game, Chicago day, beats and basis, one statement | met (pg test, one query counted) |
| 2 | A sitting across Chicago's midnight counts on both days | met (pg test) |
| 3 | Staff, own game, nobody, outside the window, other games left out | met (pg test) |
| 4 | Facts gain `playDays`/`playDaysSince` over `windowDays` (7 when missing), live non-18+ games only | met (`ranker.test.ts`) |
| 5 | Read only when the private ranker is bound | met (`ranker.test.ts`) |
| 6 | A13: no money import; from membership only who is a member | met (`architecture.test.ts`, with a self-check) |
| 7 | No existing test changed; nothing private | met: diff adds tests only; no rule, weight or setting value; the two new fields are data, not ranking |

Contract with the private Worker: the two fields are optional on `FeedFacts` and `v` stays 1, so RukenPrivate's Worker
(which type-checks against `src/features/feed/ranker.ts` on RukenApp main) keeps building and ignores them until its
half reads them. No ranking logic is added to the public repo.

## Red

**R1. The play read hands the private ranker the play of people the feed may not learn from.**

- UNIT: `src/features/play/sessions.ts`, `playDays`.
- VERDICT: red.
- REQUIREMENT: spec 4.1 and 10 ("Signed in, under 18 or no known birthday, no parent's yes: ... Nothing personal is
  read or recorded"; "Teens get a calm feed by default ... nothing personal is read"); spec section 1's failure line ("an
  under-18 without a parent's yes gets a feed that learns from them"); D6 and `User.feedPersonal`'s own comment ("Off,
  the feed treats the person like everyone else"); D1 and `User.feedResetAt`'s comment ("nothing personal before it is
  read"). The PR's own docs say the rows hold "who played what ... per signed-in person", i.e. personal, per-id rows.
- REASON: the query filters only on basis and on `userId IS NOT NULL`; it never looks at the person, so an under-18 or
  anyone of unknown age (every account today, since a parent's yes is not built and many have no birthday), a person
  with Learn from what I do off, and play before Start over all reach the private ranker under their own id, on every
  feed page.
- EVIDENCE: the probe above returned all four people. The PR's own tests make the same point: `createUser` leaves
  `adultOn` null, so every person in the "playDays" tests is of unknown age, and each one is returned.
- EXPECTED: `playDays` answers rows only for people the feed may learn from: `adultOn` known and on or before today in
  Chicago (as `isAdultOn` in `src/features/accounts/age.ts` decides; until unit I, no under-18 passes), `feedPersonal`
  true, and only beats received after `feedResetAt` when it is set. Their play still counts in the game's standing
  through `memberBeats`, which this change does not touch.
- FIX: join `"User" u ON u.id = s."userId"` in `playDays` and add `u."feedPersonal"`, `u."adultOn" IS NOT NULL AND
  u."adultOn" <= (${now} AT TIME ZONE ${CALENDAR_ZONE})::date`, and `(u."feedResetAt" IS NULL OR b."receivedAt" >
  u."feedResetAt")`; give the existing "playDays" tests adult users; add one pg test that each of the four people above
  is left out. Files: `src/features/play/sessions.ts`, `tests/features/play/sessions.pg.test.ts` (new test and adult
  users in the new block only), and the doc comments in `src/features/feed/ranker.ts` and `service.ts` naming who is
  left out. If the implementer reads the spec as letting such people's play shape other people's feeds, that is a
  privacy choice for the owner, not a reading to settle in code.

## Notes (not blocking, recorded as follow-ups)

- N1. Size and speed: at A10's scale the read is about 115 ms and 2.4 MB of JSON on every feed page, for every
  visitor, before the private ranker's `PRIVATE_WAIT_MS` clock starts, and every viewer is `crowd` today. RukenPrivate's
  A10 (one page under 300 ms) will measure the whole page; its own fallback is a 5-minute cache of the play read. Worth
  measuring once the private half reads the rows; R1's filter will shrink it.
- N2. If `playDays` throws, the whole feed page fails rather than falling back to the open order. `memberBeatsByGame`
  already behaves the same, so this is not new, but the new read doubles the chance.
- N3. When the private ranker is slow or throws, the same `facts`, `playDays` included, are handed to the open ranker,
  which ignores them. The comment on `FeedFacts.playDays` says "Sent only to the private ranker"; either drop the field
  for the fallback or reword the comment.
- N4. Play itself is recorded whatever the browser's cookie answer (existing behaviour, `src/features/play/`); the
  rows carry no consent mark, so this read cannot leave out a browser that never said "I agree". Out of this change's
  scope; noted for the consent work.
- N5. The checks were not run on Node 24 (this container has 22.23.5); CI runs the stated stack.
