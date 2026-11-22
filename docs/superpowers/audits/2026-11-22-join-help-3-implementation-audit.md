# Join and help bolder pages: lane 2 implementation audit 3 (focus rings)

- Pull request: #348, branch `claude/project-thread-peczhs`.
- Commit examined: `c5b3b0fbab5b0aba060348394519d49bf956a635` (audit 2's `7c29f4fb` plus the focus-ring commit). Main: `eb655acb`.
- Reviewer: the session that wrote audits 1 and 2, Opus 5.5, medium. Written 2026-11-22 20:48 UTC.
- Verdict: **FAIL: 2 red**.

## The change

`c5b3b0fb` changes `src/lib/look.css` and `tests/browser/join-and-help-look.test.ts`. The plan row's ring moves from `.plan:has(:focus-visible)` to `.plan input:focus-visible ~ .price::before`. That layer is absolutely positioned, and since `.price` has no position of its own it spans the `position: relative` row. It has `pointer-events: none`. The guide tile's ring moves from `.guide:has(a:focus-visible)` to `.guide a:focus-visible::after`, which is the link's stretched layer over the tile. Nothing else changed. The CSS reads right, and in Chromium both rings show: tablet and computer, `join-and-help-look.test.ts` plus `join.test.ts`, 62 passed locally.

## Red

### R1. The plan row's ring still does not show on the phone (WebKit)

UNIT: `src/lib/look.css` (`.card.bold .plan input:focus-visible ~ .price::before`) and its journey, "the plans can be chosen with the keyboard alone, and the row shows the focus".
VERDICT: red.
REQUIREMENT: the PR's acceptance criterion: "The plans can be chosen with the keyboard alone, with a visible ring on the row".
EVIDENCE: CI run 45067519946, `browser shard 4 of 6 (quick, draft)`, [phone]. At `join-and-help-look.test.ts:112`, `Expected: "solid"`, `Received: "none"` after 15 s. The tests just before it passed: the radio is checked and focused. So in WebKit the focused radio does not match `:focus-visible` (or the rule does not reach the pseudo-element), and moving the selector off `:has()` did not change that. This is the third failed try at this ring on WebKit, after the two `:has()` runs.
EXPECTED: a focused plan row shows its ring in WebKit as in Chromium.
FIX: per the tries rule, gather evidence before a fourth try. On [phone], log `annual.evaluate(e => [e.matches(':focus'), e.matches(':focus-visible')])` after ArrowDown. If `:focus-visible` is false while `:focus` is true, draw the ring from `input:focus ~ .price::before`. The radio is invisible, so a tap's ring is the row's own and shows the choice, which is acceptable. Otherwise follow what the log shows. The tile ring on the phone did not run (`--max-failures=1` stopped the shard), so check it in the same run. Files: `src/lib/look.css`, `tests/browser/join-and-help-look.test.ts`.

### R2. The `verify` job fails on formatting

UNIT: `tests/browser/join-and-help-look.test.ts`.
VERDICT: red.
REQUIREMENT: `pnpm lint` (CI `verify (quick, draft)`).
EVIDENCE: CI `verify` reports "Code style issues found" in that file. Locally, `prettier --check` flags line 327, which Prettier would wrap as `await expect` / `.poll(...)` / `.toBe("solid");`.
EXPECTED: `pnpm lint` exits 0.
FIX: `pnpm exec prettier --write tests/browser/join-and-help-look.test.ts`. File: that one.

## What ran

| Check | Result |
| --- | --- |
| Local, c5b3b0fb, tablet + computer: `join-and-help-look.test.ts`, `join.test.ts` | 62 pass |
| Local `prettier --check` on the two changed files | the test file fails |
| CI run 45067519946 (draft quick run) | `verify` failure (formatting); shard 4 failure (R1, phone); the other shards cancelled; `postgres`, `commit-authors`, `pr-rules-run` success |
