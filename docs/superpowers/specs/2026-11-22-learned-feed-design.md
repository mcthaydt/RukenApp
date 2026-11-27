# The learned feed: slice 3, item 5 (public version)

Date: 2026-11-22. Status: the public half of the learned-feed spec, trimmed by the private-move spec (`2026-11-22-private-feed-ranking-design.md`, called **the private-move spec** below, section 4). Lane 3: units B, C, D, E, G and I add migrations. Nothing here is built.

**The ranking is private.** The Owner moved it out of this public repository (Owner, 2026-11-22 20:22 UTC: make the algorithm private, "Yes"). How games are ordered, its settings and its hidden layers are in RukenPrivate: the full learned spec at `feed/2026-11-22-learned-feed-design.md` and the private design at `strategy/2026-11-15-feed-design.md`. They are built there, behind the `Ranker` contract the private-move spec defines (`src/features/feed/ranker.ts`), with the public ranker as the fallback. This file keeps what RukenApp builds: who counts as which viewer, the rows people make, the screens, the law, and the public halves of the units. The spec merged in #342 (`c80ab01`) stays in this repository's history; it cannot be un-published (private-move spec, section 1).

Read this with `CLAUDE.md`, the `build`, `this-repo`, `verify` and `visual-check` skills, the private-move spec, the main design (sections 5.1 and 5.8) and the feed spec of 2026-11-21. If the repo is indexed in Graphify, use it to find callers and tests before changing a file.

Lines marked **Owner** are the Owner's words or choices. Lines marked **Call** are this spec's choices; the Owner can overrule any of them.

## 0. The Owner's direction

