# Games sent to you (Your turn), implementation audit 6

- Pull request: #424, head `a3b6f204087cc8cebac482f49214f64a007f59f2` (`a3b6f20`), lane 2 re-audit after audit 5 (`819ac31`, FAIL 1 red).
- Reviewer: fresh session, Opus 5.5, medium. Finished 2026-11-27 20:03 UTC.
- Verdict: **a3b6f20 FAIL: 1 red** (R1 below). Audit 5's R1 is fixed.

## Scope

Audit 5's R1 (after leaving Share from the friend picker, the next Share opened on Close instead of Copy link), what changed since `819ac31`, whether the new check fails without the fix, and full CI run 46057407663.

## What changed since 819ac31

`git diff 819ac31 a3b6f20`: one commit (`a3b6f20`, authored McThayDT), two files.

- `src/features/feed/ShareSheet.svelte`: `open()` focuses Copy link after `tick()` when the bound button is gone or not yet drawn again; `onclose` sets `picking = false`, so every way out (Close, Escape, the dimmed screen, gamepad B, More after a share) goes back to the link and the apps. All of them end in the dialog's `close` event (`src/lib/sheet.ts` `slideAway` → `sheet.close()`), so the reset covers them all. The feed (`Feed.svelte`) and a game's page use the same component, so both get the fix.
- `tests/browser/sent-to-you.test.ts`: after Back, for Close and Escape, the journey opens the friends, leaves, presses Share again and expects Copy link focused.

Nothing else changed.

## Checks run here

All runs in Playwright's own image `mcr.microsoft.com/playwright:v1.63.0-noble` (phone in WebKit, tablet and computer in Chromium), Postgres 16 in the container, `.wrangler/state` cleared.

| Check | Commit | Result |
| --- | --- | --- |
| `sent-to-you.test.ts`, all journeys, 3 profiles | a3b6f20 | 18 of 18 passed |
| The new check without the fix: `ShareSheet.svelte` from 819ac31, test from a3b6f20, "a friend sends a game" | a3b6f20 test, 819ac31 source | 3 of 3 failed, each at `sent-to-you.test.ts:162` (`toBeFocused`, Copy link) |
| Throwaway probe: the two other ways out, a press on the dimmed screen (a tap on the phone) and the pad's B, each then Share again expecting Copy link focused (diff below) | a3b6f20 | 3 of 3 passed (phone, tablet, computer) |
| `trackpad-swipe.test.ts`, phone, `--repeat-each=6`, fresh database | a3b6f20 | 6 of 12 failed (two runs, 3 of 6 each) |
| The same | main `d2f3897` | 6 of 6 passed |

CI run 46057407663 on a3b6f20 (full run): verify, postgres and browser shards 1, 2, 3, 4 and 6 passed; **browser shard 5 failed** (1 failed, 353 passed), so **gate failed**. The one failure is `trackpad-swipe.test.ts:92` [phone], line 104: Followed never got `aria-current="page"` after the first swipe.

## Findings

**R1 (red).**
- UNIT: the trackpad swipe between feed tabs with #424's third tab: `src/features/feed/FeedTop.svelte` (the wheel handler) and `src/features/feed/tabs.ts` (`stepOfWheel`, `WHEEL_REST`), or the journey's wheel sending in `tests/browser/trackpad-swipe.test.ts`.
- REQUIREMENT: green CI before merge (CLAUDE.md lane 2), and the trackpad journey's own claim, "one tab a swipe".
- REASON: on #424 one trackpad swipe from Fresh sometimes moves two tabs, onto Your turn. On main the same double step stops at Followed, the last tab there, so it never shows. #424 makes it show by adding the third tab.
- EVIDENCE: this is the second #424 full run to fail on it (46051556495 at `19113f9`, then 46057407663 at `a3b6f20`, both shard 5, phone). Here it failed 6 of 12 at a3b6f20 and passed 6 of 6 on main, in the same image with a fresh database. The trace of a failed run here (`repeat4`) loads `/followed/__data.json` (200, 32 ms) and then `/your-turn/__data.json` in the same swipe. Audit 5's N1 saw the same pair at `19113f9`. Not found here: whether the second step comes from a pause of more than `WHEEL_REST` (200 ms) between the journey's wheel events on a busy WebKit, or from the swipe not being kept across the move.
- EXPECTED: one swipe moves one tab on every profile. `trackpad-swipe.test.ts` passes 12 of 12 on the phone with `--repeat-each=12` at the fixed head, and the full CI run is green.
- FIX: find which one it is from the trace, then fix the product (a swipe takes no second step until the wheel has rested, across the move too) or, if a real trackpad cannot pause like that, the journey's wheel sending. Only `src/features/feed/FeedTop.svelte`, `src/features/feed/tabs.ts`, `tests/browser/trackpad-swipe.test.ts` (and its unit test for `tabs.ts`) may change. The pull request says which one it was and why. The `progress.md` Flaky tests line for this journey is updated to match.

**Notes (not blocking).**
- N1: `open()` checks `copyButton === undefined || !copyButton.isConnected`. Svelte 5 sets a `bind:this` to `null` when the element goes, so a `null` would throw at `.isConnected`. It cannot happen now, because `onclose` sets `picking = false` and Svelte draws Copy link again long before the next press. `copyButton?.isConnected !== true` would cover both.
- N2: the committed check covers Close and Escape. The dimmed screen and gamepad B were checked only by this audit's probe. Adding them to the loop would keep them covered.

## Probe (not committed)

```diff
+import { PAD, plugInPad, pressPad } from "./support/pad.ts";
...
+    // AUDIT PROBE: the other two ways out, a press on the dimmed screen and the pad's B.
+    await plugInPad(sender.page);
+    await sender.page.reload({ waitUntil: "domcontentloaded" });
+    await pageHasSettled(sender.page);
+    await sender.page.getByRole("button", { name: "Share" }).click();
+    await expect(sheet).toBeVisible();
+    for (const leave of ["outside", "B"] as const) {
+      await pickFriendsIn(sheet);
+      if (leave === "outside") {
+        if (testInfo.project.name === "phone") await sender.page.touchscreen.tap(4, 4);
+        else await sender.page.mouse.click(4, 4);
+      } else await pressPad(sender.page, PAD.b);
+      await expect(sheet, `left by ${leave}`).toBeHidden();
+      await sender.page.getByRole("button", { name: "Share" }).click();
+      await expect(sheet.getByRole("button", { name: "Copy link" }), `after ${leave}`).toBeFocused();
+    }
```
