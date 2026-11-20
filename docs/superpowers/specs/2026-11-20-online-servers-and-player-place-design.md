# Online servers, and a player's birthday and place

Date: 2026-11-20. Status: the Owner answered its three questions on 2026-11-20 (section 7); written for the lane 3 plan audit. Nothing here is built. Lane 3 (a migration), so the staged path.

## 1. What the Owner asked

- **Owner, 2026-11-19:** "I'd like to add an additional field to the maker pages that impact algorithm. Check if the game is multiplayer, and if it is, where the [servers are]... games with nearby server locations are prioritized, I think a few additional things will need to be added to compensate for that, but we can run through that when we get there".
- **Owner, 2026-11-19:** "Users would also need to add their birthday and location".

How the feed weighs any of this is not written here. RukenApp is public, and the feed's rules and numbers are kept privately, as the Owner asked on 2026-11-15. This spec covers only what makers and players are asked, what is stored, and who can see it.

## 2. What is already there

- **Multiplayer.** The game facts spec (`2026-11-17-game-facts-design.md`, pull request #195, not merged) asks "How many people play <name> at once?" with the picks "One person", "Two or more, on one phone or computer" and "Two or more, online". "Online" is multiplayer with servers, so this spec adds one question after it and no new multiplayer question.
- **Birthday.** Sign-up asks for the date of birth, keeps only the date of the 18th birthday (`User.adultOn`), and says "We don't keep your birthday" (`src/routes/sign-up/+page.svelte`, `src/features/accounts/age.ts`). Nothing about an under-13 visitor is stored.
- **Place.** Nothing about where a player is is stored today.

## 3. The maker's new question: where the servers are

- **When.** Straight after the players question, and only when "Two or more, online" is among the picks. Taking that pick away clears this answer. A game without it is never asked and stores nothing.
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
  - "It picks the nearest server by itself, anywhere" (apart, last; with any other pick it is refused, the way "None of these" is refused in good to know)
- **Wrong:** "Choose at least one."
- **Send-back.** Staff can send this answer back like the other answers (main design 11.2), with the reason "The servers you picked don't match what we saw".
- **Changing it on a live game** follows whatever #195 settles for its other answers.

## 4. The player's birthday

- **Owner, 2026-11-20 00:17 UTC, on a card:** "Keep the full date", the one already typed at sign-up. No new question.
- Stored as `User.birthDate` (a calendar day). `adultOn` is still worked out from it as today, so every age rule keeps working.
- Under 13: still refused, and still nothing stored.
- Sign-up's line changes from "We don't keep your birthday." to "We keep your birthday private. Nobody else sees it."
- Nobody but the player sees it. It is never on a page, a clip or a maker's numbers.

## 5. The player's place

- **Owner, 2026-11-20 00:16 UTC, on a card:** "Country and state, filled in".
- **Sign-up gets one screen** after the birthday: "Where do you live?" The country and state are filled in from where the connection comes from (Cloudflare's `request.cf.country` and `request.cf.regionCode`, measured, not typed), with "Yes, that's right" as the big button and "Change it" beside it. "Change it" opens a country list and, for countries split into states or provinces, a second list.
- **Stored:** `User.country` (two letters, ISO 3166-1) and `User.region` (ISO 3166-2, empty where the country is not split). No city, no street, no coordinates.
- **Changing it:** the player's own page (`/me`) shows "You live in: Ohio, United States" with Change.
- **A visitor with no account** is never asked. Where Ruken needs a place for them, it reads the connection's country and state for that request only and stores nothing.
- **From place to server area:** a pure function `areaOf(country, region)` gives one of the section 3 areas. The US and Canada are split east and west by state and province. The table is plain geography and lives in the public code; what the feed does with the area is private.
- **Accounts made before this ships** have no place; they are asked once, on their next sign-in, with the same screen.

## 6. Units

| Unit | Waits on | Owns | Output | Lane |
|---|---|---|---|---|
| O | #195's K, and D (decision day, #204), both merged | its own migration (`games.prisma`, `accounts.prisma`) | `Game.serverAreas` (a list of the section 3 areas), `User.birthDate`, `User.country`, `User.region` | 3 |
| Q+ | O, #195's Q | `src/features/games/questions.ts` and its screen | the servers question and its send-back | 2 |
| Y | O, branch B (phone sign-up) merged | `src/features/accounts/age.ts`, the sign-up screens, `/me` | birthday kept, the place screen, the sign-in ask for older accounts | 2 |
| N | the feed (slice 3) | private | nearby servers in the feed's order | slice 3 |

Call: O is its own migration, not folded into #195's K, so K's plan audit stays settled; it waits on K and on D (#204) because all three touch `games.prisma`. #195 leaves room for the servers question right after "Two or more, online". **Owner, 2026-11-20 00:17 UTC, on a card:** "Fields now, ranking with the feed": O, Q+ and Y are built in slice 2; N waits for the feed in slice 3.

## 7. The Owner's questions

1. How exact a player's place is. **Answered** 2026-11-20 00:16 UTC: country and state, filled in.
2. Keep the whole birthday. **Answered** 2026-11-20 00:17 UTC: keep the full date.
3. When to build. **Answered** 2026-11-20 00:17 UTC: the questions and fields now; the ranking with the feed in slice 3.

Further questions on what goes with nearby-server ranking (the "additional things to compensate") are kept with the feed's private design, because they are about how the feed weighs games.

Questions that are not about the feed, for later:

- Should a game's page say where its servers are, such as "Servers in Western Europe and Eastern US and Canada"? Not built unless the Owner says so.
- Should a player far from every server of an online game see a plain warning before Play, such as "This game may be slow where you are"? Not built unless the Owner says so.

## 8. Acceptance criteria

- A maker who picks "Two or more, online" gets the servers question next; one who does not never sees it, and its answer is empty.
- Taking away "Two or more, online" clears the servers answer.
- "It picks the nearest server by itself, anywhere" with any other pick is refused with the words in section 3.
- Sign-up keeps the birthday; `adultOn` matches what it is today for the same dates (an old-versus-new test over many dates from a fixed seed, 29 February included).
- An under-13 sign-up stores nothing, as today.
- The place screen is filled in from the connection; "Yes, that's right" stores exactly what it showed; "Change it" stores what was picked.
- `areaOf` gives an area for every country in the list, and the right side for every US state and Canadian province (a table test).
- Nobody but the player can read their birthday or place: no page, API or maker screen returns them (a test per route that returns a person).
- Every new screen works with the keyboard alone, with focus visible, on the small phone, tablet and computer profiles, and passes the drunk-grandma test.
