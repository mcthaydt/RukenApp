# Loading indicators, implementation audit 2 (PR #309)

- Examined: ae98ac9 (branch `claude/project-thread-jhe4or`), the fix of audit 1 (2e31622) plus the spinner the owner asked for at 06:36 UTC ("let's use a spinner too, or at least some obvious indication that something is loading").
- Lane 2. Reviewer: the same fresh review session as audit 1, Opus 5.5, medium.
- Verdict: **PASS, 0 red, 2 notes.**

## What ran

- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0, 0 errors. `pnpm test`: 125 files, 1860 tests passed.
- Audit 1's two probes (a `fetch(` appended to `src/features/feed/feed.browser.ts`, a second `use:enhance` form with no busy button appended to `LiveScreen.svelte`), then `pnpm exec vitest run tests/loading-states.test.ts`: "2 failed | 5 passed (7)", one failure naming each probe. Reverted.
- The narrowness of the no-circle exception: `border-radius: 50%` added to `.page-loading-words` and `border-radius: 999px` to `.hidden-words`, then `pnpm exec vitest run tests/lib/look.test.ts`: "has no pill or circle shape, except the drifting circles behind Live and the loading spinner" fails. Reverted.
- The spinner drawn: a page with `look.css` and busy Blue, `.outline`, `.danger` and `.quiet` buttons plus the "Loading…" chip, in Chromium. Each button's `::after` is 19.8 × 19.8 px, `border-radius: 50%`, `animation-name: spinner`, set after the words; under `prefers-reduced-motion: reduce` the animation is `none`. Every button class is `inline-flex`, so `gap` and the sized pseudo-element hold.
- CI on ae98ac9 at the time of writing: pr-rules-run, commit-authors, postgres and browser shards 2 to 6 green; shard 1 and verify still running.

## Audit 1's findings

- **Red 1: fixed.** The fetch check now reads `*.browser.ts` as well as screens, the "Starting {" escape is replaced by an explicit `BACKGROUND_FETCHES` list with a reason per entry (only the play-time beat), and each `<form>…</form>` is judged on its own. Both probes fail it (above).
- **Note 1: taken.** A polite live line in the layout (`#sending-news`, `.hidden-words`) says "Sending…" when a plain form goes out, and is emptied when the marks clear.
- **Note 2: taken.** `loads` watches `src`/`srcset` on an image with a `MutationObserver` and marks it again when the new address has not loaded; it disconnects on destroy.
- **Note 4: taken.** `clearSending` now touches only `form[aria-busy]` and, inside it, buttons carrying both `aria-busy` and `aria-disabled` (the pair only `markSending` sets), so busy marks a screen sets itself ("Looking up branches…", enhanced buttons) are left alone.
- Notes 3 and 5 stand as follow-ups, unchanged.

## The no-circle exception

Narrow. `tests/lib/look.test.ts` strips exactly one rule before the check: the block whose selector is `.spinner, :is(button, .button)[aria-busy="true"]::after`. Any other `50%`/`999px` radius still fails the test, as the probe shows. The reduced-motion copy of that selector sets no radius. The owner's word is quoted in the test and in `look.css`, and the PR body names the changed test and why. `hidden-words` joins the look's class list for the layout's screen-reader line only.

## Also checked

- The layout, `page-loading.svelte` and the live line render the same on the server and on hydration (`{#if shown}` starts false; the live line starts empty), so #293's fix is still untouched.
- The "Loading…" chip is `aria-hidden`; the progress bar keeps the spoken name. The journeys in `tests/browser/loading.test.ts` are unchanged and still look for that name.

## Notes (not blocking)

1. `tests/loading-states.test.ts`: the fetch check reads `.svelte` and `*.browser.ts` files and judges a file as a whole. A `fetch(` in a browser module under `src/lib/` (those are not named `.browser.ts`, for example `quiet-video.ts`), or a second fetch in a file that already shows one wait, would still pass. Today there is none of either.
2. A busy button grows by the spinner's width plus the gap (about 30 px) when it is pressed, so a centred or full-width row of buttons shifts a little. Reserving the space, or drawing the spinner in place of part of the padding, would keep it still.
