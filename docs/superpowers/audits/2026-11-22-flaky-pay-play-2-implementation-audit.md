# Implementation audit 2: flaky payment journeys and the page-startup fix (#293)

- Commit examined: `b8e638a` (branch `claude/project-thread-4625xg`), against `main` at `8cf811c`. Audit 1 passed `c2e147a`. This audit covers what came after: `ad1da81`, `f4fd548`, `0058693`, and the merge of `main` at `8cf811c`.
- Lane 2: `tests/browser/support/account.ts`, plus `TextAnswer`, `Picks` and `FilesQuestion`, which every maker question uses. One fresh review, Opus 5.5 medium.
- Written 2026-11-22 03:55 UTC.

## Verdict

PASS: 0 red, 2 notes (audit 1's two notes still stand).

## What was checked, and what it showed

1. **Scope.** `git diff origin/main...b8e638a --stat`: 13 files. Product code: `src/routes/me/email/+page.svelte`, `src/routes/make/parts/{TextAnswer,Picks,FilesQuestion}.svelte`. Tests: the three new journeys, plus audit 1's files. Docs: `progress.md` and audit 1. No config, CI, schema or server code. The merge kept both sides of `progress.md`'s Flaky tests list. `main`'s new entries and this branch's three entries (the two causes and the new `change-credentials`/`edit-page` entry) are all there, along with the new `purge-job.test.ts:39` entry.
2. **The fix pieces, read.**
   - `/me/email`: `value={form?.email}` leaves the field alone when there is no value, which matches sign-in, sign-up and forgot-password.
   - `TextAnswer`: `let box = $derived(value)` with `bind:value={box}`. Svelte 5.57.1 compiles it, typecheck is clean, and on hydration a bound input's typed value is read back into the state. A new server value (a refusal or a fresh question) changes `value`, so `box` recomputes and shows it. The question and room pages wrap the component in `{#key data.question}` / `{#key data.room}`, so each question gets a fresh box.
   - `Picks`: `defaultChecked`. Svelte's `set_default_checked` keeps the current `checked`, so an input reused with new defaults would keep a stale tick. The question page's `{#key data.question}` remounts `Picks` for each question, so that case does not happen there.
   - `FilesQuestion`: the folder box is bound to a `$derived` of `folder`, the same pattern as `TextAnswer`.
3. **The three new journeys fail on the old code and pass on the fix.** With the scripts held (the journeys' own `page.route`), on computer and tablet:
   - At `b8e638a`: 6 passed (33.7 s).
   - With only the four `src` files put back to `main` (`git checkout origin/main -- src/routes/make/parts src/routes/me/email`): all 6 failed.
   - Files restored afterwards; `git status` is clean.
   - This meets the PR's criterion 5.
4. **No regressions in the journeys the fix reaches.** Fresh database. Every `make-*.test.ts`, plus `edit-page`, `change-credentials`, `maker-page`, `first-owner`, `pay`, `play` and `rejoin`, on computer and tablet: **547 passed, 0 failed, 113 skipped** (the skips are journeys limited to other profiles), 12.7 min.
5. **Other checks.**
   - `pnpm lint`: exit 0.
   - `pnpm typecheck`: exit 0 (1913 files, 0 errors, 0 warnings). Leftover local build output from this session's own journey runs made the first try fail; it passed once `.svelte-kit` was removed. The change was not the cause.
   - `pnpm test`: 124 files, 1800 tests passed.
6. **Flaky-test rules.**
   - Nothing was retried, slept, skipped or loosened. The edit-page and change-credentials flakes are fixed by fixing the product bug behind them, not by changing the journeys.
   - Every existing journey check is unchanged.
   - The new journeys wait on the page's own readiness sign (`pageHasSettled`) and a held route, with no waits on a timer.
   - The `purge-job.test.ts:39` [tablet] entry is recorded honestly as "cause not found". This change touches no server code.
7. **PR body.** It names the three added journeys and the changed ones. It records a `verify` run like a person: a phone-sized window, scripts held 4 s, the name room and `/me/email`. It lists all three commits.
8. **CRUD.** The fix changes how existing boxes keep typed words. It adds no new thing a person can make, so it has no new CRUD duty. The edit-page journey it extends already creates, reads, updates and deletes the page's parts.

## Not run

- The phone (WebKit) profile is not installed in this container. CI's full run covers it (PR criterion 4).
- The full journey suite: only the files the change reaches ran here. The builder reports 1,038 passed on all files at `f4fd548`'s code. CI's full run is the gate.

## Notes (not blocking, not fixed here)

- **N3. The folder box has no fail-before, pass-after journey.** `FilesQuestion.svelte` got the same bound-box fix as `TextAnswer`, found by reading rather than from a failure. The existing files-question journeys pass with it (check 4), but no journey types a folder before the page comes alive. If it is ever wanted, the fix is one more held-scripts journey in `make-questions.test.ts`, shaped like the choice one.
- **N4. `Picks` with `defaultChecked` relies on being remounted for each question.** It is safe today because both pages that change questions key the component. A future page that reuses one `Picks` for different questions without a `{#key}` would keep stale ticks. Worth keeping in mind; nothing to change now.
