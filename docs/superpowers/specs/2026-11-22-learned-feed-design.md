# The learned feed: slice 3, item 5

Date: 2026-11-22. Status: spec and plan in one, for plan audit 2 (lane 3: units B, C, D, E, G, I and K add migrations; J2 adds a CI workflow and a credential). Changed after plan audit 1 (`docs/superpowers/audits/2026-11-22-learned-feed-1-plan-audit.md`). Nothing here is built. Written against `main` at `74bd185`.

This replaces the feed's interim order (unit C of `2026-11-21-feed-and-makers-page-design.md`, `src/features/feed/order.ts`) with the feed the Owner approved on 2026-11-15, and builds every part of that design. The full design, its numbers and its reasons are private, on the Owner's words ("Draft it in ruken private, but we need a trimmed down version for the website so people don't game the algorithm"): RukenPrivate `strategy/2026-11-15-feed-design.md` (called **the private design** below, with its section numbers), its public page draft `strategy/2026-11-15-feed-public-page-draft.md`, and the real settings `feed/settings.json`. RukenApp is public, so this spec names rules and setting keys, never a tuned number or a marked player. Every builder and every reviewer reads the private design first.

Read this with `CLAUDE.md`, the `build`, `this-repo`, `verify` and `visual-check` skills, the main design (sections 5.1 and 5.8) and the feed spec of 2026-11-21 (sections 5.1, 5.2 and unit D). If the repo is indexed in Graphify, use it to find callers and tests before changing a file.

Lines marked **Owner** are the Owner's words or choices. Lines marked **Call** are this spec's choices; the Owner can overrule any of them. Lines marked **Open** wait for the Owner, and only the units that name them wait.

## 0. The Owner's direction

