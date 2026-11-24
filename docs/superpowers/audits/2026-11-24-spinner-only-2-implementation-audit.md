# Spinner only: implementation audit, round 2

- Pull request: #390, branch `claude/project-thread-zo5n98`, head `0fbe683` (fix commit `c7c40f5`; round 1 was `63412c7`).
- Lane 2. Reviewer: Opus 5.5, medium, the round 1 reviewer, on the fixes only and what they touched.

**Verdict: FAIL, 1 red.** All three round 1 findings are fixed; the fix brought one new regression.

## What ran on 0fbe683

- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0, 0 errors. `pnpm test`: 154 files, 2,222 tests passed, exit 0.
- Browser journeys: not run here (no database in this container).
- Probes (Chromium, Playwright, each head's whole `src/lib/look.css`): accessible name of a busy button through Chrome's own accessibility tree; and, for the two other rules the fix changed, opacity, visibility, whether the pointer hits the element, whether Tab reaches it, and what a reader reads.

## Round 1 findings

1. Busy button keeps its name: **fixed.** Busy Wishlist (`<svg aria-hidden>` + `<span>Wishlist</span>`) is named `"Wishlist"` in Chrome's tree, busy and not; `getByRole("button", { name: "Wishlist", exact: true })` finds 1. "Next" and the video picker ("Choose video") keep theirs.
2. No second line beside the spinner: **fixed.** `LiveScreen.svelte` and `TakenOffScreen.svelte` keep their resting note while sending. The widened test in `tests/loading-states.test.ts` matches `{#if sending}` and `{:else if sending}`, the exact lines removed, and `sending ? "…"` label swaps; it passes on 0fbe683.
3. `this-repo` rule: **fixed.** "Every wait shows it" now says spinner only: no words, no line, no changed label; busy buttons keep their words unseen; frames and fetches show a named spinner. It matches the code. The PR body names the edit and its lane.

## Findings

### 1. Two hidden pieces are now invisible but still pressable and reachable by Tab (red)

- UNIT: `src/lib/look.css:4314` (`.playing .menu[open] > summary`) and `src/lib/look.css:5411` (`body:has(aside.consent) .about .tofeed`).
- REQUIREMENT: CLAUDE.md "Keep to the request" (the fix was to the busy-button rule only); the brief's "keep it accessible"; no regression.
- REASON: the fix also changed these two unrelated rules from `visibility: hidden` to `opacity: 0`. `visibility: hidden` took them out of reach; `opacity: 0` only makes them unseen, so they still catch taps, take keyboard focus and are read out.
- EVIDENCE: probe, same markup and each head's `look.css`:
  - 63412c7: the open play menu's tab and the about page's corner button: `visibility: hidden`, pointer hit no, Tab reaches no, reader reads nothing.
  - 0fbe683: both `opacity: 0`, `visibility: visible`, pointer hit **yes**, Tab reaches **yes**; reader reads "Menu" and link "To the feed".
  - So with the play menu open, an unseen tab sits over the panel's edge (the comment above the rule says it would cover it) and a tap there closes the menu; keyboard focus lands on an unseen tab. On `/about` with the cookie card up, Tab lands on an unseen "To the feed".
- EXPECTED: both stay out of reach and out of the reader while hidden, as on `main`.
- FIX: put `visibility: hidden` back on those two rules; only the busy-button children (`:is(button, .button)[aria-busy="true"] > *` and the `.file` span children) use `opacity: 0`. File: `src/lib/look.css`.

## Notes (not blocking)

- None.
