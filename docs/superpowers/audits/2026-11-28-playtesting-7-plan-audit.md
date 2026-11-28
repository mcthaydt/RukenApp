d4f1195 FAIL: 1 red

# Playtesting: plan audit, cycle 7

Examined: `docs/superpowers/specs/2026-11-28-playtesting-design.md` at **d4f1195** (branch `claude/project-thread-dndr0a`), the whole spec and the diff from 78dfdb2 (spec only, 42 lines in, 4 out: "The state table" and the link rule), against `main` at 19045c3 and the cycle 6 audit (9547280, `claude/project-thread-o8i5sv`). Lane 3 plan audit, Opus 5.5, medium, read-only. Started 2026-11-28 08:12 UTC, written 08:14 UTC (from `date`).

Measured against: the owner's intent as relayed (playtests only by ask or invite; the Playtest badge on feed clips; Ask, You asked and Take back on the game page only; the maker's "Playtesters →" page with the switch, invite, accept, decline and remove; Your turn for players, still a list; non-members free until launch; playtest plays never count toward the pool), privacy (a no, a removal or an under-18 status is never shown to the maker or the player), CLAUDE.md, `build`, `review`. The table is read as the source of truth, as the spec says.

## Verdict: FAIL, 1 red

Cycle 6's red and its three notes are fixed. The table is complete and matches the prose in every cell but one: an invite on a `removed` row keeps `noticeAt` as it is, so a player who came in by the link, was taken off and is invited back is never told in Your turn. The prose sets it; the table, which wins, does not.

## Cycle 6 red and notes: each checked

