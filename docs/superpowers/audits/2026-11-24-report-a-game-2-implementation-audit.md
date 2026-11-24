# Implementation audit 2: Report a game

- Spec: `docs/superpowers/specs/2026-11-24-report-a-game-design.md` (plan PASS at `679fd28`).
- Pull request: #378, branch `claude/project-thread-yqmrq4`. Examined commit: `2adf911` (one commit on `96c87e6`, which audit 1 examined; `main` at `e2a9d8f` is already in it).
- Lane 3. Model: Opus 5.5, medium. Audited 2026-11-24 03:11 UTC.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL: 1 red, 3 notes.** Both of audit 1's reds are fixed, and each new check fails when the behaviour it guards is broken. But CI's run on this commit shows a journey this change breaks that no earlier run reached: on a phone held sideways, the new Report flag pushes Share up into the bar.

## What ran, at `2adf911`, in a cloud container

- `git diff --stat 96c87e6 2adf911`: one file, `tests/browser/report-a-game.test.ts`, 49 added, 5 removed. Test-only.
- `pnpm lint`: pass. `pnpm typecheck`: 0 errors.
- Playwright's image `mcr.microsoft.com/playwright:v1.63.0-noble`, all three devices, `--retries 0`, `report-a-game.test.ts`: 27 of 27 pass (9 journeys a device).
- Mutation checks (each undone after its run; none committed):
  - M1, the sheet's `.inside` without `overscroll-behavior: contain` (`ReportSheet.svelte:237`): "the sheet fits the window" fails on phone, tablet and computer (`toHaveCSS` expected "contain", received "auto").
  - M2, `gameFor` without the 18+ refusal (`+server.ts`): the new journey fails on all three (expected 403, received 200).
  - M3, `gameFor` answering for a game that is not live: the new journey fails on all three (expected 404, received 200); "the site believes nothing the sheet sends" fails too.
  - M4, `show()` in place of `showModal()`: "the sheet fits the window" fails on all three (the sheet runs past the window).
- Probe on the phone: after `scrollBy(0, 2000)` the sheet's `.inside` stands at `scrollTop` 123 of 758 (635 shown), so the phone really scrolls the sheet's own content, and `window.scrollY` stays where it was.
- CI on `2adf911` (run 45313849432, quick draft run): lint, typecheck, build, postgres and verify green; browser shard 6 failed on `sideways-phone.test.ts:81` [phone] (R3); the other shards were cancelled at the first failure.
- `sideways-phone.test.ts` on the phone in the image: at `2adf911`, `:81` fails for both the small iPhone and the iPhone held sideways, every run; at `main` (`e2a9d8f`), it passes.

## Audit 1's reds

**R1, fixed.** "the sheet fits the window" reads `before` once the sheet is open, checks `overscroll-behavior-y: contain` on `.inside`, scrolls `.inside` by script on the phone and with the wheel elsewhere, and checks `window.scrollY` after the scroll and after reaching Send report. It passes on all three devices and fails on all three without `contain` (M1).

**R2, fixed.** "a game that is not live is missing, and an 18+ game refuses anyone not known to be 18": a waiting game answers 404 to GET signed out and to GET and PUT signed in; an 18+ game answers 403 to GET signed out, and a signed-in adult reads `{"state":"none"}`. It fails when either guard is taken away (M2, M3). Signed out is a person not known to be 18 (`adults-only.test.ts`, line 19), so criterion 13 holds as written.

## Red

**R3. On a phone held sideways, Share now overlaps the bar.**
- UNIT: `src/features/feed/Feed.svelte`, the round buttons on each clip (Share, and the new Report under it) in the sideways layout.
- REQUIREMENT: criterion 19 (browser suites pass); the owner's sideways rule (installed sideways, the bar on the right edge; `sideways-phone.test.ts:81`: "Share stands in the bar's column, under it").
- REASON: the column of round buttons grew by the Report flag (`Feed.svelte`, the `{#if ready && onreport !== undefined}` button), and with the column held to the window's foot Share's top moves up into the bar.
- EVIDENCE: CI run 45313849432, shard 6: `sideways-phone.test.ts:94` `expect(share.y).toBeGreaterThanOrEqual(rail.y + rail.height)`, expected >= 275.5, received 255. The same in Playwright's image here, for both sideways iPhones, every run; `main` passes the same test. Audit 1 did not see it: its CI run stopped at an earlier flake and its local runs did not include `sideways-phone.test.ts`. The diff since `96c87e6` is test-only, so it was already there.
- EXPECTED: on a sideways phone Share and Report both stand clear of the bar and inside the window, and `sideways-phone.test.ts` passes on the phone.
- FIX: in `Feed.svelte` (sideways rules only), place Report so it never pushes Share into the bar. A small iPhone sideways has about 44 px under the bar (window 320 high, bar foot at 275.5), so a second round button will not fit under Share there; for example, put Report beside Share (left of the bar's column) when sideways. Then extend `sideways-phone.test.ts:81` to hold Report clear of the bar and inside the window too, and run `sideways-phone.test.ts` and `report-a-game.test.ts` on all three devices in Playwright's image. Files: `src/features/feed/Feed.svelte`, `tests/browser/sideways-phone.test.ts`.

## Notes (recorded, not blocking)

- **N7. The phone's no-scroll check leans on the CSS check.** A scroll set by script never passes to the page, so on the phone the `window.scrollY` lines cannot fail on their own; `toHaveCSS("overscroll-behavior-y", "contain")` is what catches the fault (M1). Without that line, M1 passes on all three devices (probe). It is enough for the criterion; a touch swipe would be closer to a person, and Playwright's WebKit has none.
- **N8. The phone does not check that the sheet moved.** Audit 1's suggested fix asked to assert `.inside` scrolled; the test does not. The probe shows it does (123 px). One `expect(scrollTop).toBeGreaterThan(0)` would hold it.
- **N9. The 403 is tried on GET, signed out.** PUT and DELETE share `gameFor`, so they refuse the same way; a signed-in person with no age on file (`forgetAgeOf`) is not tried here, but `adults-only.test.ts` covers that refusal on the game's other addresses.
- Notes N1 to N6 from audit 1 stand.

## Criteria changed since audit 1

| # | Result | Evidence |
|---|---|---|
| 10 | pass | `:265`, three devices; M1, M4 |
| 13 | pass | `:299`, three devices; M2, M3 |
| 19 | **red R3** | CI shard 6 fails `sideways-phone.test.ts:81` [phone]; reproduced here; passes on `main` |
