# What a maker tells players about their game

Date: 2026-11-17. Status: the Owner answered its three questions on 2026-11-17 (section 8); written for the plan audit. Nothing here is built. Lane 3 (a migration), so the staged path: this spec and its plan, the plan audit, then the build.

This adds to the game's questions (main design 10.5, the maker screens redesign, and `src/features/games/questions.ts` on `main`), to what staff can send back (main design 11.2), and to the game's page (`2026-11-17-game-page-and-play-shell-design.md`, section 6, "Genre, tags and languages"). Everything else in them stands: one question a screen, the drunk-grandma test, nobody types a fact, and the look of 5.8.

Lines marked **Owner** are the Owner's words or choices. **Call** is this design's choice, which the Owner can overrule.

## 0. The Owner's words

- **Owner, 2026-11-17 06:27 UTC:** "We need to add in the bits to game submission that we don't have like languages and tags/genre, everything steam pages have, we have".
- **Owner, 2026-11-17 06:25 UTC:** "All games must be playable on computer and mobile". So nothing here asks where a game plays or what it needs to run: every game plays on phones and computers (Unit R of `plans/2026-11-15-slice-2-rest.md` takes that question out).
- **Owner, on a card (the game page):** "Now: what Ruken has; rest drawn", and on that page "basically everything steam has, but trimmed". This spec is what makes genre, tags and languages "what Ruken has", so the page shows them.

## 1. A store page, field by field

Every field a store page shows about a game, and what Ruken does with it. **Now** is asked of the maker by this spec. **Have** is on Ruken already. **Measured** is a fact Ruken works out itself, because nobody types a fact. **Later** belongs to another spec. **No** is left out, with the reason.

| A store page's field | Ruken | Where |
|---|---|---|
| Name | Have: the name question | |
| Short description | Have: the one line | |
| About this game (the long text) | Now (**Owner**): up to 280 characters, a tweet's length, optional | 2.1 |
| Trailer and videos | Have: the upright and wide videos | |
| Screenshots | No (**Owner**, on a card: "No, the two videos are enough") | |
| Genre | Now: one kind, from a short list | 2.2 |
| Tags | Now: up to 5, from a fixed list | 2.3 |
| Languages (interface, audio, subtitles) | Now: one list of the languages its words are in; spoken words with subtitles is one of "good to know" | 2.4, 2.6 |
| Single-player, multiplayer, co-op, online | Now: how many people play at once | 2.5 |
| Controller support | Now: "Works with a game controller too", in "good to know" | 2.6 |
| Accessibility features | Now: one hand, needs sound, subtitles, flashing lights, in "good to know" | 2.6 |
| AI content disclosure | No (**Owner**, on a card: "Don't ask") | |
| Release date | Measured (Call): the day staff first said yes, "On Ruken since 17 November 2026." Nobody types it | 3 |
| Developer and publisher | Have: the maker, a person with a page (game page 3.2) | |
| Website and social links | Have, on the maker's own page (the "Linktree" half of Ruken), not on each game | |
| Age rating and content descriptors | Have: who it's for, and an 18+ game's marks | |
| System requirements and platforms | Have: every game plays on phones and computers; the page says "Plays on this phone" (game page 3.1) | |
| Price, DLC | Have: membership; extras are the sales spec's (Later) | |
| Reviews, achievements, wishlist, follow | Later: the apps spec and the wishlist spec (game page section 6) | |
| Early Access | Later: the beta builds spec | |
| Saves in the cloud, family sharing, remote play | No: a game keeps its own saves in the browser, and a game never sees the player's sign-in | |
| In-game purchases | No: a game on Ruken sells nothing by itself; extras go through Ruken (sales spec) | |
| Third-party account, anti-cheat, DRM | No: a game cannot see who is playing, and staff see every other website a game talks to | |
| Franchise, soundtrack, VR, workshop, trading cards, curators, news, community | No: not in Ruken's sentence (main design 2) | |

## 2. The new questions

Each is one screen, in the redesign's question layout (`QuestionScreen`), with the same counter, Back, the card beside it on a wide screen, and Next. Picks use `Picks` as the age and marks questions do. A maker answers in the order below; a game past draft changes any of them from Check and send (and, while live, from Live), as the one line is changed today.

