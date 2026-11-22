# Implementation audit 3: the integration of #293 with main after #209

- Commit examined: `36d44f6`. It merges `a662611`, which audit 2 passed at `b8e638a`, with `main` at `7b1784a`, after #209 (phone sign-in).
- Scope: the integration only, `a662611..36d44f6`. Lane 2. Opus 5.5 medium.
- Written 2026-11-22 04:13 UTC.

## Verdict

PASS: 0 red, 1 note.

## What was checked, and what it showed

1. **What this PR still changes against `main`.** `git diff origin/main...36d44f6 --stat` lists 12 files:
   - `TextAnswer`, `Picks` and `FilesQuestion`
   - the two held-scripts journeys in `edit-page` and `make-questions`
   - `pay`, `play`, `rejoin` and `support/account.ts`
   - `progress.md` and audits 1 and 2

   `/me/email` and `change-credentials.test.ts` are gone, as #209 deleted them, and `src/routes/me/` has no `email`. Nothing from #209 is undone.
2. **The conflicts were resolved as described.**
   - `pay.test.ts` keeps `main`'s phone-number sign-up (`finishSignUpForm`, `freshNumber`). It also keeps this PR's `pageHasSettled` at the end of `signUpFromTheCard` and `pressPay` on both presses of Pay.
   - `play.test.ts` keeps `main`'s sign-up, with `pressPay`.
   - `support/account.ts` keeps `main`'s `payAsNewMember` (it returns `number`), with `pressPay`.
   - `grep` finds no plain press of Pay left anywhere in `tests/`. The only `standInPayButton(...).click` is inside `pressPay`.
3. **Checks on `36d44f6`.**
   - `pnpm lint`: exit 0.
   - `pnpm typecheck`: exit 0 (2011 files, 0 errors, 0 warnings).
   - `pnpm test`: 1851 passed.
4. **Journeys.** On a fresh database, on computer and tablet: `pay`, `play`, `rejoin`, `edit-page`, `make-questions`, and `main`'s new `join` (which has its own "kept when it does" journey). Result: **182 passed, 0 failed**, 4.4 min.
5. **PR body.** It says plainly that the `/me/email` fix and its journey were removed with #209, and it records the integration commit, the conflicts and `main` at `7b1784a`.

## Not run

- The phone (WebKit) profile, which this container does not have. CI's full run is the gate.
- Journey files the integration does not touch.

## Notes (not blocking, not fixed here)

- **N5. One Flaky tests entry now points at code that is gone.** The `progress.md` entry starting "`tests/browser/change-credentials.test.ts:106`" still gives "Fix: `/me/email` sets the value only when there is one" and names the `change-credentials.test.ts` held-scripts journey. Both were removed by #209 in this integration. The cause and the other fixes in that entry stand. Expected: a reader of `main` is told that this part no longer applies. Bounded fix: add to that entry one clause such as "the `/me/email` part and its journey went with that screen in #209". This touches only `docs/superpowers/progress.md`, and the coordinator can fold it into its next `progress.md` update.
