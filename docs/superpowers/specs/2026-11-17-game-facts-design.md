# What a maker tells players about their game

Date: 2026-11-17. Status: the Owner answered its three questions on 2026-11-17 (section 8); written for the plan audit. Nothing here is built. Lane 3 (a migration), so the staged path: this spec and its plan, the plan audit, then the build.

This adds to the game's questions (main design 10.5, the maker screens redesign, and `src/features/games/questions.ts` on `main`), to what staff can send back (main design 11.2), and to the game's page (`2026-11-17-game-page-and-play-shell-design.md`, section 6, "Genre, tags and languages"). Everything else in them stands: one question a screen, the drunk-grandma test, nobody types a fact, and the look of 5.8.

Lines marked **Owner** are the Owner's words or choices. **Call** is this design's choice, which the Owner can overrule.

## 0. The Owner's words

- **Owner, 2026-11-17 06:27 UTC:** "We need to add in the bits to game submission that we don't have like languages and tags/genre, everything steam pages have, we have".
- **Owner, 2026-11-17 06:25 UTC:** "All games must be playable on computer and mobile". So nothing here asks where a game plays or what it needs to run: every game plays on phones and computers (Unit R of `plans/2026-11-15-slice-2-rest.md` takes that question out).
- **Owner, 2026-11-17 06:37 UTC:** "Video can only be at most 60 seconds long too, minimum 15 seconds". Both of a game's videos, the upright and the wide, are 15 to 60 seconds long (2.7).
- **Owner, 2026-11-17 06:39 UTC:** "Actually scratch that, minimum 3 screenshots, Max 10 are required, carousel style; some people may use videos that are more traditional ads where gameplay isn't shown very heavily, that should be allowed and screenshots can show the game more directly". Then: "Screenshots have to be handled directly; yes" (the "yes" keeps the 15 to 60 seconds). This replaces the card's "No, the two videos are enough" (2.8).
- **Owner, 2026-11-17 06:40 UTC:** "They can upload up to 5 vertical videos, 5 horizontal and they'll be rotated on the feed" (2.9).
- **Owner, on a card (the game page):** "Now: what Ruken has; rest drawn", and on that page "basically everything steam has, but trimmed". This spec is what makes genre, tags and languages "what Ruken has", so the page shows them.

## 1. A store page, field by field

Every field a store page shows about a game, and what Ruken does with it. **Now** is asked of the maker by this spec. **Have** is on Ruken already. **Measured** is a fact Ruken works out itself, because nobody types a fact. **Later** belongs to another spec. **No** is left out, with the reason.

| A store page's field | Ruken | Where |
|---|---|---|
| Name | Have: the name question | |
| Short description | Have: the one line | |
| About this game (the long text) | Now (**Owner**): up to 280 characters, a tweet's length, optional | 2.1 |
| Trailer and videos | Have: one upright and one wide video. Now (**Owner**): up to 5 of each, each 15 to 60 seconds long; the feed takes turns between them | 2.7, 2.9 |
| Screenshots | Now (**Owner**): 3 to 10, required, shown as a carousel with the videos | 2.8 |
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

The order, after Unit R: name, line, **about**, files, upright videos, wide videos, **screenshots**, **kind**, **tags**, **languages**, **players**, **good to know**, who it's for, and the marks of an 18+ game. A second game goes from 6 questions to 13 (one more for an 18+ game, as `counterOf` works it out). Call: the screenshots come straight after the videos, so the pictures are made together, and the facts after them, because a maker who has just watched their own game back answers them quickest, and before the rating, which closes the list as it does today.

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


### 2.7 How long a video is

**Owner, 2026-11-17 06:37 UTC:** "Video can only be at most 60 seconds long too, minimum 15 seconds". This is a rule on the two video questions that are on `main` already, not a new question.

