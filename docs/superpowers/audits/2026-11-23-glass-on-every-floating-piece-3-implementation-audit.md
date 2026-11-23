# Glass on every floating piece: re-review 3 (lane 2)

- Pull request: #370, head `c630ce9aa728e02b83b6748fa4ffb3a881f88bd7` (main `682ef228` merged in).
- Prior review: FAIL at `f1f27481` (re-review 2), one red: the outlined "Test play" filled blue in the phone/tablet glass row.
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 17:48 UTC.

**Verdict: FAIL, 1 red.** The Test play fix is right and its test is honest. But the phone (WebKit) journeys run
about 1.7 times slower on this branch than on `main` in CI, and `adults-only.test.ts:289` [phone] now runs out of its
30-second budget on every run at this head (2 of 2).

## What changed since f1f27481

`git diff f1f2748 c630ce9`: three files.

- `src/lib/look.css`: the glass-row rule is now `.screen .acts > :is(.button, button):not(.danger, .outline, .quiet)`;
  the file picker's coloured glass moves to `.screen .acts > .file:not([data-quiet]) > span`.
- `tests/browser/test-play.test.ts`: `testPlayIsNotASecondBlueButton` checks every "Test play" link has
  `background-color: rgba(0, 0, 0, 0)`, on Check and send and on Waiting.
- `docs/superpowers/progress.md`: one Flaky tests line for `make-after.test.ts:601` [computer].

Nothing else changed.

## Prior red: fixed

- **Fails without the fix:** with `src/lib/look.css` put back to `f1f27481`, `test-play.test.ts --project tablet`:
  2 failed, both at the new check, `Expected "rgba(0, 0, 0, 0)", Received "rgba(0, 110, 184, 0.8)"`. With the fix:
  passes. The background is a plain colour (`--glass-pay: rgb(0 110 184 / 0.8)`, look.css:125), so
  `background-color` is the right property to read.
- **What else the new `:not()` reaches:** every `.outline` and `.quiet` that is a direct child of `.screen .acts` in
  `src/`: only the three Test play links (`make/[game]/check/+page.svelte:29,58`, `WaitingScreen.svelte:50`). The
  other outline buttons (LiveScreen's send and player-count switch, WebsiteLines, the game page's Share, Your games'
  Test play) and the quiet ones (QuestionScreen's `p.keep`, the links page) are not in an `.acts` row, so they are
  unchanged. No danger button changed (it was already excluded).

## Checks run here (cloud container, Postgres 16, Chromium only)

- `pnpm lint`: 0. `pnpm typecheck`: 0 errors. `pnpm test`: 149 files, 2164 passed.
- `test-play`, `make-look`, `make-after`, `glass` on tablet and computer: 114 passed, 26 skipped (phone-only), 0
  failed, fresh database.
- Phone (WebKit) not run here: WebKit is not installed and docker is not running in this container. CI's phone
  pieces are the evidence below.

## Findings

### R1 (red): phone journeys too slow on this branch; adults-only:289 [phone] times out

UNIT: the glass on the phone (WebKit) profile, `src/lib/look.css`.
VERDICT: red.
REQUIREMENT: the brief's criterion 9, "The journeys that touch these screens still pass", and merge on green.
REASON: at `c630ce9` the CI phone journeys are about 1.7 times slower than on `main`, and one now fails every time.
EVIDENCE:
- CI run 45228517913 at `c630ce9`, browser shard 6, attempt 1 (job 137881660097) and attempt 2 (job 137888728163):
  `[phone] adults-only.test.ts:289` "changing a game's rating..." `Test timeout of 30000ms exceeded` both times
  (30.2s, 30.1s), timing out at its last line (`adult.close()`, :319) after every assertion before it passed. The
  trace shows no single hang: every step is slower (about 0.4 to 1.5s each).
- The same journey on `main`'s CI phone: 18.6s (run 45226892675 at `9a256d5`), 19.5s (45218103470 at `682ef22`),
  13.1s (45211022631 at `0e7e218`).
- The 22 phone journeys shard 6 ran in both runs: 73.3s on `main` `9a256d5`, 123.7s at `c630ce9` (for example
  adults-only:234 13.4s to 23.9s, buttons:39 2.4s to 5.6s).
- The draft run stops at its first failure, so shards 1 to 5 were cancelled and most phone journeys have no result at
  this head.
EXPECTED: the phone journeys pass in CI within their budgets, at about main's speed.
FIX: measure where the phone time goes (for example the same journey with the glass tokens' `backdrop-filter` and the
colour fringe turned off), then cut the cost of the glass on WebKit without changing the approved look. If the cost
turns out to be CI's software rendering only, say so with the measurement in the pull request body, and any change
to a journey's time budget is named there with that reason ("Tests changed on purpose"). Files: `src/lib/look.css`,
and only the journey whose budget changes, if any.

## Notes (not blocking)

- N1. `.file[data-quiet]` is set nowhere in `src/` (only in look.css:697, look.css:1613 and tests): the new
  `.file:not([data-quiet])` split changes nothing today. Harmless; the selector was dead before this pull request.
- N2. `testPlayIsNotASecondBlueButton` loops over `.all()`, which passes with zero links; both callers then assert a
  Test play link exists, so it is not vacuous in practice.
- N3. The body's make-look:202 claim holds: the name is 52 x's plus 8 random characters, a slug is cut to 40
  (`src/features/games/ids.ts:12`), so the random part is lost and after nine runs in one long-lived database all of
  `xxxx…` to `-9` are taken ("That name is taken"). CI's database is fresh, so CI is unaffected. Its own follow-up.
- N4. The make-after:601 [computer] flake line is fair: it passed here (computer, fresh database).
- N5. `main` is now at `9a256d5` (#371), past this branch's `682ef228`: one more main merge and review re-point before
  the merge.
