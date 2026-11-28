175e3e9 FAIL: 1 red

# Playtesting: plan audit, cycle 8

Examined: `docs/superpowers/specs/2026-11-28-playtesting-design.md` at **175e3e9** (branch `claude/project-thread-dndr0a`), the whole spec and the diff from d4f1195 (spec only), against `main` at 19045c3 and the cycle 7 audit (35a2c6c, `claude/project-thread-8wfrl0`). Lane 3 plan audit, Opus 5.5, medium, read-only. Started 2026-11-28 08:16 UTC, written 08:18 UTC (from `date`).

Measured against: the owner's intent as relayed (playtests only by ask or invite; the Playtest badge on feed clips; Ask, You asked and Take back on the game page only; the maker's "Playtesters →" page with the switch, invite, accept, decline and remove; Your turn for players, still a list; non-members free until launch; playtest plays never count toward the pool; never reveal a no or an age), CLAUDE.md, `build`, `review`. The table is read as the source of truth, as the spec says.

## Verdict: FAIL, 1 red

Cycle 7's red and its notes N1, N2, N3, N4 and N7 are fixed; N5 and N6 are recorded under "Known and accepted" and "Left for later". Every action cell is right with the switch on and with it off. The one red is in the new "What P sees" check: the return type of `viewOf` cannot tell two cells apart, and the feed clip's badge comes from a second source the table test never reads, so the cell that hides a no on the feed has no check.

## Cycle 7 red and notes: each checked

1. **Red 1 (re-invite of a removed link-joiner): fixed.** The Invite/removed cell (line 92) now reads "`noticeAt` set if null, else kept; `noticeSeenAt` kept", and criterion 9 adds "Link open, remove, then invite shows the row with the dot on".
2. **N1 (switch off): fixed** by "The switch" paragraph (line 103): only Ask and the two "What P sees" rows change, and the state-table test runs every action row both ways.
3. **N2 (name the view call): taken,** as `viewOf` (line 105), but see red 1.
4. **N3 (stale Remove): fixed.** The player's Remove answers done on a row that no longer shows (line 95).
5. **N4 (`invitedById`): fixed** by dropping the field from the row (line 57), the kept-data rule (line 62) and the maker-deleted row (line 100).
6. **N5, N6: recorded** in lines 149 and 151.
7. **N7 (ticks on open): fixed** in line 45.

## The table, cell by cell, switch on and off

- **What P sees, on.** none: badge, Ask. asked and declined: badge, "You asked…", Take back, so a no looks like a waiting ask. taken back: badge, Ask, as none. in: Play with tag. removed: Wishlist only. maker: nothing. Matches lines 28 to 35 and 64.
- **What P sees, off.** none, taken back, removed: Wishlist only. asked, declined: "You asked…", Take back, no badge. in: Play with tag. maker: nothing. Matches line 44. The switch is the same for everyone, so its look tells nobody anything.
- **Ask.** On: none → asked; taken back → declined with `takenBackAt` cleared, not in Asking; the rest nothing; maker 404. Off: refused, so none and taken back stay as they are, which is what the off view offers (no Ask link). 18+ and launch: nothing. Matches line 57.
- **Take back.** Both ways: asked → deleted; declined → taken back; the rest nothing; maker 404. Off, the result is Wishlist only in both cases, and Ask stays refused, so a declined person cannot tell a no from the switch. Matches lines 44 and 57.
- **Yes, No.** Both ways: only `asked` moves; `via` stays `ask` ("Since"); an asked row never has `noticeAt` (only Ask from none makes one), so "`noticeAt` if null" always sets it.
- **Invite.** Both ways: none, asked, declined, taken back → in with `via = invite` and `decidedAt`; taken back also clears `takenBackAt`; in → nothing; removed → in, `noticeGoneAt` cleared, `noticeAt` set if null; maker and non-friend 404. A removed row can never carry `takenBackAt` (every way into `in` from declined goes through an invite that clears it), so the removed cell needs no `takenBackAt` clause.
- **Link open.** Both ways: none and asked → in, `via = link`, no `noticeAt`; the rest nothing; maker nothing; old token, 18+ not known to be 18, and launch: nothing. Matches lines 53 and 57.
- **Remove, the player's Remove, Seen.** Both ways: only `in` moves; the player's Remove and Seen act only on a row that shows. Matches lines 38 and 57.
- **Switch, Launch, deletion, 18+.** Match lines 26, 44, 50, 58 and 62. Launch changes no field and every action answers as nothing. Nothing the maker sees depends on a friend's age.
- **Your turn line (107), Asking and Playing.** Match line 57 and lines 46 and 47.

