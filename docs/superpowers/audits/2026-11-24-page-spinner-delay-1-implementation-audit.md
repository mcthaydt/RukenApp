# Page spinner after 2 seconds: implementation audit, round 1

Reviewed: branch `claude/project-thread-885jbf` at `427eff3` (PR #398). Lane 2 (`src/lib/page-loading.svelte`), one
fresh review. Brief: the owner, 2026-11-24 18:59 UTC, "Let's only show the spinner if more than 2 seconds have
elapsed"; 19:00 UTC, "Not for sub elements like images within the pages, I meant for pages exclusively"; plus the
acceptance criteria in the PR body. Reviewer: Opus 5.5, medium.

**Verdict: PASS, 0 red, 2 notes.**

## What was checked

- Scope: `git diff --stat origin/main...427eff3` touches `src/lib/page-loading.svelte` (the constant 150 → 2,000 ms and
  its comment), `tests/browser/loading.test.ts` (the page journey), the `this-repo` skill's "Every wait shows it" line
  (named in the PR body) and `progress.md`. Nothing else.
- Pages only: `page-loading.svelte` is used once, from `src/routes/+layout.svelte`, and only watches `navigating`.
  Busy buttons (`busy-forms.ts`, `look.css`), `use:loads` pictures and videos, the feed's "Loading more games", the
  play screen's "Starting <game>" and `/join/done`'s "Finishing up" do not read it and are unchanged.
- The check fails by itself: with `SHOW_AFTER_MS = 150` put back, `loading.test.ts:13` fails on phone, tablet and
  computer at line 29 (`Expected: 0, Received: 1` at 1.9 s); with `427eff3` it passes.
- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors (2,256 files). `pnpm test`: 154 files, 2,235 tests passed.
- `tests/browser/loading.test.ts` on all three profiles, phone in WebKit included (local Postgres 16, Playwright
  1.63.0 WebKit): 21 passed.
- Run like a person, on the real clock (a throwaway probe, not committed): with `/sign-up`'s data held back, the
  spinner first appeared 2,044 ms after the tap on phone (WebKit), 2,067 ms on tablet and 2,036 ms on computer, and
  went once the page came. A quick move (49 to 76 ms) never put the spinner in the page at all (a MutationObserver saw
  nothing), on all three. Phone screenshots at 1 s (old page, no spinner) and 2.5 s (the glass spinner at the top)
  match.

## Findings

None red.

## Notes (not blocking)

1. For the first 2 seconds of a slow move the screen shows no sign the tap was taken: the old page stays as it is.
   That is what the owner asked for, so it is not a defect; if a slow line later reads as "the tap did nothing", this
   is where to look.
2. "Pages exclusively" was read as moves between pages. The play screen's "Starting <game>" and `/join/done`'s
   "Finishing up" fill a whole screen but are waits inside a page, and keep showing at once. That reading fits the
   owner's 19:00 UTC message; the owner can say otherwise.
