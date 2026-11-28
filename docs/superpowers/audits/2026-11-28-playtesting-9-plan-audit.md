9fc6fb2 PASS

# Playtesting: plan audit, cycle 9

Examined: `docs/superpowers/specs/2026-11-28-playtesting-design.md` at **9fc6fb2** (branch `claude/project-thread-dndr0a`), the whole spec and the diff from 175e3e9 (spec only), against `main` at 19045c3 and the cycle 8 audit (3adafa8, `claude/project-thread-86vyq8`). Lane 3 plan audit, Opus 5.5, medium, read-only. Started 2026-11-28 08:20 UTC, written 08:21 UTC (from `date`).

Measured against: the owner's intent as relayed (playtests only by ask or invite; the Playtest badge on feed clips; Ask, You asked and Take back on the game page only; the maker's "Playtesters →" page with the switch, invite, accept, decline and remove; Your turn for players, still a list; non-members free until launch; playtest plays never count toward the pool; never reveal a no or an age), CLAUDE.md, `build`, `review`. The table is read as the source of truth, as the spec says.

## Verdict: PASS, no red

Cycle 8's red and its notes N1 to N4 are fixed. Every cell of the table holds with the switch on and off, and `lookOf` gives exactly the table's "What P sees" cells. Four notes below for the build; none blocks.

## Cycle 8 red and notes: each checked

1. **Red 1 (two sources for "What P sees"): fixed.** Line 107: one pure rule `lookOf(row, { asking, isMaker })` in `src/features/playtest/look.ts` returns `{ badge, action }`, so badge and offer are separate; `viewOf` and `feedStateFor` both use it (line 64, 107), and the state-table test checks every "What P sees" cell on both, switch on and off.
2. **N1: fixed** in line 57 ("keeps `noticeAt` if set (else sets it)") and line 38 ("or, for someone who came by the link, as a new row").
3. **N2: fixed** in line 53 ("as a yes, without a Your turn row").
4. **N3: fixed** in line 95 ("404 (no own row)").
5. **N4: fixed** by the new paragraph "A game that is not live" (line 103).

## `lookOf` against the table, cell by cell

`badge` = switch on, not the maker, state in {none, asked, declined, taken back}. `action` = "ask" for none and taken back with the switch on; "asked" for asked and declined; "play" for in; "none" otherwise.

| P | on: badge / action | table, on | off: badge / action | table, off |
|---|---|---|---|---|
| none | yes / ask | badge, Ask | no / none | Wishlist only |
| asked | yes / asked | badge, You asked, Take back | no / asked | You asked, Take back, no badge |
| declined | yes / asked | same as asked | no / asked | same as asked |
| taken back | yes / ask | badge, Ask | no / none | Wishlist only |
| in | no / play | Play with tag, no badge | no / play | Play with tag |
| removed | no / none | Wishlist, no badge, no Ask | no / none | Wishlist only |
| maker | no / none | no badge, no Ask | no / none | no badge, no Ask |

All 14 match. A declined player looks the same as an asker in both modes, on the page and on the feed, so a no is never shown. The prose agrees: line 28 (feed), line 31 (page), line 34 (declined keeps the badge; removed back to Wishlist), line 35 (maker), line 44 (switch off).

The action rows are unchanged from cycle 8 and still hold, switch on and off (Ask refused off; every other row the same), as cycle 8 recorded cell by cell. A signed-out viewer has no row and is not the maker, so `lookOf` gives badge and Ask, which line 32's signed-out Ask expects.

**18+ on the feed.** The feed already leaves out every `age_18` game (`src/features/feed/service.ts:261`, `:388`), so `feedStateFor` never puts a badge on an 18+ clip, and the game page refuses with 403 first (`src/routes/g/[game]/+page.server.ts:35`). Line 36 holds.

**Privacy.** No cell shows a no, a removal or an age in words. **Owner intent.** Badge only on the clip, Ask only on the page, the maker's page behind a link with the switch and all four answers, Your turn a list, free until launch, no pool count: all hold.

## Notes (not blocking, for the build)

- **N1, `look.ts` in unit 2's file list.** UNIT: plan unit 2 (line 136). Line 107 names `src/features/playtest/look.ts`, but unit 2's parenthetical lists `playtest.ts`, `service.ts`, `services.ts`, `link.ts`, `words.ts`, `playtest.browser.ts` and not `look.ts`. The unit owns the folder, so the L8 diff check passes, but add `look.ts` to the list so the plan and the diff read the same.
- **N2, launch is outside `lookOf`.** UNIT: line 107 with line 26. `lookOf` takes only the row, the switch and the maker, and the table assumes before launch, so "the two cannot differ" holds only before launch. Launch is applied by `viewOf` and `feedStateFor` separately; criterion 7's journey checks no badge and no tag after launch, so a wrong one fails there. Simplest: have both callers return nothing playtest when `launch.now()` is at or after `LAUNCH_MS` through one shared guard in `service.ts`, and add one launched case to the state-table test on both calls.
- **N3, the not-live paragraph has no check.** UNIT: line 103 and criterion 9. The new paragraph is not a table row, so "every cell" in the state-table test does not cover it. Add one case: take G off, run each action and see nothing change, put G back and see the rows show and work again.
- **N4, "no field changes" on a game that is not live.** Line 103 reads as if account deletion also changes nothing then. It does not mean that (the deletion rows apply whatever the game's state). Say "no action here changes a field".
