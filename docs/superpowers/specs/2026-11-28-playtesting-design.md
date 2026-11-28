# Playtesting

The owner, 2026-11-28 07:10 UTC: "How much effort would it be to add beta testing? Where if a user is added to a group, they can play; instead of wishlist it's request beta access". Then, the same morning: "Or playtesting instead of beta"; "Mockup first"; "The ask to playtest and take back my ask is fine" (07:22); "Your turn works for the player, not the maker; the feed is for players" (07:24); "Add a badge somewhere to let players on feed know when a game is playtestable" (07:25); "All playtests are requested or invited to join" (07:29); "We need a dashboard for inviting, accepting, declining, and removing on the games maker page as a link" (07:30); "Along with the toggle" (07:31); "Do it after we add the playtesting" (07:47, build it now); "This is too busy, you ask to playtest on the page" (07:50, on the feed clip with Ask under Wishlist).

Before launch, a maker can let chosen players play their live game early. A player asks, or the maker invites them; the maker says yes or no, and can take someone off. The approved look is the round 3 mockups: https://claude.ai/artifact/VEtZWzMmpHQTpxm9VZJmNq (13 screens; the PNGs and the script that made them are in the project's files under `screens/playtest-mockups/`). A built screen that differs from them is a defect unless the pull request names the difference with a reason. One difference is decided already: the feed clip keeps only the badge; "Ask to playtest", "You asked…" and "Take back my ask" are on the game's page only (the owner, 07:50).

## Open product decisions

- **D1, do non-members pay to playtest? Following the recommendation until the owner answers:** no. A playtester plays free until launch, member or not. If the owner chooses a Join button instead, only `playBasis` and one line of words change.
- **D2, Your turn stays a list.** The owner said Your turn and Followed are "supposed to be your normal feed, but with filtering"; today Your turn is a list, by its approved spec. That change is its own piece of work, not this one. Here a playtest yes or invite is one more row on the Your turn list.

Decided, not open: every playtest starts from an ask or an invite (07:29); the maker's side is its own page behind a link on the maker's game page, with the switch (07:30, 07:31); "Ask to playtest" and "Take back my ask" as mocked (07:22); playtest plays never count toward the makers' pool (the coordinator's brief, from the money rules: only `member` plays count).

## Lane

Lane 3: a migration (`prisma/migrations/`) adding two tables, one column and one enum value, and a change to who may play (`src/features/play/may-play.ts`). It takes a plan audit on this brief and an implementation audit on the build. Merge permission: the owner's standing permission of 2026-11-21 19:16 UTC (lane 3 merges once its audits pass and CI is green). No new dependency, tool, service or spend.

**The migration only adds.** It creates `Playtester` and `PlaytestLink` with their indexes, keys and `CHECK`s, adds `Game.playtestAsking boolean NOT NULL DEFAULT false`, and adds `playtest` to the `PlayBasis` enum (`ALTER TYPE … ADD VALUE`); `PlaySession_basis_check` is widened by drop-and-add only if it lists the values (the implementer reads it first and says which in the pull request). Old code runs on the new schema, so the way back from a bad deploy is `pnpm exec wrangler rollback` with the tables left in place. A unit test reads the migration's SQL and fails on anything but those statements.

**Waits on.** Nothing open: Wishlist, launch (`src/features/launch/`), Your turn (`src/features/sends/`), Follow and the share sheet are on `main`. It touches files the visual audit thread will look at next, so it merges first.

Expected duration: about 7 hours of building, plus the two audits.

## What a person sees

Before launch only. On launch day (`launch.now()` at or after `LAUNCH_MS`) every piece below goes away: no badge, no Ask, no tag, no Playtesters link, and `/p/<link>` sends to the game's page. The rows stay; nothing is deleted.

**A player, on a feed clip (Fresh and Followed):** when the maker's switch is on and this person is not a playtester, a green glass "Playtest" badge sits above the game's name, inside the band. It is a picture, not a control; the clip's band is otherwise unchanged (Wishlist), so a player finds out more by opening the game's page. A playtester sees Play with the "Playtest" tag in place of Wishlist, and no badge.

