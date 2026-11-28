dd9709f FAIL: 1 red

# Playtesting: plan audit, cycle 3

Examined: `docs/superpowers/specs/2026-11-28-playtesting-design.md` at **dd9709f** (branch `claude/project-thread-dndr0a`), the diff from 104249a, against `main` at 6192c84, the cycle 1 audit (8b0ecbd, `claude/project-thread-exm2yb`) and the cycle 2 audit (facbb1e, `claude/project-thread-p7x891`). Lane 3 plan audit, Opus 5.5, medium, read-only.

Measured against: the owner's intent as relayed (playtests only by ask or invite; the Playtest badge on feed clips; Ask, You asked and Take back on the game page only; the maker's "Playtesters →" page with the switch, invite, accept, decline and remove; Your turn for players, still a list; non-members free until launch; playtest plays never count toward the pool), CLAUDE.md, `build`, `review`.

## Verdict: FAIL, 1 red

Cycle 2's reds 1 and 2 are fixed, and so are notes N1 to N5. Red 3 is half fixed: the way to read the friend's age is now right, but the maker-side answer the spec picked still tells the maker the friend is under 18, which is the thing cycle 2's EXPECTED said it must not do, and the spec now claims the opposite in writing.

## Cycle 2 reds: each fix checked

1. **Re-invite brings the row back: fixed.** Rules now say the player's own Remove sets `noticeGoneAt` and nothing else; the maker's remove sets it too; an invite on a `removed` row clears `noticeGoneAt` and keeps `noticeAt` and `noticeSeenAt`. The Your turn paragraph says the row "comes back at its old time, and the dot stays off if they had already seen it". Criterion 9 adds "Yes, seen, remove, then invite leaves the row shown in Your turn's list at its old time and the dot off." Consistent with `sends`, whose seen mark is per row (`gameSend.seenAt`, `src/features/sends/service.ts:159`, `:165`). See N1 for one edge.
2. **Playtest row has Remove and no Stop: fixed.** The Your turn paragraph states it, with the maker's words where "From Kai" sits (`YourTurn.svelte` builds that line from `SEND_WORDS.from`, and the Stop button sits under it). Criterion 2 adds "The playtest row shows no Stop button." Unit 6 does not touch `your-turn/stop/+server.ts`, which is now right.
3. **18+ invite: the age read is fixed; the maker-side answer is not.** `isAdultOn` is exported from `src/features/accounts/accounts.ts:23` (from `age.ts:103`) and `User.adultOn` exists (`prisma/schema/accounts.prisma:44`), so reading the friend's age needs no new export, as the spec says. The second half is red 1 below.

## Also checked and holds

- Cycle 2 N1 (jumping the Asking queue) is written into the Rules as left for the deferred ask limit and named in the pull request. N2 (`seen` takes no row): unit 6 now says one post marks both, no new field. N3 (`SEND_WORDS`): the Words line now says a send's line is still built in `YourTurn.svelte`. N4 (switch off with an ask waiting): the asker keeps "You asked…" and "Take back my ask", in the switch line and criterion 5. N5 (mockups 04 and 05): named as a second decided difference, with D2.
- Nothing the owner refused is back; `/about` stays untouched; no new dependency, service or spend.
- The play route already refuses an 18+ game for anyone not known to be 18 before any play starts (`src/routes/g/[game]/play/+page.server.ts:20`, `adultsOnlyRefusal` then `error(403)`), so a playtest row can never open an 18+ game for them whatever the service does.

## Red

### 1. The 18+ invite still tells the maker the friend is not known to be 18
UNIT: Rules, "Who may change what"; criterion 8; plan units 2 and 5. VERDICT: red. REQUIREMENT: cycle 2 red 3's EXPECTED, "one stated maker-side answer that does not reveal the friend's age", and the spec's own new sentence, "so the friend's age is never shown to the maker". REASON: for an 18+ game and a friend not known to be 18 the spec makes no row and ticks the face, then says "the friend simply never shows under Playing". But the same page shows every other invitee under Playing at once ("Invited Nov 26", the Playing line), so the maker who invites Mia and Jo sees Jo appear and Mia not, on the next load. That is the friend's age shown to the maker, one step removed. The `sends` comparison does not carry over: a send's sender never sees the receiver's list, while the maker does see Playing. Criterion 8 checks the tick, the missing row and the friend's empty Your turn, so it would pass with the leak in place. EVIDENCE: the Rules sentence "For an 18+ game and a friend not known to be 18, no row is made and the sheet still ticks the face … so the friend's age is never shown to the maker; the friend simply never shows under Playing", against "Playing: a face, the name, "Since Nov 26" or "Invited Nov 26"". EXPECTED: after inviting a friend not known to be 18 to an 18+ game, the maker's Playtesters page looks the same as for any other invite. FIX: make the invite the same for everyone, as `sends.send` does (it checks no age when sending, writes the row at `src/features/sends/service.ts:122`, and hides 18+ games at read time with `visibleGames` at `:69`): the invite creates the `in` row as usual, so the friend shows under Playing as "Invited <date>"; the friend's side already hides it by the reader's own `isAdult` (the Your turn rows and dot, by the existing Rules sentence on rows "made before"), the game's page is already refused for them (`src/routes/g/[game]/+page.server.ts:35`), and play is refused by the route's existing gate. Drop the invitee `isAdultOn` read and the "no row" branch; drop "nothing is kept" for this one case and say why in the spec (it keeps the maker's view the same). In criterion 8, replace "makes no row, and the friend's Your turn shows nothing" with "the maker's Playing shows them as for any invite, the friend's Your turn shows nothing and the dot stays off, and the friend's play is refused (403)". Only the Rules sentence and criterion 8 change. (If the owner would rather the maker be told plainly, that is a product choice for a card, not this audit's call.)

## Notes (recorded, not blocking)

- **N1, a row the player hid comes back on re-invite.** The player removes the row, later the maker removes them and invites them again: the invite clears `noticeGoneAt`, so the row the player hid is back. The dot stays off if they saw it. That reads as right (the maker did something new), but say it in the pull request so the journey and the implementer agree.
- **N2, which rows light the dot.** "A new row lights the tab's dot on every page that shows it" leaves the dot's query to the reader. Write it out once in unit 2 or 6: `state = in`, `noticeAt` set, `noticeGoneAt` null, `noticeSeenAt` null, the game live, and (for 18+) the reader known to be 18. Without `noticeGoneAt` null, a row the player hid unseen would light the dot with nothing to show.
- **N3, Your turn rows after launch.** "On launch day every piece below goes away" lists the badge, Ask, tag, link and `/p/`, not the Your turn rows. After launch a "Kai let you playtest" row opens a page where a non-member gets the price card. Either list the rows as going away at launch, or name it in the pull request as kept on purpose.

## Re-audit

The plan audit runs again on the spec commit that fixes red 1. Notes are the implementer's call and are named in the pull request.