- **Owner, 2026-11-15** (the private design, every section): the approved feed, modelled on Instagram Reels; real play time first; every member counts the same; coming back counts too; recent play counts most; a fair first showing for new games; a feed shaped by what you play that you can customize "like Instagram reels", learned from who likes what; a share of surprises; "Do it quietly"; "Caught up, then favourites"; "I want it to be like this" (Instagram's "Your algorithm" page); "Test clips and tell the maker"; "Both: maker now, learned later" (mood and genre); the hidden sky layer; hand-picked and earned high-taste players with "All four guards"; "Full feed with a parent's yes"; "Everything at launch"; "One settings list with switches".
- **Owner, 2026-11-21, on a card:** "simple order first". The interim order shipped so the feed's screens could be built; this spec replaces it.
- **Owner, 2026-11-22 15:57 UTC:** "We'll park after slice 3 to refine what we have so far; that's technically our MVP".
- **Owner, 2026-11-22 16:06 UTC, on a card** ("Which parts of the approved feed design ship before we park slice 3?"): **"Everything in the design"**.
- **Owner, 2026-11-22 16:24 UTC, on a card** ("Add Like, Save and Repost buttons on clips, as the high-taste boost needs?"): **"Yes, all three"**.
- **Owner, 2026-11-22:** the feed is endless (thread "Make the feed infinite"). The learned order pages without end (4.6).
- **Owner rules that touch every screen here:** "EVERYTHING should be custom" (no built-in browser controls); frosted glass for anything see-through, copied from the Automata editors; spinners for everything that loads; "it should feel like we're using a real app inside the browser"; tapping a feed video opens the game's page; the drunk-grandma test.

## 1. The outcome

A player opens Ruken and the clips are ones they want: games people really play rise, a new game gets a fair first showing, and the feed learns each player's taste from what they play and watch, with now and then a surprise. It never ends. The player can see what the feed thinks of them, tell it more or less of anything, and start over. A maker can try up to three videos for a game and is told plainly when people watch but do not tap Play. Under-18s get a calm feed until a parent says yes. Two hidden layers (the sky and high-taste players) sit on top, each with its own off switch, and nothing in the app names them.

It has failed, even if every test passes, if: a maker's own play or a paid boost can move a game; a number on screen comes from no person; a clip ever says why it was shown; a hidden layer can be seen in the app; an under-18 without a parent's yes gets a feed that learns from them; the feed repeats or skips clips while a person scrolls (other than the echo and second try, which come back on purpose); a tuned number or a marked player appears in the public repository; or a screen needs explaining.

## 2. What is there today

Read on `main` at `74bd185`.

- `src/features/feed/service.ts`: `feed()` answers at most 50 `FeedClip`s, without 18+ games, in `feedOrder` (`order.ts`): games live under a week first, then by members' attentive beats over a week, ties by `seededNumber(chicagoDay, id)`. Nothing is personal; nothing is recorded about watching. `memberBeatsByGame` (`play/sessions.ts:217`) is read only by the feed.
- The thread "Make the feed infinite" (branch `claude/project-thread-7fe1cy`, not merged when this was written) adds paging with this contract, which unit A keeps: `service.page(after: string | null)` answers `{ clips: FeedClip[], next: string | null }`; `FeedClip` gains `key`, unique across the feed, because a game repeats; the first page is round 0 only, up to `FEED_MAX` (50); later pages walk rounds until at least `MORE_AT_LEAST` (10) clips, at most 50; `next` is null only when no game is live; `GET /api/feed?after=<next>` answers that JSON with `cache-control: no-store`, and 400 for a cursor it did not make; `/` loads `{ first: FeedPage }`; `Feed.svelte` asks for more within 3 clips of the end, behind a spinner, with "Couldn't load more games." and Try again. Its cursor is `day~round~offset`. Unit A's builder re-reads the merged contract before its step 5, since it was taken from that thread's message, not from `main`.
- Play: `PlaySession` (`userId`, `gameId`, `basis`: `member`, `free_game`, `staff`, `own_game`) and `PlayBeat` (`attentive`, every 15 s, `BEAT_EVERY_MS`). A maker's own play is `own_game` and staff's is `staff`. Revenue splits (slice 5) are not built, so "anyone on the game's split" has no rows yet; unit A reads them through one function, `splitMembersOf(gameIds)`, that answers nobody until splits exist.
- Accounts: `User.adultOn` (the 18th birthday, nullable); `isKnownAdult`; `User.phoneNumberVerified` (default false). Accounts are 13 and up. Texts go out through `accounts/auth.ts`.
- Games: one `GameClip` per shape; a live game's new video waits in `GameHeldClip`; `Game` relations use `onDelete: Restrict`. No mood or genre. Submission is one question at a time (`games/questions.ts`).
- `/healthz` answers the plain text `ok` (`src/routes/healthz/+server.ts`; `tests/browser/healthz.test.ts:10`).
- No likes, saves, reposts, player reviews, follows, or "Your feed" page. Player reviews are approved (apps-and-player-features design) but not built and not in this spec.
- Jobs: `/jobs/*` with `JOBS_SECRET`; the daily cron's job list in `cloudflare/crons.js`.

## 3. Boundaries

- **Dependencies:** none new. The sky sums are written by hand from published low-precision formulas, checked against reference dates (unit H). No property-test library: invariants are checked with seeded loops over `seededNumber`.
- **Environments and spend:** the site Worker and its database, as today. One new Worker secret, `FEED_SETTINGS`, loaded by a workflow in RukenPrivate, never by hand (section 5). Texts to parents (unit I) use the existing text provider, at most three per teen a day.
- **Data:** every new table holds a person's data and goes with the account purge; every row that points at a game or a maker goes when that game or maker's account is removed, for every player (cascading foreign keys, section 7). Watching rows are kept for `windowDays`, then deleted by the daily job. Nothing is recorded about a signed-out visitor, or about an under-18 without a parent's yes.
- **Expected duration:** about five working days of build sessions across the units, plus audits.
- **Not in this spec:** player reviews, follows, comments, search, a player's own sign from a birthday, a maker's sign on their page (the private design 8, "after launch"), and the lawyer's read itself (Open 2).

## 4. The order, for one viewer

`src/features/feed/learned.ts`, `learnedOrder(input)`, decides the base order. It is pure: the games, the play days, the viewer's signals, the settings, the time `asOf` and a seed are handed in, and the same input always gives the same output. Each later part of the order is its own module under `src/features/feed/signals/` that `learned.ts` calls through one list fixed by unit A (`standing`, `firstShowing`, `taste`, `quiet`, `mood`, `sky`, `highTaste`); unit A ships every module but its own as a module that changes nothing, and each later unit owns only its module and its tests.

### 4.1 Who is looking

- **Signed out:** the crowd feed (standing, first showing, surprises, spacing). One order for every signed-out visitor on a Chicago day.
- **Signed in, under 18 or no known birthday, no parent's yes:** the crowd feed, its surprises drawn by their own seed. Nothing personal is read or recorded (private design 10).
- **Signed in adult, or under 18 with a parent's yes:** the full feed: the crowd feed blended with what they play, watch and say.

### 4.2 A game's standing (private design 2)

Over the window (`windowDays`) ending at `asOf`, per member and Chicago day, for plays with basis `member` only, never by the game's maker or anyone on its split:

- time: the member's attentive beats that day times `BEAT_EVERY_MS`, capped at `dailyCapMinutes`, as a share of the cap (0 to 1);
- coming back: 1 if the member played the game on an earlier day in the window, else 0, times `comebackWeight` (switch `comeback`);
- each day's sum is weighted by recency, halving every `halfLifeDays`; nothing outside the window counts.

Standing is the sum. Free watchers (signed-in non-members whose `phoneNumberVerified` is true) add at most `freeShareMax` of a game's standing, from their watching (unit B) and free-game plays (switch `freeWatchers`).

### 4.3 A fair first showing (private design 3)

A game is **new** from going live until `firstShowingMembers` distinct members have played it, or `firstShowingDays` pass, and (from unit B on) it has been shown to `firstShowingViewers` viewers. New games take fixed slots in round 0 (every `firstShowingEvery`th slot, starting with the first), fewest members first, then newest. A game whose showing ends below `firstShowingMembers` is ranked on what it has, and its maker sees one plain line on its page (unit F).

### 4.4 Learning who likes it (private design 4)

- **Who played what:** for each pair of games, how much the same people kept playing both: a cosine over players, each weighted by the days they played each game in the window (basis `member` or `free_game`, signed in).
- **A viewer's taste for a game:** the sum, over the games the viewer played or showed interest in (unit B), of that pair's likeness times the viewer's own days with that game, plus their "more" and "less" (unit D), pulled to 0 to 1 across the catalogue.
- **The blend:** `score = (1 − w) × standing + w × taste`, both pulled to 0 to 1, where `w = min(1, players / learnFromPlayers)`. A game with few players leans on its standing by itself.
- **Quiet no:** a clip swiped away within `quickNoMs` lowers the viewer's taste for that game and, by likeness, for games like it, from their next open.
- **Less like this** on a game, its maker, mood or genre takes those games out of the viewer's round 0 for `lessDays`, then ranks them last, from their next open.

### 4.5 Surprises, spacing, echo, second try (private design 4)

- **Surprises:** each slot is a surprise with chance `surpriseRate` (moved by the sky, unit H), drawn from `seededNumber(seed, slot)`. A surprise is the best game by standing from the lower half of the viewer's taste; a crowd viewer's surprise comes from the lower half of standing.
- **Spacing:** never two clips in a row from the same maker, or from the same crowd (likeness at or above `sameCrowd`), when another game can go there (switch `spacing`). Whatever the switch, the same game is never twice in a row, across a round's end too.
- **The echo:** a clip watched to the end or twice (interest) with no Play tap comes back later (4.6), as another of the game's videos (unit E) or, with one video, the game most like it.
- **The second try:** a clip watched twice with no Play is followed, at the start of the next page, by the game its crowd kept playing longest.
- **Good pick?** (unit D) is offered only when the viewer played (`goodPickMinutes`, or came back) a game that was in the lower half of their taste, at most once every `goodPickDays`.

### 4.6 Rounds and endless paging (private design 4, "Caught up, then favourites")

- **The base order is frozen at `at`,** the time the first page was ranked. It ranks only games live at or before `at`. A game taken down after `at` keeps its place in the ranking and is dropped only when a page is cut, so offsets never move; a game that goes live after `at` waits for the next open.
- **Round 0** is every game the viewer has not played, in base order. **Round 1 and later** are every game: those not played and those the viewer came back to first, then the rest, each round with a seeded shake of size `roundShake` on the scores, so rounds differ but one round never differs between two loads.
- **The first page** is round 0, and when round 0 has fewer than `MORE_AT_LEAST` clips (a viewer who has played nearly everything) it goes on into round 1, so a first page always has clips while any game is live. Later pages walk rounds as the infinite feed's do (at least 10, at most 50). A fresh open always starts at round 0, so new games come first.
- **What a later page reads after `at`:** only the viewer's views and plays since `at`, and only to put in echo and second-try clips: the echo at the first slot of the page being built that is at least `echoAfter` clips after the view that caused it; the second try at the first slot of the next page. Everything else a person does after `at` (quick no, More, Less, Good pick answers, new plays) changes their next open, never the cursor's later pages.
- **The cursor** is base64url JSON `{ v: 1, at, r, o, x, w }`: `r` the round, `o` the offset in the base order, `x` the put-in clips so far (at most 20, each with its game and slot, so they are not put in twice), `w` a short hash of the viewer. A cursor that does not parse is a 400, as today. A cursor in the infinite feed's old `day~round~offset` form, one whose `at` is in the future or more than 24 hours old, or one whose `w` is not this viewer (they signed in or out while scrolling) answers a fresh first page.
- **Keys:** a base clip's `key` is `<round>~<slug>`; a put-in clip's is `<round>~<slug>~x<slot>`, so every key in one feed read is unique.
- **The caught-up line:** `FeedPage` gains `caughtUpAt: number | null`, the index in this page's `clips` before which "You're all caught up" shows (0 when round 0 is empty); null when round 0 does not end on this page.
- **Good pick:** `FeedPage` gains `ask: { index: number; slug: string } | null` (unit D; always null before it), the place in this page's clips where the "Good pick?" card shows. It is written to `GoodPickAsked` when served, so it is asked once.
- **The seed** is the viewer (their id, or `anon`) and the Chicago day of `at`.

### 4.7 18+ games

Left out of the feed, as today, until the 18+ rules are built.

## 5. Settings and switches (private design 11)

- **Owner** (private design 11): one list, every number in it, an off switch for each part, changeable without a rebuild; the real numbers and the marked players never in the public repository.
- `src/features/feed/settings.ts` holds the list's shape and public defaults. **Call:** the public defaults are placeholders that behave sensibly and **differ from every private value** (J2's check fails a run when any public default equals its private value; switches excepted). Every hidden part is off by default. A missing secret, bad JSON or an unknown key falls back to the default for that key and logs one line naming the key, never a value.
- **The keys:** `windowDays`, `halfLifeDays`, `dailyCapMinutes`, `comebackWeight`, `freeShareMax`, `firstShowingMembers`, `firstShowingViewers`, `firstShowingDays`, `firstShowingEvery`, `learnFromPlayers`, `quickNoMs`, `lessDays`, `surpriseRate`, `sameCrowd`, `echoAfter`, `goodPickMinutes`, `goodPickDays`, `roundShake`, `testClipViews`, `testClipPriorTaps`, `testClipPriorViews`, `fewPlayTapShare`, `moodLearnPlayers`, `genreWeight`, `skyLiftMax`, `skyMoodShare`, `surpriseRange`, `skyElementStep`, `newMoonFirstShowingEvery`, `fullMoonStandingWeight`, `retrogradeIdleDays`, `highTasteLike`, `highTasteLikeReview`, `highTasteAll`, `highTasteCapPerGame`, `highTasteEarnedMax`.
- **The switches** (`true`/`false`): `learned`, `comeback`, `freeWatchers`, `firstShowing`, `surprises`, `quietSignals`, `echo`, `spacing`, `goodPick`, `testClips`, `learnedMood`, `sky`, `highTaste`, `parentYes`. `learned: false` gives standing alone. `sky`, `highTaste` and `parentYes` are off by default and in the private file until Open 2 is answered.
- **Loaded automatically, never by hand.** A workflow in RukenPrivate (unit J2) runs on every push to its `main` that changes `feed/settings.json`, and on demand: it checks the file, loads it into the Worker with `wrangler secret put FEED_SETTINGS --name ruken`, and then asks `/healthz/feed` until it answers `private`. A failed run is a red check on RukenPrivate's `main`. The Owner changes a number by changing the file in a pull request; nothing else.
- **`/healthz/feed`** (unit A) answers plain text: `private` when `FEED_SETTINGS` parsed with no fallback, `partial` when any key fell back, `defaults` when it is missing. It never names a key or a value. `/healthz` itself is unchanged.
- **The one access it needs** (Open 4): the Cloudflare token the "Deploy automatically from main" work already asks the Owner for, also set as a secret on RukenPrivate. Until it is set, the feed runs on the public defaults and `/healthz/feed` says `defaults`.

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
- **"You're all caught up"**: one frosted line between rounds; the feed keeps going under it.
- **"Good pick?"** (unit D): a frosted card at `ask.index`: the game's name, "Good pick?", and two big buttons, **Yes** and **No**. Either answer moves on; swiping past it counts for nothing.

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
- An under-18 without a parent's yes sees, in place of the chips: "Your feed doesn't learn from what you do until a parent says yes." and, once unit I is built and `parentYes` is on, the button **Ask a parent**.

