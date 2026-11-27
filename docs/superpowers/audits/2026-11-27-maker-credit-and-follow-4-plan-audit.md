# Plan audit 4: maker credit and follow

- Pull request: #400, branch `claude/project-thread-6790hn`
- Reviewed commit: `5392f72` (spec `docs/superpowers/specs/2026-11-27-maker-credit-and-follow-design.md`), on main `16f8996`
- Lane: 3 (adds a table and a migration). Reviewer: Opus 5.5, medium, a fresh session that wrote neither the brief nor audits 1 to 3.
- Scope: the brief only. The build commits on the branch (`a930a52`, `df486de`) are for the implementation audit; they were read only to see what the brief's units plug into.
- Verdict: **PASS**, 0 red, 3 notes

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Audit 3's findings

- **Red 1, the badge below the house size: fixed.** "The plus" now says "48 by 48px to press (`--size-target`, which the feed's journey checks on every clip button)", and criterion 9 says "at least 48 by 48px". Checked: `src/lib/look.css` line 103 on main `16f8996` is still `--size-target: 48px`; `tests/browser/feed.test.ts` lines 103 to 106 still hold every clip button to a box height of 48 or more and to no words (`innerText` empty). The "+" and the check are drawn marks, so a badge built to the brief passes both. Holds.
- **Red 2, the Tab order journey not named: fixed.** Unit 5's row now owns `tests/browser/follow-a-maker.test.ts` (new), `tests/browser/feed-controls.test.ts` (the Tab order journey: Play, then the maker's name and "Follow <name>" when the first clip's maker has a page, then Share, then Sound) and `tests/browser/feed.test.ts` (only its comment about the band). Checked against main: the journey at `feed-controls.test.ts` lines 801 to 828 expects `names[play + 1]` to be "Share" and `names[play + 2]` "Sound"; in `Feed.svelte` the band holds the maker link, the game link and Play, and `.side` holds Share, so moving the credit to the top of `.side` puts the maker link and the badge between Play and Share in DOM order, as the brief says. `feed.test.ts` finds the maker link by role and name inside the clip (line 87), not inside the band, so only its comment (line 85) goes stale, as the brief says. Holds.
- **Audit 3 note 1 (gated before the yes):** criterion 6 now says "(with the cookie yes)", which settles which path it checks. The before-the-yes path stays covered by the brief's words and `gate.test.ts`, which unit 3 owns.

## Re-checked, and held

- Main moved from `34375a5` to `16f8996` since audit 3 (#399 and #401: the Back glide, notes). Neither touches `src/features/feed/`, `feed-controls.test.ts` or `feed.test.ts`; the glass tokens the brief names (`--glass-pay`, `--glass-safe`, `--glass-edge`) are still in `look.css`.
- Lane 3, the add-only migration and its unit test, `Restrict` keys with the rows removed in `deletion.ts`, and rollback with the table left in place: unchanged since audit 3, still consistent.
- CRUD: create (criterion 1), read (2), delete (3) as journeys; no update, with the reason given.
- The ranker still gets the crowd: `viewerId` apart from `Asking` (criterion 13).
- Every file the build has touched so far (`a930a52`, `df486de`) is in a unit's row of the plan.
- Files the brief names exist: `src/lib/safe-next.ts`, `tests/lib/glass.test.ts`, `tests/routes/privacy/cookies.test.ts`, `tests/features/consent/*`, `tests/features/feed/ranker.test.ts`.
- No live-state file in `5392f72`.

## Notes (not blocking, recorded)

1. **The Tab journey needs more presses.** It presses Tab 9 times. Today that ends on the second clip's Sound (bar 3, Sound, maker, game, Play, Share, Sound). After the move, with a maker on the first clip, Sound comes at the 10th press (bar 3, Sound, game, Play, maker, Follow, Share, Sound), so `names[play + 4]` would be empty. Raising the count is part of the edit unit 5 already names. Say so in the pull request body.
2. **The maker link's name in that journey.** The label comes from `innerText` when there is no `aria-label`. With no photo, the initial is `aria-hidden` but still part of `innerText`, so the label is the initial plus the name. Match it by "contains the maker's name", not by equality.
3. **Like, Save and Repost share the column.** Criterion 9's "whichever merges second runs it again" applies to criterion 8 (the Tab order in `feed-controls.test.ts`) as well, since their buttons go in the same column. The second to merge fixes both expectations together.

## Follow-up outside this change

None found.
