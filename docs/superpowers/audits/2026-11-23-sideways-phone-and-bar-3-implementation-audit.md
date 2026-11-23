# Sideways phone and bar: re-review after the CI fix (audit 3)

- Pull request: #364, branch `claude/project-thread-qlb5o2`
- Commit examined: `ef134cc2edbeb084cb1cbb0983c68b6c1b745652` (diff read: `7767912..ef134cc`, one commit)
- Earlier PASS: 0b23fb3, re-pointed to 7767912 (audits 1 and 2)
- Reviewer: Opus 5.5, medium, fresh session. Written 2026-11-23 14:16 UTC (from `date`).

## Verdict

**ef134cc PASS.** No blocking defect. One note (stale comment), not blocking.

## What was checked

1. **The note-3 revert is complete.**
   - `git log -S"note 3" ffab7fc..ef134cc` finds only 8b992cc (which added the right-edge column), 5e75f4eb/0b23fb3 (live state) and ef134cc (which removes it).
   - 8b992cc touched three files: `look.css` (+30, the `@media (orientation: landscape) and (max-height: 449px)` block on `:root:not(:has(nav.bar)) .screen` and `.screen .acts`), `+layout.svelte` and `sideways-phone.test.ts`. ef134cc deletes the whole look.css block, line for line. `git grep` at ef134cc finds no `--steps` and no `:root:not(:has(nav.bar)) .screen` rule left, so a sideways step's `.acts` falls back to main's row across the foot.
   - The slice 2 step checks that failed (`make-design-pass`, `make-screen-review`, `make-second-look`, `make-look`) are not in the PR's diff against its base ffab7fc: they are exactly main's, so they now check main's behaviour again, unedited.
   - The `+layout.svelte` part of 8b992cc kept on purpose: `/make/page` with no page yet stays a no-bar step. That is criterion 1 of the PR body, not part of note 3's column.
2. **The Help fix is right.**
   - The CI failure was `how-the-feed-works.test.ts:17-20`: on `/help` it clicks the feed-help link, Help's last tile, which sat under the bar on an upright WebKit phone. `/help` is `main.helpdesk` (`src/routes/help/+page.svelte:29`); the four help sub-pages are `main.card` and were already covered.
   - The fix adds `main.helpdesk` to the same two selectors cards and `.screen` use: the upright room under the page (`look.css:1246`, padding on `body`, so it cannot collapse out as a margin could) and its sideways reset to 0 (`look.css:1285`, where the bar is on the right edge and `--rail` pads that side instead). Upright and sideways both stay consistent with the other screens.
   - `main.helpdesk` keeps its own `min-height: calc(100dvh - …)` and `margin-bottom` (`look.css:2591`), so the page still fills the window; the body padding only adds scroll room below it. Fine.
3. **No test was weakened.**
   - `how-the-feed-works.test.ts` is untouched.
   - `bar.test.ts` gains `expectAllAboveTheBar("/help")` in the upright check (scroll to end, every link and button's whole box at or above the bar's top). The PR body records it failing without the fix (660.75 against 595); I did not re-run that (no `node_modules` or database in this container), CI runs it.
   - The removed `sideways-phone.test.ts` test is note 3's own check for the column that was removed; deleting it with its feature is correct, and the PR body says so and names the follow-up.
   - Its "no bar on `/make/page` with no page yet" part moved to `bar.test.ts` with the same three assertions (signs up a fresh maker, heading "Pick your page's address" visible, bar count 0). The old cookie clearing was only needed mid-test after a sign-in; the new test starts with the config's consented state. Nothing dropped.
   - The now-unused imports (`signUp`, `CONSENTED_STATE`) were removed from `sideways-phone.test.ts`.
4. **PR body.** "Since the audit" matches the diff. Last line is "Requested by **McThayDT**".

## Note (not blocking)

- **Stale comment.** `src/routes/+layout.svelte:35-37` still says the steps pin Back and Save "across the bottom, or along the right edge of a phone held sideways". At ef134cc they only go across the bottom. Expected: the comment says "across the bottom". Fix: drop the "or along the right edge…" clause now, or let the note-3 follow-up restore it. Comment only; no behaviour.

## Not run here

- No browser or unit tests ran in this session (no install or database here). The quick draft CI run on ef134cc was in progress at 14:15 UTC; the full WebKit run after marking ready is the merge evidence for the 13 journeys that failed on 7767912.
