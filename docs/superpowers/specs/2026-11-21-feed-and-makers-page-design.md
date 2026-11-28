# The feed and the maker's page: the rest of slice 3

Date: 2026-11-21. Status: spec and plan in one, for the plan audit (unit K is lane 3); changed after plan audit 1 (`docs/superpowers/audits/2026-11-21-feed-and-makers-page-1-plan-audit.md`). Nothing here is built.

This is slice 3's remaining work, planned again against `main` at `e7e2577`. It replaces the old plan (`git show 2f1bde5^:docs/superpowers/plans/2026-11-14-slice-3-feed-maker-page.md`), which was written against `main` at `00d616d`, before slice 2's game page, play shell and player count existed. The old plan's branches A (themes), B (the page's rules) and G (the photo) are on `main` and are not planned again. What is left is its branches C to F (the feed's order, the feed, its controls, the price card over a clip) and H and I (the maker's page and editing it).

It builds on the main design (`2026-11-13-ruken-reels-linktree-design.md`, sections 5.1, 5.2, 5.3, 5.7 and 5.8) as amended by `2026-11-17-game-page-and-play-shell-design.md` (sections 0, 3.2, 3.3 and 6) and by `2026-11-14-maker-screens-redesign-design.md` (sections 1, 15.1 and 16). Read those with `CLAUDE.md` and the `build`, `this-repo`, `verify` and `visual-check` skills.

Lines marked **Owner** are the Owner's words or choices. Lines marked **Call** are this spec's choices; the Owner can overrule any of them. Lines marked **Open** wait for the Owner, and only the task that names them waits.

## 0. The Owner's direction

- **Owner, 2026-11-20, on a card:** "Ready to launch". Every roadmap slice up to launch is built, in order; this is the go for slice 3.
- **Owner** (main design 5.1): "Match the UI/UX of Instagram reels primarily"; "we have vertical video for vertical screens, horizontal video for horizontal screens."
- **Owner, 2026-11-17** (game page spec, 0 and 6): "players see the game on a reels like interface like this, but I'd prefer the bar be on the bottom like YouTube; we go to the game page when we click on the game, but not play". "Home and You only, for now" (the bar). "Bottom bar options: play/wishlist and follow with the profile pic, handle, game name, description, and playing audio". "The feed should be human first rather than game, when we click on the game that's when we see game page specific details". "not that we're there yet, but I'd like the feed sidebar options to be like, repost, share, comment, save".
- **Owner, 2026-11-17:** "All games must be playable on computer and mobile". There is no computer-only game, so the old plan's "This one needs a computer." is gone.
- **Owner, 2026-11-14** (main design 5.2): the price card is laid over the clip the person tapped, which stays on screen, dimmed, behind it.
- **Owner** (main design 5.3): "Match whatever linktree does with a slightly game focused twist, use A Dictionary of Color Combinations for the theming available." **Owner, 2026-11-14:** "Real icons" (the social icons), copied as path data from the CC0 `simple-icons` set, as files with their licence beside them; no package is added.
- **Owner, 2026-11-15** (redesign 16.1): "Your page should be fairly similar in the typeform type of way as we do game submission".
- **Owner, 2026-11-15, on a card** (redesign 15.1): red is only for acts that cannot be undone.

## 1. The outcome

Ruken opens straight into full-screen clips of games, one per swipe, each led by the person who made it. Pressing a game opens its page; Play is on both. Every maker has a page at a short address with their games, their links and their chosen colours, and makes it themselves, one question at a time.

It has failed, even if every test passes, if a person on a phone cannot tell what to press, if the feed stutters or fetches every clip at once, or if a maker's link ever sends a visitor to an address that was not checked as `https`.

## 2. Where the old plan and `main` disagree

Read on 2026-11-21, on `main` at `e7e2577`. Each line is settled here; the units below follow the right-hand column.

| The old plan said | `main` and the later designs say | This plan |
|---|---|---|
| `/g/<game>` opens the feed at that clip (Task 15) | `/g/<game>` is the game's own page (the Bento page, slice 2) | The game page stays. In the feed, pressing a game's name opens its page. Share sends `/g/<game>`. The feed has no `first` clip. |
| Play is the only thing with words; a person mark at the top right leads to `/me` | The bar, Home and You, floats at the bottom and "comes with the feed in slice 3"; the clip leads with its maker | The bar is built with the feed (unit D). No person mark. The game page's "← Ruken" becomes "← Back to the feed". |
| "This one needs a computer." on a phone, and `needsComputer` | No computer-only games | Not built. |
| The feed and the price card find a game's clip through `address("media")` and `isPhone` | `gamesServices().media(key)` and `deviceOf` | The units use what is there. |
| "First went live" is the first accepted review | A held yes takes effect on its decision day (`moreLiveGamesBy` works it out) | One rule, moved into one helper and used by both (unit C). |
| The feed's and the page's styles live in feature components | Slice 2 put the game page's styles in `look.css`; no `.svelte` file is in `src/features/` yet | The feed and a maker's page are still feature components with their own styles: main design 5.8 says these two screens do not wear the Card Table look, and it keeps every unit's files its own. The price card's backdrop is on a Card Table screen, so it is in `look.css`. |
| A small pip-red mark on the price card (Task 19) | `look.test.ts`: "red is only the danger button: no other rule uses the pip" | **Open 1, answered 2026-11-21: leave it off.** Not built. |
| Four card screens under `/make/page` (Tasks 24 to 26) | The maker's area is one question at a time on the felt (redesign 4, 13.1 "M4 to M6" and 16.1) | **Open 2, answered 2026-11-21: simple editing now.** Planned as rooms, one question each (unit I). |
| No session runs tests itself; every task is two pushes; the Owner says "fine" per branch | `CLAUDE.md` of 2026-11-20: quick tests run locally, CI is the gate, lanes decide reviews, the Owner sees the screens page at the slice's end | The units follow `CLAUDE.md`. |
| Old branches and tasks 1 to 8, 20 and 21 | Merged: `src/features/pages/` (themes, handle, links, photo, service), the gate's photo key, the purge | Not planned again. `liveGames`, `memberBeatsByGame`, `src/features/feed/` and `src/lib/random.ts` do not exist yet. |

