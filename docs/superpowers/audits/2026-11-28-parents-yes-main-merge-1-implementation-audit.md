# Parent's yes for teen feeds (#457): main merge review, round 1

Examined: head `89bd2bfa78b6b9eacc7ff7acdb853b37bba7b706` (parents `50fff59`, the PR side, and `0ceeb12`, main). Last PASS: `f90f121`. Reviewer: Opus 5.5, medium, fresh session. Lane 3. Written 2026-11-28 13:40 UTC.

Verdict: **PASS** on the merge. No red findings.

## What was checked, and how

1. **The PR's own change is unchanged since f90f121.** For each of the 37 files, the added and removed lines of `git diff 19045c3 f90f121` (the PR against its base at the last PASS) were compared with those of `git diff 0ceeb12 89bd2bf` (the PR against main now). 35 files match line for line. Two differ, both only through main:
   - `src/routes/privacy/+page.svelte`: the PR's "Last updated 27 → 28 November 2026" line is gone because main already says 28 November. The PR's privacy text about parents' asks is otherwise the same.
   - `tests/browser/controls-overlap.test.ts`: only the import block's shape (main had already made it multi-line). The PR's test is the same.
   This covers both main merges since f90f121 (50fff59, which was not passed because CI was red there, and 89bd2bf).
2. **consent/routes.ts.** At 89bd2bf `GATED` holds main's list (`/your-turn/send`, `/your-turn/seen`, `/your-turn/remove`, no `/your-turn/stop`, no `/your-turn/stopped`) plus the PR's `/parent`. No route folder for stop or stopped exists under `src/routes` (`git ls-tree`). `OPEN` and `MACHINE` equal main's. The PR's four route folders (`/parent/[token]`, `/settings/feed/parent`) are all covered (`/parent` and `/settings` gated). No block-list route is revived; `sent-to-you.test.ts` still checks `/your-turn/stopped` is a 404.
3. **progress.md Flaky tests.** The PR's added lines are identical to those at f90f121, on top of main's file, so both sides are kept.
4. **controls-overlap.test.ts imports.** The import from `support/database.ts` at 89bd2bf is main's set (`fillAnswers`, `followById`, `givePage`, `likeById`, `personWithPage`, `putGameWhereStaffLeaveIt`, `userIdOf`) plus the PR's `askedForParent` and `makeThemUnder18`; the other imports equal main's.
5. **No lost test.** Every `test("…` title on main (963) is in the merge (968), and all 5 the PR added are there. `it("…` titles: main 2100, merge 2120, none of main's missing.
6. **Privacy guarantees.** `src/features/feed/parent-asks.ts`, `phone.ts`, `forms.ts` and the parent and teen routes are unchanged since f90f121 (check 1), so what earlier rounds passed still holds: the parent's text names only the teen's own nickname and the link; the per-number cap from every teen together (`perNumberADay`, stand-in 3 when `PARENT_ASK_LIMITS` is missing) and the per-teen daily limit are intact. Main brought no change to these files.
7. **CI on 89bd2bf.** Run 46147990501 (head_sha 89bd2bf): lint, typecheck and build in `verify`, `postgres`, the six browser shards and `gate` all succeeded; `commit-authors` and `pr-rules-run` succeeded. This is the **draft quick run**, which runs only the tests the change touches. The full run starts when the PR is marked ready.

## Notes (not blocking)

- N1: The full CI run (`gate`, not the quick draft one) has not run on 89bd2bf. The merging session marks the PR ready and waits for the full `gate` to be green before merging; this PASS stands on that commit if it is.
- Merge still needs the owner's yes (lane 3).
