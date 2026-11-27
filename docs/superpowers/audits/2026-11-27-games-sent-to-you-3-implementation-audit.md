# Implementation audit 3: games sent to you (Your turn), PR #424

- Commit examined: `fc7000b` (fc7000b869ecbbdeeddb9050dd252e39ea129e4f). Delta since audit 2 (`013fe89`, PASS): `da3351a` (the picker restyled to match the other pull-up panels, the owner, 2026-11-27 15:54 UTC: "that's too hard to read, match the design we used for the other pull up panels") and `fc7000b` (with no friends the focus lands on Back, audit 2's N1; a flake logged in `progress.md`).
- Brief: `docs/superpowers/specs/2026-11-27-games-sent-to-you-design.md`, revision 4 with the "laid out like the other pull-up panels" line.
- Lane 3 implementation audit, cycle 3. Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-27 16:37 UTC (`date`).

**Verdict: FAIL, 1 red.** The picker now reads like the Report panel in every way but one: its Back button's word sits at the left, where Report's full-width second button (and the picker's own Send right above it) is centred. Everything else in the delta passes.

## What ran

| Check | Result |
|---|---|
| Diff `013fe89..fc7000b` | 6 files: `SendPicker.svelte`, `ShareSheet.svelte` (title line only), the brief (one paragraph), `progress.md` (one flake line), `sent-to-you.test.ts`, `gamepad.test.ts` (dialog name matcher only). Nothing outside the delta. No test weakened: the dialog name matcher widens to the new title; two expectations are added. |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | 0 errors, 2377 files |
| `pnpm test` | 169 files, 2404 tests passed |
| Journeys, all three profiles, phone in WebKit inside `mcr.microsoft.com/playwright:v1.63.0-noble`: `sent-to-you`, `gamepad.test.ts:158` and `:401`, `feed-controls`, `report-a-game`, `glass`, `real-buttons`, plus a probe (below) | 228 passed, 0 failed, 8.2 min |
| CI on this head (run 46031917311) | `gate (quick, draft)` success, every shard green |

### Probe (not committed; kept at `/mnt/project-files/audits/2026-11-27-games-sent-to-you-3/probe.test.ts.txt`)

Nine friends, the game page's Report sheet and then Share → Your turn, two faces picked; screenshots plain and over a striped busy picture; computed styles; fit; `padReachesEverything` with a pad plugged in.

- **Same panel as Report.** Panel background `rgba(17, 19, 20, 0.04)` with `blur(28px) saturate(1.8) brightness(0.94)` on both; the title is the sheet's one `h2` at 24px Ruken Digits on both; the game's name under it in the same `.which` style; Close is the same green glass (`rgba(0, 79, 70, 0.8)`); Send is the blue glass (`rgba(0, 110, 184, 0.8)`) and Back the green glass, as Report's Send report and Take back my report. Faces are green glass rounds with white initials and white names, like the share sheet's app buttons.
- **Easy to read.** Chromium (tablet, computer) draws the blur: over the striped picture every name, initial, tick and button word is clear (tablet-picker-busy.png). The WebKit image in this container does not draw backdrop blur (the Report sheet shows the page sharp through it too, phone-report.png), and even there the words keep their shadow and read (phone-picker-busy.png).
- **Fits.** 375×667 WebKit phone: the sheet runs 227–667px, 8 faces (the ninth friend left out), nothing inside scrolls (`scrollHeight − clientHeight = 0`), the page does not scroll. Faces 78×82, Send and Back 335×48, Close 48×48. Tablet 810×1080 and computer 1280×720: centred, no scroll, faces 96×82, Send and Back 408×48.
- **Pad and keyboard.** `padReachesEverything` passed in the picker with 8 faces on all three. The keyboard journey in `sent-to-you.test.ts` (Tab to a face, Enter picks, Tab to Send, Enter sends) passed on all three.
- **No friends.** Enter on Your turn puts the focus on Back, with a solid ring (computer-nofriends.png), on all three (audit 2's N1 fixed; the journey now checks it).
- **Signed out.** Sign in is now a blue `.button main`, as Report's Sign in.

## Findings

R1.
- UNIT: `src/features/sends/SendPicker.svelte`, `.back`.
- VERDICT: red.
- REQUIREMENT: the owner, 15:54 UTC, "match the design we used for the other pull up panels"; the brief: "Send and Back as the sheet's coloured glass buttons", laid out like the other pull-up panels.
- REASON: Back is full width but its word sits at the left; the Report panel's full-width green button is centred, and so is the picker's own Send just above it.
- EVIDENCE: `ReportSheet.svelte:320-326` gives `.quiet` `justify-content: center; width: 100%`. `SendPicker.svelte:251-255` gives `.back` `width: 100%` only, so the global `.quiet` (`look.css:791`, `justify-content: flex-start`) puts "Back" at the left. Seen in phone-picker.png, tablet-picker-busy.png and computer-picker.png: "Send" centred, "Back" hard left under it.
- EXPECTED: "Back" centred in its button, as "Send" and Report's "Take back my report".
- FIX: add `justify-content: center;` to `.back` in `src/features/sends/SendPicker.svelte`, and one expectation in `pickFriendsIn` in `tests/browser/sent-to-you.test.ts` that Back has `justify-content: center`. Those two files only.

## Notes (not blocking)

- N1. `ShareSheet.svelte` changes the dialog's own name to "Send to friends" while the picker shows. Correct for a screen reader, and the journeys match either name.
- N2. Audit 2's N4 flake (`feed-leave-and-return.test.ts:160`, phone) is now logged under Flaky tests. Its line says "run and job not passed on"; audit 2 named them: run 46025657459, job 140596258091.
- N3. Audit 2's notes N2, N3 and N5 still stand; not re-checked here.