The order, after Unit R: name, line, **about**, files, upright video, wide video, **kind**, **tags**, **languages**, **players**, **good to know**, who it's for, and the marks of an 18+ game. A second game goes from 6 questions to 12 (one more for an 18+ game, as `counterOf` works it out). Call: the facts come after the videos, because a maker who has just watched their own game back answers them quickest, and before the rating, which closes the list as it does today.

### 2.1 About

- **Owner, 2026-11-17, on a card:** "Yes, short", then in words: "However long a single tweet can be for about this game". So 280 characters.

- Heading: "Tell players more about <name>." Hint: "A few sentences. Plain words, no links. Leave it empty if the line says it all." A `TextAnswer` that grows, up to 280 characters; Next with it empty keeps it empty.
- Wrong: "Keep it to 280 characters." A link (anything with `://` or `www.`): "Take the link out. Your links go on your own page."
- Stored as it was typed, its line breaks kept. Empty is an answer ("" once Next is pressed; null until then).

### 2.2 Kind

- Heading: "What kind of game is <name>?" One pick. Hint: "Pick the one that fits best."
- The list, in this order: Action, Adventure, Arcade, Card and board, Music and rhythm, Party, Platformer, Puzzle, Racing, Role-playing, Simulation, Sports, Story, Strategy, Word.
- Wrong: "Choose the kind that fits best."

### 2.3 Tags

- Heading: "What's <name> like?" Several, at least 1, at most 5. Hint: "Pick up to 5. Players find games by these."
- The list, in three groups, each under a small heading:
  - How it feels: Calm, Cozy, Cute, Funny, Spooky, Intense, Moving.
  - How it looks: Pixel art, Hand-drawn, 3D, Retro, Colorful, Simple shapes.
  - How it plays: Endless, Roguelike, Physics, Idle, Building, Exploring, Survival, Tower defense, Sandbox, Hard, Easy to pick up.
- Wrong: "Choose at least one." / "Pick 5 at most."
- Call: a fixed list, not words the maker types. Free tags would need staff to read every one and would split one idea into many spellings. Nothing here repeats a fact Ruken measures (no "short" tag: the sitting length is measured) or another question (no "multiplayer" or "controller" tag).

### 2.4 Languages

- Heading: "What languages can people play <name> in?" Several, at least 1. Hint: "Pick every language its words are in."
- The list: It has no words (first, apart), then English, Spanish, Portuguese (Brazil), French, German, Italian, Dutch, Polish, Russian, Ukrainian, Turkish, Arabic, Hindi, Indonesian, Thai, Vietnamese, Japanese, Korean, Chinese (Simplified), Chinese (Traditional).
- "It has no words" with a language is refused: "Choose It has no words, or the languages. Not both." None chosen: "Choose at least one, or It has no words."
- Stored as language codes (`en`, `es`, `pt-BR`, `fr`, `de`, `it`, `nl`, `pl`, `ru`, `uk`, `tr`, `ar`, `hi`, `id`, `th`, `vi`, `ja`, `ko`, `zh-Hans`, `zh-Hant`) and `none`.
- Call: one list. A store page splits words on screen, spoken words and subtitles into three columns; on a phone that is a table nobody reads. Spoken words with subtitles is one line in "good to know".

### 2.5 Players

- Heading: "How many people play <name> at once?" Several, at least 1. Hint: "Pick every way it can be played."
- The picks: "One person", "Two or more, on one phone or computer", "Two or more, online".
- Wrong: "Choose at least one."
- Online play needs the game to talk to other websites. Staff check that when they play it; nothing here refuses the pick.

### 2.6 Good to know

- Heading: "Anything players should know about <name>?" Several, at least 1. Hint: "Players see these on the game's page."
- The picks, in this order: "Works with a game controller too", "Can be played with one hand", "Needs sound to play", "Spoken words have subtitles", "Has flashing lights", and "None of these" (apart, last; with any other pick it is refused as the marks question refuses it).
- Wrong: "Choose at least one, or None of these."


## 3. Storage

One migration, made by `pnpm prisma migrate dev --create-only` and read before it is kept, adds to `Game`:

