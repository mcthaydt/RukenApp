# Feed settings: implementation audit 4 (lane 3)

- Pull request: #405, branch `claude/project-thread-eij1zi`
- Commit examined: `3ea9010cd60e6892897431218c67472c74ba720b` (retargeted from `887c8a1` mid-audit; both were run, below)
- Spec: `docs/superpowers/specs/2026-11-22-learned-feed-design.md`, unit D (D1 to D7), screen 6.2
- Round 3: `2026-11-27-feed-settings-3-implementation-audit.md` (FAIL at `542ea9d`, R4), on branch `claude/project-thread-38r6yk`
- Auditor: Opus 5.5, medium. Written 2026-11-27 03:24 UTC.

**Verdict: FAIL, 2 red, 5 notes.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

| Check | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck` (at `887c8a1`) | exit 0; 0 errors, 0 warnings |
| `pnpm test` (at `887c8a1`) | 2255 tests: 2236 passed in the Playwright image; the 19 others (`deploy-target.test.ts`, `games-check.test.ts`) fail there only because the image has no `jq` (exit 127), and pass on a machine that has it (26 of 26). Neither file is touched by #405. |
| `pnpm test:pg` on `tests/features/feed` and `purge.pg.test.ts` (Postgres 16) | 26 passed |
| Journeys in `mcr.microsoft.com/playwright:v1.63.0-noble` (phone = iPhone SE 3rd gen in **WebKit**): at `887c8a1`, `fits-the-screen`, `your-feed`, `me`, `look-layout`, `feed-controls`, `scrollbar` plus the probe, on phone, tablet and computer | 288 passed, 6 skipped, 0 failed |
| Same image at `3ea9010`: `fits-the-screen`, `your-feed` plus the probe | 49 passed, 8 skipped, 0 failed |
| `cookie-consent` on phone, 3 repeats, at `3ea9010` | 30 of 30 passed (see N5) |
| CI at `887c8a1` (quick draft run) | **red**: browser shard 2, `cookie-consent.test.ts:170` [phone] timed out on `page.goto("/g/…")` (job 140286566716); the other shards were cancelled. CI at `3ea9010` had not started when this was written (only `pr-rules-run`). |

The fix commits (`542ea9d..3ea9010`) touch only `YourFeed.svelte` and `fits-the-screen.test.ts`; the server is as round 3 read it.

## Round 3's finding

- **R4 (Your feed overflows with more or longer chips): fixed.** Each side is now one line. With **every** mood on the more side (12) and **every** genre on the less side (11), at 375×667, on all three devices: the view does not scroll (0), each side is one line 48 px tall with no vertical overflow inside it, Add stays at the line's end in view, and Start over ends at 479 px, pressable, above the bar at 595 (screenshot `every-chip-phone-375x667.png`). The longest sentence (three long genres first: three lines, 84 px) also fits: Start over at 507. Slid to the end, the last chip sits 16 px clear of the fade on all three devices, WebKit included. The check in `fits-the-screen.test.ts` now adds 6 and 5 chips with the longest words and asserts one line per side, Add in view and view 0.
- **Keyboard reach (the coordinator's retarget, `3ea9010`): fixed.** Tabbing through every Remove and suggestion on both sides with every chip kept, each focused button is wholly inside its line and at least 15 px from its right edge, clear of the fade, on all three devices (at `887c8a1`, six of them sat under the fade or 19 to 42 px past the edge).
- **Sideways phone**: 667×375 in the browser shows the existing "Turn your phone upright" cover, as the owner's rule says (2026-11-24). Nothing to fix.

## Red

- **R5.** UNIT: `src/features/feed/YourFeed.svelte` (the Add sheet's `send` → `update`), `tests/browser/your-feed.test.ts`. VERDICT: red. REQUIREMENT: the drunk-grandma rule (`CLAUDE.md`, `this-repo`: "one obvious next step", "nothing that needs explaining"); spec 6.2's Add. REASON: once a side's line is full, a chip added through Add lands past the end of the line, out of sight; the sheet closes and the screen looks unchanged, so the person cannot tell it worked. Before the one-line layout the new chip showed on a new row. EVIDENCE: probe "add through the sheet" at `3ea9010`, 375×667: eight moods kept, Add → Weird; after the sheet closes, Remove Weird is not in the line (`visible: false, scrollLeft: 0, max: 1179`) on phone (WebKit), tablet and computer. Screenshot `added-chip-out-of-sight-phone-375x667.png`: Bold and Cosy show, Weird does not. EXPECTED: after an Add, the new chip is in view in its line (as a focused chip already is). FIX: after an add from the sheet (or a suggestion) is answered, slide that side's line to the new chip (for example `scrollIntoView({ block: "nearest", inline: "nearest" })` on its `li`, the same call the focus handler uses); add a step to `your-feed.test.ts` (or the fit check) that fills a line, adds one more through Add and asserts its Remove button is in view in its line. Files: `YourFeed.svelte`, `your-feed.test.ts` or `fits-the-screen.test.ts`.

- **R6.** UNIT: `src/features/feed/YourFeed.svelte` (`.chips`). VERDICT: red. REQUIREMENT: the device matrix in `CLAUDE.md` Settings (computer is one of the three devices); the owner's "everything editable" and the CRUD rule (a person deletes what they made); the drunk-grandma rule. REASON: on a computer the line has no scrollbar (the owner's no-scrollbar rule) and a plain mouse wheel over it does not slide it, so a person with an ordinary mouse cannot see, or remove, the chips past the end of the line. Only Tab, a trackpad's sideways swipe or Shift+wheel reach them, and nothing on screen says so. EVIDENCE: probe "computer at its own size" at `3ea9010` (Desktop Chrome, 1280×720), every chip kept: the more line shows 4½ chips; `mouse.wheel(0, 400)` over it leaves `scrollLeft` at 0 and the page still (`bodyTop` 0); Tidy, Friendly, Spooky, Adventurous, Tough, Weird and Dreamy stay past the end; Shift+wheel slides it (400). Screenshot `computer-1280x720-every-chip.png`. EXPECTED: with a plain mouse on a computer, a person can bring every chip into view and press its ×. FIX: either turn a vertical wheel over a line into a sideways slide when the line can slide (a `wheel` handler on `.chips` that adds `deltaY` to `scrollLeft` and prevents the default only while the line can still move that way), or let the lines wrap where the window has the height for it; plus a step in a journey on the computer that wheels over a full line and asserts a chip past the end comes into view. Files: `YourFeed.svelte`, `fits-the-screen.test.ts` or `your-feed.test.ts`.

## D1 to D7

Re-read at `3ea9010`: `taste.ts`, `settings/feed/+page.server.ts`, `consent/routes.ts` are unchanged since round 1's `91a9502` (`git diff 91a9502 3ea9010 --stat` names only `YourFeed.svelte`, `fits-the-screen.test.ts`, `progress.md`); the Postgres tests and `your-feed.test.ts` pass on all three devices.

- **D1**: `FeedTaste`, `GoodPickAsked`, `User.feedPersonal`, `User.feedResetAt`; `taste.pg.test.ts` passes.
- **D2**: `aboutGame` keeps a `game` chip only for a live game that is not the person's own.
- **D3**: chips, suggestions and Add; `remove` deletes only the person's own row (`deleteMany where id, userId`); Start over forgets in one go. The one-line layout keeps every suggestion (N1 of round 3 is moot), but see R5 and R6 for reaching them.
- **D4**: `asking` asks once (`createMany skipDuplicates`); `answer` answers only an unanswered ask; Yes/No keep a game chip, as the code and PR body say.
- **D5**: `your-feed.test.ts` passes on all three devices (CRUD, second account).
- **D6**: off refuses new chips (409 "Your feed isn't learning right now…"); on again forgets; locked is 403.
- **D7**: `/settings` and the two `/api/feed/*` routes are in `GATED`.

## Notes (not blocking)

- **N1.** The focus ring is cut off above and below a chip: the ring is drawn 6 px outside the button (3 px offset, 3 px wide) and the line is exactly the button's height (48 px) with `overflow-x: auto`, which clips both ways. Only the ring's sides show (screenshot `focused-chip-phone-375x667.png`). A 6 px block padding on `.chips` (with the margin taken back) would show it whole.
- **N2.** The new Tab check in `fits-the-screen.test.ts` asserts a focused button is inside the line (`box.right <= lineBox.right + 1`), not clear of the 1rem fade, so it would pass with the button under the fade. The code meets the stronger claim today (probe: ≥ 15 px clear); the check could subtract the fade's width to hold it.
- **N3.** When a line has slid, the first chip on the left is cut hard, with no fade (the left of `every-chip-phone-375x667.png` shows "nd board"). The right fade alone is the only cue that a line slides, and on a computer it is faint (`computer-1280x720-every-chip.png`). For the owner's screens look.
- **N4.** On the more side the suggestions now come after every kept chip, so with a full line they are out of sight until the line is slid to its end.
- **N5.** CI's red at `887c8a1`: `cookie-consent.test.ts:170` [phone], "saying yes from a game's page keeps the maker who brought the person", timed out loading the game page. #405 does not change the game page or consent; the same file passed 30 of 30 here (3 repeats, phone, WebKit). It is a flake by the repo's rule and goes under "Flaky tests" in `progress.md` with the run, if it does not fail again.

## Probe

Scratch, not committed: `tests/browser/zz-probe4.test.ts`. It adds chips with the page's own `?/add` action (as round 3's probe 2), then at 375×667 measures the page and view overflow, Start over's place and whether its centre is pressable, each line's width, height and line count, the gap after the last chip slid to the end, a plain and a Shift wheel over a line, every Tab stop's place in its line, the ring's box, the sideways phone, and whether a chip added through the Add sheet is in view; plus the computer at its own size (1280×720). Sets: the longest sentence (Racing and sports, Building and life, Party and board, Adventurous more; Role-playing, Heartfelt, Cosy less) and every chip (12 moods more, 11 genres less).
