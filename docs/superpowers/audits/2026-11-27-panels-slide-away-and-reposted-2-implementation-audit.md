# Panels slide away, and Reposted: implementation audit 2

- Pull request: #425, lane 2. Reviewed head: `90d8c658f82345c8b63213d595a163e347242cdd` (90d8c65).
- Reviewer: a fresh session, Opus 5.5, medium. Changed nothing but this file.
- Written: 2026-11-27 15:35 UTC (from `date`).

**Verdict: FAIL, 3 red.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

Site per `verify` (Postgres 16, the four stand-ins, `wrangler dev`), with the Playwright runner and browsers inside the `mcr.microsoft.com/playwright:v1.63.0-noble` docker image, so the phone profile is WebKit (iPhone SE) and tablet and computer are Chromium, as in CI.

| Check | Result |
|---|---|
| PR journeys `sheets-slide`, `feed-marks`, `report-a-game`, `feed-controls`, all three profiles, with the reviewer's probes | 179 of 183 passed. The 4 failures are red 1 (phone), and probes A and B1 below |
| `sheets-slide` "a late first frame does not cut the slide away short", phone (WebKit) | **failed 5 of 5** (1 + `--repeat-each 4`). CI on this head fails the same way: `browser shard 2 of 6 (quick, draft)`, `+ "end sheet-undim"` |
| Same journey, tablet and computer (Chromium) | passed 9 of 9 |
| Same journey against the old `sheet.ts` from 8982b37 (tablet and computer) | failed 4 of 4, so the journey does catch red 1 of review 1 in Chromium |
| Probe A: Escape straight after opening the ••• panel (while it slides in) | **failed 4 of 12** in Chromium (tablet 2 of 5, computer 2 of 4 over two runs) and visibly failed on phone once (see red 2) |
| Probe B1: a slide away that never starts (`animation-delay: 20s` on `dialog.rises.closing`) | **Chromium: panel stays open and `inert` past 5 s (2 of 2).** WebKit: closed at about 0.8 s, only because the backdrop's start was taken as the panel's |
| Probe B2: a paused slide away (`animation-play-state: paused`) | closes about 1 s after the slide starts, all three profiles |
| Probe C: `dialog.close()` from outside mid-slide, then open and close again | reopens and slides away normally on all three (note N1) |
| Probe D: Repost at 320 × 568 | passed on all three: Like's x 260 before and after, "Reposted" spans x 252 to 316 (inside 320), check 20 × 20 on the disc's corner, page 320 wide, no scroll; taking it back shows "Repost" and removes the check |
| Lint, typecheck, unit tests | not run here; CI's `verify (quick, draft)` on this head passed |

Review 1's notes, checked: N1 the column stays still (probe D and `feed-marks`); N2 one `.disc` rule in `Feed.svelte`; N3 the sliding panel is `inert` (seen in probe C as `inert true` mid-slide).

## Red findings

### Red 1

- UNIT: `tests/browser/sheets-slide.test.ts` "a late first frame does not cut the slide away short" (and the same filter in `src/lib/sheet.ts` `own`).
- VERDICT: red.
- REQUIREMENT: the PR's own criterion (the journey passes) and CI green; the phone profile runs WebKit in CI.
- REASON: WebKit reports the `::backdrop` animation's events on the dialog with `pseudoElement === ""`, so the journey's filter records the dim's `sheet-undim` too and the expected list never matches on the phone.
- EVIDENCE: phone (WebKit) failed 5 of 5 here and in CI on 90d8c65 with `Expected ["end sheet-down","closed"]`, `Received` with an extra `"end sheet-undim"`. Probe B1's WebKit log shows `start sheet-undim` passing the same `pseudoElement === ""` test.
- EXPECTED: the journey passes on all three profiles, and `sheet.ts` tells the panel's slide from the dim's in both engines.
- FIX: match on the animation's name, not on `pseudoElement`: in `sheet.ts`, count only `animationName` `sheet-out` / `sheet-down` as the panel's slide away; in the journey, record only the panel's slide names. Files: `src/lib/sheet.ts`, `tests/browser/sheets-slide.test.ts`.

