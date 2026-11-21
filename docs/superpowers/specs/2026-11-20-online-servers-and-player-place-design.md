# Online servers, and a player's birthday and place

Date: 2026-11-20. Status: the Owner answered its three questions on 2026-11-20 (section 7). Cycle 3: cycle 1's fixes are marked (R1) to (R13) and (N1) to (N6), cycle 2's (C1) to (C3) and (2N2) to (2N6), each where it lands (audits `2026-11-20-online-servers-and-player-place-1-plan-audit.md` and `-2-plan-audit.md`). Nothing here is built. Lane 3 (a migration), so the staged path.

## 1. What the Owner asked

- **Owner, 2026-11-19:** "I'd like to add an additional field to the maker pages that impact algorithm. Check if the game is multiplayer, and if it is, where the [servers are]... games with nearby server locations are prioritized, I think a few additional things will need to be added to compensate for that, but we can run through that when we get there".
- **Owner, 2026-11-19:** "Users would also need to add their birthday and location".

How the feed weighs any of this is not written here. RukenApp is public, and the feed's rules and numbers are kept privately, as the Owner asked on 2026-11-15. This spec covers only what makers and players are asked, what is stored, and who can see it. (N6: every later cycle checks this again.)

## 2. What is already there

- **Multiplayer.** The game facts spec (`2026-11-17-game-facts-design.md`, #195) asks "How many people play <name> at once?" with the picks "One person", "Two or more, on one phone or computer" and "Two or more, online" (`GamePlayers`: `alone`, `one_device`, `online`). Its section 2.5 keeps the order so this spec's question slots in after it.
- **Birthday.** Sign-up asks for the date of birth and keeps only the date of the 18th birthday (`User.adultOn`); it says "We don't keep your birthday" (`src/routes/sign-up/+page.svelte`, `src/features/accounts/age.ts`). On branch B (`plans/2026-11-15-texts-not-email.md`), sign-up becomes the phone number, password and date of birth on one screen, then a text code; what was typed waits in `PendingSignUp` until the code, and the account is made by `finishSignUp`.
- **Place.** Nothing about where a player is is stored, and nothing in RukenApp reads Cloudflare's `request.cf` today.

## 3. The maker's new question: where the servers are

- **When.** Straight after the players question, and only when `online` is among the picks. Taking `online` away clears this answer in the same write. A game without `online` is never asked and stores nothing.
- **Heading:** "Where are <name>'s servers?" Several, at least 1. **Hint:** "Pick every area you run a server in. Players close to one get a smoother game."
- **The picks** (Call: a fixed list of areas, not typed places, so every answer means the same thing and nobody types a fact):
  - Eastern US and Canada
  - Western US and Canada
  - Mexico and Central America
  - South America
  - Western Europe
  - Eastern Europe
  - Middle East
  - Africa
  - India and South Asia
  - East Asia
  - Southeast Asia
  - Australia and New Zealand
  - "Players anywhere join their nearest server" (apart, last; with any other pick it is refused, as "None of these" is in good to know) (N4)
- **Wrong:** "Choose at least one." With "anywhere" and another pick: "Pick areas, or pick Players anywhere. Not both." (2N5)
- **Stored and checked** (R9): see section 6, Unit O.
- **Send back** (R9). The servers answer is part of the `players` part, as the marks are part of `age_rating` (`src/features/games/questions.ts`, `marks: "age_rating"`), so no new `GamePart` value. Sending back `players` sends the maker to the players question, and from there through the servers question again. One more reason under `players` in `library/send-back-reasons.json`:

  | Part | Staff read | The maker reads |
  |---|---|---|
  | `players` | Its servers aren't where it says. | We couldn't find {name}'s servers where you said. Pick where they really are. |

- **On a live game** (R10). #195 puts `players` in `LIVE_MAY_CHANGE` and `LIVE_MAY_BE_SENT_BACK`; the servers answer goes with it:
  1. The maker may change the servers answer on a live game by themselves, and staff may send it back, through the `players` part.
  2. On a live game, a maker who adds `online` presses Next and goes straight to the servers question; the players change is saved only together with a servers answer (one write), so a live game never holds `online` with no servers.
  3. The review command's `look` answer (`src/routes/jobs/review/+server.ts`) gains `serverAreas` (the words a person reads, in list order), beside #195's `players`.
  4. Check and send, Live and Sent back list it under the players line: "Servers in Western Europe and East Asia." / "Players anywhere join their nearest server."

## 4. The player's birthday

- **Owner, 2026-11-20 00:16 UTC, on a card:** "Keep the full date", the one already typed at sign-up. No new question for a new account.
- **Stored** as `User.birthDate` (a calendar day, America/Chicago as `age.ts` reads it), nullable: null for every account made before Y (R13). `adultOn` is still worked out by `ageCheck` as today, so every age rule keeps working.
- **Across B's code screen** (R2): `PendingSignUp` gains `birthDate`; `startSignUp` keeps it beside `adultOn`, and `finishSignUp` writes it in the same transaction that writes `adultOn`.
- **Under 13:** still refused, and still nothing stored.
- **Accounts with no birthday** (R13): the "About you" screen (section 5) asks for it first. A date whose 18th birthday is not the stored `adultOn` is refused: "That isn't the birthday you gave when you joined." Where `adultOn` is null, any date 13 or more years ago is taken and `adultOn` is written from it; an under-13 date is refused with sign-up's words, nothing is stored, and the screen offers "Delete my account" (`/me/delete`) under the words (2N2). (N1: branch B's X8 has every account made again after B, so on the test site this covers only accounts made between B and Y.)
- **Sign-up's line** changes from "We don't keep your birthday." to "We keep your birthday private. Nobody else sees it."
- **Who sees it:** only the player, on `/me` ("Your birthday: 4 March 2001"). It is never on a page, a clip, the review command's `look`, `waitingGames` or a maker's numbers.
- **Deleting an account** (R3): `purgeDueAccounts` (`src/features/accounts/deletion.ts`) sets `birthDate`, `country` and `region` to null with `adultOn`.