- **Owner, 2026-11-15** (the private design, every section): the approved feed, modelled on Instagram Reels; real play time first; every member counts the same; coming back counts too; recent play counts most; a fair first showing for new games; a feed shaped by what you play that you can customize "like Instagram reels", learned from who likes what; a share of surprises; "Do it quietly"; "Caught up, then favourites"; "I want it to be like this" (Instagram's "Your algorithm" page); "Test clips and tell the maker"; "Both: maker now, learned later" (mood and genre); the hidden sky layer; hand-picked and earned high-taste players with "All four guards"; "Full feed with a parent's yes"; "Everything at launch"; "One settings list with switches".
- **Owner, 2026-11-21, on a card:** "simple order first". The interim order shipped so the feed's screens could be built; it stays in RukenApp as the public ranker (private-move spec P2).
- **Owner, 2026-11-22 15:57 UTC:** "We'll park after slice 3 to refine what we have so far; that's technically our MVP".
- **Owner, 2026-11-22 16:06 UTC, on a card** ("Which parts of the approved feed design ship before we park slice 3?"): **"Everything in the design"**.
- **Owner, 2026-11-22 16:24 UTC, on a card** ("How does a parent say yes to their teen's full feed?"): **"Text the parent a code"**.
- **Owner, 2026-11-22 16:24 UTC, on a card** ("Build the hidden layers and child feed before a lawyer reads them?"): **"Build now, switches on"**.
- **Owner, 2026-11-22 16:24 UTC, on a card** ("Add Like, Save and Repost buttons on clips, as the high-taste boost needs?"): **"Yes, all three"**.
- **Owner, 2026-11-22:** the feed is endless (thread "Make the feed infinite", merged in #329).
- **Owner, 2026-11-22 20:22 UTC:** the ranking goes private; the public "How the feed works" page stays.
- **Owner rules that touch every screen here:** "EVERYTHING should be custom" (no built-in browser controls); frosted glass for anything see-through, copied from the Automata editors; spinners for everything that loads; "it should feel like we're using a real app inside the browser"; tapping a feed video opens the game's page; the drunk-grandma test.

## 1. The outcome

A player opens Ruken and the clips are ones they want: games people really play rise, a new game gets a fair first showing, and the feed learns each player's taste from what they play and watch, with now and then a surprise. It never ends. The player can see what the feed thinks of them, tell it more or less of anything, and start over. A maker can try up to three videos for a game and is told plainly when people watch but do not tap Play. Under-18s get a calm feed until a parent says yes. Two hidden layers (the sky and high-taste players) sit on top, each with its own off switch, and nothing in the app names them.

It has failed, even if every test passes, if: a maker's own play or a paid boost can move a game; a number on screen comes from no person; a clip ever says why it was shown; a hidden layer can be seen in the app; an under-18 without a parent's yes gets a feed that learns from them; the feed repeats or skips clips while a person scrolls (other than the echo and second try, which come back on purpose); a tuned number or a marked player appears in the public repository; or a screen needs explaining.

## 3. Boundaries

- **Dependencies:** none new.
- **Environments and spend:** the site Worker and its database, as today, and the private Worker `ruken-private` (private-move spec, section 3). Two secrets, both loaded by RukenPrivate's workflow, never by hand: `FEED_PUBLIC` on `ruken`, holding only `learned`, `teenPersonal` and `windowDays`, and `FEED_SETTINGS` on `ruken-private`. Texts to parents (unit I) use the existing text provider, at most three per teen a day.
- **Data:** every new table holds a person's data and goes with the account purge; every row that points at a game or a maker goes when that game or maker's account is removed, for every player (cascading foreign keys, "For every unit"). Watching rows are kept for `windowDays`, then deleted by the daily job. Nothing is recorded about a signed-out visitor, about an under-18 without a parent's yes, or about anyone whose browser has not said "I agree" to cookies (4.1).
- **Waits on the cookie consent work** (spec `docs/superpowers/specs/2026-11-22-cookie-consent-design.md`, Owner 2026-11-22 16:41 UTC: "do NOT collect ANY data until the cookies is accepted"). Every unit that writes a row a person causes (B, D, G, I, K) builds on its write guard (`NoConsentWrite`), its `hasConsent(cookies)` and its notice, and waits for it to merge. Without consent this spec writes nothing and the viewer is `crowd`; it adds no consent code of its own.
- **Nothing private here.** No ranking rule, weight, signal module, setting value, or setting key other than `learned`, `teenPersonal` and `windowDays`; no value from RukenPrivate `feed/settings.json`. RukenApp tests use the public ranker, a stub ranker, the public defaults or their own made-up values (private-move spec C5).
- **Not in this spec:** player reviews, follows, comments, search, a player's own sign from a birthday, a maker's sign on their page. A lawyer's read of the feed laws for children and of hidden boosts: the Owner chose to build and switch on without one.

## 4. Who is looking, and what is left out

### 4.1 Who is looking

The app decides the viewer and hands it to the ranker as `crowd` or `full` (private-move spec, section 3):

- **No "I agree" yet** (no `rk_consent` cookie): the consent work does not read the session, so the caller is `none` and the viewer is signed out, whatever cookie they hold. `crowd`; nothing is read about them and nothing is written (section 3).
- **Signed out:** `crowd`. One order for every signed-out visitor on a Chicago day.
- **Signed in, under 18 or no known birthday, no parent's yes:** `crowd`, its surprises drawn by their own seed. Nothing personal is read or recorded.
- **Signed in adult, or under 18 with a parent's yes:** `full`, while `learned` is on (and, for an under-18, `teenPersonal`) and the person has not turned off **Learn from what I do** (D6).

### 4.7 18+ games

Left out of the feed, as today, until the 18+ rules are built.

## 6. The screens

Every screen follows the Owner's rules in section 0. Words are the ones below; a change is a deviation to report.

### 6.1 The feed (`/`)

```
| [clip, full screen]                         ♡  Like      |
|                                             ⤴  Share     |
|                                             •••          |
| @maker · Game name                                       |
| one line                          [ Play ]               |
| [ Home ]        [ + ]        [ You ]                     |
```

- **•••** opens a frosted sheet with two big buttons, **More like this** and **Less like this**, and Cancel. Pressing one closes the sheet and shows "Got it." for 2 seconds. **Call:** the private design says "On each clip"; they sit behind ••• on each clip, as Instagram does, so the clip's right side stays short. Nothing on a clip ever says why it was shown.
- Like, Save, Repost (unit G) sit above Share, each a custom icon with its word under it.
- **"You're all caught up"**: one frosted line at the page's `caughtUpAt`; the feed keeps going under it.
- **"Good pick?"** (unit D): a frosted card at the page's `ask.index`: the game's name, "Good pick?", and two big buttons, **Yes** and **No**. Either answer moves on; swiping past it counts for nothing.

### 6.2 Your feed (`/me/feed`, linked from You as "Your feed")

```
Your feed
Lately you've been into cosy puzzle games and spooky adventures.

What you want to see more of
[Cosy ×] [Puzzle ×] [@maker ×]  [+ Clever] [+ Story]   [ Add ]

What you want to see less of
[Racing and sports ×]                                    [ Add ]

[ Start over ]
```

- The sentence is built from the viewer's top chips by a fixed template, never by an AI ("Built from your chips"); with too little known: "Play a few games and we'll learn what you like."
- Filled chips are what the feed learned or the viewer added; tap × to remove. Outlined chips with + are suggestions; tap to add. Add opens a frosted sheet of moods, genres and makers to pick from. Chips have gently rounded corners, not pills.
- **Start over** asks once ("Start over? Your feed forgets what it learned about you." with **Start over** in red and Cancel) and wipes what the feed learned (unit D).
- An under-18 without a parent's yes sees, in place of the chips: "Your feed doesn't learn from what you do until a parent says yes." and, once unit I is built, the button **Ask a parent**.

### 6.3 Submitting and editing a game

Two new questions after "line": **mood** ("How does your game feel?", the twelve moods as big buttons) and **genre** ("What kind of game is it?", the eleven genres as big buttons). Both change from Check and send, and on a live game they change at once, like the name ("Keep them instant", 2026-11-21). If the command-line upload work has merged, it and the help guide's agent prompt (`src/routes/help/get-your-game-on-ruken/agent-prompt.ts`) take the same two answers in unit C.

Moods (**Owner**): Bold, Cosy, Clever, Heartfelt, Showy, Tidy, Friendly, Spooky, Adventurous, Tough, Weird, Dreamy. Genres (**Owner**): Action, Adventure, Puzzle, Story, Strategy, Role-playing, Platformer, Racing and sports, Building and life, Party and board, Other.

### 6.4 Test videos, on the maker's game page (`/make/<game>`)

- "Videos" lists up to three pairs (tall and wide), each with Change and Remove, and **Add another video** while there are fewer than three. A live game's new pair waits for staff, as a changed video does today.
- When the ranker's `notes()` says a pair is watched but seldom played: "Lots of people watch this video but few tap Play. Try another one." Never a number.
- When `notes()` says a game's first showing ended with few plays: "Few people have tapped Play on your game yet. A new video can help." (unit F).

### 6.5 A parent's yes (unit I)

The teen presses **Ask a parent**, types the parent's phone number, presses **Text my parent**. The parent gets: "Your teen <first name> asked for a Ruken feed that learns what they like. Say yes or no: <link>". The link opens a plain page with **Yes** and **No**. An unanswered ask ends after 5 days. After Yes, the same link shows **Turn it off** for as long as the yes holds. At 18 the full feed starts by itself.

### 6.6 How the feed works (`/help/how-the-feed-works`)

The approved public page draft's words, without its "Questions for the Owner on this page" section, linked from Your feed and the help list. **It stays true:** a private ranking change that makes its words untrue merges only after a RukenApp pull request that changes the page has merged (private-move spec, section 3).

## 7. The plan (public halves)

Each unit's public half is one pull request on its own branch, built test first (journeys first), run through `verify`, with screens shot on the three devices when they change. Lane 3 units get an implementation audit (Opus 5.5, medium) as well as their checks; lane 2 units one fresh review. Builders: Sonnet 5.5, medium, in a fresh session per unit, with the prompt `/mnt/project-files/prompts/learned-feed-unit-execution.md`, which names each unit's repo or repos and which half lands first.

Every unit waits on the private-move spec's P0, P2, P3 and P4. The units' order and private halves are in the full learned spec in RukenPrivate.

| Unit | Public half (RukenApp) | Private half (RukenPrivate) | Lane here |
|---|---|---|---|
| A, the learned order | the play-days read (A9); the `full`/`crowd` viewer from `FEED_PUBLIC` (A5); `/healthz/feed` (A8); the caught-up line; journey A11 on a stub ranker; A13 | the order, the cursor, the settings | 2 |
| F, the few-plays note | the line on `/make/<game>` (F1) | the rule, answered by `notes()` | 2 |
| B, watching signals | `ClipView`, `/api/feed/seen`, `Feed.svelte` sending views, the purge and daily deletion (B1, B2, B5 to B7) | reading the views; echo and second try | 3 |
| C, mood and genre | migration, questions, screens (C1, C2, C4) | learned mood | 3 |
| E, test videos | migration, uploads, staff review, the note (E1, E3, E4) | the slot pick | 3 |
| D, Your feed | migration, `/me/feed`, the ••• sheet, the Good pick card, `ask` passed through (D1 to D7) | more and less in the order; the Good pick rule | 3 |
| G, Like, Save, Repost | migration, buttons, Saved, the purge (G1, G2, G4, G5) | likes in the order | 3 |
| H, the sky layer | `docs/feed-sky.md` in words only, no number; H3's test | the rest | 2 |
| I, a parent's yes | all of it | nothing | 3 |
| K, high-taste players | K3's test; a neutral `/jobs/` route and table only if K's private plan needs one | the rest | 3 |
| L, How the feed works | the page and its links | nothing | 1 |

**For every unit.** Every journey starts with `test.beforeEach(forgetRateLimits)` and shows each new or changed screen with `showTheOwner`. The journeys share one database, so they find their own game by `data-slug` and assert order only in unit and database tests, on a stub ranker. Every new thing a person makes has create, read, update (where it can change) and delete in a journey (CRUD in `build`). Every new table's `userId` and `gameId` is a foreign key with `onDelete: Cascade`, and a `FeedTaste` row of kind `maker` or `game` holds the user's or game's id (never a handle or slug), with the same cascade; the account purge test covers every new table and shows that another player's chip for a deleted maker is gone. A pull request that changes or deletes an existing test names each one and why. Lessons in `progress.md` whose trigger the diff matches are carried. Nothing private goes in RukenApp (section 3). **Consent:** every new route is placed in the consent work's `consent/routes.ts` as exactly one of its three kinds (Open, Machine or Gated; its route test enforces it), by path or by a pattern it already lists: `/api/feed/seen` Gated (403 in plain words without consent, the refusal its gated test accepts); Like, Save, Repost, More/Less and Good pick routes, under `/api/feed/`, Gated the same way; `/me/feed` Gated by `/me/*`; `/parent/[token]` Gated (the notice); `/healthz/feed` Machine (writes nothing); `/help/how-the-feed-works` Open by `/help/*`; the existing `GET /api/feed` stays Open. C's and E's writes under `/make/*` are Gated by that pattern; every new write runs behind its write guard, never around it; and each unit that writes has a test that the same press without `rk_consent` writes nothing. A crowd-feed test shows a browser without consent is sent to the ranker as `crowd`, like a signed-out visitor, even holding a valid sign-in cookie.

### Unit A: the learned order (public half)

- **A5.** The viewer (4.1): a browser without `rk_consent`, a signed-out visitor and an under-18 without a parent's yes are sent as `crowd` with no personal facts; with `FEED_PUBLIC` missing or bad, every viewer is `crowd` and no view is stored.
- **A8.** `/healthz/feed` answers plain text, what the ranker's `health()` says, or `defaults` when the private Worker is not answering; it never names a key or a value. `/healthz` and its test are unchanged. It is not skipped by `handle.ts` or `https-only.ts` (both match `/healthz` exactly), so its test calls it over https through the same hooks a real request passes.
- **A9.** The play read: one query answers per user, game and Chicago day the attentive beats and basis over the window, tested against Postgres (`*.pg.test.ts`), including a session that crosses midnight.
- **A11.** Journey, on a stub ranker: a viewer opens the feed, sees two clips, then "You're all caught up" at `caughtUpAt`, and keeps going; the screen asks for the next page with the `next` it was given.
- **A13.** An architecture test: nothing under `src/features/feed/` imports from `src/features/money/`, and from `src/features/membership/` only the membership status read (10.1).

Steps:
- [ ] 1. Journey A11, failing.
- [ ] 2. The viewer and `FEED_PUBLIC` (A5), test first.
- [ ] 3. The play read and its Postgres test (A9).
- [ ] 4. `/healthz/feed` (A8).
- [ ] 5. The caught-up line.
- [ ] 6. The architecture test (A13); `verify` on the three devices; the journey green.

### Unit F: the few-plays note (public half)

- **F1.** The line of 6.4 shows on `/make/<game>` when `notes()` says so; never a number.

Steps:
- [ ] 1. Journey on a stub ranker: the line shows when `notes()` says so, and not otherwise. Failing.
- [ ] 2. The line on the page; `verify`; shots.

### Unit B: watching signals (public half)

- **B1.** `ClipView`: `id`, `userId`, `gameId` (both cascade), `clipSlot` (1 until unit E adds slots), `shownAt`, `watchedMs`, `ends` (times watched to the end), `playTapped`, `createdAt`. Index `[userId, shownAt]`, `[gameId, shownAt]`.
- **B2.** `POST /api/feed/seen` takes one clip's view when it leaves the screen (and on page hide, by `sendBeacon`): Gated in `consent/routes.ts` and signed in only; without `rk_consent` the screen sends nothing at all (no beacon, no `POST`, as the consent journey requires), and the route refuses with 403 in plain words without touching the database; a `crowd` viewer gets 204 and nothing is stored; rate-limited like other posts; `watchedMs` capped at three times the clip's length.
- **B5.** The daily job deletes `ClipView` rows older than `windowDays` (from `FEED_PUBLIC`); the account purge and a game's removal delete their rows. Tested against Postgres.
- **B7.** Without consent: a unit test shows the route writes nothing and answers 403 without `rk_consent`; the consent journey's check (no `POST`, no beacon before "I agree") stays green with the feed scrolled past several clips.
- **B6.** Journey: watch clips and scroll on; the views are stored for a `full` viewer and not for a `crowd` one.

Steps:
- [ ] 1. Journey B6, failing.
- [ ] 2. Migration and Postgres tests (B1, B5).
- [ ] 3. The route (B2), test first.
- [ ] 4. `Feed.svelte` sends the view; `verify`.

### Unit C: mood and genre (public half)

- **C1.** `Game.mood` and `Game.genre`, nullable enums. The two questions come after "line" for a new game; a live game without them shows them on its maker's page as "Two quick questions" and stays live meanwhile.
- **C2.** Changing either on a live game takes effect at once and does not send the game for review.
- **C4.** Journey (CRUD): a maker answers both, sees them on Check and send, changes each, and the game page and feed still work; a game with neither still shows in the feed.

Steps:
- [ ] 1. Journey C4, failing.
- [ ] 2. Migration.
- [ ] 3. Questions and screens, test first (and the command line and agent prompt, if merged).
- [ ] 4. `verify`; shots.

### Unit E: test videos (public half)

- **E1.** A game has one to three slots, each a tall and a wide clip; existing clips become slot 1. A new slot on a live game waits in `GameHeldClip` with its slot for staff's yes; removing the last slot is refused. The feed shows the slot the ranker names.
- **E3.** The video note of 6.4 shows when `notes()` says so, never a number.
- **E4.** Journey (CRUD): add a second video, see it wait, accept it through `/jobs/review` (with its look), see both listed, change one, remove one.

Steps:
- [ ] 1. Journey E4, failing.
- [ ] 2. Migration.
- [ ] 3. Upload and review paths, test first.
- [ ] 4. The note.
- [ ] 5. `verify`; shots.

### Unit D: Your feed (public half)

- **D1.** `FeedTaste`: `userId`, `direction` (`more`/`less`), `kind` (`mood`, `genre`, `maker`, `game`), `value` (a mood, a genre, or a user or game id), `createdAt`; unique on the four; maker and game rows cascade with their user or game. `User.feedResetAt`: personal signals before it are not read (plays stay, for pay). `User.feedPersonal`, Boolean, default true (D6). `GoodPickAsked`: `userId`, `gameId`, `askedAt`, `answer` (`yes`/`no`/null).
- **D2.** The ••• sheet's buttons write a `game` row.
- **D3.** `/me/feed` (6.2): chips, suggestions and Add as 6.2 says; × deletes; Start over deletes their `FeedTaste`, `ClipView` and `GoodPickAsked` rows and sets `feedResetAt`.
- **D4.** Good pick? shows where the ranker's `ask` says, and is written to `GoodPickAsked` when served, so it is asked once; yes adds a `more` row for the game's mood, no a `less` row.
- **D7.** Without consent, More like this, Less like this and Good pick are not offered (the viewer is signed out, so `ask` is null), and the ••• button is hidden (until unit L adds How the feed works, which then is all the sheet shows); `/me/feed` asks them to sign in, which opens the consent notice first. A test shows no `FeedTaste` or `GoodPickAsked` row is written without consent.
- **D6.** **Learn from what I do** (10.1): `User.feedPersonal` (D1); off makes the viewer `crowd`, stores no views and hides the chips; on again starts fresh; locked off for a teen without a parent's yes. **Call** (from the Owner's 16:24 UTC instruction on the law). How the feed works is added to the ••• sheet and Your feed by unit L.
- **D5.** Journey (CRUD): turn Learn from what I do off and on, add a chip, read it back, remove it, add a less chip, press More and Less on a clip and see the chips change, answer a Good pick, Start over and see the empty state; a second account cannot read or change the first's chips.

Steps:
- [x] 1. Journey D5, failing.
- [x] 2. Migration and purge.
- [x] 3. The ••• sheet.
- [x] 4. `/me/feed`, built at `/settings/feed` (the Owner, 2026-11-27 00:43 UTC: feed settings live under Settings; the Me to Settings move waits for member pages).
- [x] 5. Good pick: `ask` passed through, test first.
- [x] 6. `verify`; shots.

### Unit G: Like, Save, Repost (public half)

**Owner, 2026-11-22, on a card:** "Yes, all three" ("Each clip gets Like, Save and Repost. Saves show on You. Reposts show on your page.").

- **G1.** One row per person and game for each; pressing again takes it back. A count on screen is a count of rows, nothing else. Nobody can like, save or repost their own game.
- **G2.** Saved games list on You ("Saved"). Reposts show on You until players' pages are built (approved, not built).
- **G5.** Without consent, pressing Like, Save or Repost opens the consent sheet ("To save this game" for Save, "To like this game" for Like, "To repost this game" for Repost, each followed by the consent sheet's own words); "I agree" carries on to sign in or to the press. A test shows no row is written without consent.
- **G4.** Journey (CRUD) for each, and the purge test.

Steps:
- [ ] 1. Journey G4, failing.
- [ ] 2. Migration and purge.
- [ ] 3. The buttons and their routes, test first.
- [ ] 4. Saved on You.
- [ ] 5. `verify`; shots.

### Unit H: the sky layer (public half)

- **H3.** Nothing on any screen, address, page title or response names a sign, the moon, a planet or the sky: a test reads every screen's words and the feed's responses for those words.
- **H4.** `docs/feed-sky.md` says the rules in words, never their strength or any number (10.1), and merges the same day as the private half.

Steps:
- [ ] 1. H3's test, passing now and kept green.
- [ ] 2. `docs/feed-sky.md`.

### Unit I: a parent's yes

**Owner, 2026-11-22, on a card:** "Text the parent a code" ("The teen types a parent's phone number. Ruken texts that phone a code and a yes link. One tap from the parent turns on the full feed. Parent can undo it."). The code is the one-time part of the link, so the parent never types it.

- **I1.** `ParentYes`: `teenUserId` (cascade), `phoneHash`, `tokenHash`, `askedAt`, `answeredAt`, `answer`, `revokedAt`. One open ask per teen; three texts per teen a day; an ask unanswered after 5 days ends.
- **I2.** The flow of 6.5. A yes makes the teen `full` only while `teenPersonal` is on (section 10); with it off, the parent's page still records the answer and says "Thanks. We'll turn it on when we can." The parent's page needs no account. Yes turns on the full feed at once; Turn it off returns the calm feed and stops recording; the teen can cancel an ask.
- **I5.** The parent's page (`/parent/<token>`) is a page a person's browser opens, so it is consent-gated: without `rk_consent` it shows the consent notice first and records the answer only after "I agree". A test shows no `ParentYes` change without consent. Asking a parent needs the teen signed in, so it already has consent.
- **I4.** Journey (CRUD): ask, see it waiting, the parent says yes (test texts as in the sign-up journeys), the full feed starts, the parent turns it off, the teen asks again and cancels; an ended ask's link says so.

Steps:
- [ ] 1. Journey I4, failing.
- [ ] 2. Migration and purge.
- [ ] 3. The ask and the text, test first.
- [ ] 4. The parent's page.
- [ ] 5. The full feed follows the yes (A5's rule with a yes), test first; and with `teenPersonal` off, a teen with a yes is `crowd` and no view is stored (10.2), test first.
- [x] 6. `verify`; shots.

### Unit K: high-taste players (public half)

- **K3.** Nothing tells anyone they are marked: no screen, no response, no count. A test reads the player's own screens and responses.
- **K4.** No made-up likes or saves, ever.

Steps:
- [ ] 1. K3's test, passing now and kept green.

### Unit L: How the feed works

- **L1.** The page of 6.6; links on it 44 × 44; no `<style>` block (help rules).
- **L2.** **How the feed works** is added to every clip's ••• sheet (under More and Less; for a viewer without consent, the only button, and the ••• button shows again) and to Your feed; both open the page.

Steps:
- [ ] 1. Journey: open it from a clip's •••, from Your feed and from the help list, with and without consent; its words. Failing.
- [ ] 2. The page and the three links; `verify`; shots.

## 10. The law, and what needs a lawyer

**Owner, 2026-11-22 16:24 UTC:** "Make sure we build it in a way that the law will be okay with" (straight after choosing "Build now, switches on"). This spec does not say what any law requires; nobody on this work is a lawyer, and the laws named below were not read in full. It builds the most careful version that keeps the Owner's design, makes every risky part one switch away from off, and lists as **Open (lawyer)** each question only a lawyer can answer.

### 10.1 What is built in, whatever a lawyer says

- **No one under 13.** Accounts are 13 and up today (`adultOn`, sign-up's age check), so the feed never holds data about a child under 13. No unit changes that.
- **Teens get a calm feed by default.** An under-18, or anyone whose birthday is not known, is `crowd`: nothing personal is read, and no watching is recorded (4.1, B2). The full feed needs a parent's yes (unit I) **and** the switch `teenPersonal` (below).
- **Anyone can turn personalising off.** Your feed (unit D) gains a switch, **Learn from what I do** (on by default for adults, off and locked for a teen without a parent's yes). Off makes the viewer `crowd`, stops recording views, and keeps chips hidden; on again starts fresh. `User.feedPersonal` (Boolean, default true) holds it; journey D5 covers it both ways.
- **Plain disclosure.** "How the feed works" (unit L, the Owner-approved words) says what the feed ranks on, that it learns from what you play and watch, how to change it, that teens' feeds do not learn without a parent, that nobody can pay to move a game, and that Ruken adds "a few touches of our own". It is linked from every clip's ••• sheet ("How the feed works"), from Your feed and from the help list, so it is one tap from where the feed is used. The approved words do not mention **Learn from what I do**; L ships the approved words as they are, and a line about the switch is the Owner's to approve, asked when L's screens go to the Owner.
- **No fake engagement, no paid ranking.** Every count on screen is a count of rows people made (G1); high-taste players change reach only, never pay, and never add a like (K4). An architecture test (A13) keeps ranking from reading payments beyond membership status.
- **Nothing hidden makes a claim.** The sky layer and high-taste players show nothing, promise nothing and name nothing in the app (H3, K3). The sky layer is a ranking input like any other, described on GitHub (`docs/feed-sky.md`) without its strength. **Call** (private-move spec, section 4): this line is a disclosure made for the law, so `docs/feed-sky.md` stays public, words only.
- **Nothing before "I agree".** The Owner's consent rule (16:41 UTC) comes first: without `rk_consent` the feed reads nothing personal and writes nothing, and the consent work's write guard makes a missed write fail loudly (section 3, "For every unit").
- **Least data, kept short.** Watching rows hold no device, place or address, are deleted after `windowDays`, and go with the account; "Start over" and the switch above delete them at once. A parent's phone is kept only as a hash.

### 10.2 The switches for the risky parts

Each can be turned off without a rebuild, and each has a test that off means off, in the repo where the switch acts:

| Switch | Turns off | Test | Repo |
|---|---|---|---|
| `teenPersonal` | the full feed for every under-18, parent's yes or not | a teen with a yes is `crowd` and no view is stored | RukenApp |
| `learned` | all personalising, for everyone | every viewer is `crowd` and no view is stored | RukenApp (who is `full`); RukenPrivate (the order on its own) |
| `highTaste` | the high-taste boost | the order equals the order with no marked players | RukenPrivate |
| `sky` | the sky layer | the order equals the order on a date with no sky lift | RukenPrivate |

`teenPersonal` is off in the public defaults. **Owner, 2026-11-22 16:40 UTC, on a card** ("Get a lawyer to check the teen feed and hidden ranking before teens get it?"): **"No, turn it on anyway"** (the card said: "A parent's yes turns on the learning feed for teens as soon as it is built. New York and California laws on this are in court."). So it is on in the private settings, and a teen's yes turns on their full feed once unit I merges. The switch stays, so it can be turned off in one change if the law or the Owner says so.

### 10.3 Open (lawyer)

These are questions, not answers. Each names what it would change.

1. **A parent's yes.** Whether a yes given by tapping a link texted to a number the teen typed is enough consent for a feed that learns from a minor, under New York's and California's laws on feeds for minors and any like them. If not, unit I changes how a parent proves who they are. The Owner chose to turn it on without this read.
2. **Hidden ranking parts.** Whether the high-taste boost and the sky layer need saying more plainly than "a few touches of our own" (US consumer-protection rules on deception and endorsements; the EU Digital Services Act's rules on explaining recommender systems, if Ruken is offered in the EU). If so, the public page and the terms change; the switches stay.
3. **Which privacy laws apply, and the papers they need.** Ruken has no privacy policy or terms page today (`src/routes/legal/` holds only the maker agreement). Whether California's privacy law (and its opt-out of profiling), the EU's and the UK's rules (including the UK Children's Code) apply to Ruken at its size, and what its privacy policy must say about watching, likes and taste. Writing those pages is the thread "Add privacy policy and terms pages"; its privacy page should name watching, More/Less, likes, saves, reposts and taste.
4. **Under-13s found later.** What Ruken must do when it learns an account belongs to someone under 13, despite the age check.

**Open 5 (the Owner): get a lawyer's read on 10.3.** **Answered 2026-11-22 16:40 UTC: no lawyer now; turn it on anyway.** The four questions above stay unanswered and are carried as risks. Nothing in this spec waits on them.
