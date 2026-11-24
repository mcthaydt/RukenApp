# Implementation audit 1: Report off the feed

- Brief: the owner's request (2026-11-24 14:11 UTC: "We don't need the report button on the feed view, we can click to go to the game to see that") and the acceptance criteria in pull request #392.
- Pull request: #392, branch `claude/project-thread-yqmrq4`. Examined commit: `4b832c2` (three commits on `main` at `d5988b3`).
- Lane 2. Model: Opus 5.5, medium. Audited 2026-11-24 14:46 UTC.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: PASS: 0 red, 2 notes.** The feed has no Report, game-page reporting is untouched, the sideways layout is back to what it was before #378, and nothing that was checked regressed. One small leftover (the flag picture, now unused) and a spec whose older lines still describe the feed flag are recorded as notes.

## What changed

`git diff --stat d5988b3...4b832c2`: 8 files, 36 added, 69 removed.

- `src/features/feed/Feed.svelte`: the `onreport` prop, the `Icon` import, the flag button, the `.report` styles (glass icon, focus ring, round button), the sideways `row-reverse` and the wider right padding are gone; comments no longer name Report.
- `src/routes/+page.svelte`: the feed's `ReportSheet` and its wiring are gone; the page renders `<Feed first launch />` as before #378.
- Tests: `report-a-game.test.ts` (the create-read-update-delete journey starts on the feed, checks no Report button there, presses the game's name and reports from the game's page), `feed-controls.test.ts` (Report out of the "never covered" list and the Tab order, back to 9 presses), `glass.test.ts` (the feed's Report picture out), `sideways-phone.test.ts` (the Report checks beside Share out). Each is named in the pull request body with why.
- Docs: one dated line in the report-a-game spec, one row in `progress.md`.

## Leftovers of the feed flag

- `grep -rni report` over `src/features/feed`, `src/routes/+page.svelte`, `src/lib/*.css`, `tests/browser` and `tests/lib`: nothing names the feed's Report any more, apart from `ShareSheet.svelte:3`, which compares the share sheet to "the Report sheet" (still true: the game page's sheet).
- `ReportSheet` and `onreport` appear only in `src/features/moderation/` and `src/routes/g/[game]/+page.svelte`.
- The sideways rules in `Feed.svelte` match `Feed.svelte` before #378 (`15f98e6^1`) line for line, apart from the `.sharenote` rule that #385 (custom share sheet) removed on purpose.
- The `flag` picture in `src/lib/icon.svelte`, added by #378 for the feed button, now has no user (N1).

## Game-page reporting

`git diff d5988b3 4b832c2 -- src/routes/g src/features/moderation src/lib` is empty, so the game page, its Report button, the sheet, the server routes and the review command are as they were. `report-a-game.test.ts` passes all its journeys on the three devices, all now opening the sheet from the game's page.

## What ran, at `4b832c2`, in a cloud container

All in Playwright's image `mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30…a4a27` (the digest CI pins), Postgres 16 beside it, `--retries 0`.

- `pnpm lint`: pass.
- `pnpm typecheck`: every error reported is in `.svelte-kit/output`, `.svelte-kit/cloudflare` or `.svelte-kit/cloudflare-tmp`, the build output my journey runs left in the folder; none in source. CI's `verify` (which runs typecheck on a clean checkout) is green.
- `sideways-phone`, `feed-controls`, `report-a-game`, `glass` and `game-page` journeys on phone, tablet and computer: 213 of 213 pass.
- Mutation check (undone after its run; none committed): `Feed.svelte` and `src/routes/+page.svelte` put back as on `main` (feed flag present), the pull request's tests kept, on phone and computer: the report journey fails on both (the feed's Report count is not 0) and the Tab test fails on both (Report where Sound should be). So the new checks catch a feed flag that comes back. `sideways-phone.test.ts:88` still passes with it, since it now checks only Share; the sideways rules are held by the line-for-line comparison above.

## CI on `4b832c2`

Run on the draft (quick run): gate, verify, postgres, browser shards 1 to 6, pr-rules and commit-authors all green.

## Acceptance criteria (pull request #392)

| # | Result | Evidence |
|---|---|---|
| 1 | pass | report journey, three devices: Report count 0 on `/`, Share visible; fails with the flag back |
| 2 | pass | same journey: game's name opens `/g/<slug>`, create, read, update, delete all pass from there |
| 3 | pass | `sideways-phone.test.ts:88`, three sideways iPhones; sideways rules equal pre-#378 |
| 4 | pass | Tab test, three devices: Play, Share, Sound; fails with the flag back |
| 5 | pass | lint pass, typecheck clean in source and green in CI, 213 of 213 journeys |

CRUD: reports are still created, read, updated and deleted in the browser journey, now from the game's page.

## Notes (recorded, not blocking)

- **N1. The `flag` picture is now unused.** UNIT: `src/lib/icon.svelte`. REASON: #378 added `"flag"` to the `name` union, its path and the comment "a flag (report)" for the feed button only; the game page's Report is a word button and never used it. EVIDENCE: `grep -rn 'name="flag"' src` finds nothing. EXPECTED: no picture with no user. FIX: drop `"flag"` from the union, its `{:else if}` branch and the comment's "and a flag (report)"; file `src/lib/icon.svelte` only. No criterion covers it, so it does not block.
- **N2. The spec's older lines still describe the feed flag.** UNIT: `docs/superpowers/specs/2026-11-24-report-a-game-design.md`. The new dated line says the feed flag is gone and criterion 1 starts on the game's page, but the "Where" bullet still describes the flag under Share, and criterion 1 still reads "presses Report on a clip in the feed". A reader who skips the dated line gets the old design. A strike-through or a short edit of those two lines would settle it.
