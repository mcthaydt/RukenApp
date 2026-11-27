# Darker panel glass: implementation audit 1

- Pull request: #432 (`claude/project-thread-f2dfux`), head `866bb30` (main `d2f3897` is its base; no newer main).
- Lane 2 (`src/lib/look.css`). Reviewer: a fresh session, Opus 5.5, medium.
- Brief: the owner, 2026-11-27 19:22 UTC, "the glass panel needs to be darker and more blurred", and the five acceptance criteria in the pull request body.
- Verdict: **PASS**. No red findings; two notes.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors |
| `tests/lib/glass.test.ts` at `866bb30` | 50 passed |
| Same file with `src/lib/look.css` from main | 4 failed (the two new tests and the two extended fallback tests): the checks fail by themselves |
| Browser journeys `sheets-slide`, `glass`, `report-a-game`, `feed-marks` on the tablet and computer projects (Chromium), retries 0 | 56 passed. The phone project (WebKit) did not run: this container has no WebKit build, and the Docker WebKit draws no blur anyway |
| Probe (`/mnt/project-files/audits/2026-11-27-darker-panel-glass-1-probe.test.ts.txt`): Share, ••• and Report on a Pixel 7 window in Chromium, over a white clip and a busy striped colour picture, main tokens vs this head | Shots in `/mnt/project-files/audits/2026-11-27-darker-panel-glass-1/grid.png`, numbers in `results.json` there |
| `git merge-tree` of this head with open #424 | merges cleanly |

## Against the criteria

1. **Darker, more blurred, same tint.** `--glass-panel-filter` is `blur(56px) saturate(1.6) brightness(0.75)` against the general `blur(28px) … brightness(0.94)`; `--glass-panel-bg` is the darkest felt at 0.35 against 0.04. The test checks blur ≥ 1.5×, lower brightness, higher alpha and the same RGB. Met.
2. **A third to a half darker over white.** From the tokens: 0.35 × 17 + 0.65 × 255 × 0.75 = 130.3, so 48.9% darker; the general glass test (≤ 12%) is unchanged and still passes. Measured in the shots (panel area left of the apps, white clip, behind the dim): mean grey 89.6 on main, 64.5 at this head. Met.
3. **Every rising panel.** Only three components carry `rises` on main (`ShareSheet`, `TasteSheet`, `ReportSheet`), each draws its own surface with `var(--glass-bg)` / `var(--glass-filter)`, and `dialog.rises` sets those two properties on the dialog element itself, so it wins over the inherited root value. #424's friend picker (`SendPicker`) renders inside the Share dialog and uses no glass-bg of its own (its faces are `--glass-safe`), so it gets the panel glass and still matches the apps. The shots show all three panels darker and blurrier. Met.
4. **Fallbacks.** The pair is solid darkest felt in the no-blur, less see-through and more contrast blocks and on `:root:not([data-glass])`; since the dialog reads `var(--glass-panel-*)`, which inherit from `:root`, the panel goes solid with the rest. Tests extended. Met.
5. **Shots in Chromium.** The builder's artifact has them; this audit's own Chromium shots agree: the busy stripes become soft colour with no edges behind every panel, and the words and the coloured buttons stay clear. Met.

## Exploratory checks

- **Other glass unchanged.** `--glass-bg` and `--glass-filter` on `:root` keep their values. Every other surface that reads them (`.panel.over`, `.screen .acts`, the game page's name and Back, the play menu, the page spinner, cookie consent, the sideways phone row) sits outside any `dialog.rises`, so none of them change. No other rule sets `--glass-bg` or `--glass-filter` on an element (only `html[data-sliding]::view-transition-group(tabs)` sets the filter to none, unrelated).
- **No nested blur inside a panel.** Nothing inside the three panels, or #424's picker, reads `--glass-bg` or `--glass-filter`, so the 56px blur is drawn once per panel, not again by each child.
- **Readability.** With the words hidden, the brightest 1% of the background behind the Share and Report titles fell from luminance 0.141 (main) to 0.075 (this head): chalk-white contrast rises from about 5.5:1 to about 8.4:1. The ••• panel's numbers measure its green button, not the glass, and are left out.
- **Slide and blur cost on a phone (Chromium, CPU slowed 4×).** Six opens and closes of Share, two rounds each, frame gaps by `requestAnimationFrame`: main median 17 ms, 95th 50 ms, frames over 50 ms 5 and 10; this head median 17 ms, 95th 50 ms, frames over 50 ms 4 and 11. No measurable difference. The owner's phone is a Galaxy (Chromium-based), so this is the engine that matters most.

## Notes (not blocking)

- **N1.** UNIT: `.claude/skills/this-repo/SKILL.md`, "See-through is frosted glass". VERDICT: note. REQUIREMENT: the rule text should describe the code. REASON: it still names Share among plain glass pieces and says nothing of the panel pair, so a later builder could "fix" a panel back to the 12% general glass. EVIDENCE: the skill's glass line lists "Share" and the 12% limit only. EXPECTED: one sentence saying rising panels (`dialog.rises`) read `--glass-panel-bg` / `--glass-panel-filter`, a third to a half darker. FIX: that sentence, in this pull request or the next one that touches the glass; lane 1 when alone.
- **N2.** Blur cost on iPhone Safari is not measured: no cloud WebKit draws backdrop blur. If an iPhone ever feels slow opening a panel, measure there first; 56px is the first thing to try lower.

## Not checked

- The phone project in WebKit (see above). CI's phone pieces cover the journeys there; they do not judge the blur.
