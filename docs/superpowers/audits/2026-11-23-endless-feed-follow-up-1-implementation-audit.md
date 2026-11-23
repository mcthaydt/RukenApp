# Endless feed follow-up (#363): lane 2 review, round 1

- Pull request: #363, head `646d17b` (`646d17b4c3d41103d3512112cc631d20dab782dd`), branch `claude/project-thread-7fe1cy`.
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 13:55 UTC.
- Brief: the request plus the three acceptance criteria in the pull request body.
- Verdict: **FAIL, 1 red, 3 notes.**

## What ran, at `646d17b`

- `pnpm lint`: clean. `pnpm typecheck`: 0 errors, 0 warnings.
- `vitest run --project unit src/features/feed tests/features/feed`: 5 files, 45 passed.
- `playwright test tests/browser/feed-controls.test.ts tests/browser/feed.test.ts tests/browser/loading.test.ts --project tablet --project computer` against a local Postgres 16: 74 passed. Phone (WebKit) is not installed in this container; CI runs it.
- Each fix reverted, on computer (below).

Not run: the phone profile, the whole browser suite, `test:pg`.

## Each fix taken away

| Change taken away | Journey | Result |
|---|---|---|
| All of `Feed.svelte` back to `main` | "a reload on a game that came off ... starts from the top" | fails (`toHaveCount(0)`: the gone game is back on screen). The check is real. |
| Only the watcher line (`sections.slice(0, clips.length)` back to `sections`) | "a reload whose kept feed is shorter ..." alone | **passes** |
| Same | `feed-controls` + `feed` files on computer (30 journeys) | **passes**, all 30 |

## Findings

### R1 (red): the up-arrow journey does not fail without the up-arrow fix

- UNIT: `tests/browser/feed-controls.test.ts`, journey "a reload whose kept feed is shorter than the fresh one puts back the kept feed, and the page keeps working", lines 416 to 421.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, "A check is a test that fails by itself"; criterion 1's own evidence ("failed at the up arrow with the watcher line reverted").
- REASON: the up arrow is pressed while the arrow-down's slide target (`aim`) is still set, so `goTo((aim ?? current) - 1)` counts from `aim` and lands on the second clip whatever `current` is. The watcher bug lives in `current`, which the journey never reaches.
- EVIDENCE: with the watcher line reverted and a log in the watcher, the reverted build reported `current` = 38 on the spinner (39 screens watched, 2 clips), the wrong answer, and the up arrow still landed on clip 2. 0 of 2 runs on computer failed (the journey alone, and the two feed files).
- EXPECTED: the journey fails with the watcher line reverted and passes with it.
- FIX: before the up arrow, end what the keys were aiming at the way a person's touch does, so the up arrow counts from `current`. Checked here: adding `await page.getByRole("progressbar", { name: "Loading more games" }).dispatchEvent("pointerdown");` just before `page.keyboard.press("ArrowUp")` made the reverted build fail at line 422 (the up arrow) and the fixed build pass 6 of 6 (computer and tablet, 3 each). Any way that clears `aim` (a real tap, a wheel, waiting out the slide) is fine. Files: `tests/browser/feed-controls.test.ts` only. Then state in the body the result of the reverted-line run again.

### N1 (note): a place on a later page whose game came off still puts back the stale kept clips

`returnTo` only looks at the fresh first page. A place past the first page puts back the kept clips as before, including a game that has since come off. The pull request says so ("as before"), so it is outside this change. Follow-up, not fixed here.

### N2 (note): snapshots kept before this ships have no `firstCount`

`index >= undefined` is false, so such a place is looked up in the fresh first page and, if it was on a later page, starts from the top once. Harmless, one time per open tab.

### N3 (note): the branch is behind `main`

`main` is now `ffab7fc` (docs and the private-move spec since `22267e9`). `git merge-tree` merges it cleanly; nothing there touches the feed.

## Checked and fine

- **progress.md after the merge of `main`.** `11e87b5` added a flaky line for `edit-page.test.ts:482` [tablet], run 45067364220. The merge kept `main`'s text, so that line is gone from the branch, but `main` already records the same run and its fix ("Fixed, both at their cause ... `edit-page.test.ts:451` and `:482` [tablet] (runs 45069502901 and 45067364220)"). Nothing of this branch's entry is lost. The diff against `main` touches only `Feed.svelte` and the journey file.
- **The "came off" journey checks the top by place.** The old check compared the top's slug with the one read before the reload; another journey making a game live between the two changes the fresh first page, so that comparison was a race, not a product failure. The test still asserts (a) the gone game has no clip and (b) the first clip is the one on screen. (a) is what proves the fresh page was used, and it fails on `main`'s feed (above). Not a weakened test.
- **`returnTo` logic.** Kept index -1 (not in kept clips) or below `firstCount` uses the fresh page; then a key not found or at 0 stays at the top. A restored kept feed carries its `firstCount` forward, so a second Back stays right.
- **Owner rules.** No new copy, no "Loading..." text (the spinner is the existing `progressbar` with no words), no links added.
- **CRUD.** The change adds nothing a person makes.
- **Pull request body.** `## Lane` present; last line "Requested by **McThayDT**". Commits authored by McThayDT.