### 6.3 Submitting and editing a game

Two new questions after "line": **mood** ("How does your game feel?", the twelve moods as big buttons) and **genre** ("What kind of game is it?", the eleven genres as big buttons). Both change from Check and send, and on a live game they change at once, like the name ("Keep them instant", 2026-11-21). If the command-line upload work (thread "Build command line sign-in and video uploads") has merged, it and the help guide's agent prompt (`src/routes/help/get-your-game-on-ruken/agent-prompt.ts`) take the same two answers in unit C.

Moods (**Owner**): Bold, Cosy, Clever, Heartfelt, Showy, Tidy, Friendly, Spooky, Adventurous, Tough, Weird, Dreamy. Genres (**Owner**): Action, Adventure, Puzzle, Story, Strategy, Role-playing, Platformer, Racing and sports, Building and life, Party and board, Other.

### 6.4 Test videos, on the maker's game page (`/make/<game>`)

- "Videos" lists up to three pairs (tall and wide), each with Change and Remove, and **Add another video** while there are fewer than three. A live game's new pair waits for staff, as a changed video does today.
- When a pair has been shown `testClipViews` times and its share of Play taps is under `fewPlayTapShare`: "Lots of people watch this video but few tap Play. Try another one." Never a number.
- A game whose first showing ended with few plays: "Few people have tapped Play on your game yet. A new video can help." (unit F).

