# Readable search results, review 4 (implementation audit)

- Pull request: #451, head `99fd58c36da1c3c1ff2c67ecf4b2e273b6e3564e`.
- Lane 2, fresh session, Opus 5.5 medium. Verdict: **PASS**, no red.
- Ran here: Playwright 1.63 with the repo's config, Postgres 16, the phone project in Chromium at the iPhone SE profile (Safari's engine was not run here; CI ran it, below).

## What changed since review 3 (071f83f)

- `git diff c105b6d 99fd58c --stat`: only `tests/browser/text-contrast.test.ts` (16 lines in, 3 out). The live file was added and removed in the same range.
- `c105b6d` is a clean merge of `main` (`git diff-tree --cc c105b6d` prints nothing): no hand edits.
- Every commit on the branch is McThayDT.
- Criterion 3 in the body now names the marks screens (live game on the way to 18+, an 18+ draft) and the "not found" rule. The body's last line is `Requested by **McThayDT**`.

## Review 3's R1: the marks screens

- The test now reads `/make/<live>/marks?age=18` and `/make/<18+ draft>/marks`, and soft-fails any screen other than `/no-such-page-here` that does not answer 200 (or 304 when read again).
- Probe (a scratch copy of the setup, not committed), same helpers:
  - `/make/<live>/marks?age=18`: 200, heading "Does Tiny game … have any of these?", 4 tick boxes.
  - `/make/<18+ draft>/marks`: 200, same heading, 4 tick boxes.
  - `/make/<live>/marks` and `/make/<12+ draft>/marks` (round 3's paths): 404, "We can't find that page." So the old hole was real and the new status check would have caught it.
  - Screenshot of the 18+ marks screen looked at: the question, Sex or nudity, Gore, Drugs, None of these, Back and Save.
- This matches `askedQuestion` in `src/routes/make/[game]/[question=question]/+page.server.ts:67`.

## The check still fails by itself

- With `main`'s `src/features/feed/Search.svelte` put back, at 375×667: 3 of 4 tests fail, only on Search with results, for every person, before and after launch: `"Tiny game …" is 1.05:1, needs 4.5:1 (#34454c on #004f46)`, on the name, the line and "by Night Owl Games". Restored afterwards.

## At this head

- `text-contrast.test.ts` at 320×568, 375×667, 667×375 (tablet size not run here): 12 of 12 pass.
- `controls-overlap.test.ts`, which measures at 320×568, 375×667 and 667×375: 4 of 4 pass.
- CI run 46138954611 at `99fd58c` (quick, draft): every job green, `gate (quick, draft)` success. The 12 phone contrast tests ran in Safari's engine in shard 5 and passed; tablet and computer skip them as written. `commit-authors` and `pr-rules` green. The full run starts when the pull request is marked ready.

## Notes, not blocking

- The marks screen's bottom line ("Only adults will see this game…") sits under a fade above the Save bar until scrolled; the journey scrolls and reads it, and it passes.
- Carried from review 3: the "Take it back" cookie flake needs its own thread; `/your-turn/stopped` is a dropped feature still on `main`.
