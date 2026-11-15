# Plan audit: the maker screens rebuild (slice 2, branch M)

Date: 2026-11-15. Plan: `docs/superpowers/plans/2026-11-15-maker-screens-rebuild.md` at `5e34b85` (pull request #114). Spec: `docs/superpowers/specs/2026-11-14-maker-screens-redesign-design.md` (pull request #96, merged). Also read: the slice 2 plan (Branch G, Tasks 24, 30, 31, and "Where execution stops"), `progress.md`, the board's source (`/mnt/project-files/maker-screens/maker-screens-round-7.html`, read as a file), and the code of `slice-2/submit` (`0387975`) with `main` (`b16dbec`) merged into it in a local trial merge, which had no conflict. The trial merge was not pushed. No test, lint or typecheck ran: CI runs them.

Every finding below is fixed in the plan on the same branch, unless it says otherwise.

## The four checks

### 1. Only slice 2: from "Add a game" to waiting, sent back or live

Holds. Each task builds a step of that path: the button colours the redesign changes on Ruken's own screens (spec 1), the door on Your account, the questions, the agreement, Check and send, Waiting, Sent back, Live, Throw a draft away, and "What players will see". The plan's "Not built here" table sends Your page, money, extras, beta, achievements, Connect your game, rooms and the staff screens to their own slices, and the "Notes for the plans that follow" leave each one a hook. Tasks 30 and 31 (branch S) are in the slice 2 plan already, so amending them is not new scope. Nothing new is added: no package, no colour, no route outside `/make`, `/me` and `/help/github`.

### 2. The age rating is asked now

Holds. Question 7, "Who is {name} for?", has the five choices 3+, 7+, 12+, 16+, 18+, with the lines as the approved board (version 26) and spec 16.4 write them, nothing picked. An 18+ game gets question 8, "Does {name} have any of these?" (Sex or nudity, Gore, Drugs, None of these). The counter reads "of 7", or "of 8" for an 18+ game. A game that goes from 18+ to 12+ loses its marks (Review Focus 5). The database keeps marks off a game that is not 18+. Staff can change the rating at Accept (Task 30, amended, with five choices; the spec's "four" in 11.1 is from before the five ratings). Fixed: Live did not show the rating chip, which spec 12 asks for on Check and send, Sent back and Live (Task 8).

The 18+ hint: the plan's line is the board's ("Only adults see it. Pornography and gambling are never allowed."), not section 12's line that changes with the picks. The board is right: section 12's amendment moves the Settings switch to after launch, so "Players see it only if they turn it on" would not be true at launch. The plan now says why in "Which words win".

### 3. G is only the GitHub App hookup on the test site

The intent holds, but G2 alone does not work, and the plan now says what does. Read in `src/features/games/services.ts`: the games services will not start without `GAME_ADDRESS_PATTERN`, and every maker screen calls them. With G3 gone, the test site's maker area would answer "Something went wrong". Fixed: G also sets that one setting to `https://{name}.games.invalid` (a name that never answers; `checkAddressPattern` takes it). Said plainly, once: on the test site a maker can connect GitHub, answer every question, upload both videos and send. The videos do not play there, and nothing can be played, until the games domain comes at launch. In CI everything plays. Also added: the GitHub App is made with the test site's address, so at launch its home page and callback are changed on GitHub (a website step).

### 4. Ordered and testable for a Sonnet build

Four defects would have stopped the build. All are fixed.

- **Task 2's green could not pass typecheck.** It made `oneLine`, `playsOn` and `repoFullName` nullable, added `thrown_away`, dropped `GameReview.reason` and changed `listWords`. All four break `service.ts` and the old routes, which Task 2 did not touch. Fixed: Task 2 now only adds (the new enums, the rating, the marks, `toFix`, `Game_marks_check`, `questions.ts`, `send-back.ts`). The changes that break callers move to Task 3, in a second migration, beside the service that calls them.
- **Fixtures the new rule refuses.** `Game_answered_check` refuses a game past draft with no rating. `pull.pg.test.ts`, `service.pg.test.ts`, `review.pg.test.ts` and `schema.pg.test.ts` put games live or waiting directly, and none was in the plan's files. `connection.pg.test.ts` calls `createGame` five times, and Task 3 removes it. Fixed: Task 3 names each file and what it gains. That is data for the rule, not a looser test.
- **Expected results that were wrong.** Task 3's red said `browser` fails on `createGame`, but a red push only adds stubs. Its green hedged on the old journeys. Fixed: the red expects `browser` to pass. The green expects exactly the old `make.test.ts` journeys that send a game to fail ("Answer every question first.", because the old form has no age question). They are reported and carried by Task 4, and any other failure is a stop. The old exports (`gameFieldProblems`, `beforeSendWords`, `stateWords`, `MissingBeforeSend`) now stay until their last screen goes, and Task 11 removes them.
- **Journeys that would run out of addresses.** A name makes the same address at most nine times (`MAX_SLUG_NUMBER`), and nine browser projects share one database. Task 4's first journey saved "Floor Fifty" on every project. Fixed: a Global Constraint says every journey that saves a game uses `freshName()`, and that journey now does.

Smaller fixes:

- `fillAnswers` could not reach the age question, because the line and where it plays stayed empty. It now fills them by default.
- Tasks 4 to 6 lead to `check` before Task 7 builds it. The plan now says no journey goes there until Task 7's red.
- Sent back: "6 accepted" was fixed text. It is now counted, "{n} accepted", which matches the plan's own "7 accepted" test and "All 8".
- The sideways phone's box was 52 (the board's stylesheet). Spec 4.5 says 56, and the plan's rule 2 makes the spec win, so it is now 56.
- Two motions of spec 4.6 were missing: the track piece that grows, and the 250ms tone change. Both are added.
- Spec 15.1 says "Sent back" in Your games is blue text. Added, with its look case.
- "No shape rounder than 12px" contradicted the approved board's 20px sheets and the 20px token, and no task changed either. It now reads: no pills; chips 8px; buttons and boxes 12px; sheets keep 20px.
- The step's stagger is set in `look.css` with `:nth-child`, never with a `style:` directive on a screen.

## The how-to page, against GitHub's help

The plan asked the audit to check its GitHub steps. Against GitHub's "Adding a file to a repository" (docs.github.com, read through a search, not opened in a browser): "Add file", then "Upload files", then "Commit changes" match step 4's "Commit changes". A browser upload takes at most 100 files at a time and 25 MiB a file. Step 3 gains "GitHub takes up to 100 files at a time. If you have more, upload them in a few goes." A file over 25 MiB cannot be uploaded in a browser at all, and the page does not try to teach the command line. Not checked: GitHub's labels on a phone.

## Calls left as the plan made them

- The three reasons about what is in a game ("It goes past what we allow.", pornography, gambling) sit on the game's files, not on the age rating. The fix is on GitHub, so that is where "Fix this" leads. The spec put the first on the age rating row.
- The files question keeps the spec 5 sentence "You choose which repositories Ruken can see. It can't see anything else." beside the board's.
- Live's slow-phone answer: where autoplay is unwelcome (reduced motion, Save-Data, under 4 GB) the background stays on its first frame. Not measured on a real phone.

## Open, for nobody to answer now

- Nothing needs the Owner. The test site's videos not playing follows from the Owner's decision to move the domain to launch. It is said once, in the plan and in this audit, and not asked again.
