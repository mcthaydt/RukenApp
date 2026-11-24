# Report a game

The owner, 2026-11-23 23:51 UTC: "we have no way of reporting a game". This is the brief for the first piece of moderation (design 7.1, `moderation`): a player tells Ruken that a game breaks the rules, and the owner can read what was sent. Taking a game down, a queue in the admin portal and telling the maker are slice 5, not here. The custom share sheet (same message) is its own later piece.

## Lane

Lane 3: it adds a table, so it adds a migration (`prisma/migrations/`). It also touches lane 2 paths (`prisma/schema/`, `src/lib/icon.svelte`, `src/lib/look.css` if a token is needed). Lane 3 takes a plan audit on this spec and an implementation audit on the build. Merge permission: the owner's standing permission of 2026-11-21 19:16 UTC (every pull request, lane 3 included, merges once its audits pass and CI is green). No new dependency, tool, service or spend. Expected duration: about 4 hours of building, plus the audits.

## What a person sees

- **Where.** A Report button on every clip in the feed (a round glass flag under Share, labelled "Report") and on every game's page (an outline "Report" button beside Share). Both open the same sheet. Both are there only once the page's script runs, since the sheet needs it.
- **The sheet.** A frosted-glass panel over a dimmed screen, built from the glass tokens (no browser `alert`, `confirm` or `prompt`, and no new kind of surface). It fits the window: on a short phone its list scrolls inside the sheet, never the page behind. Escape and the close icon shut it, and focus goes back to the button that opened it.
  - Heading "Report this game", then "What's wrong?" and one big choice per reason:
    - Sexual content
    - Gambling
    - Ads
    - Hate or bullying
    - Copied from someone else
    - It doesn't work
    - Something else
  - A box "Tell us more (you don't have to)", 500 characters at most.
  - One main button: "Send report". Pressing it with no reason picked says "Pick what's wrong." and sends nothing. While it sends, the button is busy with a spinner and takes no second press.
  - Sent: "Thanks. We'll take a look." and a "Done" button.
- **Seeing it again (read), changing it (update), taking it back (delete).** Opening the sheet on a game the person already reported shows "You reported this game." with their reason picked and their words in the box. The main button reads "Save changes"; under it an outline button "Take back my report" removes it ("Your report is gone." and "Done").
- **Signed out.** The sheet says "Sign in to report a game." with a "Sign in" button that comes back to the same game's page.
- **Your own game.** The sheet says "This is your game, so you can't report it." with "Done".
- **Too many.** Past the limit the sheet says "You've sent a lot of reports. Try again later." and keeps what the person picked.
- **Failure.** Anything else that goes wrong says "That didn't work. Try again." and keeps what the person picked. Opening the sheet shows a spinner until the person's report (or none) is known.

## Rules

- **One report per person per game.** A second send changes the first (one row, `@@unique([userId, gameId])`). Two sends at once still make one row.
- **Only live games the person may see.** The same gate as the game's page: a game that is not live is a missing page, an 18+ game refuses anyone not known to be 18 or over.
- **Limits.** Each send (new or changed) counts against the person's limits on the shared `RateLimit` table (keys `api:report:…`). Taking a report back does not count. The numbers live in one small file, `src/features/moderation/limits.ts`, handed to the service as `limits`, so a later change can bring them from the private Worker without touching the rest (owner, 2026-11-22 20:25 UTC: "the exact rate-limit and spam numbers" go private, "the mechanism can stay public"). Today's numbers: 10 an hour and 30 a day per person.
- **What is kept.** The game, the person, the reason, their words, when it was made and last changed. Deleting the account deletes the person's reports (`deletion.ts`), as their wishlist is. Taking it back deletes the row.
- **The owner reads them through the review command.** `POST /jobs/review` with `{"do":"reports"}` (the jobs secret, as the other review orders) answers every reported game, most reported first: its address, name, state, how many reports, and each report's reason in words, its words and its time. It names no reporter. This is the existing review path (design 5.5) until the admin portal (slice 5) takes reports over.
- **Pages that keep up.** `/privacy` says what a report keeps and when it goes (with its "Last updated" date). `/about` (`sections.ts`) gets one line for players: they can report a game that breaks the rules.

## Acceptance criteria

1. A signed-in player presses Report on a clip in the feed, picks "Gambling", writes a note and sends: the sheet says "Thanks. We'll take a look.", and `{"do":"reports"}` lists the game with one report, "Gambling", and the note. (journey)
2. Opening the sheet again on that game shows "You reported this game." with "Gambling" picked and the note in the box (read). (journey)
3. Picking "Ads" and pressing "Save changes" changes the same report: the review command still shows one report, now "Ads" (update). (journey)
4. "Take back my report" removes it: the sheet says "Your report is gone.", and the review command no longer lists the game (delete). (journey)
5. The same sheet works from the game's page. (journey)
6. Signed out, the sheet asks the person to sign in, and its button leads to sign-in and back to the game. (journey)
7. A maker opening the sheet on their own game is told they can't report it, and the site refuses a send for it. (journey and database test)
8. "Send report" with nothing picked says "Pick what's wrong." and sends nothing. (journey)
9. The sheet works with the keyboard alone: Tab reaches every choice, the box and the buttons with a visible focus ring; Escape closes it and focus returns to Report. (journey)
10. The sheet fits a 375 by 667 phone, a tablet and a computer: the page behind never scrolls, and the sheet's own content scrolls when it is taller than the window. (journey)
11. The sheet's panel and dim read the glass tokens; `tests/lib/glass.test.ts` passes with it. (unit)
12. Two sends at once for one person and game make one row; a send past the limit is refused with 429 and saves nothing; taking a report back is not counted. (database tests)
13. A report on a game that is not live answers 404; on an 18+ game for a person not known to be 18, 403. (database or journey)
14. Deleting an account deletes its reports. (database test)
15. Lint, typecheck, unit, database and browser suites pass in CI; the layer test passes with `moderation` importing only features below it.

## Plan

| # | Unit | Files it owns | Check |
|---|---|---|---|
| 1 | Table | `prisma/schema/moderation.prisma`, `prisma/migrations/<stamp>_game_reports/`, `User`/`Game` back-relations | `prisma migrate diff` empty after deploy; schema test |
| 2 | Service | `src/features/moderation/` (`reasons.ts`, `limits.ts`, `reports.ts`, `services.ts`, `moderation.ts`) | `tests/features/moderation/*.pg.test.ts`, criteria 7, 12, 14 |
| 3 | Address | `src/routes/g/[game]/report/+server.ts` (GET, PUT, DELETE, JSON), `deletion.ts` line | database and journey tests |
| 4 | Review order | `readReviewOrder` gains `reports`; `src/routes/jobs/review/+server.ts` | journey through `reviewJob` |
| 5 | Sheet | `src/features/moderation/ReportSheet.svelte`, `moderation.browser.ts`, a `flag` in `src/lib/icon.svelte` | journeys, criteria 1 to 11 |
| 6 | Buttons | `Feed.svelte` gets an `onreport` callback (the route owns the sheet, so `feed` never imports `moderation`, which sits above it), `src/routes/+page.svelte`, `src/routes/g/[game]/+page.svelte` | journeys |
| 7 | Words | `/privacy`, `/about` `sections.ts` | their existing tests |

Units run in this order on one branch; each waits on the one before it.
