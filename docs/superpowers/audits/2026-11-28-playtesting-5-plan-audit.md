4f2e0af FAIL: 1 red

# Playtesting: plan audit, cycle 5

Examined: `docs/superpowers/specs/2026-11-28-playtesting-design.md` at **4f2e0af** (branch `claude/project-thread-dndr0a`), the whole spec and the diff from ebea510, against `main` at 19045c3 and the audits of cycles 1 (8b0ecbd, `claude/project-thread-exm2yb`), 2 (facbb1e, `claude/project-thread-p7x891`), 3 (9268f41, `claude/project-thread-0srshe`) and 4 (dcfabed, `claude/project-thread-g4sbfz`). Lane 3 plan audit, Opus 5.5, medium, read-only. Started 2026-11-28 08:07 UTC (from `date`).

Measured against: the owner's intent as relayed (playtests only by ask or invite; the Playtest badge on feed clips; Ask, You asked and Take back on the game page only; the maker's "Playtesters →" page with the switch, invite, accept, decline and remove; Your turn for players, still a list; non-members free until launch; playtest plays never count toward the pool), CLAUDE.md, `build`, `review`.

## Verdict: FAIL, 1 red

Cycle 4's red and both its notes are fixed, and the four leftovers the builder named hold. One contradiction no earlier cycle raised is left: the feed clip shows the badge to a player the maker took off, while the game page and criterion 3 say that player sees no badge.

## Cycle 4 red, notes and leftovers: each checked

1. **Red 1 (line 35, the 18+ bullet): fixed.** The bullet now says an ask or `/p/<token>` changes nothing for someone `adultsOnlyRefusal` refuses, that the maker's invite is still made, and that its row and dot are hidden on the friend's side, with page and Play at 403. That matches "Who may change what" (line 57) and criterion 8 word for word in meaning. `adultsOnlyRefusal` is no longer named for the invite (it judges the caller, `src/features/accounts/adults.ts:28`–`34`).
2. **N1 ("Since" or "Invited"): fixed** (line 46): "Since" after a yes to an ask, "Invited" for `via` `invite` or `link`, the date `decidedAt`, set by nothing the player does later.
3. **N2 (the sentence said twice): fixed**; line 57 says it once.
4. **Leftovers.** Criterion 8 now ends "Apart from that invite, which makes its row, nothing changes in each case", which no longer contradicts the invite making a row. Line 52 gates `/p/<token>` on "known to be 18" for an 18+ game, as the Rules do. Line 26 reads "The database rows stay". Line 18 quotes `PlaySession_basis_check` exactly as `main` has it (`prisma/migrations/20261114083000_play/migration.sql:95`–`96`: `CHECK ("userId" IS NOT NULL OR "basis" = 'free_game')`); it lists no values, so leaving it alone is right.

## Also checked and holds

- `sends.send` writes the row without reading the receiver's age (`src/features/sends/service.ts:122`), so the Rules' comparison stands. `FRIENDS_MAX = 8` (`src/features/sends/service.ts:16`). `rk_test_launch` exists (`src/features/launch/now.ts:9`); `rk_wish_pressed` is listed in `src/features/consent/cookies.ts:54`.
- `playBasis` today checks own game, staff, free game, member in that order (`src/features/play/may-play.ts:24`–`28`); putting `playtest` before member keeps a member's playtest play out of the pool. `play` sits below where `playtest` goes (`tests/architecture.test.ts:12`–`26`), so `may-play.ts` taking a flag on the viewer is the only way that works, as the spec says.
- The layer order "after `sends`, before `feed`" lets `playtest` read the friend list and lets `Feed.svelte` and `ShareSheet.svelte` (in `feed`) read `playtest`.
- The Live screen's "See it on Ruken" (`src/routes/make/parts/LiveScreen.svelte:130`) and "Show how many people played it" (`:145`) exist, so the link's place and the switch's model are real.
- The diff from ebea510 touches only the spec. Nothing the owner dropped is back; `/about` is untouched; no new dependency, service or spend.

## Red

### 1. The feed clip shows the badge to someone the maker took off
UNIT: spec, "A player, on a feed clip" (line 28), "Later feed pages" (line 63), criterion 3. VERDICT: red. REQUIREMENT: the spec agrees with itself (`review`), and the owner's badge is there "to let players on feed know when a game is playtestable" (07:25). REASON: line 28 shows the badge "when the maker's switch is on and this person is not a playtester", and line 63 feeds the clips only "which games take asks, which the viewer plays". A person the maker took off is not a playtester, so the clip shows them the badge. But line 34 says that person is "back to plain Wishlist, with no badge and no Ask for that game", and criterion 3 says "the player sees plain Wishlist with no badge and no Ask". So the badge on the clip leads to a page with no badge and no Ask: a dead end, and the two sections give the implementer two answers. Built from lines 28 and 63, the clip fails criterion 3 if the journey looks at the feed; built from line 34, the feed data in line 63 is not enough. EVIDENCE: spec lines 28, 34 and 63, criterion 3 (line 72). EXPECTED: a player the maker took off sees no badge for that game anywhere, on the first feed page and on later ones. FIX: line 28, after "this person is not a playtester", add "and was not taken off this game"; line 63, "(which games take asks, which the viewer plays, and which the viewer was taken off)"; criterion 3, "the player sees plain Wishlist with no badge and no Ask, on the clip and on the game's page". Only those three places change.

## Notes (recorded, not blocking)

- **N1, the maker's own game.** Line 28 and line 31 show the badge and "Ask to playtest" to anyone with the switch on who is not a playtester, and that includes the maker on their own clip and page. The Rules refuse the maker's own ask (404, criterion 8), so the link would be one that does nothing. Say once that the maker sees no badge and no Ask on their own game (the page already knows it is theirs: `src/routes/g/[game]/+page.svelte:49`).
- **N2, an invite on an `asked` row.** The Rules turn `asked`/`declined` into `in` on an invite but do not say whether `via` becomes `invite`. That picks "Since" or "Invited" on Playing (line 46) and "let you" or "invited you" in Your turn (line 37). Say which; setting `via = invite` matches what the maker did.

## Re-audit

The plan audit runs again on the spec commit that fixes red 1. Notes are the implementer's call and are named in the pull request.
