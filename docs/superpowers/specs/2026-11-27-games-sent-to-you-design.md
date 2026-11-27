# Games sent to you

The owner, 2026-11-27 02:07 UTC: "Let's add an Inbox (use a better name) too for games sent by people". This is the brief for sending a game to a person on Ruken, and for the place where a person sees the games sent to them. The coordinator's note: sending builds on the custom share sheet (#385, #394); the place to see them sits in the feed's top bar (#402); who can send to whom reads Follow (#400).

## Open product decisions

These two are the owner's. Each is asked as a card with a recommendation; the build follows the recommended option until the owner answers, and changes only words or one rule if the answer differs.

- **D1, the name.** Options: **"Sent to you"** (recommended: plain words that say what it is; the action in the share sheet is "Send to someone"), "Your turn" (playful, like handing over the controller), "Mailbox". "Inbox" is not used. Every name in this brief is written as "Sent to you"; a different answer changes the words only (`src/features/sends/words.ts`).
- **D2, who can send to whom.** Options: **people you follow and people who follow you** (recommended: nobody gets a game from a stranger; today that means a player can send to the makers they follow and a maker to the people who follow them, and players reach each other once slice 4 lets people follow any person's page), anyone on Ruken with a page (wider, but strangers can send you games), or wait for friends in slice 4. A different answer changes one function, `canSend` in `src/features/sends/who.ts`.

## Lane

Lane 3: it adds two tables, so it adds a migration (`prisma/migrations/`), and touches lane 2 paths (`prisma/schema/`). Lane 3 takes a plan audit on this brief and an implementation audit on the build. Merge permission: the owner's standing permission of 2026-11-21 19:16 UTC (every pull request, lane 3 included, merges once its audits pass and CI is green). No new dependency, tool, service or spend. The brief and the build share one pull request: the plan audit reads the brief, the implementation audit the build.

**Waits on.** Follow (#400, `MakerFollow` and `pagesServices().follows`) must be on `main` before unit 2 starts, because `canSend` reads it. The top bar (#402, `FeedTop.svelte`) must be on `main` before unit 5 starts, because the button sits in it. Units 1 and 3 can start before either.

**The migration only adds.** It creates `GameSend` and `SendStop`, their indexes, foreign keys and two `CHECK`s (nobody sends to or stops themselves); it alters and drops no other table. All keys are `onDelete: Restrict`, like `MakerFollow`: an account purge deletes the rows a person is in first, in `deletion.ts`. Old code runs on the new schema, so the way back from a bad deploy is `pnpm exec wrangler rollback` with the tables left in place. A unit test reads the migration's SQL and fails on anything but `CREATE TABLE`, `CREATE [UNIQUE] INDEX` and `ALTER TABLE … ADD CONSTRAINT` on the two new tables.

Expected duration: about 5 hours of building, plus the audits.

## What a person sees

- **Sending.** The share sheet (feed and game page) gains one row above the apps: "Send to someone", with up to 8 round faces of the people this person can send to (D2), most recently followed first, each 48px with the first name under it. Pressing a face sends the game: the face shows the spinner alone while it sends, then a green check and "Sent" under it; pressing it again does nothing. If it fails: "That didn't work. Try again." under the face (`role="alert"`), and the face can be pressed again. A person with nobody to send to sees no row (the sheet is as today). Signed out, the row is not there. Sending the same game to the same person twice is one row; the second press says "Sent" too.
- **Where they land.** A paper-plane icon button, "Sent to you" by its `aria-label`, sits on the left of the feed's top bar (opposite Search), coloured glass like the other top-bar buttons. When games have come in that the person has not looked at, a small green dot sits on it, and the label says "Sent to you, new games". It opens `/sent`.
- **The list, `/sent`.** One screen that fits the view with no page scroll (the list scrolls inside its box, with no scrollbar): a title "Sent to you", then one row per game, newest first: the game's still (64px), its name in bold, "From <sender's name>" and when ("Today", "Yesterday", or the date). The whole row opens the game's page. On the row's right, a Remove icon button ("Remove <game> from Sent to you"). Opening the list marks every game on it as seen, and the dot goes.
- **Empty.** "Nothing yet. When someone sends you a game, it shows up here." and a Back to the feed button.
- **Remove.** Remove takes the row off at once (spinner on the button while it sends); a fail puts it back with "That didn't work. Try again.".
- **Stop someone.** Each row has a second, smaller → link under the sender: "Stop games from <name>". It asks once, on a glass card: "Stop games from <name>? They won't be told." with Stop (red) and Keep (quiet). Stop removes their games from the list and nothing they send reaches this person again. The face of a person who stopped you still shows in your sheet and still says "Sent" (they are never told). Under the list, a → link "People you stopped" opens `/sent/stopped`: one row per person with an Undo button; Undo lets their games through again (only games sent after the undo show).
- **Ages.** A game shows on the list only when the person may see its page: an 18+ game shows only to a known adult, as on the game's page. A game that is taken off Ruken leaves every list.
- **Signed out.** `/sent` sends the person to sign in and back.

Every screen passes the drunk-grandma test: one main action per screen (the rows on `/sent`, the Stop button on its card), words people say out loud, and Back on every screen.

## Rules

- **The site believes nothing the form sends.** `POST /sent/send` with `game` (a slug) and `to` (a handle). Signed out: 401. A game that is not live, or a handle with no page: 404. Sending to yourself: 400. `canSend(from, to)` false: 403, and nothing is saved. Stopped by the receiver: 200 with `{ sent: true }`, and nothing is saved, so the sender is never told.
- **Who can send to whom** is one function, `canSend(fromUserId, toUserId)` (D2). With the recommended answer it is true when either follows the other (`MakerFollow`, either way round). The faces in the sheet come from the same rule, so a face never shows that the site would refuse.
- **One send per sender, receiver and game.** `@@unique([fromId, toId, gameId])`; sending again is `createMany` with `skipDuplicates`. Removing deletes the row, so the same person may send it again later and it shows as new.
- **A limit on sending.** Through the shared `RateLimiter`, the way reports do (`src/features/moderation/limits.ts`): the numbers sit in `src/features/sends/limits.ts` (30 an hour, 100 a day for each sender), so they can move to the private Worker with the other spam numbers later. Over the limit: 429, "You've sent a lot today. Try again later."
- **Only the receiver reads and changes their list.** `/sent`, Remove and Stop act only on rows whose `toId` is the caller. Remove or Stop on someone else's row answers 404 and changes nothing. The sender is never shown whether a game was seen, removed, or stopped.
- **What is kept.** Who sent which game to whom, when (`sentAt`, from the injected clock), and when the receiver first saw it (`seenAt`). Who stopped whom, and when. Deleting either account deletes every row it is in (`deletion.ts`). `/privacy` says so, with its "Last updated" date. No new cookie and no browser-kept value: sending and the list need a sign-in, which already sits behind the cookie yes.
- **Pages that keep up.** `/about` (`sections.ts`) gets one line for players: send a game to someone you follow. `/privacy` as above.

## Acceptance criteria

1. A signed-in player who follows a maker opens Share on a clip, presses that maker's face: it shows "Sent", and the database holds one `GameSend` row (create). (journey)
2. The maker signs in: the top bar's button shows the dot and its label says "new games"; `/sent` shows the game with "From <player's name>"; the row opens the game's page; coming back, the dot is gone and the row has `seenAt` (read, update). (journey)
3. Remove takes the row off, the database row is gone, and a reload shows the empty words (delete). (journey)
4. Stop: the card asks, Stop removes the sender's rows from the list; a new send from them saves nothing and the sender still sees "Sent"; `/sent/stopped` lists them; Undo lets a new send through (create, read, delete of a stop). (journey)
5. A person with nobody to send to sees no "Send to someone" row; a signed-out person sees no row; `/sent` signed out goes to sign-in and back. (journey)
6. `POST /sent/send` answers 401 signed out, 404 for a game that is not live or a handle with no page, 400 to yourself, 403 when `canSend` is false, 429 over the limit, and saves nothing in each. (route or database tests)
7. Remove or Stop on another person's row answers 404 and changes nothing; `/sent` never lists a row whose `toId` is someone else. (database and route tests)
8. Two sends at once of one game to one person make one row. (database test)
9. An 18+ game sent to a person whose age is unknown does not show on their list; it shows for a known adult. A taken-off game shows on no list. (database or service test)
10. Deleting an account deletes the sends and stops it is in, both ways. (database test)
11. `canSend` is true when either person follows the other and false otherwise; the sheet's faces are exactly the people `canSend` allows, at most 8, newest follow first. (database test)
12. Everything works with the keyboard alone, with visible focus: Tab reaches the faces in the sheet, the top-bar button, each row, its Remove and its Stop link; Enter sends, opens and removes; Escape closes the Stop card. (journey)
13. Every button is at least 48 by 48px to press; `/sent` and `/sent/stopped` fit a 375 by 667 phone, a tablet and a computer with no page scroll, and a sideways phone as the other screens do; nothing is underlined. (journeys, including `fits-the-screen` and `real-buttons`)
14. The new floating pieces read the glass tokens; `tests/lib/glass.test.ts` passes. Every wait shows only the spinner; `tests/loading-states.test.ts` passes. (unit)
15. The migration's SQL holds only `CREATE TABLE`, `CREATE [UNIQUE] INDEX` and `ADD CONSTRAINT` on `GameSend` and `SendStop`. (unit test)
16. Lint, typecheck, unit, database and browser suites pass in CI; the layer test passes.

## Plan

| # | Unit | Waits on | Files it owns | Check |
|---|---|---|---|---|
| 1 | Tables | none | `prisma/schema/sends.prisma` (`GameSend`, `SendStop`), `prisma/migrations/<stamp>_game_sends/`, `User` and `Game` back-relations in `accounts.prisma` and `games.prisma` | `prisma migrate diff` empty; criterion 15 (`tests/features/sends/migration.test.ts`) |
| 2 | Service | 1, #400 on `main` | `src/features/sends/` (`sends.ts` entry, `who.ts`, `limits.ts`, `words.ts`, `services.ts`), its place in `tests/architecture.test.ts`'s list (above pages and games), the line in `src/features/accounts/deletion.ts` | `tests/features/sends/sends.pg.test.ts`, `tests/features/accounts/purge.pg.test.ts`; criteria 6 to 11 |
| 3 | Addresses | 2 | `src/routes/sent/` (`+page.server.ts`, `+page.svelte`, `send/+server.ts`, `remove`, `stop` and `undo` actions, `stopped/`) | route tests; criteria 6, 7 |
| 4 | Share sheet row | 2 | `src/features/feed/ShareSheet.svelte`, a `SendRow.svelte` in `src/features/sends/`, the faces carried to the sheet from `src/routes/+page.server.ts` and `src/routes/g/[game]/+page.server.ts` | journey `tests/browser/sent-to-you.test.ts`; criteria 1, 5, 12 |
| 5 | Top-bar button and list | 3, #402 on `main` | `src/features/feed/FeedTop.svelte` (the button), `src/lib/icon.svelte` (a `send` icon), the `/sent` screens | the same journey; criteria 2 to 4, 12 to 14; `fits-the-screen` and `real-buttons` run over `/sent` |
| 6 | Words | 5 | `src/routes/privacy/+page.svelte`, `src/routes/about/sections.ts` | their existing tests |

Test files named in a unit's Check column belong to that unit. Units run in this order on one branch. Existing tests that change are named in the pull request body. The live-state file is deleted in the last commit before each hand-off to an audit.

Left for later, on purpose: a note with the game (there is no chat, apps spec "Not in this"); telling a person by text that a game came in (not asked for); sending to people you don't follow (D2); a count of how often a game was sent.
