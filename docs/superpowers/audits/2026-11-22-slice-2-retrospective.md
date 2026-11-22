# Slice 2 retrospective

- Examined: `main` at `f0ccc09`; pull requests #240 to #284 (GitHub search API, read 2026-11-22 01:29 UTC); the audits in the project's shared `audits/` folder and in `docs/superpowers/audits/`; `docs/superpowers/progress.md` (owner instructions, Flaky tests, Known issues, Lessons); the apps kit practice audit (`2026-11-22-apps-kit-practice-1-audit.md`, gaps P1 to P11).
- Reviewer: a fresh thread that built nothing in slice 2 (Opus 5.5, medium). Written 2026-11-22 (times from `date`).
- Why now: `staged-path` makes the retrospective the last stage of every slice. Slice 2's never ran (practice audit, P5).

## What "slice 2" covers here

Slice 2 began under the old workflow (2026-11-15). That workflow was cleared by #239, so its loops are not measured here. This retrospective covers slice 2 under the current rules: from #240 (the new workflow's setup, opened 2026-11-20 22:02 UTC) to #284 (merged 2026-11-21 21:58 UTC) and #283 (merged 22:53 UTC), the last change made while slice 3 was parked on the owner's word "Let's park slice 3 until we confirm slice 2 is perfect". The editing work (everything editable, the 18+ gate) counts as slice 2: it was the "fix what is broken and the must-haves" the owner asked for before slice 3 could resume (14:32 UTC).

**Blind judge: not run.** `visual-check` step 4 runs it before the owner's first look. The owner has already looked at and approved slice 2's screens, so running it now would judge screens the owner signed off. Slice 3's end runs it (agrees with the practice audit, P5).

## Measured

All times UTC, from GitHub's `created_at` and `merged_at`.

