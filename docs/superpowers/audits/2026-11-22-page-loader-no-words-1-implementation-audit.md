# Page loader with no words: implementation audit 1

Pull request #317, branch `claude/project-thread-bip6ma`, examined commit `54a5141`. Lane 2 (`src/lib/`). Reviewer: Opus 5.5, medium, fresh session.

Brief: the owner, 2026-11-22, "We don't need the Loading... text". Keep the spinner and the top line, drop the words.

## Verdict

54a5141 PASS: 0 red, 0 notes that block.

## What was checked

- The words are gone. `src/lib/page-loading.svelte:32` renders `<p class="page-loading-spinner" aria-hidden="true"><span class="spinner"></span></p>`; rendered with `look.css` in Chromium, its text is `""`.
- The top line stays. `.page-loading` (role `progressbar`, name "Loading the page") is unchanged; `getByRole("progressbar", { name: "Loading the page" })` finds 1 in the same render, which is what `tests/browser/loading.test.ts:19` looks for.
- Accessibility. The chip stays `aria-hidden`, so a screen reader hears only the progress bar's name, as before; nothing spoken was lost because the removed words were already hidden.
- No stale references. `grep -rn "page-loading-words" src tests .claude` finds nothing; the only hits for the old class or "Loading…" are in past audit files (`2026-11-22-loading-indicators-2-implementation-audit.md`), which record history and are not changed.
- The chip's look. Rendered in Chromium: chip 39.0 × 39.0 px at top 16 px, centred; spinner 25.9 × 25.9 px with 6.6 px on every side, so the even padding gives a square chip. `font: var(--text-button)` is kept, which is right: the spinner is sized in `em`. The removed `gap` had nothing to separate.
- The loading rule still holds. Every page move still shows the line and a turning spinner after the delay; reduced motion still stops the spinner and draws the line whole (`look.css` reduced-motion block unchanged). Comments in `look.css` and the component now describe the spinner with no words.
- Checks run here at `54a5141`: `pnpm lint` passed; `pnpm typecheck` 0 errors; `vitest run tests/lib/look.test.ts tests/loading-states.test.ts` 139 passed.
- Not run here: the browser journeys. This container has no database (`Connection url is empty`). CI at `54a5141` ran them: all 6 quick browser shards, postgres, verify, gate, commit-authors and pr-rules-run succeeded (run 45029286904).
- CRUD: the change adds or touches nothing a user can make.

## Follow-ups (not this change)

None.
