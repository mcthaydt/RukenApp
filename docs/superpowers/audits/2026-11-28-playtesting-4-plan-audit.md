ebea510 FAIL: 1 red

# Playtesting: plan audit, cycle 4

Examined: `docs/superpowers/specs/2026-11-28-playtesting-design.md` at **ebea510** (branch `claude/project-thread-dndr0a`), the diff from dd9709f, against `main` at 6192c84 and the audits of cycles 1 (8b0ecbd, `claude/project-thread-exm2yb`), 2 (facbb1e, `claude/project-thread-p7x891`) and 3 (9268f41, `claude/project-thread-0srshe`). Lane 3 plan audit, Opus 5.5, medium, read-only.

Measured against: the owner's intent as relayed (playtests only by ask or invite; the Playtest badge on feed clips; Ask, You asked and Take back on the game page only; the maker's "Playtesters →" page with the switch, invite, accept, decline and remove; Your turn for players, still a list; non-members free until launch; playtest plays never count toward the pool), CLAUDE.md, `build`, `review`.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict: FAIL, 1 red

Cycle 3's red is fixed in the Rules and in criterion 8, and its three notes are written in. But the fix left the older sentence in "What a person sees" standing, and that sentence still says an invite to someone the 18+ gate refuses "changes nothing". The spec now says both, and the old reading is the one that leaks the friend's age.

## Cycle 3 red and notes: each checked

1. **The 18+ invite no longer tells the maker the friend's age: fixed in the Rules and criterion 8.** The Rules now make the invite for every friend, whatever their age, and put all hiding on the friend's side. Each claim holds on `main` at 6192c84:
   - `sends.send` writes the row without reading the receiver's age (`src/features/sends/service.ts:122`) and hides 18+ games at read time with `visibleGames` (`:69`).
   - The game's page refuses through `adultsOnlyRefusal` with 403 before anything else (`src/routes/g/[game]/+page.server.ts:35`–`36`), and so does play, before `startPlay` and so before `playBasis` is reached (`src/routes/g/[game]/play/+page.server.ts:20`–`21`). An `in` row can never open an 18+ game for someone not known to be 18.
   - The feed never shows an 18+ game at all (`src/features/feed/service.ts:261`, `:388`; search at `src/features/feed/search.ts:97`), so such a friend never sees the playtester's Play on a clip either.
   - Criterion 8 now checks the maker's Playing shows the friend as for any invite, the friend's Your turn is empty, the dot stays off, and page and play answer 403.
   - The invitee `isAdultOn` read and the "no row" branch are gone from the Rules, and no plan unit names them.
2. **N1 (a hidden row comes back on re-invite):** written in the Rules and named for the pull request.
3. **N2 (the dot's query):** spelled out in the Rules: `state = in`, `noticeAt` set, `noticeGoneAt` null, live, before launch, 18+ only for a known adult; the dot when shown and `noticeSeenAt` null.
4. **N3 (Your turn rows at launch):** the launch line and criterion 7 now list the playtest rows and their dot as going at launch, and the show rule says "before launch".

## Also checked and holds

- Nothing the owner refused is back; `/about` stays untouched; no new dependency, service or spend. The diff from dd9709f touches only the spec.
- A friend not known to be 18 who later becomes known to be 18 then sees the row at its old time, with the dot if unseen. That is how sends behave too, and it reveals nothing to the maker.

## Red

### 1. "What a person sees" still says an 18+ invite changes nothing
UNIT: spec, "What a person sees", the 18+ bullet (line 35). VERDICT: red. REQUIREMENT: the spec agrees with itself (completeness and consistency, `review`), and cycle 3 red 1's EXPECTED, "after inviting a friend not known to be 18 to an 18+ game, the maker's Playtesters page looks the same as for any other invite". REASON: the bullet says "The same gate (`adultsOnlyRefusal`) holds for every way in: an ask, an invite from the sheet, opening `/p/<token>`, and the Your turn row. For someone it refuses, the ask, invite or link changes nothing". The Rules now say the opposite for the invite: "An invite is made for every friend, whatever their age". An implementer who builds from the screens section makes no row, which brings back exactly the leak cycle 3 found (the friend missing under Playing). It also names `adultsOnlyRefusal` for the invite, which judges the caller, here the maker (`src/features/accounts/adults.ts:28`), as cycle 2 red 3 found. EVIDENCE: spec line 35 against spec line 57 ("Who may change what") and criterion 8. EXPECTED: one rule, the Rules' one, stated the same everywhere. FIX: in that bullet, drop "an invite from the sheet" from the gate's list and drop "invite" from "the ask, invite or link changes nothing", and add: "An invite is made for every friend whatever their age, and hidden on the friend's side (see Who may change what)." Only that bullet changes.

## Notes (recorded, not blocking)

- **N1, "Since" or "Invited".** The Playing line shows "Since Nov 26" or "Invited Nov 26" but the spec does not say which row gets which. Say it once (for example: "Invited" when `via` is `invite` or `link`, "Since" when the maker said yes, the date being `decidedAt`). Keep it off anything the friend does, such as a first play, or a friend the 18+ gate refuses would stay "Invited" while others move on.
- **N2, one sentence said twice.** "Who may change what" now says the Your turn row and dot leave out an 18+ game for someone not known to be 18 twice in a row. Drop one when the bullet above is fixed.

## Re-audit

The plan audit runs again on the spec commit that fixes red 1. Notes are the implementer's call and are named in the pull request.