## 5. The player's place

- **Owner, 2026-11-20 00:16 UTC, on a card:** "Country and state, filled in".
- **Stored:** `User.country` (ISO 3166-1 alpha-2, two letters) and `User.region` (ISO 3166-2, such as `US-OH`; null where the country gets no second list). No city, no street, no coordinates.
- **The "About you" screen** (R5, R13), at `/about-you`. It is one screen with up to two questions, the birthday (only when `birthDate` is null) and then "Where do you live?":
  - The country, and for the countries below the state or province, are filled in (R6). "Yes, that's right" is the big button. "Change it" is a quiet link beside it, as B's "Text it again" is (N5); it opens a country list and, for those countries, a second list.
  - **When it shows.** A signed-in account with no `birthDate` or no `country` that opens any page is sent to `/about-you?next=<that page>` first, by one handle in `src/hooks.server.ts` (`aboutYouFirst`, in `src/features/accounts/about-you.ts`), after `createHandle`. Not sent: `/about-you` itself, `/sign-out`, `/legal/*`, `/help/*`, `/goodbye`, `/me/delete`, and every non-page path (`/api`, `/jobs`, `/webhooks`, `/healthz`). It reads the two columns in one small query by the signed-in user's id, once a page request; nothing for a signed-out one. Call (D1): one read of its own rather than adding the columns to better-auth's session user, which would widen Y into `auth.ts` and `handle.ts` and send the birthday and place to the browser with every session read (2N2).
  - **On sign-up**, this is what happens straight after the code: `finishSignUp` makes the account with its birthday and redirects to `next` as B says, the handle sends the new account to `/about-you?next=…`, and "Yes, that's right" goes on to `next`. So the paywall path still lands on the card, one screen later (R5). Call: after the code, not between the first screen and the code, because B's first screen already has a "Country" field for the phone number, and two "Country" fields one after the other would confuse people.
  - **Accounts made before Y** meet the same screen the first time they open a page after Y merges (R13).
- **Filled in from the connection** (R6). One function, `placeOf(event)` in `src/features/accounts/place.ts`, reads `event.platform?.cf`:
  - the country is `cf.country`; a missing value, `XX` (unknown) or `T1` (Tor) is no country;
  - the region is `cf.country + "-" + cf.regionCode` (Cloudflare gives `TX`, not `US-TX`; the build confirms this against Cloudflare's `IncomingRequestCfProperties` in step 0), and only for a country with a second list and a code in its list; otherwise none.
  - With no country from the connection, the screen falls back to the phone number's country (B's `phoneNumber`, through `phone.ts`); with neither, it opens on the country list with nothing picked.
  - Tests set the place through `placeOf`'s seam (a `cf` object passed in); `vite dev` and Playwright have no `cf`, so they meet the fallback unless a test sets it.
