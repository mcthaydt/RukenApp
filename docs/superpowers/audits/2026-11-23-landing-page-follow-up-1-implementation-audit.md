# Landing page follow-up (#369): implementation audit, round 1

Examined: `3d5f23f` (head of `claude/project-thread-2vpwcj`, on main at `509aa6e`). Lane 2, one fresh review. Reviewer: Opus 5.5, medium. Written 2026-11-23 15:49 UTC (time from `date`).

**Verdict: `3d5f23f` FAIL: 3 red.**

## What ran

- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 2,221 files. `pnpm test`: 149 files, 2,162 passed.
- `tests/browser/about.test.ts` on tablet and computer (Chromium, local Postgres 16): 22 passed.
- Each fix reverted alone, its journeys run on tablet and computer:
  - `motion.ts` back to `509aa6e`: the jump journey fails on computer (its top is not 0), passes on tablet (card already on screen at load, as the PR says).
  - Only the `text-decoration: none` line removed: the underline journey fails on both, `Received: "underline"`.
  - The sideways `@media` block removed: all 4 sideways journeys fail (`toBeInViewport` failed).
- Probe (not committed) at 320x640, 375x667, 810x1080, 1280x720, 667x375, 844x390, 568x320: no sideways scroll anywhere (`scrollWidth` equals the width). Sideways, "Watch the feed" sits at y 239–287, inside 320/375/390. Upright sizes keep the old order (lines, then the button), so the rule does not reach them.
- The PR's own CI (run 45207831333, quick draft): `browser shard 2 of 6` failed on the phone profile; see red 1.
- Phone (WebKit) not run here: the container has no WebKit. CI's result is used instead.
- The progress.md flake entry checked against run 45203368851 (main at `509aa6e`): shard 2 failed at `edit-page.test.ts:278` [phone], as written.

## Red

### 1. The jump journey fails on the phone in this PR's CI

- UNIT: `tests/browser/about.test.ts:181-187`.
- VERDICT: red.
- REQUIREMENT: acceptance criterion 1 and "CI green"; a new journey must pass on every profile.
- REASON: `Math.round` of a small negative top gives `-0`, and `toBe` uses `Object.is`, so `-0` is not `0`. The card is in place; the check is wrong.
- EVIDENCE: job 137808533959, `[phone] about.test.ts:169`: `Expected: 0 Received: -0`, "Timeout 5000ms exceeded while waiting on the predicate" at line 185. Max failures then stopped the shard, so the phone's underline and two sideways journeys never ran.
- EXPECTED: the journey passes on phone, tablet and computer, and still fails with `motion.ts` from `509aa6e` (top near -24).
- FIX: compare the distance, at both line 185 and line 187, e.g. `Math.abs(top) < 1` (or `Math.round(top) + 0`). Only `tests/browser/about.test.ts`.

### 2. The fix stops the rise on three bands it was not meant for

- UNIT: `src/routes/about/motion.ts:41` (`y: block.id === "" ? 24 : 0`).
- VERDICT: red.
- REQUIREMENT: the PR body and the new code comment: only a block "the page's own links jump to ("For players", "For makers")" stops rising; the owner-approved look (#333) has every block below the first screen rise.
- REASON: every `.band` with an `id` loses the rise too: `#fans`, `#safe` and `#pay` (ids from `sections.ts`) are not jump targets of the page's links.
- EVIDENCE: probe at 1280x720 after load, inline styles set by GSAP: `makers`, `players`, `fans`, `safe`, `pay` all `translate(0px, 0px)`; the bands without an id and the closing cards `translate(0px, 24px)`. At `509aa6e` all ten were 24px.
- EXPECTED: only `#players` and `#makers` fade without rising; the other bands still rise 24px.
- FIX: choose by what the links jump to, e.g. `block.matches(".pair .card[id]")`, or the ids in `TOP_LINKS`; a journey line that `#pay` (or another band) still starts lowered keeps it. Only `src/routes/about/motion.ts` and `tests/browser/about.test.ts`.

### 3. The PR body is missing its first attribution line

- UNIT: PR #369 body.
- VERDICT: red.
- REQUIREMENT: the project's PR attribution rule and the coordinator's brief: the body starts with `<!-- claude-projects-attribution: {"github_login":"mcthaydt"} -->`, then the `_Requested by **McThayDT** · [project thread](…)_` line.
- REASON: the body's first line is the "Requested by" line; the HTML comment is absent.
- EVIDENCE: `gh api repos/mcthaydt/RukenApp/pulls/369 --jq .body | head -1` prints `_Requested by **McThayDT** · [project thread](https://claude.ai/code/project/chan_01XVJVT78CDCo32eqKbcTJ4h)_`. "## Acceptance criteria" and the last line "Requested by **McThayDT**" are present.
- EXPECTED: the comment line first, the Requested-by line second, last line unchanged.
- FIX: edit the body through the hooked route, adding the line at the top; read the body back after.

## Notes (not blocking)

- The sideways rule `(orientation: landscape) and (max-height: 30rem)` also catches a computer window made very short (e.g. 1280x450). The result there is fine (smaller headline, button first), so nothing to do.
- The corner-button underline fix is correct as written; the button has only an SVG today, as the PR says.
- CRUD: the change makes nothing a person can save. Nothing to check.
- The drunk-grandma test: sideways, the first screen now shows the headline and one blue "Watch the feed" button, with the lines after it. Clear.
