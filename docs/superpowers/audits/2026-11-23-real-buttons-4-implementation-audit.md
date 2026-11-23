# Real buttons: implementation audit, round 4 (fresh lane 2 review)

- PR: #345 "Replace underlined text buttons app-wide"
- Head examined: `916f71d66564c6b75eb050ddace1f0bba0925668` (carries the conflict-resolved merge of main 992c281, 4330051)
- Reviewer: fresh session, Opus 5.5, medium
- Date: 2026-11-23 21:02 UTC
- Verdict: **FAIL: 1 red**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was read

- The whole diff `992c281...916f71d` under `src/` (45 files in the PR, 1,245 diff lines under `src/`), the PR body, `this-repo` product rules, and `tests/browser/real-buttons.test.ts`.
- Every `<a>` in `src/**/*.svelte` with no class, and every class used on an `<a>`, to find actions that stand on their own and are not painted buttons.
- `grep -rn underline src`: only comments remain. No `text-decoration: underline` is left anywhere.

## Checks run

On the head merged with current main `8cfacf30` (clean auto-merge; main's 18 commits since 992c281 touch the feed video code, one line each of `about` and `join`, and tests), in a cloud container on a fresh Postgres 16 database:

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 2,174 passed, 149 files |
| `pnpm test:browser` real-buttons, look, look-layout, about, cookie-consent, me, bar, membership, make-second-look, make-design-pass on computer and tablet | 348 passed, 82 skipped, 0 failed (4.3 min) |
| CI at 916f71d | gate (quick, draft) and every quick shard: success; pr-rules-run and commit-authors: success |

Not run: phone (WebKit). CI's full run covers it once the PR is marked ready.

## PR body against the pr-rules

Starts with the attribution comment and the "Requested by" line; has `## Lane` and `## Acceptance criteria`; last line is `Requested by **McThayDT**`. Pass.

## Owner's rules

- No underlined text anywhere: pass (grep and the journey's underline sweep on every visited screen).
- The four "What is Ruken?" links (sign-in, You, join, help): all are `.quiet` painted buttons. Pass.
- Icon-only where the icon is clear (Back, Change, Up, Down, Remove, Close), each with an `aria-label`: pass. Show and Hide staying words is a sound call.
- Frosted glass: a quiet button in a pinned glass `.acts` row and the cookie notice's What we keep use `--glass-safe` with `--glass-edge`. Pass.

## Judgement calls

1. **Landing footer columns stay plain navigation links, no underline.** Upheld. The owner's rules are "no underlined text" and "actions are real buttons". A site footer is a list of places to go, read as a list, not a set of actions; nothing in it is underlined. Painting every footer entry as a button would make the foot louder than the page's real actions and break "one main action per screen".
2. **Help's guide tiles count as whole cards.** Upheld. Each tile is painted, the name's link stretches over the whole tile (`.helpdesk .guide a::after`), and the tile presses like a button (`.helpdesk .guide:active`). The tile is the button.

## Findings

### Red 1: the cookies page's "What we keep" is still a bare link

- UNIT: `src/routes/cookies/+page.svelte:41`
- VERDICT: red
- REQUIREMENT: acceptance criterion 1, "Anything a person presses that stands on its own line is a painted button"; owner 2026-11-22 17:02 UTC, actions are real buttons.
- REASON: the signed-in, already-agreed state of `/cookies` ends with `<p class="note"><a href="/privacy">What we keep</a></p>`, a link alone on its own line with no class. The PR changed the same words in the cookie notice (`Notice.svelte`) but missed this page.
- EVIDENCE: `grep -rnE '<a href' src --include=*.svelte` lists it as the only class-less link that is not inside a sentence or a whole card. With this PR's CSS it is drawn as weight 600 blue words on the card, not a painted button. `tests/browser/real-buttons.test.ts` never visits `/cookies`, so the journey does not catch it.
- EXPECTED: a `.quiet` button (Glaucous Green, ink words on the card), like every other standalone way on.
- FIX: add `class="quiet"` to that link, and add a step to `tests/browser/real-buttons.test.ts` that opens `/cookies` as someone who has said yes and runs the same standalone-actions check. Files: `src/routes/cookies/+page.svelte`, `tests/browser/real-buttons.test.ts`.

## Notes (not blocking, not fixed here)

- The PR adds a global `.ways` rule (flex row with a gap). `/about` already has `nav.ways` with its own `.about .ways` rule, which is more specific, so the landing page's top tabs keep their look (about.test.ts passes). The shared name could surprise a later change; a follow-up could rename one of them.
- `/me/link` is not walked by the journey (the PR says so). Its links are `.quiet` in the code.
- The implementer's `purge-job.test.ts:39` tablet failure was not re-run here: the diff touches no money or job files, and it is not a check this change touches.