1. **Red 1 (the link undoes a no): fixed.** Line 53 now excepts "a removed or declined person's" link open; line 57 says the link "on a `declined`, `in` or `removed` row … does nothing"; the table's Link open row is "nothing" for declined, taken back, in and removed, and `asked → in, via = link` for asked.
2. **N1 (re-invite sets `via` and `decidedAt`): fixed** in line 57 and the table's Invite/removed cell.
3. **N2 (the link makes no Your turn row): fixed** in line 57 and the Link open/none cell ("no `noticeAt`").
4. **N3 (cycle 6's "line 31 and the asker"): fixed** in line 31 ("or, once asked, the lines below").

## The table, cell by cell

Every row was read across all seven columns and against the Rules (lines 57 to 67).

- **What P sees, on and off.** All 14 cells match lines 28 to 36 and 44. Asked and declined look the same with the switch on (badge, "You asked…") and off ("You asked…", no badge), so a no is never shown. Taken back looks like none in both. Removed sees Wishlist only either way. The maker sees nothing. Owner intent (badge on the clip only, Ask on the page only) holds.
- **Ask.** none → asked; taken back → declined with `takenBackAt` cleared and not in Asking (a no sticks, the answer the player sees is the same "You asked…" as a fresh ask); every other state nothing; maker 404. Matches line 57.
- **Take back.** asked → deleted; declined → taken back; the rest nothing; maker 404. Matches line 57.
- **Yes, No.** Only `asked` moves; matches line 57. `via` stays `ask`, so Playing reads "Since".
- **Invite.** none, asked, declined, taken back → in with `via = invite` and `decidedAt`; in → nothing; maker 404; non-friend 404. Matches lines 57 and 59, except the removed cell (red 1).
- **Link open.** Matches line 53 and 57 in every column; the switch does not gate it; an old token does nothing (line 61).
- **Remove, the player's Remove, Seen.** Match lines 38 and 57: only `in` moves; the player's Remove and Seen act only on a row that shows.
- **Switch, Launch.** Match lines 26, 44 and 50. Launch changes no field and every action answers as nothing.
- **Deletion.** Matches line 62; games are never deleted, only taken off or thrown away (`src/features/games/service.ts:1226`, `src/features/accounts/deletion.ts:152`), so no "game deleted" row is needed.
- **18+.** Ask and link open by someone not known to be 18 change nothing; the invite is made as for anyone; hiding is on the reader's side. Matches lines 36 and 58, and `src/features/sends/service.ts:115-126` is the pattern cited. Nothing the maker sees depends on the friend's age.
- **Your turn line (103).** Matches line 57.

**Privacy.** No cell lets the maker see a person's age or lets a player see a no or a removal in words. The two indirect signs that remain (a removed player loses the badge while friends see it; a declined player who opens a passed-on link does not get Play) follow from owner-approved choices and the cycle 6 fix, and are notes, not reds.

**Tests.** The table-driven test in `tests/features/playtest/playtest.pg.test.ts` runs every state × action, so every cell has a check; the J cells are walked in the journey; deletion is also in the purge test; 18+ and 404 answers are in criterion 8's route tests. Criteria 1 to 11 each name the cells they walk.

**Unchanged since cycle 6** (checked by the diff): lane, migration, plan rows, consent, cookie, words, layering, merge order.

## Red

### 1. A removed link-joiner who is invited back is never told

UNIT: "The state table", row **Invite (maker, P a friend)**, column **removed** (line 92). VERDICT: red. REQUIREMENT: line 38 ("when the maker says yes or invites them, one row" in Your turn), line 57 ("A yes or invite sets `noticeAt` … only when the row has never had one"), and the owner's "Your turn works for the player". REASON: the cell says "`noticeAt` and `noticeSeenAt` kept". A person who came in by the link has `noticeAt` null (Link open/none: "no `noticeAt`"). After Remove then Invite, the table leaves `noticeAt` null, so the Your turn row never shows (line 103 needs `noticeAt` set) and the dot never lights: the maker invited them and they are never told. The prose sets `noticeAt` in this case; the table, which wins (line 71), does not. Every other Invite cell says "`noticeAt` if null"; this is the only one that does not. EVIDENCE: spec lines 38, 57, 71, 92 (removed cell), 93 (none cell), 103. EXPECTED: the re-invite sets `noticeAt` when it is null and otherwise keeps it and `noticeSeenAt`, so a link-joiner gets a new row with the dot on, and a person told before keeps the old time with the dot off once seen. FIX: in line 92's removed cell, change "`noticeAt` and `noticeSeenAt` kept" to "`noticeAt` set if null, else `noticeAt` and `noticeSeenAt` kept"; add to criterion 9: "Link open, remove, then invite leaves the row shown in Your turn with the dot on." Only those two places change.

## Notes (not blocking)

- **N1, actions with the switch off.** The table's states assume the switch is on (line 73), and only Ask ("refused with the switch off") and Link open ("works with the switch off") say what the switch does to them. The prose (line 44) says waiting asks can still be answered, the asker can still take back, and invites still work with the switch off, and criterion 5 walks only the invite. Say under the table "The switch changes only Ask and what P sees; every other row is the same with it off", and have the state-table test run every action row with the switch off as well, so a builder who guards Yes, No or Take back on the switch fails a test.
- **N2, the "What P sees" rows in the database test.** Line 71 says the test checks "what the service returns". Name the service call that returns the view (badge, Ask, asked, Play with tag) so the two "What P sees" rows are checked there too; today only the J cells of those rows have a named check, and taken back (on), declined, taken back, removed and maker (off) have none outside that sentence.
- **N3, a stale Remove.** The player's Remove answers 404 on a row that no longer shows. A player whose row the maker just removed, pressing Remove in an open tab, gets "Not found" for a row they meant to remove anyway. Answering as done (the row is gone either way) tells them nothing new.
- **N4, `invitedById`.** No Invite cell says it sets `invitedById`, and only the maker invites, so it always equals the game's maker and the Maker's-account-deleted row's second half is already covered by "every row … of G". Either say the invite sets it (and the test checks it) or drop the field.
- **N5, undoing a no or a removal for a non-friend.** Only a maker's invite undoes a no or a removal, and invites go to friends only, so a maker cannot let back in someone they said no to or took off who is not a friend. The owner asked for accept, decline and remove, not undo, so this is recorded only; it belongs with the later items in line 145 if the owner wants it.
- **N6, the indirect signs.** A removed player sees no badge where friends see one, and a declined or removed player who opens a passed-on link lands without Play. Both follow from decided rules and tell nothing in words; recorded so the implementation audit does not raise them again.
- **N7, ticks when the sheet opens.** Line 45 says pressing a face ticks it, but not whether friends already playing are ticked when the sheet opens. Say they are, so the maker does not invite twice.