| Column | Type | Empty means |
|---|---|---|
| `about` | `TEXT`, null | null: not asked yet; "": answered empty |
| `kind` | `TEXT`, null | not asked yet |
| `tags` | `TEXT[]`, default `{}` | not asked yet |
| `languages` | `TEXT[]`, default `{}` | not asked yet; `{none}` is "It has no words" |
| `players` | `GamePlayers[]`, default `{}` (enum `alone`, `one_device`, `online`) | not asked yet |
| `goodToKnow` | `GameNote[]`, default `{}` (enum `controller`, `one_hand`, `needs_sound`, `subtitles`, `flashing_lights`, `none`) | not asked yet |
| `firstLiveAt` | `TIMESTAMPTZ`, null | never live yet |

and to the enum `GamePart` the values `about`, `kind`, `tags`, `languages`, `players` and `good_to_know`.

- **Lists that grow are text, lists that don't are enums.** Kind, tags and languages are codes from `src/features/games/library/kinds.json`, `tags.json` and `languages.json` (each entry: its code and the words a person reads), checked by the games service, so a new tag or language is a change to a file, not a migration. Players and good to know are short fixed sets, so they are enums, as `ContentMark` is. Call.
- **CHECKs**, each named and listed in the model's `///` line as the others are: `Game_about_check` (`char_length(about) <= 280`), `Game_tags_check` (`cardinality(tags) <= 5`), and `Game_languages_check` and `Game_goodToKnow_check` (`none` only alone, as `Game_marks_check` does for the marks).
- **`Game_answered_check` is not changed.** Games already past draft on the test site have none of the new answers, so a check that needs them would fail the migration, and a `NOT VALID` one would refuse every later write to those games (taking one off included). Sending for review already asks for every unanswered question first (`firstUnanswered`), so no new game reaches review without them. Call.
- **`firstLiveAt`** is written once, in the same write that first makes a game live (staff's yes, Unit S's review job), and never changed; a game taken off and put back keeps it. Games already live keep null and show no date. Call: no backfill, since the test site's games are test data.
- **Undoing it** is a second migration that drops the columns, not a revert. Postgres cannot drop a value from an enum, so the new `GamePart` values stay unused if it is undone.
- Merging applies the migration to the test site's database: the deploy command runs `prisma migrate deploy` first on every merge to `main` (`package.json`, `deploy`). That is what the Owner's lane 3 approval of Unit K is for.

## 4. Send back, and changing a live game

Each new question is its own part, so staff can send back just that answer, and the maker fixes it on that one question (main design 11.2). The words staff choose from and the words the maker reads go in `library/send-back-reasons.json`, beside Something else, as every part has:

| Part | Staff read | The maker reads |
|---|---|---|
| `about` | It's rude. | We can't show this on Ruken. It's rude. Write it again. |
| `about` | It's not about this game. | What you wrote isn't about your game. Say what {name} is. |
| `about` | It has links or ads. | Take the links and ads out of what you wrote about {name}. |
| `kind` | It's not that kind of game. | {name} doesn't look like that kind of game to us. Pick the one that fits best. |
| `tags` | Some don't fit the game. | Some of what you picked doesn't fit {name}. Pick only what does. |
| `languages` | It isn't in every language picked. | We couldn't find every language you picked in {name}. Pick only the ones it's in. |
| `players` | It doesn't play that way. | {name} doesn't play the way you said. Pick how it really plays. |
| `good_to_know` | It has flashing lights. | {name} has flashing lights. Say so, so players know. |
| `good_to_know` | Something picked isn't true. | Something you picked isn't true of {name}. Pick only what is. |

