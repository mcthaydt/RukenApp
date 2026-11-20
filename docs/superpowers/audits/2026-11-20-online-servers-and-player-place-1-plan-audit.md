# Plan audit: online servers, and a player's birthday and place (cycle 1)

Examined: `docs/superpowers/specs/2026-11-20-online-servers-and-player-place-design.md` at **1bc8b21** (PR #203, draft), against:

- `main` at **dc96dc9** (code, schema, `docs/superpowers/plans/2026-11-15-texts-not-email.md`, branch B);
- PR #195 at **3d39aba** (`2026-11-17-game-facts-design.md`: units L, K, Q, V);
- PR #204 at **0b266a0** (`2026-11-20-decision-day-design.md`: units D, H, A);
- RukenPrivate PR #15 at **5f03442** (`strategy/2026-11-20-nearby-servers-ranking.md`), for the leak check only, and RukenPrivate `main` at **d47d559** (`legal/drafts-from-rukenapp-pr-104/privacy.md`).

Graphify's index of RukenApp is at dc96dc9, the same as `main`, so its answers were used as they are.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**Not ready to merge: 13 red, 6 notes.** The Owner's three answers are carried faithfully (place is country and state, filled in; the full birthday is kept; O, Q+ and Y in slice 2, N in slice 3), and nothing private about the feed leaks. The reds are gaps against the codebase and the specs it sits beside: branch B's own migration and its pending sign-up row, account deletion, the privacy page, where the place screen goes, what happens when the connection gives no place, the area table, how the servers answer is stored and sent back, and the unit rows a staged-path brief needs.

## What holds

- **Owner's words and cards.** Section 1 quotes 2026-11-19 exactly as memory and RukenPrivate #15 section 1 hold them. Sections 4, 5, 6 and 7 carry the three cards of 2026-11-20 (00:16 and 00:17 UTC) with the same answers as the project memory.
- **#195 leaves room.** #195 section 2.5 keeps the `online` code and the question order "so that question slots in", and its section 7 Boundaries names O as #203's own migration after K and D. The two specs agree.
- **#204.** D adds `DecisionDay`, `DecisionOutcome`, `GameReview.goesOutOn`, `Game.changedAt` and `Game.acceptedSeenAt` (section 4), all in `games.prisma`; O waiting on D is right.
- **The leak check passes.** The spec, its five commit messages and PR #203's body hold none of the feed's private rules or numbers, checked word by word against RukenPrivate #15. The only feed words are the Owner's own 2026-11-19 quote and "what the feed does with the area is private".
- **Under 13** stays as `ageCheck` has it (`src/features/accounts/age.ts:47-62`): no date is returned, so nothing is stored.

## Red findings

### R1. O and branch B both change `accounts.prisma` with a migration, and neither waits on the other

- UNIT: section 6, row O. VERDICT: red.
- REQUIREMENT: `staged-path`, Splitting: "A unit waits on another when ... the two touch the same file, interface, schema".
- REASON: O waits only on K and D, but branch B's Task 3 also changes `prisma/schema/accounts.prisma` (`User` gains `phoneNumber`, `phoneNumberVerified`, `phoneConfirmedAt`, `paperEmail`; new `PendingSignUp`) with its own migration.
- EVIDENCE: `plans/2026-11-15-texts-not-email.md`, Task 3 ("Modify: `prisma/schema/accounts.prisma`; create `prisma/migrations/<timestamp>_texts_sign_in/`"), and "Its folder is dated after ... the newest on `main`". If O merges first, B's folder date is older than O's and B's rule is broken; B is built but held until the slice end (Step 1a), so O merging first is the likely order.
- EXPECTED: the row says how O and B are ordered.
- FIX: in section 6, O's "Waits on" adds "not alongside branch B (both change `accounts.prisma` with a migration): whichever starts second starts from a `main` holding the other, and dates its migration after the newest there". Only the spec.

### R2. The birthday is lost between sign-up's two screens: B's pending row keeps only `adultOn`

- UNIT: section 4 and row O's output. VERDICT: red.
- REQUIREMENT: Owner's card, "Keep the full date"; section 8, "Sign-up keeps the birthday".
- REASON: on branch B the account is made only after the text code, and what was typed on the first screen waits in `PendingSignUp`, which holds `adultOn`, not the date.
- EVIDENCE: texts-not-email plan, Task 3 table: "`PendingSignUp` | `numberHash`, `browserHash`, `passwordHash`, `adultOn DateTime @db.Date`, ...". O's output names only `User.birthDate`, `User.country`, `User.region`.
- EXPECTED: the full date reaches `User.birthDate` when the account is made after the code.
- FIX: O's output adds `PendingSignUp.birthDate` (a date); Y's row says `startSignUp` keeps it and `finishSignUp` writes it, and the place too if R5 puts the place screen before the code. Section 8 adds "an account made after the code has the date typed on the first screen". Only the spec.

### R3. Deleting an account does not clear the birthday or the place

- UNIT: sections 4, 5 and 8. VERDICT: red.
- REQUIREMENT: section 4, "Nobody but the player sees it"; the privacy draft, line 100: "After 14 days, we remove: ... your age ...".
- REASON: the purge clears `adultOn` by name and nothing else about age or place; the spec never mentions deletion.
- EVIDENCE: `src/features/accounts/deletion.ts:142-152` sets `adultOn: null` with the name, email and image; it has no line for columns that do not exist yet. `tests/features/accounts/purge.pg.test.ts` checks the purge.
- EXPECTED: after the 14 days, `birthDate`, `country` and `region` are null like `adultOn`.
- FIX: Y owns `src/features/accounts/deletion.ts` and `tests/features/accounts/purge.pg.test.ts`; section 8 adds "after the purge, the birthday and place are gone (a pg test)". Only the spec.

### R4. The privacy page says Ruken does not keep the birthday, and says nothing about place

- UNIT: sections 4 and 5. VERDICT: red.
- REQUIREMENT: CLAUDE.md, "Report honestly"; the main design's legal text row ("terms, privacy ... reviewed for what changed").
- REASON: once Y ships, four lines of the privacy draft are false, and a new kind of data (where a person lives) is kept without being listed. It applies to 13 to 17 year olds too.
- EVIDENCE: RukenPrivate `legal/drafts-from-rukenapp-pr-104/privacy.md` at d47d559: line 16 "we don't keep your date of birth", line 29 "We don't keep the date. We keep only the day you turn 18", line 100 (what is removed), line 145 (children and teenagers) "We only keep the day you turn 18, not your date of birth". No line names a place.
- EXPECTED: the brief names the privacy text as part of Y's change and as a lawyer question, since it keeps a minor's birth date and home state.
- FIX: Y's row adds "the privacy draft's lines 16, 29, 100 and 145 and a new line on place, marked [LAWYER TO CONFIRM], in RukenPrivate, merged before Y". The privacy page is public text, so naming it here leaks nothing. Only the spec.

### R5. Where the place screen goes in branch B's sign-up is not said, and B already asks "Country"

- UNIT: section 5, "Sign-up gets one screen after the birthday". VERDICT: red.
- REQUIREMENT: CLAUDE.md, the drunk-grandma test; main design 5.7 and its amended line 398 ("one short sign-up").
- REASON: on B the birthday is on the first screen with the phone and the password, then comes the code. "After the birthday" can mean between those (so the place waits in `PendingSignUp`) or after the code (once the account exists). The paywall path goes "straight back to the card" after sign-up, and an extra screen sits in it. B's first screen already has a "Country" field, for the phone number, so a second "Country" on the next screen will confuse people.
- EVIDENCE: texts-not-email plan, the screens drawing, lines 153 to 207 ("Country" above the number; "`Country` is its own labelled field above the number").
- EXPECTED: one place in the flow, named, and the paywall return still lands on the card.
- FIX: section 5 says the screen comes after the code, once the account is made, before the person goes on to where they were going (the paywall card included). It is filled in from the connection, or from the phone's country when the connection gives none (R6). Section 8 adds "the paywall sign-up still lands on the card after the place screen". Only the spec.

### R6. Nothing says what shows when the connection gives no place

- UNIT: section 5, "filled in from where the connection comes from". VERDICT: red.
- REQUIREMENT: section 8, "The place screen is filled in from the connection"; `build`, the quality bar (no dead ends).
- REASON: `request.cf` is absent in `vite dev`, in Playwright against the dev server and in unit tests; Cloudflare gives `XX` for unknown and `T1` for Tor, and often no `regionCode`; and `regionCode` comes without the country (`TX`, not `US-TX`, per Cloudflare's `IncomingRequestCfProperties`, to confirm in the build). Nothing in RukenApp reads `cf` today (no match for `.cf`, `regionCode` or `CF-IPCountry` in `src/` or `cloudflare/`), so there is no pattern to follow.
- EXPECTED: one rule for each case, and a way for tests to set the connection's place.
- FIX: section 5 adds that the place is read in one function (`placeOf(event)`) through `event.platform?.cf`, gives `US-TX` from `US` and `TX`, and treats a missing, `XX` or `T1` country as none. With none, the screen opens on "Change it" with nothing picked (or the phone's country, per R5). Tests set the place through that function's seam. Section 8 adds a test for each case. Only the spec.

### R7. Which countries get a second list, and where the lists come from, is not said

- UNIT: section 5, "for countries split into states or provinces, a second list". VERDICT: red.
- REQUIREMENT: Owner's card "Country and state"; `staged-path`, the brief's boundaries (dependencies, tools).
- REASON: ISO 3166-2 splits almost every country (France into regions, the UK into its four countries and then counties), so "split" picks no set. No data file is named and no boundary says that no new dependency is added for country and region names.
- EVIDENCE: the spec names no file; `src/features/accounts/` has no countries or regions list on `main` (branch E's `library/countries.json` is for phone numbers and is not built).
- EXPECTED: a named list of countries that get a second list, a named data file, and its source.
- FIX: section 5 names the countries that get a state or province list (recommended: those where people say "state" or "province", at least the US, Canada, Australia, Brazil, Mexico and India; `areaOf` needs only the US and Canada). It names `src/features/accounts/library/places.json` (codes and the words a person reads), where it was taken from, and "no new dependency". If the set leaves out a country the Owner expects, that is a card. Only the spec.

### R8. The area table cannot be judged: many countries fit no area, and the splits are not drawn

- UNIT: section 3 (the 12 areas) and section 5 (`areaOf`). VERDICT: red.
- REQUIREMENT: section 8, "`areaOf` gives an area for every country in the list, and the right side for every US state and Canadian province (a table test)".
- REASON: the Caribbean, Central Asia, Russia east of the Urals, Greenland and the Pacific islands are in none of the 12 areas, and "Western" and "Eastern" Europe and US and Canada are not split anywhere in the spec. The test has nothing to check against. It is "plain geography" and safe to keep public, so it belongs in the spec.
- EVIDENCE: section 3's list; section 5 says only "split east and west by state and province".
- EXPECTED: every ISO country has one area, written down, and the east/west lines are named.
- FIX: section 5 gives the rule (recommended: the US and Canada split at the Central time zone's western edge, so Central goes east; Alaska and Hawaii go west; the Caribbean goes to "Eastern US and Canada"; Central Asia goes to "Middle East"; Russia, Turkey and the Caucasus go to "Eastern Europe"; Greenland goes to "Eastern US and Canada"; the Pacific islands go to "Australia and New Zealand"). It names the Europe split and says the full table is a file the table test reads. Only the spec.

### R9. How the servers answer is stored, checked and sent back is not said

- UNIT: row O's output and section 3. VERDICT: red.
- REQUIREMENT: #195 section 3 ("lists that don't grow are enums"; a named CHECK for "none only alone"); #195 section 4 (each reason is a "Staff read" and a "maker reads" pair with `{name}`, plus `partTitle` and `partNoun`); `GamePart` in `prisma/schema/games.prisma:31-40`.
- REASON: "a list of the section 3 areas" gives no type, no CHECK for "anywhere only alone", no CHECK that the list is empty unless `players` holds `online`, and no part to send back. The send-back has one sentence, not #195's pair.
- EVIDENCE: the precedent is that the marks question shares the `age_rating` part (`src/features/games/questions.ts:79`, `marks: "age_rating"`) and is cleared when the age changes (`src/features/games/service.ts:567`, `data.contentMarks = []`).
- EXPECTED: storage and checks as #195 writes them, and one stated part.
- FIX: O's output is `serverAreas GameServerArea[] @default([])` (an enum of the 12 areas and `anywhere`), with `Game_serverAreas_check` (`anywhere` only alone) and `Game_serverAreas_online_check` (`cardinality("serverAreas") = 0 OR 'online' = ANY("players")`), each in the model's `///` line. The servers answer shares the `players` part, as the marks share `age_rating`, so no new `GamePart` value is needed. Its reason goes under `players` in `library/send-back-reasons.json` as a pair ("Its servers aren't where it says." / "We couldn't find {name}'s servers where you said. Pick where they really are."). Only the spec.

### R10. A live game is left to "whatever #195 settles", but #195 has settled it, and one case is new

- UNIT: section 3, "Changing it on a live game". VERDICT: red.
- REQUIREMENT: `review` and CLAUDE.md, the brief states its acceptance criteria; #195 section 4.
- REASON: #195 puts `players` in `LIVE_MAY_CHANGE` and `LIVE_MAY_BE_SENT_BACK` (`src/features/games/service.ts:389` and `:485` today). So a live game's maker may add "Two or more, online", which leaves the servers question unanswered on a live game. Nothing says it is asked then. The review command's `look` answer (#195 section 4) and Check and send's lines (#195 section 5) also do not list the servers.
- EVIDENCE: #195 section 4, "On a live game, the maker may change the six words-and-picks answers ... players ...".
- EXPECTED: the servers answer is changeable live like players. Adding "online" on a live game goes straight to the servers question. The Owner sees the areas before a yes, and Check and send lists them.
- FIX: section 3 replaces "follows whatever #195 settles" with those four lines (servers in both live lists via `players`; on a live game, Next after adding "online" opens the servers question and the change is saved only with both; `look` gains `serverAreas`; Check and send gains "Servers in Western Europe and East Asia"), and section 8 gains a criterion for each. Only the spec.

### R11. Q+ and Y own too few files, and Q+ has no "not alongside" line for H and A

- UNIT: section 6, rows Q+ and Y. VERDICT: red.
- REQUIREMENT: `staged-path`, Splitting: each row names "the files it owns", and "no two running units own the same file".
- REASON: Q+ names only `questions.ts` and its screen, but R9 and R10 also need `service.ts`, `fields.ts`, `send-back.ts`, `library/send-back-reasons.json`, `review-order.ts`, `src/routes/jobs/review/+server.ts`, `src/routes/make/[game]/+page.server.ts`, `check/+page.svelte`, `laid-out.ts`, `tests/browser/support/game.ts` and the journeys. #204's H owns `service.ts`, `review-order.ts` and the review route, and A owns `service.ts` and `make/[game]/+page.server.ts`. Y names `age.ts`, the sign-up screens and `/me`, but on B the date flows through `forms.ts` and `pending-sign-up.ts`, the sign-in ask needs the sign-in route, and R3 needs `deletion.ts`.
- EVIDENCE: #195 section 7, Q's row, and #204 section 7, rows H and A.
- EXPECTED: full lists, and "not alongside H or A: whichever starts second waits for the other to merge" on Q+.
- FIX: section 6, both rows rewritten with the full file lists above and the not-alongside line. Only the spec.

### R12. The brief lacks what a staged-path spec holds: boundaries, time, checks, steps and models

- UNIT: section 6. VERDICT: red.
- REQUIREMENT: `staged-path`, "One working brief": "the outcome, the acceptance criteria, the boundaries the owner approves (dependencies, tools, environments, budget, expected duration) and the plan"; each unit row has "its acceptance check"; CLAUDE.md "every session names its model and effort".
- REASON: there is no Boundaries paragraph, no expected time, no Check column, no step-by-step for O, Q+ and Y, and no models. O's merge applies a migration to the test site's database, which needs the Owner's approval as #195's K and #204's D say, but that is not stated.
- EVIDENCE: compare #195 section 7 (Check column, "Expected time", "Boundaries", "Unit K, step by step") and #204 section 7.
- EXPECTED: the same parts as #195 section 7.
- FIX: section 6 adds a Check column (O: the plan audit before; CI green; the implementation audit; the Owner's approval of the merge (the migration). Q+ and Y: CI green; one fresh review; the visual check on the device matrix for the new screens), a "Boundaries" paragraph (no new dependency, tool, environment or spend; one migration, in O; undoing it is a second migration), an expected time per unit, models from Settings, and a step-by-step for O at least (failing pg tests for every CHECK, then the migration with an empty `prisma migrate diff`). Only the spec.

### R13. Accounts that exist before Y never give their birthday

- UNIT: section 5, "Accounts made before this ships". VERDICT: red.
- REQUIREMENT: Owner, 2026-11-19, "Users would also need to add their birthday and location".
- REASON: older accounts are asked for their place at the next sign-in, but not for their birthday, and the spec does not say that `birthDate` may be null.
- EVIDENCE: `prisma/schema/accounts.prisma:31-33` keeps only `adultOn`, so the date cannot be worked out for an existing account. Section 5 says only "have no place; they are asked once".
- EXPECTED: one rule for an account with no `birthDate`.
- FIX: section 4 says `birthDate` is nullable for accounts made before Y. The same one-time screen at sign-in asks the date of birth first, then the place. A date whose 18th birthday does not match the stored `adultOn` is refused with "That isn't the birthday you gave when you joined." Section 8 adds a test. (Branch B's X8 makes every account again after B, so on the test site this covers only accounts made between B and Y.) Only the spec.

## Notes

- **N1. Y lands last in the slice.** Y waits on branch B, and B merges only after the Owner's Twilio Step 1a, which the Owner moved to the slice end (2026-11-17 05:08 UTC). "Fields now" holds for O and Q+. Y's place and birthday reach `main` at the slice end at the earliest. Worth one line in section 6 so nobody expects it sooner.
- **N2. The visitor's place belongs to N.** Section 5's "A visitor with no account ... reads the connection's country and state for that request only" has no user until the feed. Section 6 should say O, Q+ and Y do not build it (CLAUDE.md, "Build nothing ahead of its user").
- **N3. Name the routes the privacy test covers.** "A test per route that returns a person" should list them. Today only `/me` reads the account (`src/routes/me/+page.server.ts:8`, `accountOf`, which returns `email` and `emailVerified`); maker pages and the review command's `look` should be named too.
- **N4. The "anywhere" pick reads long.** "It picks the nearest server by itself, anywhere" may be plainer as "Players anywhere join their nearest server". A copy call for the visual check, not a defect.
- **N5. Two plain-words checks for the place screen:** "Change it" next to "Yes, that's right" is two actions on a screen whose rule is one main action. It holds if "Change it" is visibly quieter (a link, as B's "Text it again" is green and its other actions are not). Say so in section 5.
- **N6. Keep the leak check in every later round.** The fixes for R4 and R8 add public text (the privacy lines and the area table, which are fine in public). How the feed uses an area or a birthday stays in RukenPrivate, and the next audit cycle checks it again against RukenPrivate #15.
