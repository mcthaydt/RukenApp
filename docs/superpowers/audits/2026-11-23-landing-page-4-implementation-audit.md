# Landing page (#333): implementation audit, cycle 4

- Pull request: #333, branch `claude/project-thread-2vpwcj`
- Commit examined: 589379184dcd835aa549e5080a585146b6af856d (5893791). `main` at c0d05cc8 is contained in it.
- Lane: 2 (`src/lib/`, `package.json`, `pnpm-lock.yaml`). One fresh review after the build.
- Reviewer: a fresh session, Opus 5.5, medium. Finished 2026-11-23 15:01 UTC (from `date`).

**Verdict: PASS.** No red finding in the code. One fix to the pull request body is needed before merge (below); it does not change the commit.

## What ran

| Check | Where | Result |
| --- | --- | --- |
| `pnpm lint` | 5893791 | exit 0, Prettier clean, 0 errors |
| `pnpm typecheck` | 5893791 | exit 0, 2,221 files, 0 errors, 0 warnings |
| `pnpm test` | 5893791 | 149 files, 2,158 passed |
| Journeys `about`, `bar`, `sideways-phone`, `cookie-consent`, `join`, `join-and-help-look`, `help-guide`, tablet and computer | 5893791, Postgres 16 in the container | 155 passed, 15 skipped (the sideways cases on the computer profile skip by design), 0 failed, 2.4 min |
| Phone profile (WebKit) | not run | The container has no WebKit (`/opt/pw-browsers` holds Chromium only). CI runs it. |
| Walk of `/about` in Chromium (`verify` setup, fresh database) | 5893791 | 320x640, 375x667, 810x1080, 1280x720, and sideways 667x375 and 844x390 (touch) |

The walk, at every size: no sideways scroll (`scrollWidth` equals `clientWidth`), no bottom bar, no link under 44 by 44, no page or console error, the "For players" way in moves to its card, the End key reaches the foot, and the corner "Back to the feed" button is on screen, pressable (not `inert`) at the foot. The blue "Watch the feed" is in the first screen at all four upright sizes.

## Read against the brief and the rules

- `/about` is in the layout's `NO_BAR` and the bar journey checks it; `/about` is an open route for consent, so it answers before a cookie yes.
- The foot's third column is "The small print", so no two navigations share the bar's name "Ruken".
- The "What is Ruken?" links on `/join`, `/sign-in`, `/me` and `/help` use `plain-link`.
- `playOnScreen` keeps `quiet-video.ts`'s rules (still where nothing may move) and pauses clips off screen; its unit test covers the three steps.
- `startMotion` returns early for less motion, and its clean-up reverts GSAP, removes the ticker and destroys Lenis.
- The corner button is `inert` and hidden until the first screen has gone by, so the keyboard never lands on a hidden button.
- Words checked against the code: the maker share for a brought fan's first 12 months, the $25 minimum and the 15th are in `src/features/money/rules.ts`; "13 and up" matches `/terms`; every in-site link in `sections.ts` names a route that exists.
- CRUD: the page makes nothing a person can save, so it has no create, read, update or delete journey to require.
- No `<style>` block; the page's styles are in `src/lib/look.css` under `.about`, and `tests/lib/look.test.ts` checks the class names and that each `@keyframes` name is used once.

## Pull request body (fix before merge, no new commit)

UNIT: the body of #333. VERDICT: red for the body, not the code. REQUIREMENT: the project's PR attribution, whose two lines start every pull request body. REASON: the first line is there; the second is missing. EVIDENCE: `gh api repos/mcthaydt/RukenApp/pulls/333 --jq .body | head -2` gives `<!-- claude-projects-attribution: {"github_login":"mcthaydt"} -->` then `## Why`. EXPECTED: line 2 is `_Requested by **McThayDT** · [project thread](https://claude.ai/code/project/chan_01XVJVT78CDCo32eqKbcTJ4h)_`. FIX: add that line as line 2 of the body; keep the last line `Requested by **McThayDT**` (it is there now). Touches the body only.

## Notes (not blocking, recorded for later)

1. UNIT: `src/routes/about/motion.ts`. VERDICT: note. REASON: a card still waiting to rise is drawn 24 px low, so the "For players" and "For makers" ways in land on it there; when it rises, its top 24 px slip above the window. EVIDENCE: after the click, `#players` top is -24 at 320, 375, 1280 and both sideways sizes, 0 at 810 (where the card was on screen at load). The "For players" line stays readable. EXPECTED: the card's top at 0. FIX: leave targets of the ways in (`#players`, `#makers`) out of the rise, or skip the rise for a block the page jumps to; `motion.ts` only.
2. UNIT: `/about` held sideways. VERDICT: note. REASON: on a phone held sideways (667x375 and 844x390) the blue "Watch the feed" is below the first screen; the headline and the first line fill it. Upright, it is in the first screen at every size. No criterion asks for it sideways. FIX, if wanted: a tighter first screen in `look.css` for `(orientation: landscape) and (max-height: 500px)`.
3. UNIT: `.about a.tofeed` in `look.css`. VERDICT: note. REASON: its computed `text-decoration-line` is `underline`. It holds only an SVG, so nothing is drawn; a future text label would show underlined. FIX: `text-decoration: none` on `.tofeed`.
4. Outside this change: the cookie card's "What we keep" is underlined, and held sideways the card covers most of the window. Both come from `main`, not this pull request; reported, not to be fixed here.

## Screens

Taken at deviceScaleFactor 1 for this check only, in the reviewer's scratchpad; not kept.
