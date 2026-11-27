# Implementation audit 2: games sent to you (Your turn), PR #424

- Commit examined: `013fe89` (013fe890ef144b9ae1b848355f2b59ca35cefab5), `main` at `306ddc7` already merged in.
- Brief: `docs/superpowers/specs/2026-11-27-games-sent-to-you-design.md`, revision 4 (Email becomes Your turn, the owner, 2026-11-27 14:48 UTC).
- Lane 3 implementation audit, cycle 2. Reviewer: a fresh session, Opus 5.5, medium. Started 2026-11-27 15:32 UTC, written 16:09 UTC (`date`).
- Audit 1: `ba8beb7`, FAIL 3 red (R1 lint, R2 phone share sheet Tab stop, R3 keyboard journey).

**Verdict: PASS, 0 red.** The three reds are fixed and the owner's new Your turn button meets the brief. One note matters for the merge: CI's draft run on this head is red on a phone journey that fails the same way on `main` (N4); the merge still needs a green `gate`.

## What ran

| Check | Result |
|---|---|
| `pnpm lint` | exit 0, "All matched files use Prettier code style!" (R1 fixed). CI `verify (quick, draft)` on this head: success. |
| `pnpm typecheck` | 0 errors, 2377 files |
| `pnpm test` | 169 files, 2404 tests passed |
| `pnpm test:pg` (fresh Postgres 16 database) | 56 files, 829 tests passed |
| Journeys, all three profiles, phone in WebKit, run inside `mcr.microsoft.com/playwright:v1.63.0-noble`: `sent-to-you`, `feed-top`, `feed-controls`, `fits-the-screen`, `real-buttons`, `glass`, `game-page`, `follow-a-maker` | 323 passed, 7 skipped (the files' own), 0 failed, 8.7 min |
| `gamepad.test.ts`, all three profiles, same image | 86 passed, 1 failed: `:81` on computer, sign-up "no code waiting" while my probe (below) was signing up nine people at once. Rerun `:81` `--repeat-each 3` on all profiles: 9/9 passed. Counted as caused by the probe, not the change. |
| `gamepad.test.ts:401` (audit 1's R2) | passed on phone (WebKit), tablet and computer (R2 fixed) |
| `feed-leave-and-return.test.ts` `--repeat-each 3`, three profiles | 17 of 18 passed; `:160` failed once on phone, `page.screenshot: Timeout 5000ms exceeded` (N4) |
| Same `:160` on `main` (`306ddc7`), phone, `--repeat-each 6` | 5 passed, **1 failed** with the same error (N4: pre-existing on `main`) |
| Probe journey (not committed): 9 friends, share sheet on a game page, every profile | below |

### Probe results (375×667 WebKit phone, 810×1080 tablet, 1280×720 computer)

- Apps row reads Text, WhatsApp, Instagram, Your turn, X (no Email; More only where the browser has a share sheet).
- With 9 friends the picker shows 8 faces (newest friendship first is the service's, checked by `sends.pg.test.ts`). On the phone the sheet sits at 186–667px: it fits, no element in it scrolls, the page does not scroll. Faces are 78×82, Send and Back 335×48.
- `padReachesEverything` passes in the picker with 8 faces, with no friends, and signed out, on all three; B on a face closes the sheet.
- Signed out the picker's Sign in takes the focus; with friends the first face takes it.
- With no friends, Enter on Your turn leaves the focus on the page itself (N1).
- `POST /your-turn/send` with no cookie yes and no sign-in answers 401 and keeps nothing; `/your-turn/send` is in `GATED` (`routes.test.ts` checks it).

## Audit 1's reds

- **R1, formatting.** Fixed: `pnpm lint` exits 0 here and in CI.
- **R2, the phone share sheet's own Tab stop.** Fixed: `ShareSheet.svelte` gives the `dialog` `tabindex="-1"`, and with the friends row gone the apps view is no taller than before. `gamepad.test.ts:401` passes on the phone profile in WebKit, and now also walks the picker with the pad (A on Your turn, A picks, every control reached). The test's expectation and `support/pad.ts` are unchanged.
- **R3, keyboard journey.** Fixed: `sent-to-you.test.ts` "from the keyboard alone" reaches Share, Your turn, Send, the tab, a row's link, Remove and Stop by Tab presses only, checks a visible ring on each, and uses Enter to open the sheet, open the picker, pick, send ("Sent to Kay Keys."), remove, ask (Escape closes, focus returns to Stop) and open the row. Passed on all three profiles.

## The owner's change (revision 4)

- Email is gone from `share.ts` and the sheet; a Your turn button sits between Instagram and X (`feed-controls.test.ts` checks Email gone and Your turn shown).
- Your turn turns the sheet into the picker, headed "Send to friends": faces 48px round with names cut with "…", a press picks (green ring and tick, `aria-pressed`), again unpicks; one Send sends to everyone picked, says "Sent to <name>." or "Sent to <n> friends.", "Pick a friend first." with nobody picked, "That didn't work. Try again." on a fail with the failed ones kept picked, the limit's words on 429; Back returns to the apps and puts focus on Your turn. The old "Send to a friend" row (`SendRow.svelte`) is deleted.
- Only mutual follows appear: the faces come from `friendsOf`, the same join as `canSend`; the journey shows a one-way follow is not a face, and `sends.pg.test.ts` that `canSend` is false and nothing is saved for a one-way follow.
- Sending is cookie-gated: `/your-turn/send` is `GATED`; signed-in needs the yes already.
- The picker reads the sheet's glass and white words (the journey checks transparent background and white heading). The coordinator says the owner has since asked for the picker to look like the other pull-up panels; that look is not judged here.
- The brief, `/about` and `/privacy` match revision 4.

## Owner rules re-checked

- `/your-turn` is the third tab, `OPEN` like Followed; swipe and RB from Followed reach it and stop there; a visitor with no cookie yes lands on the tab, not the notice (`feed-top`, `sent-to-you`, passed on three profiles).
- The list is solid, not glass; the Stop card reads the glass tokens (`glass.test.ts` unit and journey pass).
- Every button at least 48px; the top bar's controls share one centre line at 320 and 375 (`feed-top`, `real-buttons`).
- `/your-turn` and `/your-turn/stopped` fit with no page scroll (`fits-the-screen`).
- CRUD: send (create), list and dot (read), seen (update), Remove (delete); stop create, list, Undo delete; all in `sent-to-you.test.ts`, passed.

## Findings

None red.

## Notes (not blocking)

- N1. `SendPicker.svelte`: with no friends, `focusFirst` has nothing to focus (there is no face or Sign in), so after Enter or A on Your turn the focus drops to the page. Tab then reaches Back and the pad's next move reaches Close, so the keyboard and pad still work, but for a moment no focus shows (criterion 12, "visible focus"). Suggested: focus Back when there is no face and no Sign in. Files: `src/features/sends/SendPicker.svelte` only.
- N2. The keyboard journey calls `document.body.focus()` between steps; the body is not focusable, so this does nothing and Tab carries on from the last control. The journey still proves each control is reached by Tab alone, but the comment's intent (start from the page) is not what happens.
- N3. `gamepad.test.ts:401` puts focus on the sheet's Your turn with `.focus()` before pressing A; `padReachesEverything` just before it proves the pad reaches that button, so this is a shortcut, not a gap.
- N4. `feed-leave-and-return.test.ts:160` (from #426, already on `main`) fails on phone WebKit about 1 run in 6 with `page.screenshot: Timeout 5000ms exceeded`: 1 of 6 on `main` `306ddc7` here, 1 of 3 on this head here, and in CI browser shard 4 on this head (run 46025657459, job 140596258091), which made `gate (quick, draft)` fail. It is not caused by this change. It belongs under "Flaky tests" in `progress.md`, and the merge still needs a CI run with a green `gate`.
- N5. Audit 1's notes N2 (double press on Stop can say "That didn't work"), N3 (status codes checked in the service, not the route) and N4 (`/your-turn` reads all live games twice) still stand; not re-checked here.
