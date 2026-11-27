# Implementation audit 5: games sent to you (Your turn), PR #424

- Commit examined: 819ac31584b7ca0db7d299ef943713b6d3fffbd9 (819ac31). Started on 19113f9; the head moved to 819ac31 (main merged in with #430, plus one progress.md line), and the code under audit is byte-identical between the two (checked below).
- Scope: the merge of main's #425 (panels rise and slide away, `src/lib/sheet.ts`) into #424 after audit 4 passed at e5830b4. Lane 2 re-audit, Opus 5.5, medium, fresh session.
- Verdict: **FAIL, 1 red**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## The merge resolution in ShareSheet.svelte

`git show --cc 19113f9` (the merge of fde2ddd): conflicts in `docs/superpowers/progress.md`, `src/features/feed/ShareSheet.svelte` and `tests/features/feed/tabs.test.ts`.

- Imports keep both sides: `tick`, `slideAway`/`slideAwayOnCancel`/`stopSliding` from `../../lib/sheet.ts`, and `SendPicker`/`SEND_WORDS`/`Friend`.
- `open()` keeps #424's `slug = game.slug` and `picking = false` and takes #425's `stopSliding(sheet); sheet.showModal()` in place of the old `finishClosing()`.
- The dialog is `class="sharesheet rises"` with #424's `tabindex="-1"`; #425's removal of `class:closing` stands. `close()` is #425's `slideAway(sheet)`; `oncancel={slideAwayOnCancel}`.
- The `<style>` block is identical to main's (`git diff fde2ddd 19113f9 -- ShareSheet.svelte` has no hunk after `<style>`), so #425's `.rises` slide is not overridden.
- `tabs.test.ts`: both sides' imports kept, #424's three-tab expectation kept.

## #424's own code is otherwise unchanged

For every file the PR changes, the `-U0` added and removed lines of `git diff 306ddc7 e5830b4` (audit 4's head against its base) were compared with those of `git diff fde2ddd 19113f9` and of `git diff d2f3897 819ac31`. Every file is identical except `docs/superpowers/progress.md` (flaky-test notes). So the merge undid none of #425 and changed none of #424.

## The picker inside Share rises and slides away

A throwaway probe (deleted, never committed) on all three profiles, Playwright 1.63 image, at 19113f9 (same code as 819ac31). It recorded the panel's own animation names (not `::backdrop`'s) on each open and close.

| Way out from "Send to friends" | phone (WebKit) | tablet | computer |
|---|---|---|---|
| Close (cross) | sheet-down, closed | sheet-out, closed | sheet-out, closed |
| Escape | sheet-down, closed | sheet-out, closed | sheet-out, closed |
| Press on the dimmed screen | sheet-down, closed | sheet-out, closed | sheet-out, closed |
| Gamepad B (cancelable `cancel`) | sheet-down, closed | sheet-out, closed | sheet-out, closed |
| Opening | sheet-up | sheet-in | sheet-in |
| Back, then pick a face and Send | no slide; stays open, "Sent to Sam Sender." | same | same |

In every way out the dialog carried `closing` before it was hidden, so it slid rather than vanished. Back returns to the apps with focus on "Your turn"; Send keeps the sheet open (it is not meant to close it). Reopening after any way out shows the apps (Share title), not the picker. Shots: https://claude.ai/artifact/1eBLM8XvxWLW6XKcE7HDHv (the phone image draws no backdrop blur, a known limit of the Docker WebKit image).

## Red

**R1**
- UNIT: `src/features/feed/ShareSheet.svelte`, `open()`.
- VERDICT: red.
- REQUIREMENT: the share sheet's existing rule, "The one main action takes the focus, not the cross that comes first" (comment in `open()`), held by `tests/browser/feed-controls.test.ts:799` and `:854`; gamepad and keyboard reach (owner: everything navigable with a gamepad).
- REASON: after the sheet is left from the friend picker, the next Share opens with focus on the Close cross, not Copy link.
- EVIDENCE: the probe pressed Share, then Your turn, left by each of the four ways above, then pressed Share again. `Copy link` was not focused within 15 s on phone, tablet and computer (3 of 3 failed, `toBeFocused` received "inactive"); `document.activeElement` was `BUTTON.close` in all 12 cases. Cause: Copy link is inside `{:else}` of `{#if picking}`, so while picking it is unmounted and `copyButton` is null; `open()` sets `picking = false` but calls `copyButton?.focus()` before Svelte has mounted the button again. The same code is at e5830b4, so audits 1 to 4 missed it; the merge did not cause it.
- EXPECTED: every open of Share puts the focus on Copy link, whatever the sheet showed when it last closed.
- FIX: in `open()`, focus Copy link after the DOM update (for example `await tick()` before `copyButton?.focus()`, or reset `picking` on close), and add the check to `tests/browser/sent-to-you.test.ts`: leave the picker by Close or Escape, press Share again, expect Copy link focused. The check must fail on the current code (it does: see the evidence). Files: `ShareSheet.svelte`, `sent-to-you.test.ts`.

## CI

- 19113f9, run 46051556495: verify and postgres green; browser shard 5 of 6 failed one journey, `tests/browser/trackpad-swipe.test.ts:92` [phone] (from #429), so the gate was red.
- 819ac31, run 46053869964 (full run): verify, postgres, all six browser shards and gate green, no retries. The trackpad journey passed this time. CI being green does not clear R1: no journey covers reopening Share after the picker.

## Notes (not blocking)

- **N1, the trackpad flake's cause.** The progress.md entry at 819ac31 says the first swipe "never marked Followed" and gives no cause. The failed run's trace (artifact playwright-report-5, trace `6-trace.network`) shows `/followed/__data.json` and then `/your-turn/__data.json` loaded inside that one swipe: it stepped two tabs, Fresh to Followed to Your turn. On a phone the journey sends each wheel move with its own `page.evaluate`, so on a busy runner a gap over `WHEEL_REST` (200 ms, compared by `event.timeStamp` in `FeedTop.svelte:94`) starts a new swipe mid-coast. On `main` the second step from Followed has no tab to go to, so the same pause is invisible; #424's third tab makes it show. Locally it passed 6 of 6 on phone at 19113f9. Suggested owner of the fix: whoever fixes the flake (send the phone's whole run inside one `page.evaluate`, so its gaps are the page's own), recorded under Flaky tests.
- Audit 2's notes stand.