### Red 2

- UNIT: `src/lib/sheet.ts` `slideAway`, `stopped`.
- VERDICT: red.
- REQUIREMENT: the owner's ask, "transition out animation", which the brief takes as every way out sliding away.
- REASON: when a panel is closed while it is still sliding in, adding `closing` cancels the slide in; its `animationcancel` (target the dialog, `pseudoElement` "") is taken as the slide away's end, so the panel vanishes in about 40 ms with no slide.
- EVIDENCE: probe A (Escape straight after the opener), Chromium log: `start sheet-in @111, closing @117, cancel sheet-in @157, open=false @168`, with no `sheet-out` at all. 4 of 12 Chromium runs; the others pressed Escape before the slide in had started and passed. Phone WebKit, first run: `cancel sheet-up @841`, then `open=false @855` with `sheet-down` starting and ending at the same instant (nothing seen). A quick tap on the dimmed screen, Escape, or a gamepad's B within 320 ms of opening hits this.
- EXPECTED: the slide away plays to its end, then the panel closes, whenever the close comes.
- FIX: the same name check as red 1: ignore `animationstart`/`animationend`/`animationcancel` whose `animationName` is not the slide away. Add probe A as a journey in `sheets-slide.test.ts` (close right after opening; the slide away's `end` comes before `open=false`). Files: `src/lib/sheet.ts`, `tests/browser/sheets-slide.test.ts`.

### Red 3

- UNIT: `src/lib/sheet.ts` `slideAway`, the safety close.
- VERDICT: red.
- REQUIREMENT: the coordinator's brief for this review ("check an animation that never starts still closes"), and the PR's own claim that the safety close covers a slide that never reports its end.
- REASON: the safety timer is armed only by `animationstart`. If the slide away never starts, nothing closes the panel, and since it is a modal dialog made `inert`, the whole screen takes no presses or keys.
- EVIDENCE: probe B1 in Chromium (tablet and computer): after Cancel the log is only `closing open=true`, and the panel is still open 5 s later. (WebKit closed only through the backdrop's start, red 1.) No natural trigger was reproduced here; the probe forces it with `animation-delay`.
- EXPECTED: the panel closes within about a second of the press even if its slide never starts, and a slide that does start late still plays out (red 1 of review 1 stays fixed).
- FIX: also arm a timer at the press that closes the panel only if no slide away has started by then (for example 1 s); once `animationstart` comes, clear it and use the existing 1 s from the start. Add probe B1 as a journey. Files: `src/lib/sheet.ts`, `tests/browser/sheets-slide.test.ts`.

## Notes (not blocking)

- N1: a direct `dialog.close()` while sliding leaves `closing` and `inert` on the closed dialog in Chromium (probe C: `inert true` 1.5 s later). Every opener calls `stopSliding` first, so reopening works; nothing in the app calls `close()` directly today.

## Acceptance against the owner's ask

- Panels slide away mirroring the open: yes for Cancel, the cross, Escape, the dimmed screen, a gamepad's B and a choice, once the slide in has finished (journeys pass in all three profiles). Not when the close comes during the slide in (red 2).
- Repost shows "Reposted" plus a corner check, and taking it back clears both: yes, on all three profiles, including 320 wide (probe D, `feed-marks`).

## Probes

Probe A and B1, from the reviewer's throwaway `tests/browser/zz-review-probe.test.ts` (not committed):

```ts
// A: Escape at once, while the slide in plays.
await opener.click();
await page.keyboard.press("Escape");
await expect(panel).toBeHidden();
// log = the dialog's own animationstart/end/cancel (pseudoElement ""), its class/open changes, and close
const ended = log.findIndex((l) => /^end sheet-(out|down)/.test(l));
const shut = log.findIndex((l) => /open=false/.test(l));
expect(ended).toBeGreaterThan(-1);
expect(ended).toBeLessThan(shut);

// B1: the slide away never starts.
await page.addStyleTag({ content: "dialog.rises.closing { animation-delay: 20s !important; }" });
await panel.getByRole("button", { name: "Cancel" }).click();
await expect(panel).toBeHidden({ timeout: 5000 });
```