**A player, on the game's page:**
- When the switch is on and this person is not a playtester: the same badge above the game's name over the clip, and under Wishlist a → link "Ask to playtest".
- Pressing it signed in sends the ask at once, in place (no new page), and the play tile reads "You asked to playtest. We'll tell you in Your turn." with a → link "Take back my ask", which deletes the ask and puts back "Ask to playtest". Signed out, it goes to sign up first (with the cookie notice first, as Wishlist does) and comes back with the ask sent.
- A playtester (the maker said yes, or invited them), here and on the feed clip: no badge and no Wishlist. The main button is Play with a small "Playtest" tag in it, and one line: "Free until it opens on 30 November." (D1). Play starts the game as any Play does.
- Someone the maker said no to: still sees "You asked to playtest…" and "Take back my ask", until launch. They are never told no. Someone the maker took off: back to plain Wishlist, with no badge and no Ask for that game. Neither is told.
- An 18+ game shows its badge and Ask only to someone who may see its page, as Play does today.

**A player, in Your turn (the list, D2):** when the maker says yes or invites them, one row: the game's still, its name, "Kai let you playtest" or "Kai invited you to playtest" (Kai being the maker's page name), and when. It opens the game's page. The row's Remove icon takes the row off the list, not the playtest. A new row lights the tab's dot, like a sent game.

**A maker, on their game's Live screen:** a → link "Playtesters" above "See it on Ruken", while the game is live and before launch.

**The Playtesters page, `/make/<game>/playtesters`** (the maker's own game only; anyone else gets 404). Plain page colours over the game's backdrop, like Live:
- The title "Playtesters", then "Floor Fifty. Playtesters play free until it opens on 30 November."
- The switch, one full-width button like "Show how many people played it": "Let players ask to playtest" with an On/Off chip, and a note: on, "Players see a Playtest badge on <name> and can ask."; off, "Off: only people you invite can playtest." Off hides the badge and every Ask link; asks already waiting stay here to answer, and invites keep working.
- A blue button "Invite playtesters". It opens the share sheet as "Invite playtesters": the game's name, the invite link, "Copy invite link", and the maker's friends' faces (the same friends as Your turn's picker). Pressing a face invites that friend at once and ticks it ("Invited Mia."); pressing again does nothing more. With no friends: "No friends here yet. Copy the link and send it any way you like."
- "Asking", newest first: a face, "Sam wants to playtest", when, a green "Let Sam play" and a ✕ ("Say no to Sam").
- "Playing": a face, the name, "Since Nov 26" or "Invited Nov 26", and a ✕ ("Stop Sam playtesting"). It asks once, on a card like Stop in Your turn: "Stop Sam playtesting? They won't be told." with Stop (red) and Keep.
- Nothing yet: the switch, Invite, and "Nobody is playtesting yet. Invite a friend, or turn on asking so players can ask."
- "Back to <name>" at the foot.
- Every list fits the view; the page scrolls inside its box with no scrollbar, and nothing scrolls under the bar.

**The invite link, `/p/<token>`.** Anyone signed in who opens it becomes a playtester of that game and lands on the game's page, showing Play with the tag. Signed out, it goes to sign in or sign up and comes back. The maker's own link, or a removed person's, does nothing new and lands on the game's page. One link per game, made the first time the sheet opens; the sheet has a → "Make a new link" under Copy, after which the old link lands on the game's page and does nothing. A link someone was removed after using does not let them back in.

## Rules

