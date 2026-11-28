78dfdb2 FAIL: 1 red

# Playtesting: plan audit, cycle 6

Examined: `docs/superpowers/specs/2026-11-28-playtesting-design.md` at **78dfdb2** (branch `claude/project-thread-dndr0a`), the whole spec and the diff from 4f2e0af (spec only, 8 lines in, 7 out), against `main` at 19045c3 and the audits of cycles 1 (8b0ecbd, `claude/project-thread-exm2yb`), 2 (facbb1e, `claude/project-thread-p7x891`), 3 (9268f41, `claude/project-thread-0srshe`), 4 (dcfabed, `claude/project-thread-g4sbfz`) and 5 (8846a95, `claude/project-thread-sf26zb`). Lane 3 plan audit, Opus 5.5, medium, read-only. Started 2026-11-28 08:09 UTC (from `date`).

Measured against: the owner's intent as relayed (playtests only by ask or invite; the Playtest badge on feed clips; Ask, You asked and Take back on the game page only; the maker's "Playtesters →" page with the switch, invite, accept, decline and remove; Your turn for players, still a list; non-members free until launch; playtest plays never count toward the pool), CLAUDE.md, `build`, `review`.

## Verdict: FAIL, 1 red

Cycle 5's red and both its notes are fixed, and the badge rule now reads the same in all four places. One gap no earlier cycle raised is left: the invite link can undo a maker's no, which the spec says the player can never do.

## Cycle 5 red and notes: each checked

1. **Red 1 (the badge for someone taken off): fixed.** The badge shows when the switch is on and the viewer is not the maker, not a playtester (`in`) and not taken off (`removed`): line 28 (feed clip), line 31 (game page), line 64 (later feed pages: "the switch is on and the viewer is not its maker and has no `in` or `removed` row") and criterion 3 ("no badge and no Ask on both the feed clip and the game's page"). The four agree. A `declined` row keeps the badge (line 34), which matches line 64's rule (declined is neither `in` nor `removed`), so the no is never shown. An `asked` row keeps the badge too, as before.
2. **N1 (the maker's own game): fixed.** Line 35 and criterion 2: no badge and no Ask on the maker's own clip or page; line 64 leaves the maker out of the badge set. Matches the Rules' "The maker never asks for … their own game".
3. **N2 (invite on an asked or declined row): fixed.** Line 57 sets `via = invite`, so Playing shows "Invited" (line 47) and Your turn "invited you" (line 38).

## Whole spec read once for consistency

- Switch off: no badge, no Ask; an asker and a declined player both still see "You asked…" (lines 34, 44, criterion 5), so a no stays hidden with the switch off too.
- Launch: line 26 lists everything that goes, Your turn rows and dot included; criterion 7 checks each; Playtesters sends to Live (line 50).
- Your turn rows: shown only for `in` with `noticeAt` set and `noticeGoneAt` null (line 57); a declined or removed player gets no row; a maker's remove sets `noticeGoneAt`; a re-invite brings it back at its old time. Consistent with lines 38 and criterion 9.
- 18+: the ask and the link are judged on the caller; the invite is made for everyone and hidden on the friend's side (lines 36, 58, criterion 8). One rule everywhere.
- Plan rows, lane, migration, deletion, cookie, consent and words are unchanged since cycle 5, which checked them against `main`; nothing in the diff touches them.
- Nothing the owner dropped is back; no new dependency, service or spend; `/about` untouched.

## Red

### 1. The invite link undoes a maker's no

UNIT: "The invite link, `/p/<token>`" (line 53) and Rules, "One row per person and game" (line 57). VERDICT: red. REQUIREMENT: the owner's decline (07:30, "accepting, declining"), and the spec's own "a no sticks" (line 34) and "so a no is never undone by the player" (line 57). REASON: line 53 says "Anyone signed in who opens it becomes a playtester", and excepts only the maker and "a removed person". The Rules' state list says what the link does to a `removed` row ("never by the link") but nothing about a `declined` (or `asked`) row. Read as written, a player the maker said no to who gets the link from anyone (it is a copyable link meant to be passed on, line 45) opens it and is `in`: their own action undoes the no, and they show under Playing. The implementer must guess, and the literal reading breaks the decline. EVIDENCE: spec lines 34, 45, 53, 57. EXPECTED: one stated answer for a link open on each existing row. Recommended: on a `declined` row the link does nothing new and lands on the game's page, as for a `removed` row (the maker said no; only the maker's own invite changes that, as line 57 already says for `invite`); on an `asked` row it turns the row `in` with `via = link` and `decidedAt` set (the maker handed out the link, so it is a yes), which line 47 already labels "Invited". FIX: in line 53, change "The maker's own link, or a removed person's, does nothing new" to "The maker's own link, or a removed or declined person's, does nothing new"; in line 57, add "Link open: creates `in` with `via = link`, or turns `asked` into `in` with `via = link`; on a `declined` or `removed` row it does nothing." Add to criterion 9: "Declined, then a link open, leaves the row `declined` and nothing under Playing." Only those three places change.

## Notes (not blocking)

- **N1, a re-invite of a removed player.** Line 57 says a `removed` row turns back to `in` by an invite, but not whether that sets `via = invite` and a new `decidedAt`. Line 47 says `decidedAt` is set by "the invite", so a new date reads right; say once that the re-invite sets `via = invite` too (it is an invite), so a player first let in by a yes reads "invited you" in Your turn and "Invited" on Playing after the maker brings them back. The row's time stays the old `noticeAt`, as already written.
- **N2, the link and Your turn.** Line 57 says a yes or invite sets `noticeAt`; a link open does not, so a link joiner gets no Your turn row (they are already on the game's page). That reads as intended; say it once so the builder does not add one.
- **N3, line 31 and the asker.** Line 31 gives the badge and "Ask to playtest" to everyone not the maker, a playtester or taken off, which literally includes someone who has already asked; line 32 then replaces the Ask with "You asked…". Reading the two together is clear enough; "and under Wishlist a → link 'Ask to playtest' (or, once asked, the lines below)" would remove the doubt.