### 6.5 A parent's yes (unit I, Opens 2 and 3)

The teen presses **Ask a parent**, types the parent's phone number, presses **Text my parent**. The parent gets: "Your teen <first name> asked for a Ruken feed that learns what they like. Say yes or no: <link>". The link opens a plain page with **Yes** and **No**. An unanswered ask ends after 5 days. After Yes, the same link shows **Turn it off** for as long as the yes holds. At 18 the full feed starts by itself.

### 6.6 How the feed works (`/help/how-the-feed-works`)

The approved public page draft's words, without its "Questions for the Owner on this page" section, linked from Your feed and the help list.

## 7. The plan

Each unit is one pull request on its own branch, built test first (journeys first), run through `verify`, with screens shot on the three devices when they change. Lane 3 units get an implementation audit (Opus 5.5, medium) as well as their checks; lane 2 units one fresh review. Builders: Sonnet 5.5, medium, in a fresh session per unit, with the execution prompt in `staged-path`; unit A is marked hard ("then high"): it is the core ranking, and its paging must never repeat or skip.

| Unit | Waits on | Owns | Output | Lane |
|---|---|---|---|---|
| A, the learned order | the infinite feed merged | `src/features/feed/` (`learned.ts`, `signals/*` as no-change modules, `settings.ts`, `cursor.ts`, `service.ts`; `order.ts` deleted); `src/features/play/` (one new read; `memberBeatsByGame` deleted); `src/routes/+page.server.ts`; `src/routes/api/feed/`; `src/routes/healthz/feed/`; `Feed.svelte` (the caught-up line only); tests | `page(viewer, after)` answers `{ clips, next, caughtUpAt, ask: null }` in the learned order | 2 |
| F, the few-plays note | A | `src/features/feed/first-showing-note.ts`; `/make/<game>` | the line of 6.4 | 2 |
| B, watching signals | A | migration `ClipView`; `signals/quiet.ts`; `cursor.ts` (put-in clips); `src/features/feed/views.ts`; `src/routes/api/feed/seen/`; `Feed.svelte` (sends views); `cloudflare/crons.js` if a new job address is needed; the account purge | interest, quick no, echo, second try, free watchers, viewer counts | 3 |
| C, mood and genre | B, F | migration `Game.mood`, `Game.genre`; `games/questions.ts`; two question screens; Check and send; `/make/<game>`; `signals/mood.ts` | every game can have a mood and a genre; the feed reads them | 3 |
| E, test videos | C | migration `GameClip.slot`, `GameHeldClip.slot`; `/make/<game>`; staff review of an added pair; the slot pick in `service.ts` | up to three pairs; the feed shows the best | 3 |
| D, Your feed | C | migration `FeedTaste`, `User.feedResetAt`, `GoodPickAsked`; `signals/taste.ts` (the "more"/"less" part); `/me/feed`; `Feed.svelte` (the ••• sheet, the Good pick card); `service.ts` (`ask`) | the player sees and changes what the feed thinks; Start over | 3 |
| G, Like, Save, Repost | D | migration `ClipLike`, `ClipSave`, `ClipRepost`; `Feed.svelte` (the buttons); Saved on You; the purge | real counts; each made and taken back by the person | 3 |
| H, the sky layer | Open 2, C | `src/lib/sky.ts`; `signals/sky.ts`; `docs/feed-sky.md` | hidden, switch off by default | 2 |
| I, a parent's yes | Opens 2 and 3, D | migration `ParentYes`; `/me/feed` (the ask); `/parent/<token>`; the text | an under-18 with a parent's yes gets the full feed | 3 |
| K, high-taste players | Open 2, G | migration `HighTaste`; `signals/highTaste.ts`; `src/routes/jobs/high-taste/`; the earned mark in the daily job (`cloudflare/crons.js` if a new job address is needed) | hidden, switch off by default | 3 |
| L, How the feed works | D, E, G | `src/routes/help/how-the-feed-works/`, the help list | the public page | 1 |
| J1, the private settings | nothing | RukenPrivate `feed/settings.json`, `feed/settings.md` (PR #18) | the real values | 1 |
| J2, the settings workflow | A, Open 4, a hook covering RukenPrivate pull requests | RukenPrivate `.github/workflows/feed-settings.yml`, `scripts/check-feed-settings.mjs` and its test | the real values loaded on every change | 3 |

**Why this order, and what runs side by side.** Every unit after A adds a signal module A made, so none edits another's module. The files that more than one unit edits are `Feed.svelte` (A, B, D, G), `/make/<game>` (F, C, E), `service.ts` (A, E, D) and `cursor.ts` (A, B); the units that touch each run one after another in the order above. So: A first. Then F and B side by side (F owns only its rule file and `/make/<game>`; B owns no file F touches). Then C (after both). Then E and D one after the other (both touch `service.ts`): E, then D. Then G after D, and H after C whenever Open 2 allows (H owns only `src/lib/sky.ts`, its module and its doc, so it may run beside E, D or G). I after D, K after G, each when its Opens allow. L last. J1 is done; J2 runs when its waits clear, beside anything.

**For every unit.** Every journey starts with `test.beforeEach(forgetRateLimits)` and shows each new or changed screen with `showTheOwner`. The journeys share one database, so they find their own game by `data-slug` and assert order only in unit and database tests. Every new thing a person makes has create, read, update (where it can change) and delete in a journey (CRUD in `build`). Every new table's `userId` and `gameId` is a foreign key with `onDelete: Cascade`, and a `FeedTaste` row of kind `maker` or `game` holds the user's or game's id (never a handle or slug), with the same cascade; the account purge test covers every new table and shows that another player's chip for a deleted maker is gone. A pull request that changes or deletes an existing test names each one and why. Lessons in `progress.md` whose trigger the diff matches are carried. No unit puts a value from `feed/settings.json` in RukenApp.

### Unit A: the learned order

- **A1.** `learnedOrder` is pure and deterministic: the same input in any input order gives the same output; a fixed seed gives a fixed order (golden list in `tests/features/feed/learned.test.ts`).
- **A2.** Standing (4.2): a member's play past `dailyCapMinutes` in a day counts the same as the cap; a maker's own play, staff play and a split member's play change nothing; a play outside the window changes nothing; a member coming back on a second day raises a game above one with the same total time on one day (with `comeback` on); recent days outweigh old.
- **A3.** First showing (4.3): a game live one day with no plays is in round 0's first slot; it stops being new at `firstShowingMembers` members or `firstShowingDays`, whichever comes first.
- **A4.** Learning (4.4): in a seeded world of two crowds (puzzle players and racing players), a viewer who played two puzzle games gets the other puzzle games before the racing games once those games pass `learnFromPlayers`; below it, standing decides.
- **A5.** Crowd viewers (4.1): a signed-out visitor and an under-18 without a parent's yes get no taste term: their order equals the order with every personal signal removed.
- **A6.** Surprises and spacing (4.5): over 1,000 seeded slots the share of surprises is within 2 points of `surpriseRate`; no two clips in a row share a maker when another game could go there; with `spacing` off, the same game is still never twice in a row, across a round's end too.
- **A7.** Paging (4.6), as invariants over seeded worlds: reading round 0 page by page gives each unplayed game exactly once; plays added between pages change no later page of that cursor; a game going live after `at` changes no later page; a game taken down after `at` is missing from its page and no other game is skipped or repeated; an unparsable cursor is a 400; an old-form, future, day-old or other-viewer cursor gives a fresh first page; every `key` in a feed read is unique; round 1 holds every game; rounds 1 and 2 differ for a catalogue of 10; a viewer who has played every game gets a full first page from round 1 with `caughtUpAt` 0; a viewer with one unplayed game gets it first, then round 1, `caughtUpAt` 1; `caughtUpAt` is null when round 0 does not end on the page; no games gives `{ clips: [], next: null, caughtUpAt: null, ask: null }`.
- **A8.** Settings (5): no secret gives the defaults; a partial secret overrides only its keys; a bad key logs its name and not its value; `learned: false` gives standing alone; `/healthz/feed` answers `defaults`, `partial` and `private` in turn, each tested, and never a key or value; `/healthz` and its test are unchanged.
- **A9.** The play read: one query answers per user, game and Chicago day the attentive beats and basis over the window, tested against Postgres (`*.pg.test.ts`), including a session that crosses midnight.
- **A10.** Budget: one page in under 300 ms in the Postgres test with 250 games, 1,000 players and 20,000 play days, measured and printed. If it fails, cache the play read per Worker for `at` rounded to 5 minutes, and say so.
- **A11.** Journey: a viewer seeded as having played all but two journey games opens the feed, sees those two, then "You're all caught up", and keeps going into round 1; the screen asks for the next page with the `next` it was given.
- **A12.** `order.ts`, `memberBeatsByGame` and their tests are removed, named in the pull request body.

Steps:
- [ ] 1. Journey A11, failing.
- [ ] 2. `settings.ts`, `/healthz/feed` and their tests (A8).
- [ ] 3. The play read and its Postgres test (A9).
- [ ] 4. `learned.ts` and the `signals/` list, test first, in the order A1, A2, A3, A4, A5, A6.
- [ ] 5. Re-read the infinite feed's merged contract; `cursor.ts` and the service's paging (A7); the route; the caught-up line.
- [ ] 6. The budget test (A10).
- [ ] 7. Remove the interim order (A12); `verify` on the three devices; the journey green.

### Unit F: the few-plays note

- **F1.** The line of 6.4 shows on `/make/<game>` when a game's first showing ended below `firstShowingMembers`, until the game passes it; never a number.

Steps:
- [ ] 1. Journey: a seeded game past `firstShowingDays` with few members shows the line; a game with enough does not. Failing.
- [ ] 2. The rule in `first-showing-note.ts`, test first.
- [ ] 3. The line on the page; `verify`; shots.

### Unit B: watching signals

- **B1.** `ClipView`: `id`, `userId`, `gameId` (both cascade), `clipSlot` (1 until unit E adds slots), `shownAt`, `watchedMs`, `ends` (times watched to the end), `playTapped`, `createdAt`. Index `[userId, shownAt]`, `[gameId, shownAt]`.
- **B2.** `POST /api/feed/seen` takes one clip's view when it leaves the screen (and on page hide, by `sendBeacon`): signed in only; an under-18 without a parent's yes gets 204 and nothing is stored; rate-limited like other posts; `watchedMs` capped at three times the clip's length.
- **B3.** `signals/quiet.ts` reads, for the viewer, interest (`ends ≥ 1`), a second look (`ends ≥ 2`) and quick no (`watchedMs < quickNoMs`, no Play); per game, views (for 4.3) and free watchers (for 4.2), counting only accounts with `phoneNumberVerified`: a test shows an unconfirmed account adds nothing.
- **B4.** The echo and second try go into later pages by 4.6's rule, kept in the cursor's `x`: a test shows the echo at the first slot at least `echoAfter` after its view, the second try first on the next page, each put in once, their keys unique, and the base order otherwise unchanged.
- **B5.** The daily job deletes `ClipView` rows older than `windowDays`; the account purge and a game's removal delete their rows. Tested against Postgres.
- **B6.** Journey: watch a clip to the end without Play, scroll on, and the game comes back later in the same scroll; swipe a clip away at once, open the feed again, and its game is not in round 0's first half.

Steps:
- [ ] 1. Journey B6, failing.
- [ ] 2. Migration and Postgres tests (B1, B5).
- [ ] 3. The route (B2), test first.
- [ ] 4. `signals/quiet.ts` (B3), test first.
- [ ] 5. Put-in clips in `cursor.ts` (B4), test first.
- [ ] 6. `Feed.svelte` sends the view; `verify`.

### Unit C: mood and genre

- **C1.** `Game.mood` and `Game.genre`, nullable enums. The two questions come after "line" for a new game; a live game without them shows them on its maker's page as "Two quick questions" and stays live meanwhile.
- **C2.** Changing either on a live game takes effect at once and does not send the game for review.
- **C3.** `signals/mood.ts` (switch `learnedMood`): once a game has `moodLearnPlayers` players, its mood weights mix the maker's pick with the moods of the games its players keep playing; genre counts `genreWeight` as much as mood.
- **C4.** Journey (CRUD): a maker answers both, sees them on Check and send, changes each, and the game page and feed still work; a game with neither still shows in the feed.

Steps:
- [ ] 1. Journey C4, failing.
- [ ] 2. Migration.
- [ ] 3. Questions and screens, test first (and the command line and agent prompt, if merged).
- [ ] 4. `signals/mood.ts`, test first.
- [ ] 5. `verify`; shots.

### Unit E: test videos

- **E1.** A game has one to three slots, each a tall and a wide clip; existing clips become slot 1. A new slot on a live game waits in `GameHeldClip` with its slot for staff's yes; removing the last slot is refused.
- **E2.** The feed shows each slot in turn (seeded) until each has `testClipViews` views, then the slot with the highest Play-tap share, with `testClipPriorTaps` taps and `testClipPriorViews` views added to each so a slot with few views is not crowned by luck (switch `testClips`).
- **E3.** The video note of 6.4 shows on its rule, never a number.
- **E4.** Journey (CRUD): add a second video, see it wait, accept it through `/jobs/review` (with its look), see both listed, change one, remove one.

Steps:
- [ ] 1. Journey E4, failing.
- [ ] 2. Migration.
- [ ] 3. Upload and review paths, test first.
- [ ] 4. The pick in `service.ts`, test first.
- [ ] 5. The note.
- [ ] 6. `verify`; shots.

### Unit D: Your feed

- **D1.** `FeedTaste`: `userId`, `direction` (`more`/`less`), `kind` (`mood`, `genre`, `maker`, `game`), `value` (a mood, a genre, or a user or game id), `createdAt`; unique on the four; maker and game rows cascade with their user or game. `User.feedResetAt`: personal signals before it are not read (plays stay, for pay). `GoodPickAsked`: `userId`, `gameId`, `askedAt`, `answer` (`yes`/`no`/null).
- **D2.** The ••• sheet's buttons write a `game` row; Less also keeps that game out of round 0 for `lessDays` (4.4), from the next open.
- **D3.** `/me/feed` (6.2): learned chips are the viewer's top moods, genres and makers by taste; suggestions are the next best not yet chosen; Add lists all moods, all genres, and the makers of games the viewer played; × deletes; Start over deletes their `FeedTaste`, `ClipView` and `GoodPickAsked` rows and sets `feedResetAt`.
- **D4.** Good pick? (4.5) comes through `FeedPage.ask` only on its rule; yes adds a `more` row for the game's mood, no a `less` row.
- **D5.** Journey (CRUD): add a chip, read it back, remove it, add a less chip, press More and Less on a clip and see the chips change, answer a Good pick, Start over and see the empty state; a second account cannot read or change the first's chips.

Steps:
- [ ] 1. Journey D5, failing.
- [ ] 2. Migration and purge.
- [ ] 3. `signals/taste.ts`'s more and less, test first.
- [ ] 4. The ••• sheet.
- [ ] 5. `/me/feed`.
- [ ] 6. Good pick, `ask` in `service.ts`, test first.
- [ ] 7. `verify`; shots.

### Unit G: Like, Save, Repost

**Owner, 2026-11-22, on a card:** "Yes, all three" ("Each clip gets Like, Save and Repost. Saves show on You. Reposts show on your page.").

- **G1.** One row per person and game for each; pressing again takes it back. A count on screen is a count of rows, nothing else.
- **G2.** Saved games list on You ("Saved"). Reposts show on You until players' pages are built (approved, not built).
- **G3.** A like is quiet interest for the order. Nobody can like, save or repost their own game.
- **G4.** Journey (CRUD) for each, and the purge test.

Steps:
- [ ] 1. Journey G4, failing.
- [ ] 2. Migration and purge.
- [ ] 3. The buttons and their routes, test first.
- [ ] 4. Saved on You.
- [ ] 5. The like in `signals/quiet.ts`'s interest, test first.
- [ ] 6. `verify`; shots.

### Unit H: the sky layer (hidden; Open 2)

- **H1.** `src/lib/sky.ts`: the sun's sign of a date, the moon's sign and phase at an instant, and whether Mercury is retrograde, from the injected clock, checked against at least 24 reference dates (sign changes, new and full moons, retrograde starts and ends in 2026 and 2027) listed in the test with their source.
- **H2.** `signals/sky.ts`, with `sky` on: a game's sign is the sun's sign on the Chicago day it went live; the moon in that sign, or in the sign whose mood (the private design 8 table) is the game's mood, lifts its score, mood weighted `skyMoodShare`, the lift never above `skyLiftMax`; the moon's element moves `surpriseRate` by `skyElementStep` as the private design 8.3 says, inside `surpriseRange`; a new moon sets first-showing slots to `newMoonFirstShowingEvery`; a full moon multiplies standing's weight by `fullMoonStandingWeight`; Mercury retrograde puts back games the viewer came back to and has not opened in `retrogradeIdleDays`.
- **H3.** Nothing on any screen, address, page title or response names a sign, the moon, a planet or the sky: a test reads every screen's words and the feed's responses for those words.
- **H4.** `docs/feed-sky.md` says the rules, not their strength (private design 13.4).

Steps:
- [ ] 1. H3's test, passing now and kept green.
- [ ] 2. `sky.ts` against its reference dates (H1).
- [ ] 3. `signals/sky.ts`, test first (H2), with the switch off and on.
- [ ] 4. `docs/feed-sky.md`.

### Unit I: a parent's yes (Opens 2 and 3)

Built as the Owner answers Open 3; this is the recommended answer, texting the parent.

- **I1.** `ParentYes`: `teenUserId` (cascade), `phoneHash`, `tokenHash`, `askedAt`, `answeredAt`, `answer`, `revokedAt`. One open ask per teen; three texts per teen a day; an ask unanswered after 5 days ends.
- **I2.** The flow of 6.5. The parent's page needs no account. Yes turns on the full feed at once; Turn it off returns the calm feed and stops recording; the teen can cancel an ask.
- **I3.** With `parentYes` off, Ask a parent is not shown and the parent's page says the link has ended.
- **I4.** Journey (CRUD): ask, see it waiting, the parent says yes (test texts as in the sign-up journeys), the full feed starts, the parent turns it off, the teen asks again and cancels; an ended ask's link says so.

Steps:
- [ ] 1. Journey I4, failing.
- [ ] 2. Migration and purge.
- [ ] 3. The ask and the text, test first.
- [ ] 4. The parent's page.
- [ ] 5. The full feed follows the yes (A5's rule with a yes), test first.
- [ ] 6. `verify`; shots.

### Unit K: high-taste players (hidden; Open 2)

Open 1 is answered "Yes, all three", so K counts likes and reposts as designed. Player reviews are not built, so the like-and-review and all-three tiers stay dormant until reviews exist.

- **K1.** `HighTaste`: `userId` (cascade), `source` (`picked`/`earned`), `since`. `POST /jobs/high-taste` with the jobs secret: `{"do":"add"|"remove","handle":…}`. The daily job marks as earned the players who were among a game's first members and whose games went on to the top of standing, at most `highTasteEarnedMax` at once, and unmarks those who no longer qualify.
- **K2.** `signals/highTaste.ts`, with `highTaste` on: a marked player's like counts as `highTasteLike` members' standing (like and review `highTasteLikeReview`, all three `highTasteAll`); capped per game at `highTasteCapPerGame`; never for a game they made or earn from; reach only, never pay.
- **K3.** Nothing tells anyone they are marked: no screen, no response, no count.
- **K4.** No made-up likes or saves, ever (private design 9).

Steps:
- [ ] 1. K3's test (the player's own screens and responses), passing now and kept green.
- [ ] 2. Migration and purge.
- [ ] 3. `/jobs/high-taste`: add and remove with the secret, refused without it, test first.
- [ ] 4. The earned mark in the daily job, in a Postgres test: marks, unmarks, the cap.
- [ ] 5. `signals/highTaste.ts`, test first: the tiers, the per-game cap, own game counts nothing, the switch.
- [ ] 6. An architecture test: nothing under `src/features/money/` imports the high-taste reader.

### Unit L: How the feed works

- **L1.** The page of 6.6; links on it 44 × 44; no `<style>` block (help rules).

Steps:
- [ ] 1. Journey: open it from Your feed and from the help list; its words. Failing.
- [ ] 2. The page and the two links; `verify`; shots.

### Unit J1: the private settings (RukenPrivate #18)

- **J1.** `feed/settings.json` holds every key and switch of section 5 with the private design's numbers, each with a one-line source in `feed/settings.md`, which also says the file is loaded by J2's workflow and records the values that were in RukenApp's public history.

Steps:
- [x] 1. Write both files.
- [ ] 2. Add the keys plan audit 1 asked for; drop the hand-run command; record the exposure.

### Unit J2: the settings workflow (RukenPrivate)

- **J2.** `.github/workflows/feed-settings.yml`, on push to `main` touching `feed/settings.json` and on `workflow_dispatch`: (1) `scripts/check-feed-settings.mjs` fails on any unknown key, missing key, wrong type, or private value equal to its public default in RukenApp `main`'s `src/features/feed/settings.ts` (switches excepted); (2) `wrangler secret put FEED_SETTINGS --name ruken` with the Cloudflare token secret; (3) asks `https://ruken.io/healthz/feed` until it answers `private`, at most 2 minutes, and fails otherwise. It never prints the file or a value.

Steps:
- [ ] 1. The check script's test (a good file, an unknown key, a wrong type, a value equal to its default), failing.
- [ ] 2. The check script.
- [ ] 3. The workflow.
- [ ] 4. The first real run watched to green; its link in the pull request.

## 8. Open, and what waits

1. **Open 1, likes, saves and reposts** (private design 9, 13.3). **Answered 2026-11-22 16:24 UTC by the Owner, on the card: "Yes, all three".** Unit G builds all three; K counts like, review and repost as designed; L keeps "Watching and liking help a little".
2. **Open 2, the lawyer's read** (private design 13.1): New York and California laws on feeds that learn from a child, and whether hidden boosts need saying in the terms. Asked as a card on 2026-11-22 ("Build now, switches off" recommended). Units H, I and K wait, since their code and migrations cannot be taken back once merged and one of the card's answers is not to build them yet.
3. **Open 3, how a parent says yes.** Asked as a card on 2026-11-22 ("Text the parent a code" recommended). Unit I waits.
4. **Open 4, the Cloudflare token on RukenPrivate** (section 5). New access for a second repository, so it is the Owner's: asked once, inside the "Deploy automatically from main" work's batch of Owner commands (the same token). Unit J2 waits.
5. **Not the Owner's: a hook for RukenPrivate pull requests.** In a repository without `rules.json`, creating a pull request is not checked (`progress.md`, hook follow-ups). J2 is a lane 3 pull request there, so it waits until a hook covers that route.

## 9. Risks, and what is not checked

- With a small catalogue and few members the feed will mostly look like "most played, plus surprises" for months, whatever is built (private design 12). The blend in 4.4 makes that happen by itself.
- The sky sums are low precision: a sign or phase can be off by some hours near a change. The lift is small, and H1's reference dates bound the error.
- Ranking on every page request may outgrow its budget as the catalogue grows; A10 measures it and names the cache.
- The viewer floor in 4.3 starts only with unit B; until then a first showing ends on members or days alone.
- Device profiles are emulation, not proof of how a phone performs.