Found on the way, reported and not fixed here:

1. (Built 2026-11-22, branch `claude/project-thread-mqxj7b`: the Wishlist button; Play is not refused before launch, on the Owner's word, see the wishlist spec's "Changed on 2026-11-22".) Nothing outside `src/features/launch/` asks the launch switch (`isOpen`, `launchServices`). The wishlist spec says Play is refused before launch and a Wishlist button stands in its place; today Play is offered and played whatever the date. That is "Before launch", item 1, part 2 on the roadmap. This plan leaves Play's place in the feed and on the maker's page as one link, so that work swaps it in one spot per screen.
2. A game named "New" or "Github" gets the address `new` or `github`, which `/make/new` and `/make/github` shadow, so its maker cannot open it. Unit I adds `/make/page` and guards all three in one constant (it has to guard `page`, and the same line and the same test cover the other two).
3. The feed takes turns between a game's videos (game facts spec, 2.9) only once a game can have more than one of each shape. Today it has one; the feed shows that one.
4. A game's page lists its maker's 18+ games in "More from" (`moreLiveGamesBy` answers them and the page's load does not filter). The Call below covers the feed and `/<handle>` only; that row is slice 2's and is left as it is.

## 3. What is built, and what is not

Built: the feed's order and service (C); the price card over the clip (F); a maker's page at `/<handle>` (H); the feed screen, the bar, Share, sound and the two first-open hints (D, with the old E folded in); editing your page (I); social icons (K).

Not built here, because each needs its own approval, data, spec or slice:

- Follow, Like, Save, Repost, Comment, the "For you" and "Following" tabs (**Owner:** "not that we're there yet"; the private feed design says likes, saves and reposts need the Owner's yes as features). The feed's right side holds Share alone; the others have room above it.
- The learned feed. It is approved (roadmap, slice 3, item 5: "the feed algorithm (approved): a learned feed, play time first") and it is in this slice, but it is not in this spec: it gets its own spec, and its rules and numbers are kept privately on the Owner's words. Nearby servers in the order (unit N of the servers spec) and taking turns between videos go with it. **Unit C's order is an interim order.** It is main design 5.1's simple one, and it differs from the approved feed rules, so it shipped only on the Owner's yes (**Open 3**, answered 2026-11-21: simple order first). It sits behind one pure function, so the learned feed replaces that function and nothing around it.
- Wishlist in place of Play before launch (found 1, above).
- Report on a clip and on a page; a page taken down; a new maker's first steps (slice 4).
- The "Your page" builder: a banner, sections to show and hide, layouts, a song, seven-day numbers (roadmap, slice 3, item 6; it waits for the Owner's "fine" on its board).
- The check on the real site (old branch J). It is the slice's end: the walk, the design review rounds, the screens page and the Owner's own walk (`staged-path`, "Slice end").

**Call: the feed and a maker's page leave out games rated 18+.** The redesign (section 12, "Who sees such a game") says an 18+ game is shown only to an account 18 or over that turned it on, after a warning, and "everywhere else, and for everyone else, the game does not exist: the feed, search, maker pages". None of that is built. Until it is, a clip that plays by itself in front of anyone must not be an 18+ game's. The game keeps its own page at `/g/<game>`, as today. Easy to change: one filter in the feed service and one in the page's load.

## 4. Boundaries

- **Dependencies:** none added. Two data files are copied in, as the colour data was: the social marks' path data from the CC0 `simple-icons` package (unit K), with its licence and its source record beside it.
- **Tools and environments:** cloud containers and CI only. Nothing runs on the Owner's computer (the repo is public). No new setting, secret, bucket or address.
- **Migrations:** one, in unit K (`ALTER TYPE "PageLinkKind" ADD VALUE 'social'`). It reaches the site's database when the Owner next runs `pnpm run deploy`. Undoing it is leaving the value unused; Postgres cannot drop an enum value without rebuilding the type. K is lane 3: it merges after its implementation audit passes, under the owner's standing permission of 2026-11-21 19:16 UTC recorded in `progress.md` History; the merge itself changes no database.
- **CI:** `.github/workflows/` does not change.
- **Spend:** none.
- **Expected duration** (estimates, for the overrun rule): C 3 hours, F 2, H 5, D 9, I 7, K 3, each plus its review. With the waves in section 6, about a day and a half of wall time before the slice's end.
- **Supported browsers:** the projects in `playwright.config.ts` (Chromium and WebKit; phone, phone sideways, tablet, tablet sideways, computer). They are emulation evidence. How the feed's scrolling feels on a real phone is the Owner's to judge on the deployed site, from steps the slice's end writes out; until then it is reported as not measured.
- **The one Owner step:** after the last merge, `pnpm run deploy` (it runs the migration first). `pnpm run deploy:games` is not needed: the gate does not change.

## 5. The screens

### 5.1 The feed (`/`)

Phone, upright. A wide window is the same screen with the wide clip; the band is at most 30rem wide at the bottom left, and the bar stays in the middle.

```
┌──────────────────────────┐
│ (speaker)                │  top left: sound on or off
│                          │
│     the game's clip,     │
│     the whole window,    │
│     looping              │
│                    (➤)   │  Share, right side, 48px
│ (photo) Night Owl        │  the maker: a link to their page
│ Floor Fifty              │  the game: a link to its page
│ Climb. Fall. Climb again.│
│ [         Play         ] │  blue, the one button with words
│      ( Home · You )      │  the bar
└──────────────────────────┘
   swipe up: the next game
```

- One game per screen. Swiping, the wheel and the arrow keys (also Page Up, Page Down and Space) snap to the next or the one before.
- An upright window shows the upright clip and a wide one the wide clip; both fill the window.
- The clip on screen plays without sound where a video may move by itself (`mayMove()` in `src/lib/quiet-video.ts`: never with reduced motion, Save-Data or under 4 GB of memory). Where it may not, it shows its first frame and a press on the speaker starts it. Every other clip is paused at its start.
- Pressing the clip opens its game's page (owner, 2026-11-22). Pressing the speaker turns sound on, and pressing again turns it off. Sound stays as set from one game to the next. The speaker mark shows which it is.
- **Human first** (Owner): the band leads with the maker's photo (or the first letter of their name in a circle) and their page's name, one link to `/<handle>`. A maker with no page has no such line. Then the game's name (`h2`) and its one line, one link to `/g/<game>`. Then Play, a link to `/g/<game>/play`, which works with no script.
- Share: the device's share sheet, or the link copied with "Link copied." beside the mark for 4 seconds, or "Copy the address from the bar at the top." A person who closes the sheet is told nothing. It sends `/g/<game>`.
- **A first open** (main design 5.7): on the first clip only, two lines in the middle of the clip, clear of the band: with a touch screen "Swipe up for the next game" and "Tap the speaker for sound"; without one "Scroll down for the next game" and "Click the speaker for sound". The first scroll, press or key takes them away and they never show again on that device (`localStorage`, `rk_seen_hints`). With no script they are never there.
- No game to show: the felt, the line "No games here yet." and the bar.
- The words sit on a flat band of `ink` at 60%, chalk on it (4.5:1 or more over a white clip, measured in a test). No gradient. Play is the Blue of every main button (`--pay`, white words), 48px tall at least, 12px corners. Fonts, corner sizes and colours come from the look's custom properties, never written again.
- Grandma: the game fills the screen. One button has words, and it says Play. Do nothing and the clip, who made it, the game's name and Play are all still there.

### 5.2 The bar

Home and You, floating at the bottom in the middle, on the feed, a game's page and a maker's page. Home is a link to `/`; You is a link to `/me` (signed out, `/me` already sends a person to sign in and back). Each is a word, 48px tall at least; the one for the screen a person is on is marked (`aria-current="page"`). It is not on the play screen, the maker's area or Ruken's card screens, which keep the wordmark as their way home. **Call:** those three screens only; "every screen" (game page spec 3.3) is read as every screen a player browses.

### 5.3 The price card over the clip (`/join`)

```
┌──────────────────────────┐
│░░ the clip they tapped ░░│  dimmed: felt-deep at 62%
│░┌──────────────────────┐░│
│░│ Join Ruken to play   │░│  the card, unchanged
│░│ (•) $9.99 a month    │░│
│░│ ( ) $99 a year       │░│
│░│ [    Continue      ] │░│
│░│ Not now              │░│
│░└──────────────────────┘░│
└──────────────────────────┘
```

When `next` is a live game's page or its play address, that game's clip for the window's shape is behind the card, playing where a video may move, under `felt-deep` at 62% (the same dim as the play menu). It takes no press and no focus, and a screen reader does not meet it. For any other `next`, or a game that is not live, the card sits on the felt as today. "Not now" goes back to the game's page for both addresses.

### 5.4 A maker's page (`/<handle>`)

```
         (photo)
        Night Owl               h1
        @night-owl
   I make small, hard games.
          ● ● ●                 the combination's colours
   ┌───────┐ ┌───────┐
   │ clip  │ │ clip  │          their games on Ruken
   │ Name  │ │ Name  │          the name: a link to the game's page
   │[Play] │ │[Play] │
   └───────┘ └───────┘
   [ My Discord           ]     their links, in their order
   ┌──────────────────────┐
   │ My other game        │     a game somewhere else
   │ A game on Steam      │
   └──────────────────────┘
        (▶) (◆) (✦)             social icons (unit K)
        ( Home · You )          the bar (unit D)
```

One column in the middle, 30rem wide at most; games sit two to a row on a phone and up to four on a wide window, each clip 9 by 16. The ground, the text and the buttons are the theme's four colours; a page with no theme picked wears felt, chalk and paper. Grandma: who this is, their games, then their links. Each game has Play. Each link says where it goes.

### 5.5 Your page (`/make/page`)

The maker's area's own look: the felt asks one thing, and paper is what she touches (`QuestionScreen` and its parts).

```
Your page                          the rooms, each a paper row and a link
  Address      ruken…/night-owl
  Name         Night Owl
  About you    I make small, hard games.
  Photo        Added
  Colours      Colours 48
  Links        3 links
See your page · Opened 12 times.
Back to your games
```

Each room is one question with Save, as changing a game's answer is today:

| Room | The question | The hint under it |
|---|---|---|
| Address | Pick your page's address | People find your page at `<this site>`/yourname. Use letters, numbers and hyphens. |
| Name | What should your page call you? | It is the big name at the top of your page. |
| About you | Say one line about you | It sits under your name on your page. Like: I make small, hard games. |
| Photo | Add a photo for your page | Players see it at the top of your page. A JPEG, PNG or WebP, up to 5 MB. |
| Colours | Pick your page's colours | You can change them any time. |
| Links | Your links, then "Add a link": What should the link say? then Where does it go? | A link starts with https:// |

A maker with no page yet meets the Address question first; saving it makes the page, with her address as its name until she changes it, and lands on the rooms with "Saved. Your page is live." **Call:** one question makes the page, so a page exists after one answer; the name room is next in the list. "Your games" gains one link, "Your page". `<this site>` is `url.host`, read from the request.

## 6. The plan

Six units. Each is one pull request from its own branch, built by one session with this spec, then reviewed as its lane says, then merged by its builder. Each unit's session starts with the execution prompt in `staged-path` and ticks its own tasks here, on its branch.

| Unit | Waits on | Files it owns | Output | Check | Lane | Model |
|---|---|---|---|---|---|---|
| C, the order and the feed service | nothing; **Open 3** answered 2026-11-21 | `src/features/games/service.ts`, `games.ts`; `src/features/play/sessions.ts`; `src/features/pages/service.ts`, `pages.ts`; `src/lib/random.ts`; `src/features/feed/` (`order.ts`, `service.ts`, `services.ts`, `feed.ts`); their tests | `feedServices().service.feed()` answers the clips in order | C1 to C6 | 2 | Sonnet 5.5, medium |
| F, the price card over the clip | nothing | `src/features/play/may-play.ts`; `src/routes/join/`; `src/lib/look.css`, `tests/lib/look.test.ts` (one class); `tests/browser/join.test.ts` | the clip behind the card | F1 to F5 | 2 | Sonnet 5.5, medium |
| H, a maker's page | C (it reads `liveGames`) | `src/features/pages/MakerPage.svelte`, `pages.browser.ts`; `src/params/handle.ts` and `src/params/index.ts` (where SvelteKit reads its matchers); `src/routes/[handle=handle]/`; `src/routes/+layout.svelte` (the one condition that hides the wordmark on a maker's page); `src/routes/g/[game]/` (the "Made by" link); `tests/browser/support/database.ts` (`givePage`); `tests/browser/maker-page.test.ts`, one case in `pay.test.ts` | `/<handle>` and `/<handle>/out/<link>` | H1 to H10 | 2 | Sonnet 5.5, medium |
| D, the feed screen | C; F (both edit `look.css` and `look.test.ts`); H (the feed links to `/<handle>`, and both edit `src/routes/g/[game]/` and `src/routes/+layout.svelte`: D builds on H's change to the layout). **Open 3** (answered 2026-11-21) | `src/features/feed/` (`Feed.svelte`, `Bar.svelte`, `feed.browser.ts`, `share.ts`, `current.ts`); `src/routes/+page.server.ts`, `+page.svelte`, `+layout.svelte`; `src/routes/g/[game]/+page.svelte` (the way back); `src/lib/look.css` (the game page's room for the bar); `tests/architecture.test.ts`; `.claude/skills/verify/SKILL.md`; the journeys in D's task 6 | the feed at `/`, the bar on three screens | D1 to D14 | 2 | Sonnet 5.5, high: video, snap scrolling and autoplay behave differently in Chromium and WebKit |
| I, editing your page | H (its screens open `/<handle>`). **Open 2** (answered 2026-11-21) | `src/routes/make/page/`; `src/routes/make/+page.svelte`, `+page.server.ts`; `src/features/pages/ThemePicker.svelte`, `words.ts`, `pages.ts`, `pages.browser.ts`; `src/features/games/service.ts` (the reserved words); `src/lib/look.css` and `tests/lib/look.test.ts` if a room needs a class the look lacks; `tests/browser/edit-page.test.ts` | `/make/page` and its rooms | I1 to I11 | 2 | Sonnet 5.5, medium |
| K, social icons | H and I (it adds to `MakerPage.svelte` and to I's links room) | `prisma/schema/pages.prisma`, one migration; `src/features/pages/links.ts`, `service.ts`, `library/social-icons*`; `MakerPage.svelte`; `src/routes/make/page/links/`; their tests | a row of marks on a page | K1 to K6 | 3 | Sonnet 5.5, medium |

**Why this order.** C and F share no file and no output, so they start together. H reads C's `liveGames`. D reads C's service, links to H's route, and edits files F and H edit (the layout among them), so it starts from a `main` that holds all three. I's journeys open H's page. D and I share only `look.css` and `look.test.ts`, and only if a room needs a new class: then I waits on D; otherwise they run side by side. K adds to what H and I made. So: C and F; then H; then D and I; then K. At most three write at once.

**Lessons carried** (`progress.md` History): a session that waits on CI watches the run in the foreground and never ends its turn only to wait. A journey waits for the thing it is about to measure, not for the address to change (the flaky `addDraft` fix). A press that waits for the site's answer gets `SITE_ANSWER_TIMEOUT`; finding a button still fails in 5 seconds.

**For every unit.** Test first, the hardest to fool first: the journey, then the pieces under it. Quick tests run in the container before a push; the full run is CI's. Every journey file starts with `test.beforeEach(forgetRateLimits)`. Every new or changed screen is shown with `showTheOwner(page, testInfo, "<screen>")`. The journeys share one database, so the feed at `/` holds every game any journey made: a journey finds its own game's clip by `data-slug` and asserts the order only in unit and database tests. The journeys' clips are real videos today (`realClip`), but no journey asserts that a video is playing on a runner that may refuse to play one: it asserts what Ruken's page decides (which clip is current, whether sound is on, which addresses the sources have). A pull request that changes or deletes an existing test names each one and why. Before each commit that changes behaviour the builder runs the change through `verify`. Words on screens are the words in this spec; a change to them is a deviation to report.

### Unit C: the order and the feed service

Acceptance:

- **C1.** `liveGames(filter?: { makerUserId?: string })` on the games service lists every live game (of one maker only, with the filter) as `ListedGame`: a `LiveGame` plus `liveSince: Date`. A draft, a waiting, a sent-back and a taken-off game are not listed.
- **C2.** `liveSince` is the moment the game's first accepted review took effect: when it was decided, or for a held yes when its decision day went out; with no such review, when its live copy was made. It does not move when an update is accepted or the game is taken off and put back. `moreLiveGamesBy` uses the same helper, and its existing tests pass unchanged (old against new).
- **C3.** `memberBeatsByGame(since: Date, now: Date)` on the play service answers, per game, the number of attentive beats received from `since` to `now` in sessions whose basis is `member`. A free game's, staff's and a maker's own beats are not counted. One query, added up by the database, that reads only sessions started at or after `since` less `PLAY_SESSION_LIFE_MS` (as the money roll-up bounds its own read). `PlaySession`'s indexes are (`userId`, `startedAt`) and (`gameId`, `startedAt`); the query names no game, so it does not use the second, and the `startedAt` bound is what limits the read; a game with none is not in the map.
- **C4.** `seededNumber(seed, key)` in `src/lib/random.ts` is the 32-bit FNV-1a hash of `seed + "\n" + key`: the same two words give the same whole number from 0 to 4,294,967,295. `feedOrder(games, nowMs, seed)` in `src/features/feed/order.ts` puts games that went live under seven days ago first, newest first; then the rest, most played first; ties go by `seededNumber(seed, id)`, then by `id`. The same input in any order gives the same output, and tied games change places between days.
- **C5.** `makersOf(userIds)` on the pages service answers, for each account that has a page, its `handle`, `name` and `photoKey`. `handlesOf` stays.
- **C6.** `feedServices().service.feed()` answers `FeedClip[]`: `{ slug, name, oneLine, upright, wide, maker: { handle, name, photo } | null }`, the clips and the photo as whole addresses (`gamesServices().media`), in `feedOrder` (beats since seven days ago; the seed is `chicagoDayOf` the injected clock's time), without games rated `age_18`, and 50 at most (`FEED_MAX`). No live game: an empty list. `feed` imports `games`, `play` and `pages` only through their entry files; the layer test passes.

Tasks:

- [x] 1. `liveGames` and the shared "first went live" helper, test first in `tests/features/games/service.pg.test.ts` (C1, C2).
- [x] 2. `memberBeatsByGame`, test first in `tests/features/play/sessions.pg.test.ts` with `TestClock` (C3).
- [x] 3. `seededNumber` and `feedOrder`, test first in `tests/lib/random.test.ts` and `tests/features/feed/order.test.ts` (C4): newest first among the new; most played among the rest; a game stops being new at exactly seven days; ties the same whatever order they came in, and different across ten days' seeds; no games, no order.
- [x] 4. `makersOf`, test first in `tests/features/pages/service.pg.test.ts` (C5).
- [x] 5. The feed service, test first in `tests/features/feed/service.test.ts` with plain functions for its deps and `TestClock`, no database (C6): the order, whole addresses, the maker or null, no 18+ game, the `since` it asked for, one order across two clocks on one Chicago day, 60 games give 50.

### Unit F: the price card over the clip

Acceptance:

- **F1.** `backFromPaywall(next)` answers `/g/<slug>` when `next` is `/g/<slug>` or `/g/<slug>/play`, and `/` for anything else. Its test gains the first case; the others stand.
- **F2.** `/join`'s `load` gains `backdrop: { upright: string; wide: string } | null`: the two clip addresses of the live game `next` names, or null for any other `next` or a game that is not live. With no game in `next`, `gamesServices()` is not called, so the card still opens on a site with no games settings.
- **F3.** With a backdrop, the page has one `<video>` behind the card showing the clip of the window's shape, started by `quietVideo`, with `aria-hidden="true"` and `tabindex="-1"`, under one flat layer of `felt-deep` at 62%. Tab never reaches it and a press on it does nothing. The class is `backdrop`, one rule in `look.css`, listed in `look.test.ts`.
- **F4.** The card, its words and its buttons do not change: `expectOneCard` passes over a backdrop, "Not now" goes to `/g/<slug>`, and every existing `/join` journey passes unchanged.
- **F5.** `/join?next=/me`, `/join?next=/g/no-such-game/play` and `/join?next=/g/x/play/beat` answer 200 with the card on the felt and no video.

Tasks:

- [x] 1. The journey first, in `tests/browser/join.test.ts`: a stranger presses Play on a game's page and meets the card over that game's clip (F3, F4), `showTheOwner` "the price card over a clip"; the three addresses of F5.
- [x] 2. `backFromPaywall`, test first (F1).
- [x] 3. The load, the video and the `backdrop` rule (F2, F3).
- [ ] 4. ~~**Open 1, only if the Owner says keep the mark:** one empty `<span class="pip" aria-hidden="true">` on the price card (not on the member's or the paused card), a 12px diamond 1.25rem from the card's top and right; the `.pip` rule sits with the card's rules, above `main.gamepage` in `look.css`, so the game page's "uses no pip (red) anywhere" (`tests/lib/look.test.ts:556`) stands unchanged; "red is only the danger button" (`tests/lib/look.test.ts:103`) becomes "the danger button and the pip mark", named in the pull request. Otherwise this task is struck and nothing red is added.~~ Struck: the Owner said leave it off (2026-11-21).

### Unit H: a maker's page

Acceptance:

- **H1.** `src/params/handle.ts` matches a path only when `isHandleShape` does. Ruken's own routes are fixed paths and still open (`/me`, `/join`, `/make`); a path with a capital or a dot is the ordinary missing page.
- **H2.** `/<handle>` for a page that exists shows, in this order: the photo (`<img alt="" width="96" height="96">`, round) or the name's first letter in a circle; the name as `h1`; `@handle`; the one line if there is one; one dot per colour of the theme; the maker's live games that are not 18+, newest first, in `<section aria-label="Games">`, each an `<article>` with its upright clip (`quietVideo`), its name as an `h2` link to `/g/<slug>` and a Play link to `/g/<slug>/play`; the links that are not hidden, in the maker's order, in `<nav aria-label="Links">`: a link as a button, a game somewhere else as a card with its title and "A game on `<site>`". The title is `<name> · Ruken`. No wordmark header.
- **H3.** The page wears its theme: `main`'s background and colour are the theme's ground and text, a link's are its button and button text; a page with theme 0 is felt and chalk with paper buttons. The four colours reach the page as custom properties set in `MakerPage.svelte`, which holds the page's styles; the route files hold no class and no style.
- **H4.** A page with no live games has no "Games" section. A page with no links has no "Links" navigation.
- **H5.** A link's `href` is `/<handle>/out/<id>`, with `rel="nofollow ugc noopener"`. `GET /<handle>/out/<id>` answers 303 to the stored address for a link of that page that is not hidden, and 404 for a hidden link, another page's link or a made-up id, counting nothing. The address is read from the database, never from the request.
- **H6.** A visitor's open raises `views` by one and a visitor's tap raises that link's `taps` by one; the maker's own open and tap raise neither.
- **H7.** Landing on `/<handle>` remembers the arrival (`membershipServices().arrival.remember`), and a member who came through a maker's page, pressed Play on their game, signed up and paid has that maker and `/<handle>` on their membership's start (one case in `pay.test.ts`).
- **H8.** An address nobody has is the missing page with its way back.
- **H9.** A 40-letter name, a 60-letter link title and a 100-letter line push nothing sideways on the smallest phone (`scrollWidth` equals `clientWidth`); every link and Play is 48px tall at least; the page works with the keyboard alone and focus shows.
- **H10.** On a game's page, "Made by" is one link to the maker's `/<handle>` (game page spec 3.2).

Tasks:

- [x] 1. `givePage` in `tests/browser/support/database.ts` takes an address, a theme and links, and answers the address and the links' ids; `pageCounts(handle)` reads the two counts. (The rooms arrive in unit I, so H's journeys write rows.)
- [x] 2. The journeys first, in `tests/browser/maker-page.test.ts` (H2 to H9), each screen shown: "a maker's page", "a maker's page, Ruken's colours", "a maker's page with no games".
- [x] 3. The matcher, registered in `src/params/index.ts` beside `question`, and its unit test in `tests/params/handle.test.ts` (H1). The layout's condition that hides the wordmark on `/[handle=handle]` (H2).
- [x] 4. `MakerPage.svelte`, re-exported from `pages.browser.ts`, and the page's route and load (H2 to H4, H7, H8).
- [x] 5. The out route (H5, H6).
- [x] 6. The "Made by" link and its case in `tests/browser/game-page.test.ts` (H10).

### Unit D: the feed screen

Acceptance:

- **D1.** `/` shows the feed (5.1): one `<main>` that scrolls and snaps, one `<section data-slug aria-label={name}>` per clip, each the window's size. The title is "Ruken". No wordmark header. "Coming soon" is gone.
- **D2.** The clip of the window's shape is the one shown, in Chromium and in WebKit: the upright clip on an upright window, the wide clip on a wide one, and turning the window changes it. (Two `<source>` elements with `media`, if both engines honour it; otherwise picked by script as the game page does, and the pull request says which.)
- **D3.** At most two clips are fetched before a person scrolls: the one on screen and the next. A journey counts the requests to the media address. Every other video has `preload="none"`.
- **D4.** The band: the maker's line is a link to `/<handle>` and is absent for a maker with no page; the game's name is an `h2` inside a link to `/g/<slug>`; Play is a link to `/g/<slug>/play`, Blue with white words, 48px tall at least, 12px corners. Among the things to press in a clip, only Play has words.
- **D5.** Chalk on the band over a white clip is 4.5:1 or more, measured in a test from the band's computed colour.
- **D6.** The section that fills 60% or more of the window is the current one (`data-current="true"`), and only one is. Its video plays where `mayMove()` allows; the others are paused at their start. `currentOf(ratios)` is a pure function with its own test.
- **D7.** Pressing the clip opens its game's page (owner, 2026-11-22); the speaker mark in the top corner, a button named "Sound" with `aria-pressed`, flips sound for every clip. The press on the clip never covers the speaker, Play, Share, the two links or the bar.
- **D8.** Share: `shareLink(tools, link)` is pure and answers `shared`, `closed`, `copied` or `manual`; the screen shows "Link copied." or "Copy the address from the bar at the top." in a `role="status"` for 4 seconds, and nothing for the other two. The link is `<origin>/g/<slug>`.
- **D9.** The hints (5.1): shown on the first clip only, in the device's words, clear of Play; gone for good after the first scroll, press or key; never with no script; with reduced motion they go at once and the scroll does not glide.
- **D10.** The arrow keys, Page Up, Page Down and Space move one clip. Everything is reachable with Tab in a sensible order, and focus shows.
- **D11.** The bar (5.2) is on `/`, `/g/[game]` and `/[handle=handle]` and nowhere else; Home and You are 48px tall at least; the screen a person is on is marked. On a game's page nothing is hidden under it, and "← Ruken" reads "← Back to the feed".
- **D12.** No clip to show: "No games here yet." and the bar. (The feed service's empty list is pinned in unit C; the screen is pinned by a component test or a journey against an empty feed, whichever the builder can make steady.)
- **D13.** A 60-letter game name pushes nothing sideways on the smallest phone.
- **D14.** `tests/architecture.test.ts` gains: a `.svelte` file under `src/features/` is imported from outside its feature only through that feature's `.browser.ts`. `verify`'s line about the main screen describes the feed, and its driver script opens it.

Tasks:

- [x] 1. The journey first, in `tests/browser/feed.test.ts`: "Ruken opens straight into the feed, with the right clip for the screen" (D1, D2, D4), shown as "the feed".
- [x] 2. `Feed.svelte`, `feed.browser.ts`, the route and its load (`feed()`), the layout's condition for screens with no wordmark, building on H's (D1 to D5, D13).
- [x] 3. `Bar.svelte`, drawn by the root layout for the three routes; the game page's way back and its room at the foot (D11), shown as "a game's page with the bar" and "a maker's page with the bar".
- [x] 4. `current.ts`, playing and sound, test first (D6, D7), in `tests/features/feed/current.test.ts` and `tests/browser/feed-controls.test.ts`.
- [x] 5. `share.ts` and the Share mark, test first (D8).
- [x] 6. The hints, test first (D9), shown as "the feed on a first open". The empty feed (D12), shown as "the feed with no games".
- [x] 7. The placeholder home page goes, and with it `tests/browser/home.test.ts` and the home page's cases in `tests/browser/look.test.ts` and `tests/browser/look-layout.test.ts`. Every journey that opened `/` for the placeholder (the builder searches `tests/browser/` for `goto("/")`, `toHaveURL("/")`, "Coming soon", "Your games" and "Back to Ruken"; `sign-in`, `sign-up`, `me`, `mailed-links`, `make-walk` and `support/account.ts` are a hint of where, not a boundary) is read and changed only where it named the placeholder's own words; each change is named in the pull request. A screen replaced is not a test loosened.
- [x] 8. The architecture case and `verify` (D14); the request count (D3); the keys (D10).

### Unit I: editing your page (Open 2)

Acceptance:

- **I1.** `/make/page` needs an account: signed out, a person goes to sign in and comes back.
- **I2.** With no page, `/make/page` shows the Address question. A good address makes the page (its name is the address) and lands on the rooms with "Saved. Your page is live." in a `role="status"`.
- **I3.** The rooms (5.5) list what is saved, each row a link to its question; "See your page" opens `/<handle>`; "Opened `<n>` times." comes from `timesWords` ("1 time", "12 times", "1,204 times").
- **I4.** Each room saves through the pages service and comes back to the rooms; a refusal shows the service's own words under the answer, keeps what was typed and puts the keyboard there: "Use at least 3 letters or numbers.", "That one is taken. Pick another." (for a reserved word and for another maker's address alike), "Your page needs a name.", "The one line can be up to 100 characters.", "Pick one of the colours shown."
- **I5.** Changing the address moves the page: the old one is the missing page and the new one opens.
- **I6.** Colours: one choice for Ruken's own colours and one per offered theme, each a tile in that theme's ground with "Aa" in its text colour and a bar in its button colours, 48px tall at least, named "Ruken's own colours" or "Colours `<id>`". A posted number that is not offered is refused and the page keeps its colours.
- **I7.** Photo: the picker takes a JPEG, PNG or WebP; with script the picture is cut to a square of 512px at most before it is sent (`cropSquare`); a file that is not a picture is refused in the service's words; "Remove photo" is the quiet way out; the page shows the new photo and the old one's address answers 404.
- **I8.** Links: the list shows each link as it will appear, with "tapped `<n>` times", and Up, Down, Hide or Show, and Remove (no Up on the first, no Down on the last). Adding is two questions, the words then the address, with "A game somewhere else" as a choice on the first. A link that is not `https` is refused with "A link starts with https://". Thirty is the most.
- **I9.** Nobody changes another maker's page or links: a posted id that is not hers is the missing page and nothing changes.
- **I10.** "Your games" has one link, "Your page".
- **I11.** A game cannot take the address `new`, `github` or `page`: `freeSlug` treats them as taken, and a test reads the first-level folders of `src/routes/make/` that hold a route (a `+page` or `+server` file anywhere inside; `parts` holds none and is skipped) and fails when one that has an address's shape is not on the list.

Tasks:

- [x] 1. The journey first, in `tests/browser/edit-page.test.ts`: a maker makes her page from nothing and sees it live (I1 to I3), each screen shown.
- [x] 2. The reserved words (I11) and the "Your page" link (I10).
- [x] 3. Address, Name and About you (I2, I4, I5); `timesWords`, test first.
- [x] 4. Colours, with `ThemePicker.svelte` (I6).
- [x] 5. Photo (I7).
- [x] 6. Links (I8, I9).

### Unit K: social icons (lane 3)

**Moved to slice 4, Pages** (the owner, 2026-11-28 02:08 UTC: "Yes", to holding it there and closing slice 3 without it). Its build waits as draft pull request #443 and is reworked with the page builder there.

Acceptance:

- **K1.** `src/features/pages/library/social-icons.json` holds one path (`d`, drawn in a 24 by 24 box) per site id and no other key; each path starts with `M` and holds only path letters, digits, spaces, commas, dots and minus signs. `social-icons-LICENSE.txt` is the package's licence and says CC0; `social-icons-source.json` names the package, its version, its tarball and its integrity, measured from the download. The package is not in `package.json`. If the licence is not CC0, or a mark is missing from the package, stop and report; a missing mark's site is left out.
- **K2.** `SOCIAL_SITES` and `socialSiteOf(url)` in `links.ts`: YouTube, Twitch, Discord, X, Bluesky, Instagram, TikTok, Steam, itch.io and GitHub, each found from its hosts; anything else is null.
- **K3.** The migration adds `social` to `PageLinkKind` and nothing else. Two checks that fail by themselves: a case in `tests/features/pages/schema.pg.test.ts` reads `enum_range(NULL::"PageLinkKind")` from the migrated test database and expects exactly `link`, `game_elsewhere`, `social`; and the migration file's statements, comments aside, are exactly the one `ALTER TYPE`.
- **K4.** `addLink` with kind `social` on a known site is stored; on any other it is refused with "We don't have an icon for that site yet. Add it as a link." `pageByHandle`'s links gain `social: { id, name } | null`.
- **K5.** On the page, social links sit after the links in `<nav aria-label="Elsewhere">`, each a 48px round link named for its site, through `/out/`, and are not among "Links".
- **K6.** The links room's first question gains the choice "A small icon, for YouTube, Discord and the like".

Tasks:

- [x] 1. The data files and their test, `tests/features/pages/social-icons.test.ts` (K1).
- [x] 2. `socialSiteOf`, test first (K2). The migration, with its two checks in `tests/features/pages/schema.pg.test.ts` first (K3). The service, test first (K4).
- [x] 3. The page's row and the room's choice, journeys first (K5, K6), shown as "a maker's page with social icons".

## 7. The quality bar, for the slice

Beyond each unit's criteria (`build`, "Quality bar"):

- Every journey works end to end with its empty, error and recovery states: an empty feed, a missing page, a refused answer, a hidden link.
- Everything works with the keyboard alone and focus is always visible.
- No one reaches another person's page, links or counts; a visitor is never sent to an address that was not stored as `https`.
- The browsers in section 4 pass.
- Budgets, measured in a journey: the feed fetches at most two clips before a scroll (D3); after a key the next clip is current within one second on the CI runner. A real phone's smoothness is not measured here.

## 8. Open, and what waits

1. **The red mark on the price card.** Owner, 2026-11-14: "Keep it". Owner, 2026-11-15: red is only for acts that cannot be undone, and the look's test now holds that. Asked as a card on 2026-11-21, with "leave it off" recommended. Only F's task 4 waited. **Answered 2026-11-21 by the Owner, on the card: leave it off.** F's task 4 is struck and nothing red is added.
2. **Editing your page now, or with the builder.** Asked as a card on 2026-11-21, with "simple editing now" recommended. Only unit I waited; if the Owner says wait, unit K loses K6 and nothing else changes. **Answered 2026-11-21 by the Owner, on the card: simple page editing now.** Unit I is built as planned.
3. **The interim order.** Unit C's order (C3, C4) is not the feed the Owner approved on 2026-11-15; it is the main design's earlier, simpler one. Asked as a card on 2026-11-21, with "simple order first" recommended: it lets the feed's screens be built and seen while the learned feed is planned. C's tasks 2, 3 and 5 and unit D wait. If the Owner says wait for the learned feed, C3, C4 and tasks 2 and 3 are struck, C6's order comes from the learned feed's spec, and D waits on that spec's order. **Answered 2026-11-21 by the Owner, on the card: simple order first.** Unit C and unit D are built on the interim order.

**What follows this spec inside slice 3.** The learned feed (roadmap item 5) gets its own spec, started by the coordinator, with its rules in the private repository. The slice's end (the walk, the design review rounds, the screens page, the Owner's walk) comes after it, so they show the feed that launches. "Your page" (item 6) still waits for the Owner's "fine" on its board.

Everything else is decided: the Owner's words in section 0, or a Call the Owner can overrule.

## 9. Risks, and what is not checked

- **Video in two engines.** Autoplay, `<source media>` and snap scrolling differ between Chromium and WebKit, and a CI runner may refuse to play a video at all. The journeys assert what Ruken decides, not that pixels move; the walk at the slice's end and the Owner's own phone are where playing is seen.
- **The feed adds up a week of members' beats on every open.** One sum, bounded by when a session started (C3). If the site's numbers ever show it slow, the first thing to try is the sum the money roll-up already keeps per day (`PlayDay`), with today's beats added. Not measured against a large table.
- **The interim order is replaced.** The learned feed (roadmap item 5, approved) throws away `feedOrder` and `memberBeatsByGame` and keeps everything around them. Until then the feed's order is not the approved one; that is Open 3's question.
- **Counts include programs.** A page's views and a link's taps count every visitor that is not the maker, crawlers included, with no record of who.
- **A photo sent with no script** is stored as the camera wrote it, details and all; nothing on the server redraws a picture.
