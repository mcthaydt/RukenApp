# Implementation audit 1: price card over the clip (PR #247, unit F tasks 1 to 3)

Examined commit: 6ecc8db. Lane 2. Read against spec 5.3 and unit F (F1 to F5). Not run: browser journeys (no WebKit here; CI was still running).

Checked and fine: F1 (`gameSlugOfNext`/`backFromPaywall`, tests added), F2 (`gamesServices()` only called when a slug is named; null for a missing or not-live game), F3 markup (`aria-hidden`, `tabindex="-1"`, `pointer-events: none`, one flat `felt-deep` layer at 0.62), F4 (card unchanged), F5 (three addresses tested). The `behindcard` name is accepted: `.backdrop` is Live's blurred layer and reusing it would break the flat 62%.

## Finding 1 (red)

UNIT: `src/routes/join/+page.svelte`, the `<video>`.
VERDICT: red.
REQUIREMENT: spec 5.3 / F3: the clip of the window's shape is behind the card, "playing where a video may move", started by `quietVideo`.
REASON: when the window is landscape the clip never plays; it shows one frame.
EVIDENCE: `wide` starts false and flips in `onMount`, which changes `src` on a `<video>` that `quietVideo` already ran on (action runs once). Changing `src` runs the media load algorithm, which sets the element paused again, and `quietVideo` does not run again. Every other place that swaps shape remounts the video: `src/routes/g/[game]/+page.svelte:77` (`{#key shape}`) and `src/routes/make/parts/GameBackdrop.svelte:24` (`{#key src}`). The new journey only checks `videoWidth > 0` (`expectFrame`), so a paused first frame passes.
EXPECTED: on a computer or a landscape phone the wide clip plays when `mayMove()` allows, like the upright one does on a phone.
FIX: wrap the `<video>` in `{#key wide}` (or key on the chosen src), so `quietVideo` runs on the video that is shown. Add to the journey, on the landscape/computer profile, a check that the video is not paused (`!paused` after a poll) unless reduced motion is on. Files: `src/routes/join/+page.svelte`, `tests/browser/join.test.ts`.

## Notes (not blocking)

- The journey asserts the dim and Tab, but nothing proves the clip sits visibly above the page background (z-index -1 over `body { background }`). It works because the body's background reaches the page canvas, so it is fine today; a screenshot in `showTheOwner` on the CI run is the evidence to read.
- WebKit journeys: wait for CI.