- **The hint** on both video questions changes from "Record your screen while you play for 10 to 30 seconds." to "Record your screen while you play for 15 to 60 seconds."
- **Measured, never typed.** The server reads the length from the file itself, before it is saved: an MP4 or MOV from its `mvhd` box (duration ÷ timescale), a WebM from its Segment Info (`Duration` × `TimecodeScale`). A pure function in `src/features/games/clips.ts`, `clipSeconds(bytes, contentType): number | null`, with tests on real small files of each kind kept in `tests/fixtures/`. No new dependency.
- **The rule:** from 15.0 to 60.0 seconds, both ends allowed, measured to the tenth of a second.
- **The browser checks first,** to save a 30 MB trip, from the chosen file's `<video>` metadata (`src/lib/video-choice.ts`, beside the size check). The server checks again whatever the browser said.
- **The words**, on the video question, in the order `clipProblem` already uses (the kind, the size, the file's first bytes, then the length):
  - Too short: "That video is 9 seconds. Videos need to be 15 to 60 seconds long. Record a little more, then choose it again."
  - Too long: "That video is 1 minute 24 seconds. Videos can be up to 60 seconds. Trim it, then choose it again."
  - Length not in the file: "We couldn't tell how long that video is. Save it as MP4 and choose it again." Call: a WebM recorded in a browser often carries no length, and the length is never taken from what the browser says, so such a file is refused with a way through.
- **Videos already saved** are not checked again. Call: the test site's games are test data, and a live game's video is changed only by its maker. The rule applies to every new video, a live game's replacement included.
- Nothing is stored: the length is checked, not kept. No migration.

### 2.8 Screenshots

**Owner, 2026-11-17 06:39 UTC:** at least 3 and at most 10, required, carousel style. A video may be an ad that shows little of the game; the screenshots show the game itself. "Screenshots have to be handled directly": read here as both things this design does, that the pictures are uploaded to Ruken itself (never a link to somewhere else) and that they show the game being played, which staff check.

- **The question.** Heading: "Add pictures of <name> being played." Hint: "3 to 10 screenshots. Show the game itself: players look through them before they play." One question screen for all of them, after the wide videos.
- **Adding.** "Add pictures" chooses one or more files at once (`<input type="file" multiple accept="image/png,image/jpeg,image/webp">`); the screen sends them one request each, in the order chosen, as the video question sends a video, and each shows as a tile when it is saved. With no script, one file per press, the page reloading after each.
- **The tiles.** In the order added; the first is shown first wherever they are shown. Each tile has "Take this one out" (a quiet outline under it, at least 44 by 44). Call: no reordering in this spec; a maker who wants another first takes pictures out and adds them again.
- **The count.** Next with fewer than 3: "Add at least 3 pictures. You have 1." Adding past 10: "You have 10 pictures, the most a game can have. Take one out to add another."
- **Each picture.** PNG, JPEG or WebP, up to 5 MB; its width and height are read from the file itself (PNG's `IHDR`, JPEG's start-of-frame, WebP's `VP8`/`VP8L`/`VP8X` header), never from what the browser says, and its shorter side is at least 640 pixels. Any shape. The words, the first thing wrong winning:
  - "Ruken takes PNG, JPEG or WebP pictures."
  - "That picture is 7 MB. Pictures can be up to 5 MB. Save it smaller, then add it again."
  - "That file doesn't look like a picture. Save it as PNG or JPEG and add it again." (its first bytes are checked, as a video's are)
  - "That picture is too small to see well. Use one at least 640 pixels on its shorter side."
- Stored in the bucket at `shots/<publicId>/<16 hex>.<png|jpg|webp>`, served from the media address the way a video is, and thrown away with the game's files when a game is thrown away (as `clips/` is).

### 2.9 Up to 5 videos of each shape

**Owner, 2026-11-17 06:40 UTC:** "They can upload up to 5 vertical videos, 5 horizontal and they'll be rotated on the feed".

- The upright and wide video questions each hold 1 to 5 videos. Each question still needs one to go on; the screen shows the saved ones as tiles in the order added, each with "Take this one out" (not shown on the last one of its shape: a game always has at least one of each), and "Add another video" until there are 5. Adding a sixth: "You have 5 upright videos, the most a game can have. Take one out to add another." (or "wide").
- Each video keeps 2.7's rule (15 to 60 seconds) and today's (type, 30 MB, first bytes).
- Hint, under the existing one: "Add up to 5. The feed takes turns showing them."
- **Why, Owner 2026-11-17 06:43 UTC:** "The video rotation is so the same game can appear more than once on a feed without users seeing the same video, it creates a trial reels like effect without using trial reels", and "A player might not have been interested in one video, but they see it again, a different video this time maybe a cutscene and now they're interested".
- **The feed's turns** are the feed's own (slice 3), kept here for its spec: the same game may come round again in a person's feed, and each time it shows one of its videos of the window's shape that this person has not seen yet, so a second look is a new video. Nothing in this spec builds or stores the turns.

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

and to the enum `GamePart` the values `about`, `screenshots`, `kind`, `tags`, `languages`, `players` and `good_to_know`.

The same migration:

- **A new table, `GameShot`**: `id`, `gameId`, `key` (unique), `contentType`, `bytes`, `width`, `height` (all measured, 2.8), `position` (0 first), `createdAt`; `@@unique([gameId, position])`; a CHECK that `width` and `height` are at least 1, and `bytes` at most 5,000,000. Taking one out renumbers the rest in the same transaction. At most 10 a game, held by the service (a row CHECK cannot count rows).
- **`GameClip` holds up to 5 of a shape.** It gains `position Int` (0 first; every existing row gets 0), and its `@@unique([gameId, shape])` becomes `@@unique([gameId, shape, position])`. At most 5 a shape, held by the service. The code that reads "the" upright or wide clip (the maker's screens, the review job, and F's game page) reads the first by position.
- **`GamePart`'s `upright_video` and `wide_video`** now mean every video of that shape, so staff send back the videos of a shape together, and the maker fixes them on that question.

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
| `screenshots` | They don't show the game. | Your pictures need to show {name} being played. Add pictures of the game itself. |
| `screenshots` | Something in them isn't allowed. | Something in your pictures isn't allowed on Ruken. Take it out and add another. |
| `players` | It doesn't play that way. | {name} doesn't play the way you said. Pick how it really plays. |
| `good_to_know` | It has flashing lights. | {name} has flashing lights. Say so, so players know. |
| `good_to_know` | Something picked isn't true. | Something you picked isn't true of {name}. Pick only what is. |

- Their card titles (`partTitle`): "About", "Screenshots", "Kind", "Tags", "Languages", "Players", "Good to know". Their buttons (`partNoun`): "Fix what you wrote about it", "Fix the pictures", "Fix the kind", "Fix the tags", "Fix the languages", "Fix how many play", "Fix what's good to know".
- A live game may change every new answer by itself, and staff may send back any of them on a live game (both lists in `service.ts` gain them), as they can the name and the line: they are words about the game, so a wrong one is fixed without taking the game down.
- The review command (Unit S's `review-order.ts`) takes the new parts by the same names, and its refusal's list of parts names them.

## 5. Where the maker sees them

- **Check and send** shows the screenshots as a row of small tiles with "Change", and the videos as today (each shape's first, with "3 upright videos" under it when there are more). It lists every other answer, in question order, each with its Change link, as it lists the name and line today: "Puzzle" / "Calm, Pixel art, Endless" / "In English and Spanish" / "Play alone or online" / "Works with a game controller too. Has flashing lights." / the About text, cut to two lines. One not answered yet (an older game) reads "Not answered yet" in sage, its link "Answer".
- **Live** and **Sent back** show the same lines under the game laid out (`GameLaidOut`), each with its Change link.
- A live game made before this spec has no new answers. Its Live screen shows each as "Not answered yet" with "Answer"; nothing else nags, and the page leaves those lines out until they are answered.

## 6. Where players see them (the game's page)

**The pictures and videos, carousel style** (Owner, 2.8). This amends the game page spec's 3.1 "the clip" and its two tiles. The big box at the top shows one thing at a time; under it, a strip of small tiles holds every video (the window's shape first, then the other shape) and then every screenshot, in their order. The box starts on the first video of the window's shape, playing as 3.1 says. Pressing a tile shows it in the box; "Previous" and "Next" buttons on the box's sides (44 by 44, quiet, with their names for a screen reader) step through them all; a swipe on the box does the same on touch; with the box focused, the left and right arrow keys do. The strip scrolls sideways inside itself, never the page; the tile showing has the blue edge of a picked choice. A picture in the box is shown whole (fitted, its own shape, the blurred ground either side), and pressing it opens it full size, as a video does. With no script, the box shows the first video and the strip's tiles are links that open each one full size. With reduced motion nothing slides. Each tile's name: "Watch upright video 2", "Watch wide video 1", "See picture 3 of 7".


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
| K, the facts stored | **3** (`prisma/schema/`, `prisma/migrations/`) | this spec's plan audit; R, F and L on `main` (both change `service.ts`, `laid-out.ts`); not alongside P (both change `games.prisma` and add a migration: whichever starts second waits for the other to merge) | `prisma/schema/games.prisma`, the migration, `library/kinds.json`, `tags.json`, `languages.json`, `src/features/games/fields.ts` (the checks), `laid-out.ts` (the words), `service.ts` (the answers and reads, `firstLiveAt` on the first yes, adding and taking out screenshots and videos by position), `src/features/games/shots.ts` (a picture's checks and measured size, beside `clips.ts`), every reader of "the" clip moved to the first by position, and their tests | the columns, the table, the checks, the words; no screen asks yet, and every screen still shows one video of each shape | the plan audit before; CI green on a ready pull request; the implementation audit; the Owner's approval of the merge (the migration) |
| Q, the maker is asked | **2** (`src/features/games/`, shared by the maker's screens) | K and L on `main` | `questions.ts`, `src/params/question.ts`, `send-back.ts`, `library/send-back-reasons.json`, `review-order.ts`, `service.ts` (the two live lists), the question route and its screens (the screenshots question, and the video questions holding up to 5), Check and send, `GameLaidOut`, `LiveScreen`, `SentBackScreen`, `tests/browser/support/game.ts` and `database.ts` (`answerEveryQuestion`, `fillAnswers`), and the journeys that walk the questions | the new questions, their send backs and Change links | CI green on a ready pull request; one fresh review; the visual check on the five devices |
| L, how long a video is | **2** (`src/lib/video-choice.ts`, `tests/fixtures/`, and `clips.ts`, which the games service uses) | R on `main` (both change `VideoQuestion.svelte`); it does not wait on K, Q or V | `clips.ts`, `src/lib/video-choice.ts`, `VideoQuestion.svelte`, the fixtures and their tests | 2.7 | CI green on a ready pull request; one fresh review; the visual check on the five devices for the two video questions |
| V, players see them | **2** (the game page's server and `look.css`) | Q on `main` (and F) | `src/routes/g/[game]/+page.server.ts` and `+page.svelte`, `src/lib/look.css` if a class is new, and their tests | the carousel, the facts and About on `/g/<game>` | the same as Q |

Why these lanes: K is the only unit with a migration, so it alone carries lane 3's audits and the Owner's approval; it adds nothing a maker or player sees, so merging it alone changes no screen. Q makes the questions real only once their storage is on `main`, so a draft never reaches a question that cannot be saved. V waits on Q so the page never shows a fact no maker can give.

Expected time: L 3 hours, K 6 hours, Q 9 hours, V 5 hours, plus the audits. Models and effort as Settings in `CLAUDE.md` names them (execution against a spec: Sonnet 5.5, medium; K's audits: Opus 5.5, medium).

**Boundaries.** No new dependency, tool, environment or spend. One migration, in K. The test site's database is changed only by K's merge. Nothing runs on the Owner's computer, and the Owner has no steps of their own here.

### Unit K, step by step

- [ ] **Step 1: the failing tests.** `fields.test.ts`: every check of section 2 refuses with its words and passes a good answer (a kind not in the list, a sixth tag, `none` with a language, a link in About, 281 characters). `laid-out.test.ts`: every line of section 6 from its answers, a missing answer giving null. `service.pg.test.ts`: each new answer is saved by its maker, refused for anyone else, and refused with its words when wrong; a live game takes each; the first yes writes `firstLiveAt` and a second yes after take off and put back leaves it. `shots.test.ts`: the width and height of a small PNG, JPEG and WebP fixture (`tests/fixtures/`), and each refusal of 2.8. `service.pg.test.ts` also: an 11th picture and a 6th video of a shape are refused, taking one out renumbers the rest, the last video of a shape cannot be taken out, and a game made before keeps its one video of each at position 0. A `pg` test for each CHECK: a write that breaks it is refused by the database. Run them: they fail for those reasons.
- [ ] **Step 2: the columns, the migration, the lists, the checks, the words and the answers.** Paste the empty output of `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --shadow-database-url "$TEST_DATABASE_URL" --script` into the pull request. The migration opens with a comment line, as every other one does, and holds only section 3. Run again: pass. Open the draft pull request; it names the migration, says merging applies it to the test site's database, and says undoing it is a second migration.
- [ ] **Step 3: finish.** The implementation audit on the commit named; fix its findings; the Owner's approval of this merge. Delete the live-state file in the last commit, merge `main` in, mark the pull request ready, merge on green with a merge commit.

### Unit Q, step by step

- [ ] **Step 1: the failing tests.** `questions.test.ts`: the new order and counts (section 2). `params/question.test.ts`: the new addresses are questions. `send-back.test.ts`: each new part's reasons, title and noun (section 4). `review-order.test.ts`: the new parts are taken. `service.pg.test.ts`: staff can send back each new part on a live game. A journey, `make-facts.test.ts`: a maker answers each new question with the keyboard, sees each refusal's words, sees the answers on Check and send, and changes one from there; adds 3 pictures with one choice, sees the 2-picture and 11-picture words, and takes one out; adds a second upright video and takes it out; a game made before (`fillAnswers` without the new answers) shows "Not answered yet" on Live and can answer it.
- [ ] **Step 2: the questions, the parts and the screens.** Change the journeys that walk the questions only where they answer them or read a counter; nothing is loosened. Run every file named, the browser files on `computer`, `phone` and `tablet`: pass. Open the draft pull request.
- [ ] **Step 3: finish.** The visual check on the five devices for each new question, Check and send, Live and Sent back (approved maker screens whose approval ends with this change; the pull request names them for the screens page). The fresh lane 2 review; fix its findings. Delete the live-state file, merge `main` in, mark ready, merge on green.

### Unit L, step by step

- [ ] **Step 1: the failing tests.** `clips.test.ts`: `clipSeconds` reads the length of a short MP4, MOV and WebM fixture, and gives null for a WebM with no `Duration`; `clipProblem` refuses a 14.9-second and a 60.1-second video and a video with no length, each with 2.7's words, and passes 15.0 and 60.0. `video-choice.test.ts`: the browser's words for a length out of range. A journey: a maker choosing a 9-second video sees the too-short words and nothing is saved. Run them: they fail for those reasons.
- [ ] **Step 2: the check, the words and the hint.** Run again, then the browser file on `computer`, `phone` and `tablet`: pass. Open the draft pull request.
- [ ] **Step 3: finish.** The visual check on the five devices for the two video questions (approved maker screens whose approval ends with this change); the fresh lane 2 review; fix; delete the live-state file, merge `main` in, mark ready, merge on green.

### Unit V, step by step

- [ ] **Step 1: the failing tests.** The game page's journey: the carousel shows a game's 2 upright videos, 1 wide and 3 pictures in section 6's order, and Next, Previous, a tile, the arrow keys and (on `phone`) a swipe each change what the box shows; with no script each tile opens its file. A game with every answer shows each line of section 6 in order, and About with "More" on a phone; a game with none of them shows none of those lines and no About; About's text with `<b>` in it shows the angle brackets as text.
- [ ] **Step 2: the lines and About.** Run again on `computer`, `phone` and `tablet`: pass. Open the draft pull request.
- [ ] **Step 3: finish.** The visual check on the five devices; the fresh lane 2 review; fix; delete the live-state file, merge `main` in, mark ready, merge on green.

## 8. Decisions

1. **Settled, Owner 2026-11-17:** a longer About, optional, up to 280 characters ("However long a single tweet can be").
2. **Settled, Owner 2026-11-17, on a card:** makers are not asked whether AI helped ("Don't ask"), and nothing about AI is on the page.
3. **Settled, Owner 2026-11-17 06:39 UTC, in words, replacing the card's "No":** 3 to 10 screenshots, required, carousel style (2.8). **06:40 UTC:** up to 5 videos of each shape, taking turns in the feed (2.9).
4. **Settled, Owner 2026-11-17 06:37 UTC:** both videos are 15 to 60 seconds long (2.7).
5. **Calls** the Owner may overrule: pictures at least 640 pixels on the shorter side and up to 5 MB, no reordering yet, a shape's videos sent back together, refusing a video whose file does not say its length, not checking videos already saved, the lists in 2.2 to 2.6, the question order, one language list instead of three, the date measured from the first yes, `Game_answered_check` left as it is.

## 9. Acceptance criteria

- A game cannot go on from the screenshots question, or be sent for review, with fewer than 3 pictures; an 11th is refused; each picture's checks in 2.8 refuse with their words, by the server whatever the browser said, and nothing is saved.
- Each video question holds 1 to 5 videos; a 6th is refused with 2.9's words; the last video of a shape cannot be taken out.
- The game's page shows every video and screenshot in one carousel (section 6): tiles, Previous and Next, swipe, the arrow keys, and full size; with no script, every one still opens.

- A video under 15 seconds or over 60 seconds, or one whose length the file does not say, is refused on its question with 2.7's words, by the server whatever the browser said, and nothing is saved; 15 and 60 seconds exactly are taken. Both video questions' hints say 15 to 60 seconds.

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