- **One row per person and game,** `Playtester { id, gameId, userId, state, via, askedAt?, decidedAt?, invitedById?, noticeSeenAt?, noticeGoneAt? }`, `@@unique([gameId, userId])`. `state` is `asked | in | declined | removed`; `via` is `ask | invite | link`. Ask: creates `asked` (or does nothing if a row exists). Take back: deletes an `asked` or `declined` row of the caller's own. Yes: `asked → in`. No: `asked → declined`. Invite: creates `in`, or turns `asked`/`declined` into `in`; a `removed` row turns back to `in` only by a maker's invite (the maker changed their mind), never by the link. Remove: `in → removed`. Every change is one guarded `updateMany` on the expected state, so two presses or two tabs never do it twice. Times come from the injected clock.
- **Who may change what.** Only the game's maker answers, invites, removes, flips the switch and makes a link; only the asker takes back their own ask. The maker never asks for or plays-as-playtester their own game. A person the maker blocked from sending (a `SendStop` either way) can still ask; nothing here reads it. Anything else answers 404 and changes nothing. Pages carry no internal ids a person can change to reach someone else's row.
- **Friends** are Your turn's friends (`canSend` and the friend list in `src/features/sends/`); an invite to someone who is not a friend is refused (404).
- **Who may play.** `playBasis` gains `playtest`, checked after own game, staff and free game, and before member: so a member's playtest play is a `playtest` play and never counts toward the pool. It holds only for a row in state `in`, on a live game, before launch. The play route reads it with the membership check (`isPlaytester` on the viewer), so `play` does not import the new feature. `money` and the feed's play counts read `member` (and `free_game`) only, so they need no change; a database test proves a `playtest` session is left out of the pool's roll-up.
- **The link** is 128 random bits, base64url, shown once in the sheet and kept only as a SHA-256 hash in `PlaytestLink { gameId @id, tokenHash @unique, madeAt }`. A new link replaces the row.
- **What is kept, and deletion.** Who asked to playtest which game, the answer and when, who invited whom; the link's hash. Deleting an account deletes every `Playtester` row it is in (as player or inviter) and, with the maker's games, their `PlaytestLink` rows, in `deletion.ts`, before the purge's other steps that need them gone. `/privacy` says so, with its "Last updated" date. No new cookie and no browser-kept value. `/about` (`src/routes/about/sections.ts`) gets one line for makers: playtest a game before launch with players you choose.
- **Cookie consent.** `/p/<token>`, the ask and take-back routes and every `/make/…/playtesters` action keep something, so they are `GATED` in `src/features/consent/routes.ts`; the game page and feed stay as they are.
- **Gamepad and keyboard.** Every new control is a real button or link and reachable by the gamepad layer and Tab, with visible focus only from keyboard or gamepad (`:focus-visible`).
- **No overlap.** The badge, the band's extra line and the Playtesters page pass the standing overlap journey at 320×568, 375×667 and 667×375, and every control is at least 48px.
- **Words.** All new words in one file, `src/features/playtest/words.ts`, so the screens and the journeys read the same ones. No "beta", no "tester" jargon beyond "playtest" and "playtester".

## Acceptance criteria

1. A maker turns asking on; a signed-in player sees the badge (and no Ask) on the clip in Fresh, opens the game's page, sees the badge and "Ask to playtest", asks, sees "You asked…", takes it back, asks again (create, read, delete of an ask). (journey)
2. The maker opens Playtesters from Live, sees the ask, presses "Let Sam play"; the player sees, in Your turn, "<maker> let you playtest", and on the clip and the game's page Play with the Playtest tag and no badge; pressing Play starts the game and the session's basis is `playtest`. (journey + database)
3. The maker presses ✕ on an ask: it leaves Asking; the player still sees "You asked…". The maker removes a playtester after the card: the player sees plain Wishlist with no badge and no Ask, and `/g/<game>/play` sends a non-member to the price card again (update, delete of a playtester). (journey)
4. Invite: the maker presses a friend's face in the sheet; the friend sees "<maker> invited you to playtest" in Your turn and can play. The maker copies the link; a third, signed-out person opens it, signs in, and lands on the game's page as a playtester; after "Make a new link" the old link does nothing. (journey)
5. The switch off: no badge and no Ask anywhere for that game, a waiting ask still shows on Playtesters, an invite still works. Switch on brings them back. (journey)
6. The empty Playtesters page shows the switch, Invite and the nothing-yet words. (journey)
7. With the test cookie `rk_test_launch` unset (after launch): no badge, no Ask, no tag, no Playtesters link; a playtester who is not a member is sent to the price card; `/p/<token>` lands on the game's page and changes nothing. (journey)
8. Someone who is not the maker gets 404 from every Playtesters address and action; a player cannot take back another's ask; an invite to a non-friend is refused; nobody can ask for their own game. Nothing changes in each case. (route + database tests)
9. Two presses of yes, no, remove or invite, sent at once, leave one row in the right state. (database test)
10. A `playtest` play is not in the pool's roll-up nor the feed's play counts. A member who is a playtester gets a `playtest` session before launch and a `member` one after. (database + unit test on `playBasis`)
11. Deleting a player's account removes their rows; deleting a maker's removes their games' rows and links; the purge test passes. (database test)
12. The migration only adds (criterion test reads its SQL); `prisma migrate diff` is empty.
13. Every new control works with keyboard and gamepad; the overlap, glass, real-buttons, fits-the-screen and loading checks pass on every new screen and on the feed and game page with the badge and the extra line, at 320×568, 375×667 and 667×375.
14. `/privacy` and `/about` say what this keeps and does; their tests pass.
15. Lint, typecheck, unit, database and browser suites pass in CI; the layer test passes with `playtest` placed after `sends` and before `feed`.