- **Which countries get a second list** (R7). Call: those where people name their state or province when asked where they live: the United States, Canada, Australia, Brazil, Mexico and India. Every other country stores the country alone. (Only the US and Canada are needed to pick a server area; the others are asked because people there expect it.)
- **The data file** (R7). `src/features/accounts/library/places.json`: every ISO 3166-1 alpha-2 code with its server area (section 5's table), and for the six countries above every ISO 3166-2 code with the words a person reads, taken from Unicode CLDR's subdivision data (the same ISO 3166-2 codes, with English names, under CLDR's free licence) (2N3). Country names come from `Intl.DisplayNames` (`type: "region"`), so they are not copied; Y's step 0 confirms Workers gives them. No new dependency.
- **From place to server area** (R8). `areaOf(country, region)`, a pure function in `place.ts`, reads `places.json`:
  - **US and Canada** split east and west at the western edge of the Central time zone: Eastern and Central go to "Eastern US and Canada"; Mountain, Pacific, Alaska and Hawaii go to "Western US and Canada". A state or province split between zones goes where most of its people are (so Texas, Kansas, Nebraska, the Dakotas, Florida, Kentucky, Tennessee, Indiana and Michigan go east; Idaho and Oregon go west). Saskatchewan, Manitoba and Nunavut go east; Alberta, British Columbia, Yukon and the Northwest Territories go west. A US or Canadian account with no region goes east.
  - **Europe:** "Western Europe" is Ireland, the UK, Iceland, the Nordic countries (Finland included), the Benelux, France, Monaco, Andorra, Spain, Portugal, Germany, Switzerland, Liechtenstein, Austria, Italy, San Marino, the Vatican and Malta. "Eastern Europe" is every other European country: Poland and every country east and south-east of it, the Baltics, the Balkans, Greece and Cyprus, and Ukraine, Belarus, Moldova, Russia, Turkey and the Caucasus.
  - **Mexico and Central America:** Mexico, Guatemala, Belize, El Salvador, Honduras, Nicaragua, Costa Rica and Panama.
  - **South America:** Argentina, Bolivia, Brazil, Chile, Colombia, Ecuador, Guyana, Paraguay, Peru, Suriname, Uruguay, Venezuela, French Guiana, the Falkland Islands, and South Georgia and the South Sandwich Islands.
  - **Middle East:** Saudi Arabia, the United Arab Emirates, Qatar, Bahrain, Kuwait, Oman, Yemen, Iraq, Iran, Israel, Palestine, Jordan, Lebanon and Syria, with Central Asia and Afghanistan below. (2N4)
  - **Elsewhere:** the Caribbean, Bermuda and Greenland go to "Eastern US and Canada"; Central Asia and Afghanistan go to "Middle East"; Pakistan, Bangladesh, Sri Lanka, Nepal, Bhutan and the Maldives go to "India and South Asia"; China, Hong Kong, Macau, Taiwan, Japan, both Koreas and Mongolia go to "East Asia"; the ASEAN countries and Timor-Leste go to "Southeast Asia"; Papua New Guinea, the Pacific islands and Antarctica go to "Australia and New Zealand"; every African country, Egypt included, goes to "Africa".
  - The full table is `places.json`; the table test reads it.
- **Changing it:** `/me` shows "You live in: Ohio, United States" with Change, which opens the same two lists.
- **A visitor with no account** (N2): the feed (Unit N, slice 3) may read `placeOf` for one request and store nothing. O, U, Q+ and Y build nothing for visitors.

## 6. The plan: units, lanes and order

| Unit | Lane | Waits on | Owns | Output | Check |
|---|---|---|---|---|---|
| O, the servers column | **3** (`prisma/schema/`, `prisma/migrations/`) | this spec's plan audit; #195's K and #204's D on `main` (all three change `games.prisma` with a migration) | `prisma/schema/games.prisma`, its migration, and the pg tests of its CHECKs | `Game.serverAreas GameServerArea[] @default([])` (an enum of the 12 areas and `anywhere`), `Game_serverAreas_check` (`anywhere` only alone), `Game_serverAreas_online_check` (`cardinality("serverAreas") = 0 OR 'online' = ANY("players")`), each in the model's `///` line. No screen changes. | the plan audit before; CI green on a ready pull request; the implementation audit; **the Owner's approval of the merge** (it applies the migration to the test site's database) (R12) |
| U, the account columns | **3** (`prisma/schema/`, `prisma/migrations/`) | this spec's plan audit; **branch B on `main`** (B changes `accounts.prisma` with its own migration and makes `PendingSignUp`, so U starts from a `main` holding B and dates its migration after the newest there) (R1); not alongside O (each dates its migration after the newest on `main`) | `prisma/schema/accounts.prisma`, its migration, and the pg tests of its CHECK | `User.birthDate DateTime? @db.Date`, `User.country String?`, `User.region String?`, `User_region_check` (`region IS NULL OR (country IS NOT NULL AND region LIKE country \|\| '-%')`), `User_country_check` (`country IS NULL OR country ~ '^[A-Z]{2}$'`) (2N6), and `PendingSignUp.birthDate DateTime @db.Date` (R2; B's pending rows last ten minutes, so the migration first deletes any left). No screen changes. | the same as O |
| Q+, the servers question | **2** (`src/features/games/`, shared by the maker's screens) | O and #195's Q on `main`; **not alongside #204's H or A** (`service.ts`, `review-order.ts`, the review route, `src/routes/make/[game]/+page.server.ts`): whichever starts second waits for the other to merge (R11). If H is on `main`, every save and clear of `serverAreas` on a waiting game sets `Game.changedAt` in the same write, as #204 (F12) asks of every maker write; if H merges after Q+, H does it (C1) | `src/features/games/questions.ts`, `src/params/question.ts`, `service.ts` (saving, clearing with `online`, the one-write live change), `fields.ts`, `send-back.ts`, `library/send-back-reasons.json`, `library/server-areas.json` (each area's code and words), `review-order.ts`, `laid-out.ts` (`serverWords`), `src/routes/jobs/review/+server.ts` (`look`), the question route and its screen, `src/routes/make/[game]/+page.server.ts`, `src/routes/make/laid-out.ts`, `laid-out.server.ts`, `src/routes/make/[game]/check/+page.svelte`, `GameLaidOut`, `tests/browser/support/game.ts` and `database.ts` (`answerEveryQuestion`, `fillAnswers`), `tests/browser/review-job.test.ts`, and the journeys that walk the questions (R11) | section 3 | CI green on a ready pull request; one fresh review; the visual check on the device matrix for the servers question, Check and send, Live and Sent back |
| Y, birthday and place | **2** (`src/hooks.server.ts`, `src/features/accounts/`) | U on `main`, and so branch B (N1: B merges at the slice end, after the Owner's Step 1a, so Y lands last in the slice); **not alongside Q+, #195's Q or V, or #204's A** (`tests/browser/support/database.ts`, the support helpers, `src/lib/look.css`, `tests/lib/look.test.ts`): whichever starts second waits for the other to merge (C2) | `src/features/accounts/age.ts`, `forms.ts` (`startSignUp`, `finishSignUp`), `pending-sign-up.ts`, `deletion.ts`, `about-you.ts` (new: `aboutYouFirst`), `place.ts` (new: `placeOf`, `areaOf`), `library/places.json` (new), `src/hooks.server.ts`, `src/routes/about-you/` (new), `src/routes/sign-up/+page.svelte` (the line), `src/routes/me/+page.server.ts` and `+page.svelte`, `src/lib/look.css` and `tests/lib/look.test.ts` (each new class), `tests/browser/support/account.ts` and `database.ts` (a made account has a birthday and a place unless a test asks otherwise, so other journeys never land on About you), their tests and `tests/features/accounts/purge.pg.test.ts` (R3, R11) | sections 4 and 5 | CI green on a ready pull request; one fresh review; the visual check on the device matrix for About you, sign-up's line and `/me` |
| N, nearby servers in the feed | slice 3 | the feed | private | the feed's order | the feed's own spec |

**The privacy draft** (R4, C3). Y's step 0 writes it before Y's pull request is marked ready, in the "Legal draft: Privacy" page of the Library in the owner's Ruken page in Notion (changed 2026-11-21: private notes moved from RukenPrivate to Notion; see `this-repo`; the page holds what was RukenPrivate's `legal/drafts-from-rukenapp-pr-104/privacy.md`). It changes the passages that were lines 16, 29, 100 and 145 to say Ruken keeps the date of birth and the country and state, private to the player, and removed 14 days after an account is deleted; and adds a "Where you live" line. Every changed line is marked [LAWYER TO CONFIRM], because 13 to 17 year olds are included. **An Owner step, not a blocker:** the Owner's lawyer reads those lines before launch, with the rest of the draft.

**Why this order.** O waits on K and D because all three migrate `games.prisma`. The account columns are their own unit, U, so the servers question is not held to the slice end with B: U waits on B because both migrate `accounts.prisma` and U adds a column to B's `PendingSignUp` (R1, R2). Q+ waits on O so the question is never asked before it can be saved, and on #195's Q because it slots into Q's question list. Y waits on U, and so on B, because it changes B's sign-up. N waits on the feed. O adds nothing a person sees, so merging it alone changes no screen.

**Expected time:** O 3 hours, U 3 hours, Q+ 6 hours, Y 9 hours, plus the audits. **Models and effort** from Settings in `CLAUDE.md`: execution against a spec, Sonnet 5.5, medium; O's and U's audits, Opus 5.5, medium; the lane 2 reviews of Q+ and Y, the builder's model, medium.

**Boundaries** (R12). No new dependency, tool, environment or spend. Two migrations, one in O and one in U, each holding only its unit's output. The test site's database is changed only by O's and U's merges. Undoing it is a second migration that drops the columns, not a revert; Postgres cannot drop an enum value, so `GameServerArea` stays if it is undone. Nothing runs on the Owner's computer. **Owner, 2026-11-20 00:17 UTC, on a card:** "Fields now, ranking with the feed": O, U, Q+ and Y are built in slice 2; N waits for the feed in slice 3. Call (2026-11-20, at the game facts thread's request): O is its own migration, not folded into #195's K, so K's audit stays settled.

### Unit O, step by step

- [ ] **Step 1: the failing tests.** A pg test for each CHECK: `anywhere` with another area is refused; a game with `serverAreas` and no `online` in `players` is refused; a game with no servers and no `online` is fine. Run them: they fail for those reasons.
- [ ] **Step 2: the columns and the migration**, made by `pnpm prisma migrate dev --create-only` and read before it is kept; it opens with a comment line, as every other one does. Paste the empty output of `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --shadow-database-url "$TEST_DATABASE_URL" --script` into the pull request. Run again: pass. Open the draft pull request; it names the migration, says merging applies it to the test site's database, and says undoing it is a second migration.
- [ ] **Step 3: finish.** The implementation audit on the commit named; fix its findings; the Owner's approval of this merge. Delete the live-state file in the last commit, merge `main` in, mark ready, merge on green with a merge commit.

### Unit U, step by step

The same three steps as O, on `accounts.prisma`: Step 1's pg tests are `User.region` `US-OH` with `country` `CA`, or with no country, refused; `US-OH` with `US` and a null region with any country taken; `country` `us` or `USA` refused; a `PendingSignUp` row without `birthDate` refused.

### Unit Q+, step by step

- [ ] **Step 1: the failing tests.** `questions.test.ts`: the servers question comes after players only with `online`, and the counts. `fields.test.ts`: each refusal's words. `service.pg.test.ts`: saved by the maker only; taking `online` away clears it; on a live game, adding `online` without servers is refused and with servers is one write; `players` sent back on a live game; with H on `main`, saving or clearing the servers answer on a waiting game sets `changedAt` and lapses a held decision (C1). `send-back.test.ts`: the new reason. `review-job.test.ts`: `look` lists `serverAreas` in words. `laid-out.test.ts`: `serverWords` for one, two, three areas and anywhere. A journey, `make-servers.test.ts`: with the keyboard, a maker picks online, sees the servers question, sees both refusals, sees the line on Check and send and changes it from there; a live game adds online and is taken to the servers question.
- [ ] **Step 2: the question, the part and the lines.** Change the journeys that walk the questions only where they answer them or read a counter; nothing is loosened. Run every file named, the browser files on `computer`, `phone` and `tablet`: pass. Open the draft pull request.
- [ ] **Step 3: finish.** The visual check; the fresh lane 2 review; fix; delete the live-state file, merge `main` in, mark ready, merge on green.

### Unit Y, step by step

- [ ] **Step 0.** Write the privacy draft into its Notion page (section 6, C3; without Notion, the fallback in `this-repo`). Confirm Workers' `Intl.DisplayNames` gives English region names (2N3). Confirm `cf.country` and `cf.regionCode` in Cloudflare's `IncomingRequestCfProperties` (the `@cloudflare/workers-types` already in the lockfile, or Cloudflare's page), and note the source in the pull request.
- [ ] **Step 1: the failing tests.** `age.test.ts` (old against new): over many dates from a fixed seed, 29 February included, `adultOn` is the same as before. `place.test.ts`: `placeOf` for a full `cf`, a missing one, `XX`, `T1`, a region outside the six countries, and a region code not in the list; `areaOf` gives an area for every code in `places.json` and the side the table names for every US state and Canadian province. `pending-sign-up.pg.test.ts` and `forms.test.ts`: the birthday typed on the first screen is the account's after the code. `purge.pg.test.ts`: after the purge, `birthDate`, `country` and `region` are null. `about-you.test.ts`: who is sent and who is not (each path in section 5). Journeys: sign-up with the place filled in, "Yes, that's right", and on to `next`; the paywall sign-up lands on the card after About you; "Change it" with the keyboard; an older account answers its birthday (a wrong one refused with its words) and place; `/me` shows and changes the place. A privacy test for each route that returns a person (N3): `/me` shows the birthday and place only to its own account; the review command's `look` and `waitingGames` return neither.
- [ ] **Step 2: the screen, the handle and the writes.** Run again, the browser files on `computer`, `phone` and `tablet`: pass. Open the draft pull request; it links the merged privacy draft change.
- [ ] **Step 3: finish.** The visual check; the fresh lane 2 review; fix; delete the live-state file, merge `main` in, mark ready, merge on green.

## 7. The Owner's questions

1. How exact a player's place is. **Answered** 2026-11-20 00:16 UTC: country and state, filled in.
2. Keep the whole birthday. **Answered** 2026-11-20 00:16 UTC: keep the full date.
3. When to build. **Answered** 2026-11-20 00:17 UTC: the questions and fields now; the ranking with the feed in slice 3.

Further questions on what goes with nearby-server ranking (the "additional things to compensate") are kept with the feed's private design, because they are about how the feed weighs games.

Questions that are not about the feed, for later, and not built unless the Owner says so:

- Should a game's page say where its servers are, such as "Servers in Western Europe and Eastern US and Canada"?
- Should a player far from every server of an online game see a plain warning before Play, such as "This game may be slow where you are"?

## 8. Acceptance criteria

- A maker who picks "Two or more, online" gets the servers question next; one who does not never sees it, and its answer is empty.
- Taking away "Two or more, online" clears the servers answer.
- "Players anywhere join their nearest server" with any other pick is refused with the words in section 3; the database refuses it too, and refuses servers on a game without `online`.
- On a live game, adding `online` goes to the servers question and is saved only with an answer; staff can send back `players` with the servers reason; `look` and Check and send list the servers.
- Sign-up keeps the birthday; an account made after the code has the date typed on the first screen; `adultOn` matches what it is today for the same dates (an old-versus-new test over many dates from a fixed seed, 29 February included).
- An under-13 sign-up stores nothing, as today.
- The place screen is filled in from the connection, or the phone's country, or opens on the list; "Yes, that's right" stores exactly what it showed; "Change it" stores what was picked; a test covers each case of `placeOf`.
- The paywall sign-up still lands on the card after About you.
- An older account is asked its birthday and place once; a birthday that does not match `adultOn` is refused with its words.
- `areaOf` gives an area for every ISO country, and the side section 5 names for every US state and Canadian province (a table test over `places.json`).
- After the purge, the birthday and place are gone (a pg test).
- Nobody but the player can read their birthday or place: `/me` only for its own account; the review command's `look` and `waitingGames` return neither.
- The privacy draft says what is kept, marked for the lawyer, before Y merges.
- Every new screen works with the keyboard alone, with focus visible, on the small phone, tablet and computer profiles, and passes the drunk-grandma test.