**Privacy.** No cell shows a no, a removal or an age in words, to the maker or the player, with the switch either way. The two indirect signs are accepted in line 149.

**Owner intent.** Badge only on the feed clip, Ask only on the game page, the maker's page behind a link with the switch and all four answers, Your turn a list, free until launch, no pool count: all hold.

## Red

### 1. "What P sees" has two sources and the named check covers neither fully

UNIT: "The state table", the paragraph "What P sees" (line 105), with "Later feed pages" (line 64) and plan unit 4. VERDICT: red. REQUIREMENT: line 71 ("checks each cell's result"), line 105 ("The two 'What P sees' rows are checked on it in the same test, every cell, both ways"), and the owner's "never reveal a no". REASON, two parts:
- `viewOf` returns `none | badge | asked | playtester`. The table has five looks, not four: asked and declined show the badge with the switch on and not with it off, so both map to `asked` either way. A test on `viewOf` cannot fail if the badge is wrong for an asker, so the cells asked/on, declined/on, asked/off and declined/off are not checked by the test the spec names for them.
- The feed clip does not use `viewOf`. Line 65 has the feed's loads pass, once for all games, "which games show this viewer the badge" and "which the viewer plays", as Wishlist passes `wished` (`src/features/feed/Feed.svelte:52` on main). That list is a second implementation of the same rule, and no test checks it against the table. Its declined/on cell is the one that hides a no on the feed: a list built as "switch on and no row" or "no declined row" takes the badge off a declined player's clips while friends still see it, and only the none, in and removed clip cases are walked (criteria 1, 2, 3).

EVIDENCE: spec lines 64, 71, 86, 87, 105; criteria 1 to 3 and 5 (no journey walks the asked or declined clip with the switch on). EXPECTED: one rule, checked in every cell, for both the game page and the feed clip. FIX: make the view carry the badge on its own, for example `viewOf` returning `{ badge: boolean, offer: "ask" | "asked" | "play" | "none" }`, and have the feed's load build its per-game lists from the same service (a batch `viewsOf(games, viewer)` over the same code, not a second query with its own conditions). State in line 105 that the state-table test checks both `viewOf` and `viewsOf` for every "What P sees" cell, with the switch on and off. Only line 105, line 64 and unit 4's files change (the batch call lives in `src/features/playtest/service.ts`, already in unit 2).

## Notes (not blocking)

- **N1, line 57 and line 38 on a re-invite.** Line 58 says an invite on a `removed` row "keeps `noticeAt` and `noticeSeenAt`", and line 38 says the row "comes back at its old time". Read with the sentence before ("sets `noticeAt` … only when the row has never had one") and the table, which wins, this is right, but a builder reading line 57 alone keeps a null `noticeAt`. Say "keeps `noticeAt` if set (else sets it) and keeps `noticeSeenAt`" in line 57, and "or, for someone who came by the link, as a new row" in line 38.
- **N2, line 53 "as a yes".** A link open on an asked row is "as a yes", but a yes sets `noticeAt` and the link does not (table, Link open/asked). Say "as a yes, without a Your turn row".
- **N3, the player's Remove in the none column.** The row header says any id but P's own is 404, and the none column says "nothing, answers done", yet in none there is no own row. A shown row is always `in`, and only account deletion takes an `in` row to none. Write "404 (no own row)" or "n/a" there.
- **N4, a game that is not live.** The table assumes G is live. Lines 57 and 60 hide the Your turn row and stop playtest play when it is not, but nothing says what `/make/<game>/playtesters`, its actions, Ask and `/p/<token>` do on a game taken off and put back, nor that the rows survive that. One line under the table would settle it (likely: the Playtesters page sends to the game's maker screen, the actions and the link do nothing, the rows stay and work again when it is live).