- Their card titles (`partTitle`): "About", "Kind", "Tags", "Languages", "Players", "Good to know". Their buttons (`partNoun`): "Fix what you wrote about it", "Fix the kind", "Fix the tags", "Fix the languages", "Fix how many play", "Fix what's good to know".
- A live game may change every new answer by itself, and staff may send back any of them on a live game (both lists in `service.ts` gain them), as they can the name and the line: they are words about the game, so a wrong one is fixed without taking the game down.
- The review command (Unit S's `review-order.ts`) takes the new parts by the same names, and its refusal's list of parts names them.

## 5. Where the maker sees them

- **Check and send** lists every answer, in question order, each with its Change link, as it lists the name and line today: "Puzzle" / "Calm, Pixel art, Endless" / "In English and Spanish" / "Play alone or online" / "Works with a game controller too. Has flashing lights." / the About text, cut to two lines. One not answered yet (an older game) reads "Not answered yet" in sage, its link "Answer".
- **Live** and **Sent back** show the same lines under the game laid out (`GameLaidOut`), each with its Change link.
- A live game made before this spec has no new answers. Its Live screen shows each as "Not answered yet" with "Answer"; nothing else nags, and the page leaves those lines out until they are answered.

## 6. Where players see them (the game's page)

On the paper card of play facts (game page 3.1 and 3.3), under the device line and the sitting line, each its own line, in this order. A line whose answer is missing is not drawn.

1. The kind and tags: "Puzzle · Calm · Pixel art · Endless".
2. Languages: "In English." / "In English and Spanish." / "In English, Spanish and French." (every one named; "and" before the last) / "No words to read."
3. Players: "Play alone." / "Play alone or together on one device." / "Play alone, together on one device, or online." (the picks in list order: "alone", "together on one device", "online").
4. Good to know, one short line each: "Works with a game controller too." / "Can be played with one hand." / "Needs sound." / "Spoken words have subtitles." / "Has flashing lights." "None of these" draws nothing.
5. The date: "On Ruken since 17 November 2026." (America/Chicago, the day only).

**About <name>**, as a watch page's description: under the paper card on a phone, in the left column under the card on a wide screen; the heading "About Floor Fifty" at the card title size, then the text in ink, line breaks kept, plain text only (escaped, never HTML). Over 4 lines on a phone, it shows 4 and "More" (a `<details>`, so it works with no script).

All the words are made by pure functions with tests, beside `ratingWords` in `src/features/games/laid-out.ts`: `kindWords`, `languagesWords`, `playersWords`, `goodToKnowWords`, `sinceWords`.

## 7. The plan: units, lanes and order

These units add to the units of `plans/2026-11-15-slice-2-rest.md` and go after them. Each unit is one session and one pull request, on the branch its session is given, from a `main` that holds what it waits on.

| Unit | Lane | Waits on | Owns | Output | Check |
|---|---|---|---|---|---|
| K, the facts stored | **3** (`prisma/schema/`, `prisma/migrations/`) | this spec's plan audit; R and F on `main` (both change `service.ts`, `laid-out.ts`); not alongside P (both change `games.prisma` and add a migration: whichever starts second waits for the other to merge) | `prisma/schema/games.prisma`, the migration, `library/kinds.json`, `tags.json`, `languages.json`, `src/features/games/fields.ts` (the checks), `laid-out.ts` (the words), `service.ts` (the answers and reads, `firstLiveAt` on the first yes) and their tests | the columns, the checks, the words; no screen asks yet | the plan audit before; CI green on a ready pull request; the implementation audit; the Owner's approval of the merge (the migration) |
| Q, the maker is asked | **2** (`src/features/games/`, shared by the maker's screens) | K on `main` | `questions.ts`, `src/params/question.ts`, `send-back.ts`, `library/send-back-reasons.json`, `review-order.ts`, `service.ts` (the two live lists), the question route and its screens, Check and send, `GameLaidOut`, `LiveScreen`, `SentBackScreen`, `tests/browser/support/game.ts` and `database.ts` (`answerEveryQuestion`, `fillAnswers`), and the journeys that walk the questions | the new questions, their send backs and Change links | CI green on a ready pull request; one fresh review; the visual check on the five devices |
| V, players see them | **2** (the game page's server and `look.css`) | Q on `main` (and F) | `src/routes/g/[game]/+page.server.ts` and `+page.svelte`, `src/lib/look.css` if a class is new, and their tests | the facts and About on `/g/<game>` | the same as Q |

Why these lanes: K is the only unit with a migration, so it alone carries lane 3's audits and the Owner's approval; it adds nothing a maker or player sees, so merging it alone changes no screen. Q makes the questions real only once their storage is on `main`, so a draft never reaches a question that cannot be saved. V waits on Q so the page never shows a fact no maker can give.

Expected time: K 4 hours, Q 6 hours, V 3 hours, plus the audits. Models and effort as Settings in `CLAUDE.md` names them (execution against a spec: Sonnet 5.5, medium; K's audits: Opus 5.5, medium).

**Boundaries.** No new dependency, tool, environment or spend. One migration, in K. The test site's database is changed only by K's merge. Nothing runs on the Owner's computer, and the Owner has no steps of their own here.

### Unit K, step by step

- [ ] **Step 1: the failing tests.** `fields.test.ts`: every check of section 2 refuses with its words and passes a good answer (a kind not in the list, a sixth tag, `none` with a language, a link in About, 281 characters). `laid-out.test.ts`: every line of section 6 from its answers, a missing answer giving null. `service.pg.test.ts`: each new answer is saved by its maker, refused for anyone else, and refused with its words when wrong; a live game takes each; the first yes writes `firstLiveAt` and a second yes after take off and put back leaves it. A `pg` test for each CHECK: a write that breaks it is refused by the database. Run them: they fail for those reasons.
- [ ] **Step 2: the columns, the migration, the lists, the checks, the words and the answers.** Paste the empty output of `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --shadow-database-url "$TEST_DATABASE_URL" --script` into the pull request. The migration opens with a comment line, as every other one does, and holds only section 3. Run again: pass. Open the draft pull request; it names the migration, says merging applies it to the test site's database, and says undoing it is a second migration.
- [ ] **Step 3: finish.** The implementation audit on the commit named; fix its findings; the Owner's approval of this merge. Delete the live-state file in the last commit, merge `main` in, mark the pull request ready, merge on green with a merge commit.

### Unit Q, step by step

- [ ] **Step 1: the failing tests.** `questions.test.ts`: the new order and counts (section 2). `params/question.test.ts`: the new addresses are questions. `send-back.test.ts`: each new part's reasons, title and noun (section 4). `review-order.test.ts`: the new parts are taken. `service.pg.test.ts`: staff can send back each new part on a live game. A journey, `make-facts.test.ts`: a maker answers each new question with the keyboard, sees each refusal's words, sees the answers on Check and send, and changes one from there; a game made before (`fillAnswers` without the new answers) shows "Not answered yet" on Live and can answer it.
- [ ] **Step 2: the questions, the parts and the screens.** Change the journeys that walk the questions only where they answer them or read a counter; nothing is loosened. Run every file named, the browser files on `computer`, `phone` and `tablet`: pass. Open the draft pull request.
- [ ] **Step 3: finish.** The visual check on the five devices for each new question, Check and send, Live and Sent back (approved maker screens whose approval ends with this change; the pull request names them for the screens page). The fresh lane 2 review; fix its findings. Delete the live-state file, merge `main` in, mark ready, merge on green.

### Unit V, step by step

- [ ] **Step 1: the failing tests.** The game page's journey: a game with every answer shows each line of section 6 in order, and About with "More" on a phone; a game with none of them shows none of those lines and no About; About's text with `<b>` in it shows the angle brackets as text.
- [ ] **Step 2: the lines and About.** Run again on `computer`, `phone` and `tablet`: pass. Open the draft pull request.
- [ ] **Step 3: finish.** The visual check on the five devices; the fresh lane 2 review; fix; delete the live-state file, merge `main` in, mark ready, merge on green.

## 8. Decisions

1. **Settled, Owner 2026-11-17:** a longer About, optional, up to 280 characters ("However long a single tweet can be").
2. **Settled, Owner 2026-11-17, on a card:** makers are not asked whether AI helped ("Don't ask"), and nothing about AI is on the page.
3. **Settled, Owner 2026-11-17, on a card:** no screenshots ("No, the two videos are enough").
4. **Calls** the Owner may overrule: the lists in 2.2 to 2.6, the question order, one language list instead of three, the date measured from the first yes, `Game_answered_check` left as it is.

## 9. Acceptance criteria

- A new game is asked kind, tags, languages, players and good to know and About, one per screen, in section 2's order, with section 2's words; the counter counts them.
- Each refusal in section 2 shows its words on its own question, and nothing is saved.
- A game cannot be sent for review until every new question is answered (`firstUnanswered`).
- Each answer is stored as section 3 says; each CHECK refuses a write that breaks it, by the database itself.
- Staff can send back each new part, with section 4's reasons; the maker reads section 4's words and fixes it on that question; a live game stays live while it is fixed.
- A live game's maker can change each new answer from Live; a game made before this spec shows "Not answered yet" for each and can answer it.
- The game's page shows section 6's lines in order, only for answers that exist, and About as plain text with line breaks; "None of these" draws nothing.
- `firstLiveAt` is set by the first yes and never changed.
- Everything works by keyboard alone with focus visible, nothing scrolls sideways, every target is at least 44 by 44, and each new screen passes the visual check on the five devices.
- The words in this file are the words shipped.