## Plan

| # | Unit | Waits on | Files it owns | Check |
|---|---|---|---|---|
| 1 | Tables | none | `prisma/schema/playtest.prisma` (`Playtester`, `PlaytestLink`, their enums), `Game.playtestAsking` in `games.prisma`, `playtest` in `PlayBasis` (`play.prisma`), back-relations in `accounts.prisma` and `games.prisma`, `prisma/migrations/<stamp>_playtesting/` | `prisma migrate diff` empty; criterion 12 (`tests/features/playtest/migration.test.ts`) |
| 2 | Service | 1 | `src/features/playtest/` (`playtest.ts` entry, `service.ts`, `services.ts`, `link.ts`, `words.ts`, `playtest.browser.ts`), its place in `tests/architecture.test.ts`, the lines in `src/features/accounts/deletion.ts` | `tests/features/playtest/playtest.pg.test.ts`, `tests/features/accounts/purge.pg.test.ts`; criteria 8, 9, 11 |
| 3 | Who may play | 1 | `src/features/play/may-play.ts`, `src/features/play/sessions.ts` (the viewer type), `src/routes/g/[game]/play/+page.server.ts` | `tests/features/play/may-play.test.ts`, a pool roll-up database test; criterion 10 |
| 4 | Player's ask | 2 | the badge and the playtester's Play in `src/features/feed/Feed.svelte` (the band); the badge, Ask, asked and playtester states in `src/routes/g/[game]/+page.svelte`; their loads (`src/routes/+page.server.ts`, `src/routes/followed/+page.server.ts`, `src/routes/g/[game]/+page.server.ts`, adding one statement to the game page's `Promise.all`), `src/routes/g/[game]/playtest/` (ask and take-back), the look in `src/lib/look.css` | journey `tests/browser/playtest.test.ts`; criteria 1, 3 (player side), 5, 7 |
| 5 | Maker's page | 2 | `src/routes/make/[game]/playtesters/` (page and actions), the link in `src/routes/make/parts/LiveScreen.svelte` and its load, the invite sheet (the share sheet in its invite form, `src/features/feed/ShareSheet.svelte`, fed by the maker's friends), `src/routes/p/[token]/` | the same journey; criteria 2 to 6 |
| 6 | Your turn rows | 2 | `src/routes/your-turn/+page.server.ts` (merges playtest notices into the list and the dot), the row's words in `src/features/sends/YourTurn.svelte` | the same journey; criteria 2, 4 |
| 7 | Consent and words | 4, 5 | `src/features/consent/routes.ts` with `tests/features/consent/routes.test.ts`, `src/routes/privacy/+page.svelte`, `src/routes/about/sections.ts` | their tests; criterion 14 |

Units 3 and 2 share nothing but unit 1, and run in that order on one branch; 4, 5 and 6 follow 2. Test files named in a unit's Check column belong to that unit. Existing tests that change are named in the pull request body. The live-state file is deleted in the last commit before each hand-off to an audit.

## Lessons carried

From `progress.md` Lessons whose trigger this matches: L5 (journeys that open an address straight after another page wait for `pageHasSettled`) and L8 (before the hand-off to the implementation audit, `git diff --name-only origin/main...HEAD` lists only files in the plan's rows). From the owner's rulings in `progress.md`: the overlap journey runs on every changed page at 320×568, 375×667 and 667×375, before and after launch, and any overlap blocks (2026-11-27 23:12 UTC); build only what the owner asked for (2026-11-28 04:09 UTC).

Left for later, on purpose: telling a maker by text or email that someone asked; a limit on how often someone can ask; feedback from playtesters to the maker (no chat); playtesting after launch (an update before it ships).