| Measure | Value |
|---|---|
| Elapsed, setup to the slice end's last merge (#240 opened to #266 merged) | 16 h 24 min (2026-11-20 22:02 to 2026-11-21 14:26) |
| Elapsed, including the editing must-haves (to #283 merged) | 24 h 51 min |
| Pull requests opened in the window | 45: 42 merged, 3 closed unmerged (#251 the parked feed screen, #263 and #264 CI demos) |
| Time open, open to merge | median 29 min, mean 46 min, 32.1 h in total |
| Product changes for slice 2 | 16 pull requests, 13.3 h open in total (median 28 min) |
| Workflow, rules, hooks and CI changes | 18 pull requests (40%), 14.1 h open in total (median 39 min) |
| Slice 3 work started before slice 2 closed | 6 pull requests (#245 to #249, #251), from 00:29 UTC; the owner parked slice 3 at 03:12 UTC |
| Records and specs | 5 pull requests |
| Waiting: gaps with no merge for over 90 minutes | 4 gaps, 9.3 h in total: 04:36 to 06:55, 07:21 to 08:58, 10:17 to 13:33 (the owner asleep from 09:21), 17:10 to 19:16 |
| Waiting: the longest open branch | #209 (phone sign-in), open 2 days 0 h 27 min at 2026-11-22 01:30, over the 2-day branch limit in Settings |

Not measured: CI run times per pull request. The "Speed up CI" thread owns that measurement (spec `636c072`), so it is not repeated here.

### Owner interventions

44 owner instructions fall in the window (`progress.md`, The owner's instructions, 2026-11-20 22:27 to 2026-11-21 20:39 UTC). Sorted by what they were:

| Kind | Count | Examples |
|---|---|---|
| Product choices and owner actions (the owner's to make) | 24 | "Ready to launch"; the feed cards; "Games come off with the account"; "Keep the address"; the jobs secret; running owner steps 1 to 4 |
| Corrections to how the work was run | 11 | 23:38 "What's the holdup"; 06:54 "add a permission rule"; 14:25 Opus for no-plan builds; 14:41 "ALL SESSIONS NEED TO FOLLOW THE HOOKS" (twice); 19:16 "these are things that I should not need to intervene for"; 19:30 "Follow my rules"; 19:59 to 20:01 "Remove the merge without asking"; 20:19 "Remove ANYTHING that contradicts" |
| Questions that were process snags, not the owner's | 6 | 09:22 merge lane 3 tonight?; 14:43, 14:48, 15:00 the footer and pull request counting cards; 15:33 close #251 for a slot; 15:50 "merge when green" for #268 |
| Defects or missing requirements the owner found | 3 | 13:45 the Menu tab and sidebar during a drag (#265) and the computer game page (#266); 14:20 "we didn't have a way to update" (CRUD); 14:29 "Nothing should be permanent" |

17 of 44 (39%) were the owner steering the workflow or answering questions the rules give to the coordinator. All six snag questions came before the owner's 19:30 UTC rule (check CLAUDE.md before any card).

### Rework

Audit cycles, from the verdict lines of each audit file:

| Work | Audits | Red verdicts |
|---|---|---|
| Hooks cover every pull request route (#275, #279) | 6 implementation | 3 (cycles 1, 3, 4) |
| Apps kit alignment (#280, #284) | 5 plan, 2 implementation | 5 (plan 1 to 4, implementation 1) |
| Everything editable, unit A (#276) | 5 implementation, 3 design | 4 (implementation 1 and 4, design 1 and 2) |
| Phone sign-in (#209, still open) | 2 on branch B, 5 on its merge with `main` | 3 |
| Test cleanup (#252) | 1 | 1 (4 red) |
| Flaky journeys (#242), slice 2 audit (#243) | 1 each | 2 |
| 18+ gate, its sign-in return, CRUD rule, purge, unit B | 1 each | 0 |

What the repeated reds had in common:

- **Old wording left behind when a rule changed.** Hooks audits 3 and 4 ("Lane 3 merge lines still say the owner approves", "The owner-questions bullet still says merges go without the owner"); apps kit plan audits 1, 2 and 4 (stale sections, live specs still pointing at `history.md`). Five of the eight red verdicts on rule work.
- **Files changed outside the unit's row.** Unit A, audits 1 and 4 (G6 twice).
- **Main moved under a branch.** #209's merge audits 1 and 2 (journeys red after `main` moved); #281, red `main` after #276 (20:00) and #277 (20:07) merged seven minutes apart, each tested against a `main` without the other: the by-hand merge queue in `release` was skipped.

### Escaped defects

Found after the change that caused them merged:

1. **Red `main`** after #276 and #277 (fixed in #281, 20:53 UTC). Cause above.
2. **Two design defects past three design rounds** (#265, #266): the Menu tab kept pointing the old way until it snapped across, and the menu opened on the wrong side; the computer game page's tiles were uneven. The rounds checked still pictures (`2026-11-21-slice-2-design-round-1.md` to `-3.md`); a drag cannot be seen in a still picture.
3. **Missing update journeys**: the owner found that nothing tested an update reaching players (14:20 UTC); the CRUD audit (#267) confirmed it with two reds.
4. **The adults-only page's sign-in did not return to the game**: a note in the 18+ gate's audit, fixed in #283.
5. **Five new flaky tests** (`progress.md`, Flaky tests): `play.test.ts:41`, `pay.test.ts:41`, `purged-account.test.ts:30`, `pay.test.ts:76` (fixed, #273), `adults-only.test.ts:233` (fixed, #283). Two have no root cause yet (practice audit, P9). Three flakes in and after the window share one cause: opening an address while the last page is still loading (`pay.test.ts:41`, `adults-only.test.ts:233`, `edit-page.test.ts:80`).
6. **Process escapes**: the practice audit's P1 to P8 (audits kept outside the repo, no live-state files, plans not ticked, pull request bodies missing the three commits) and this missing retrospective.

## Lessons

Each lesson is turned into a check where one can catch it. The rest go under Lessons in `progress.md` in this pull request, with a trigger, as `build` says. None holds for every change, so none moves into CLAUDE.md, and this pull request changes no rule file.

| # | Lesson | Check that can catch it | Where |
|---|---|---|---|
| L1 | The session that merges runs the queue by hand: merge current `main` in, rerun the checks, one pull request at a time (`release`, Lanes and merging) | None new: `release` keeps branch protection from requiring up-to-date branches, and the body's "Commits:" line (L3) records the integration and `main` commits the queue tested | Lesson |
| L2 | A live-state file is kept, not only deleted | The `liveState` hook refuses ready when the branch's history never held `docs/superpowers/live/<branch>.md` | Its own hooks thread (lane 3) |
| L3 | A lane 2 or 3 body records its three commits | The `prBody` hook refuses a lane 2 or 3 body with no "Commits:" line | The same hooks thread |
| L4 | The reviewer's audit file is on the branch it reviewed | A review's PASS line counts only when its audit file is in the branch's diff under `docs/superpowers/audits/` | The same hooks thread |
| L5 | A journey opens an address only once the last page has settled | Journeys open addresses through one helper that waits on `pageHasSettled` (`tests/browser/support/account.ts:43`); 444 bare `page.goto` calls today | The flaky tests thread (P9) |
| L6 | A screen that moves is checked while it moves | none: judging motion needs a person or a reviewer | Lesson |
| L7 | A rule change removes the old wording everywhere | none that is general: the old wording differs each time | Lesson |
| L8 | A unit's diff stays inside its row | none beyond the existing CLAUDE.md check | Lesson |
| L9 | The next slice waits for this one to close | none: starting a slice is a coordinator act | Lesson |

## Pruned

- **Lesson removed**: "a spec session redid a hook-refused edit with the Edit tool". CLAUDE.md's Hooks rule now says the same in full ("never route around it, not with another tool, another API path, a reworded command or another session"), and the project instructions repeat it, so the lesson catches nothing they do not.
- **Kept, though another rule covers it**: the ACCEPTED example in `review` (watch CI in the foreground) repeats CLAUDE.md's No stalls. It is the owner's apps kit text word for word, and the owner's 20:19 UTC instruction makes the kit the source of truth, so it stays.
- **Tests**: not pruned here. The owner's 01:20 UTC rule ("We should have primarily e2e tests") has its own thread that prunes tests, in its own pull requests, as `build` says.
- **`verify` steps**: two journeys today (practice audit, P7, adds the rest). Nothing to prune.

## Not lessons

- 40% of the window's pull requests were workflow work, and its two costliest pieces of rework (hooks, 6 audits; apps kit alignment, 7) were rule work. That came from a one-time event, the new workflow arriving mid-slice, not from a rule; it is reported, not turned into one.
- One gap with no merge (10:17 to 13:33) matches the owner's 09:21 UTC "Going to sleep". The other three were not traced to a cause: the records do not say whether a session stalled on CI, so no lesson is drawn from them.
