# Sideways steps follow-up: implementation audit 1 (PR #366)

- Reviewed head: 0cb4c6c29c4851ed6beb8d73a2b04f339e5796e9 (0cb4c6c), branch claude/project-thread-qlb5o2
- Lane: 2 (`src/lib/look.css`, `tests/browser/support/look.ts`). One fresh review.
- Reviewer: Opus 5.5, medium. Written 2026-11-23 15:13 UTC.

## Verdict: 0cb4c6c FAIL: 3 red

The code and the tests are sound. The three reds are paperwork on the pull request and the branch, each a small fix. After the fix, R3 moves the head, so a re-point audit checks only that the new commits delete the live-state file and change nothing else.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` (eslint, prettier) | clean |
| `pnpm typecheck` | 2178 files, 0 errors |
| `pnpm test` | 148 files, 2154 passed |
| Journeys: `sideways-phone`, `bar`, `make-look`, `make-design-pass`, `make-screen-review`, `make-second-look`, `adults-only`, phone project | 162 passed, 29 skipped, 0 failed (3.8m) |
| Probe A: `main`'s `look.css` under this branch's tests | 4 failed as they should: `make-look` question sizes (column), and the new right-edge step check on all three sideways phones |
| Probe B: this branch's `look.css` without the 568-wide rule | 1 failed as it should: `make-design-pass` "the wide video question's heading is not crushed beside its frame" |
| `edit-page.test.ts` x4, phone project | 36 passed |
| Probe C: Your links at 375x320 with two links, `main`'s vs this branch's `look.css` | identical: 182px to scroll, bar shown, both |

Not run: WebKit (not installed in this container); the phone project ran on Chromium at the iPhone SE size, through a local config that only swaps the phone's engine (not committed). CI's phone project is the WebKit evidence; at the time of writing the quick draft run had verify, postgres, commit-authors and shards 2 and 6 green, the rest in progress. The tablet and computer projects were not run here: the CSS change is inside `max-height: 449px`, which neither reaches.

## The 12 moved checks are honest

- Each one is named in the body and carries a "Changed on purpose" note in its file.
- `clearOfTheButtons` keeps the old test exactly where the buttons are still a row (phone and tablet upright: bottom of the box at or above `.acts` top), and the window's foot where they follow the answer (the old `barTop` fallback). Only the phone held sideways changes, to the column's analogue: wholly left of `.acts` and above the window's foot. That is the same property (nothing under the buttons, nothing below the fold) for the new layout, not a looser one.
- `make-look` adds stronger checks than before for the column: at the right edge, centred in height, the blue button above Back, the answer box wholly left of it.
- Probe A shows the new checks fail without the column; Probe B shows the wide-heading check (an existing one, unchanged) fails without the new rule. Neither is a check that passes by itself.

## Scope items

- Right-edge Back/Save column: `look.css` scoped by `:root:not(:has(nav.bar)) .screen` inside `(orientation: landscape) and (max-height: 449px)`, so only bar-less maker screens on a sideways phone. Matches note 3 and the owner's approved look.
- Wide heading at 568x320: below 700 wide the wide frame goes under the words. Checked by Probe B.
- Step-screen no-bar: five more routes in `bar.test.ts`, each also checking it was not redirected; a new journey for agreement then check. All step routes in `NO_BAR` are now covered.
- Adults-only: Tab stops now named (Home, Add a game, You, then Sign in) instead of a count. Stronger.
- Cookie card vs Back/Save: the check that a step without a cookie yes shows the full "Cookies?" screen and no `.acts` is a fair answer to the note; it passed on all three phones.
- `+layout.svelte` comment: unchanged, and true again with the column back.
- progress.md: #364 row, this PR's row, and the flake entry.

## The `edit-page.test.ts:278` [phone] flake

This PR neither fixes nor worsens it. Your links (`/make/page/links`) shows the bar, so the new column rule (bar-less screens only) does not reach it, and Probe C measured the same 182px of scroll room on `main`'s and this branch's styles. Four more phone runs passed here. The lead in progress.md (a 320-tall window is now a sideways phone, so less room to scroll) stands as written; the cause is still open.

## Findings

R1. UNIT: PR #366 body. VERDICT: red. REQUIREMENT: CLAUDE.md "The brief" (acceptance criteria written in the pull request) and the `pr-rules` check. REASON: the body has no "Acceptance criteria" heading. EVIDENCE: status `pr-rules` on 0cb4c6c is failure: "the body has no "Acceptance criteria" heading and the change goes beyond docs". EXPECTED: an `## Acceptance criteria` section listing the observable criteria (the What list already holds them), and `pr-rules` green. FIX: edit the PR body only.

R2. UNIT: PR #366 body. VERDICT: red. REQUIREMENT: the project's PR attribution rule (the body starts with the two attribution lines). REASON: the body starts with "## What". EVIDENCE: `gh api repos/mcthaydt/RukenApp/pulls/366 --jq .body | head -2`. EXPECTED: the first two lines are the `claude-projects-attribution` comment and the "_Requested by **McThayDT** · [project thread](…)_" line, and the last line stays "Requested by **McThayDT**". FIX: edit the PR body only.

R3. UNIT: `docs/superpowers/live/claude-project-thread-qlb5o2.md`. VERDICT: red. REQUIREMENT: CLAUDE.md "Live state in a file": the session deletes its live-state file in its last commit before it hands the branch to the audit, so the file never reaches `main`. EXPECTED: the file is absent at the head the PASS names. FIX: one commit deleting that file, nothing else.

## Notes (not blocking)

N1. `tests/browser/support/look.ts` `clearOfTheButtons`: its comment says "wholly in view", but it checks only the bottom and right edges, not that the top and left are at or past 0. The old checks did not either, so nothing is weaker; a later change could add `box.y >= 0 && box.x >= 0`.
