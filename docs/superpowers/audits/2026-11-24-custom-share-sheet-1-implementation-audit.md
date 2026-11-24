# Custom share sheet: implementation audit 1

- Pull request: #385 (lane 2, short path). Commit examined: `8bc52fc1533b98d140228420f98ca1ec7080c217`.
- Reviewer: fresh session, Opus 5.5, medium effort. Written 2026-11-24 05:30 UTC.
- Verdict: **FAIL, 1 red.**

## What ran

- Read the whole diff against `main` (`share.ts`, `ShareSheet.svelte`, `Feed.svelte`, the game page, the three test files) and the brief (the PR body's eight acceptance criteria).
- `pnpm exec vitest run tests/features/feed/share.test.ts`: 7 passed.
- Playwright v1.63.0 image (`mcr.microsoft.com/playwright:v1.63.0-noble`), phone (WebKit), tablet and computer: the PR's Share journeys in `feed-controls.test.ts`, `game-page.test.ts` and `glass.test.ts`, plus a reviewer probe (`/mnt/project-files/audits/2026-11-24-custom-share-sheet-1-probe.test.ts.txt`, not committed). 51 passed, 9 failed; all 9 failures are probe checks named below. Every journey in the PR passed on all three devices.
- PR CI at `8bc52fc` (draft, quick): gate, verify, postgres and browser shards 1 to 6 all success.

## Checked and fine

- Addresses: Text `sms:?&body=`, WhatsApp `wa.me/?text=`, Email `mailto:?subject=&body=`, X `x.com/intent/post?text=&url=`, Facebook `sharer.php?u=`; every part goes through `encodeURIComponent`, and a name with `&` and `?` stays inside its parameter (unit test). https apps open in a new tab with `noopener noreferrer`.
- Copy link: copies `origin/g/<slug>`; a refusing or missing clipboard says how to copy by hand (press-and-hold on touch, select elsewhere) and the link stays as one-press-selectable text.
- More: shown only where `navigator.share` exists; closing says nothing; a broken sheet says "That didn't work. Copy the link instead." (probe passed on all three devices).
- Closing: the cross, Escape and a press on the dimmed screen close it; focus goes back to Share; Copy link takes the focus on open. Tab stays inside the open sheet (probe, all three).
- Report beside Share (#378): Share, Escape, Report, Escape, Share on the same clip each open the right sheet and close (probe, all three).
- Fit: no scroll and 44px targets on the device matrix (375x667, iPad, desktop) and on a phone held sideways at 667x375, and at 320x568, on the feed and the game page (probe, all three).

## Red

UNIT: `src/features/feed/Feed.svelte`, `onKey`.
VERDICT: red.
REQUIREMENT: acceptance criterion 8 ("Everything works with the keyboard alone"); the sheet is modal, so keys pressed in it must not act on the screen behind it.
REASON: arrow keys (and Page Up/Down) pressed while the Share sheet is open move the feed behind it to another clip.
EVIDENCE: probe "arrow keys while the sheet is open leave the feed where it is", failed on phone, tablet and computer: Share opened, Copy link focused, ArrowDown, Escape; the current clip went from `tiny-game-351a067b` to `tiny-game-6de1ae97`. `onKey` (window `keydown`) only skips fields and Space on buttons; a key from inside `<dialog open>` reaches `goTo`. Before this PR Share opened the phone's own sheet outside the page, so this is new to Share. The Report sheet on the feed goes through the same `onKey` (pre-existing there; the same fix covers it).
EXPECTED: with any sheet open, the feed does not move; the clip under the sheet is still the one being shared when it closes.
FIX: in `onKey`, return when the key's target is inside an open dialog (`target?.closest("dialog[open]") != null`), and add a journey to the `Share` group of `tests/browser/feed-controls.test.ts` that presses ArrowDown in the open sheet and checks the current clip did not change. Files: `src/features/feed/Feed.svelte`, `tests/browser/feed-controls.test.ts`.

## Notes (not blocking, not fixed here)

1. Smaller than the device matrix: at 568x320 (a 4-inch phone held sideways) the panel's content is 326px in a 288px box, so it scrolls inside itself by 38px, on the feed and the game page. The owner has said a rare in-box scroll is fine; record it only.
2. Criterion 5's broken-sheet message has no browser journey (only `share.test.ts`); the `standIns` helper already has `share: "breaks"`. Worth one journey.
3. Back on Android: nothing ties the sheet to history. Chrome on Android closes a modal `<dialog>` on the system Back gesture by itself; not tested here (no Android device).
