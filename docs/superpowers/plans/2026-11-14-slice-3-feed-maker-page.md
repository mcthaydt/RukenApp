# Slice 3: The Feed and the Maker's Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ruken opens straight into full-screen clips of games, one per swipe, and every maker has a page at a short address with their games, their links and their chosen colours.

**Architecture:** Two new features in the one SvelteKit app. `pages` (a maker's page: its address, name, photo, links, colours and counts) sits above `games` and `play`; `feed` (the order of the clips, the clip screen, share, the first-open hints) sits above `pages`. Each feature keeps its screen as a Svelte component of its own, reached through the feature's browser entry, so the feed and a maker's page carry their own styles and the files under `src/routes/` stay plain. The feed's order and a theme's colours are pure functions. A maker edits their page on four small card screens under `/make/page`.

**Tech Stack:** as slices 1 and 2 (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers, R2 through slice 2's `FileStore`). New: one data file, `colors.json` from the MIT-licensed `dictionary-of-colour-combinations` 1.0.2, copied in (design 5.3: "It is not a dependency"). **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md` (sections 5.1, 5.2 "the card is … laid over the clip", 5.3, 5.6, 5.7 "A viewer's first open", 5.8, 7.1, 8, 10). Read it with `CLAUDE.md`, `AGENTS.md`, slice 1's plan (`docs/superpowers/plans/2026-11-13-slice-1-accounts-membership.md`: "How a task runs", "The look", "Notes for the plans that follow") and slice 2's plan (`docs/superpowers/plans/2026-11-13-slice-2-games-play.md`: "The Owner's decisions … and the Calls", Tasks 11, 13, 16 to 22, 26, 30, and "Notes for the plans that follow").

**Planned against:** `main` at `00d616d` (slice 1 merged; slice 2's branches A, B and C and its Task 29 merged; D to G not yet), plus what slice 2's plan says its later branches will produce. Nothing of slice 2's branches D to G could be read as code. "What this plan relies on", below, names each piece; if one is not on `main` as named when its task starts, stop and report.

## Global Constraints

- No session runs tests, lint or typecheck itself. Push, then read CI on the pull request (CLAUDE.md, Owner 2026-11-13).
- Every task is test-first, in two pushes, exactly as slice 1's "How a task runs" says: red (the test and stubs that throw `not built yet`), then green. A pull request is opened as a draft at the first push and marked ready only when its branch's last task is green.
- No new dependency. Anything that seems to need one is a stop: report it with the exact name and version, for the Owner's yes.
- `.github/workflows/ci.yml` does not change in this slice.
- This repository is public. No secret, real address or key goes in. No strategy, research or reason behind a business decision goes in any file, comment, commit or pull request.
- Not built in this slice, because the design says later or another slice owns it: like, save, follow, the "For you" and "Following" tabs (design 5.1: "come later"); Report on a clip and on a page (slice 4, with moderation); what a person saved and who they follow on `/me` (they arrive with save and follow); the maker's three-step onboarding (slice 4, which wraps this slice's `/make/page` screens as its steps 1 and 2). No button, table or column is made for any of them (CLAUDE.md: build nothing ahead of its user).
- Nobody types a fact. A page's views and a link's taps are counted by the server when they happen; no form has a field for a count.
- Time comes from an injected `Clock`. Feature code never calls `Date.now()` or `new Date()` with no argument. The feed's order takes its seed as an argument.
- Layers: `pages` may import `accounts`, `membership`, `games` and `play`; `feed` may import those and `pages`. Both are already in `FEATURE_ORDER`. A route, a component and `src/params/` reach a feature's browser code only through `src/features/<feature>/<feature>.browser.ts` (slice 2, Task 22), and its server code only through `<feature>.ts`. Tests live only in `tests/`, mirroring `src/`.
- Links a maker adds are `https://` only, are stored as they were checked, and are the only addresses Ruken ever sends a visitor on to.
- Comments say why, never which plan asked.
- Every screen and message passes the drunk grandma test. The words in this plan are the words to ship; a change to them is a deviation to report.
- The look. Ruken's own screens (the four `/make/page` screens, `/join`) wear the Card Table look from `src/lib/look.css` and only its classes; no file under `src/routes/` gets a `<style>` block, a `style=` attribute or a colour of its own. The feed and a maker's page do not wear it (design 5.8): their styles live in their feature's component. They still take the look's fonts, its two corner sizes (buttons 12px, cards and panels 20px) and its 48px least height for anything pressed. Pip red appears once in the whole site: the one small mark on the paywall card (Task 19), never on a button. "Continue to payment" stays the Blue `pay` button.
- Every journey file starts with `test.beforeEach(forgetRateLimits)`. Every new or changed screen is attached with `showTheOwner(page, testInfo, "<screen>")`, which gives the Owner a phone and a computer screenshot named `look: <screen>`; the branch's last step sends the coordinator the run and one line per screen, and the branch is marked ready only after the Owner's "fine". After two rounds without "fine", stop (CLAUDE.md, Pace). There are no pixel goldens: a clip is a moving picture, and a screenshot of one is for a person, not for a comparison.

## What this plan relies on

| Piece | From | Used for |
|---|---|---|
| `prisma()`, `Clock`, `TestClock`, `chicagoDayOf`, `startTestDatabase()`, `requireEnv` | slice 1 | every table, time and setting |
| `locals.caller`, `signedInOnly`, `Caller` | slice 1 | who is asking; the `/make/page` screens need an account |
| `membershipServices().arrival.remember(cookies, { makerUserId, path })` | slice 1, Task 26 | the arrival from `/<handle>` (and still from `/g/<game>`) |
| `purgeDueAccounts` in `src/features/accounts/deletion.ts` ("each later slice that adds a person's data adds its own removal here, with a test") | slice 1, Task 20 | removing a deleted person's page |
| `src/lib/look.css`, `CLASSES`, `expectOneCard`, `showTheOwner`, `pipRed`, `token`, `rgb`, `contrast` (today in `tests/support/look-tokens.ts`), `forgetRateLimits`, `signUp`, `payAsNewMember` | slice 1 | the card screens, and the journeys |
| `/join`, its `next`, its "Not now" link | slice 1, Task 27; slice 2, Task 21 | the paywall card, which this slice lays over the clip |
| `FileStore`, `fileStore()`, `MemoryFileStore` | slice 2, Task 6 | a maker's photo |
| `gamesServices(): { service; address(name) }`, `LiveGame`, `liveGameBySlug(slug)`, `GameError` | slice 2, Task 11 | a game and its two clip keys; `address("media")` is where clips are served |
| `Game.state`, `Game.livePullId`, `GameReview` (`gameId`, `decision`, `decidedAt`, add-only) | slice 2, Tasks 1, 26 | which games are live, and when each first went live |
| `PlaySession` (`gameId`, `basis`), `PlayBeat` (`sessionId`, `receivedAt`, `attentive`) | slice 2, Task 16 | how much members played each game in the last seven days |
| `handleGameRequest` in `src/features/play/gate.ts`, its step 4 ("A clip", on the `media` name) | slice 2, Task 13 | serving a maker's photo beside the clips (Task 21) |
| `isPhone`, `backFromPaywall` from `play.ts`; `/g/<game>/play`, which decides between the game, the paywall and a phone that cannot play | slice 2, Tasks 17, 21 | the feed's Play; "This one needs a computer"; which clip sits behind the paywall card |
| The browser-entry rule in `tests/architecture.test.ts` (a `.svelte` file reaches a feature only through `<feature>.browser.ts`; nothing reachable from one imports server code) | slice 2, Task 22 | the two features' components |
| `/g/[game]/+page.server.ts` and `+page.svelte` (the placeholder card), `tests/browser/game-page.test.ts` | slice 2, Task 20 | replaced by the feed opened at that clip (Task 15) |
| `/make` ("Your games", "Add a game") | slice 2, Task 27 | gains one link, "Your page" (Task 24) |
| `addGame(browser, options?)` answering `{ slug, name, publicId, makerEmail, makerUserId }`, `signInAs(page, email)`, `tests/browser/support/database.ts` | slice 2, Tasks 30, 31 | journeys that need a live game and its maker |

**What slice 3 adds to slice 2's features** (reported to the coordinator, 2026-11-14): a list of live games with when each first went live (Task 9, in `games`); members' attentive beats per game since a moment (Task 10, in `play`); one more key shape on the gate's `media` name, for photos (Task 21). Nothing of slice 2's is changed in meaning.

## Found while planning

Read on 2026-11-14, on `main` at `00d616d`. Where the code and this plan disagree when execution reads it, stop and report.

1. **The colour data is not in the repository yet.** `src/lib/look.css` names ten of the book's colours by hand and keeps the data set's licence at `src/lib/dictionary-of-colour-combinations-LICENSE.txt`; no file holds the 159 colours. Measured in a scratch folder outside the repository: `dictionary-of-colour-combinations` 1.0.2 (MIT, `https://registry.npmjs.org/dictionary-of-colour-combinations/-/dictionary-of-colour-combinations-1.0.2.tgz`, integrity `sha512-7IiYWH/oZvfxuXP9pyf+H6WgRRvgavKZ4NsKdHTzmSQJUCITqQj3aNEQFFlBvPc5tnIgAIczGaMvJxZce6Vp4w==`); its `colors.json` is 60,245 bytes, SHA-256 `555f11c32eb8133078fd470dd7d5320533aaa8b636f12fa06a8dd3d0ee2703b4`, an array of 159 objects with the keys `name`, `combinations`, `swatch`, `cmyk`, `lab`, `rgb`, `hex`; every `hex` is `#` and six lower-case hex digits; the combination numbers run 1 to 348 with none missing; 120 combinations have two colours, 120 have three, 108 have four. How many combinations are readable was not measured: the code and its test decide (design 10), and Task 3 records the number.
2. **The check that screens carry no styles reads only `src/routes/`** (`tests/lib/look.test.ts`, "screens wear the look and nothing of their own"). Slice 1's note said this plan would take the feed's and the page's route folders out of that check by name. It does not need to: the two screens are components inside their features (`src/features/feed/Feed.svelte`, `src/features/pages/MakerPage.svelte`), their route files hold no class and no style, and the check stays whole.
3. **`contrast` is a test helper today** (`tests/support/look-tokens.ts`). The theme rule needs it in the app, so Task 2 moves it to `src/lib/colour.ts` and the helper re-exports it.
4. **The root layout shows the Ruken wordmark above every page but `/`** (`src/routes/+layout.svelte`). The feed at `/g/<game>` and a maker's page have no room for it; Task 13 turns it off by route.
5. **The journeys' clips are not playable video** (slice 2, Task 7: four length bytes, `ftyp`, zeros). No journey in this plan asserts that a video is playing. They assert what Ruken's page decides: which clip is marked current, whether sound is on, which addresses the sources have.
6. **Every journey shares one database**, so the feed at `/` holds every game any journey made, in an order no journey controls. Journeys of the feed open it at a game they made (`/g/<slug>`), find that clip by its `data-slug`, and assert order only in unit and database tests. From Task 15 on, slice 2's journeys that press Play on `/g/<slug>` must find the link inside that clip too, because the page then holds more than one Play.
7. **Not settled by reading:** whether Playwright's `phone` project reports `navigator.maxTouchPoints > 0` (Task 17's hints read it; its step 3 says what to do if not); whether `pnpm dev` can read the database for a local look (slice 1's note; the first session that looks locally checks, and uses `pnpm build` and `wrangler dev` if not).

## The Owner's decisions, the open questions, and the Calls in this plan

- **Owner** (design 5.1, 5.3, 5.7, as approved and revised): the feed matches Instagram Reels, one game per screen, upright clip on an upright screen and wide clip on a wide one; a clip starts without sound and a tap turns it on; share is in at launch, and like, save, follow and the two tabs come later; one feed, newly accepted games first, then the rest by how much members played them in the last seven days; `/g/<game>` opens the feed at that clip; a maker's page is Linktree with a game twist, themed from A Dictionary of Color Combinations, live as soon as it is saved, with https links only; two hints on the first clip, once per device.
- **Owner, 2026-11-14** (design 5.2, 5.8): the paywall card is the paper card laid over the clip the person tapped, dimmed; one small pip-red mark on that card ("Keep it"); "Continue to payment" is Blue; buttons 12px, cards 20px.
- **Owner, 2026-11-14**, relayed by the coordinator: start this plan now, beside slice 2's building.
- **Open, asked of the coordinator on 2026-11-14. Each is held to one task, which does not start without its answer.**
  - **Q1. Social icons** (design 5.3 names them). The repository has no icon source. A (recommended): about ten marks copied as path data from the CC0 `simple-icons` set, with its licence beside them, as the colour data is. B: no icons; a social link is a small button with the site's name. C: no social row at launch. Task 23 is written for A and says what B and C change.
  - **Q2. The maker's photo** (design 5.3). A (recommended): served like a clip, from the `media` name, by one more key shape on slice 2's gate. B: no photo at launch; the first letter of the name in a circle. Branch G (Tasks 20 and 21) is written for A; under B it is not built, and Task 22's letter is all there is.
- **Calls** (the Owner can overrule):
  - **The feed is one page of clips**, the newest order worked out on the server, fifty games at most (`FEED_MAX`), with no "load more": launch day has one game. The page scrolls by the browser's own snap, so swipe and wheel need no script; the arrow keys are three lines of script.
  - **"Newly accepted" is seven days** (`NEW_FOR_MS`) from the first time staff accepted the game. An accepted update, or a game its maker took off and put back, is not new again.
  - **"How much members played" is the number of attentive beats from members' sessions in the last seven days** (slice 2: one beat each 15 seconds). It orders games the same way counted time would, and the database adds it up in one query instead of the app reading every beat.
  - **The seed is the America/Chicago day** (`2026-11-30`), so games that tie keep their places for a day and move the next.
  - **Tapping the clip turns sound on, and tapping again turns it off.** Sound stays as it was set while the person swipes. It is off again after a reload: a browser will not start a page with sound.
  - **The hints say what the person's own device does**: with a touch screen, "Swipe up for the next game" and "Tap for sound" (design 5.7's words); without one, "Scroll down for the next game" and "Click for sound".
  - **The feed's other controls**: a share mark at the right, and a small person mark at the top right that goes to `/me` (signed in) or `/sign-in`. Both are drawn in the component as plain line shapes; no icon file is brought in for them. Play is the only button with words (design 5.1).
  - **The words under a clip sit on a flat dark band** (`ink` at 60%), so chalk text reads over any clip (4.5:1 or more even over a white one; Task 13's test measures it). No gradient.
  - **The paywall card over the clip is `/join` itself**: when its `next` is `/g/<game>/play` and that game is live, the page shows that game's clip behind the card, dimmed. One page, one address, working with no script; the person sees the price over the clip they tapped. Where there is no clip (`/join?next=/me`), the card sits on the felt as today (design 5.2).
  - **The pip mark** is a 12px pip-red diamond in the top right corner of the price card, and is not there for a member or a paused membership (they see no price).
  - **A maker's address** (design 10): 3 to 30 characters, lower-case letters, digits and single hyphens between them; not a word Ruken uses (Task 5's list, which a test ties to the folders in `src/routes/` and `static/`). It can be changed; the old one is free at once.
  - **`/me` (design 5.6) gains nothing here.** Its membership line, cancelling, signing out and deleting the account are slice 1's; "what they saved" and "who they follow" arrive with save and follow. What this slice adds is the way to it from the feed.
  - **A page belongs to an account, not to a game**: anyone signed in can make one, before or after their first game (design 5.3: "live as soon as the maker saves it").
  - **A theme is one of Wada's combinations, by its number.** Code picks, from the combination's own colours, the ground, the text, the button and the button's label that read best (Task 3). The page also shows all the combination's colours as a row of small dots, so a three- or four-colour combination still looks like itself. A page with no theme picked wears the Card Table's own colours.
  - **A link is one of two kinds** the maker picks: "A link" (a button) or "A game somewhere else" (a card with the game's name and where it is, as "A game on Steam", worked out from the address). Thirty links at most.
  - **Counts are two numbers**, kept on the page and on each link and raised by one in the database each time: the page was opened, a link was tapped. A maker's own opens and taps are not counted. A tap is counted by sending the visitor through `/<handle>/out/<link>`, which works with no script.
  - **While an account waits its 14 days to be deleted, its page stays up.** When the daily job finishes the deletion, the page, its links and its photo go, and the address is free.
  - **A photo** is a JPEG, PNG or WebP, 5 MB at most as it arrives, checked by its first bytes. With script, the page first cuts it to a square of 512px at most in the browser, so a phone's photo is small before it is sent.

## Where execution stops and waits for the Owner

There is no command for the Owner in this slice: no new setting, secret, bucket or address. The stops are:

- **Q1** before Task 23 and **Q2** before branch G (Tasks 20 and 21), above. The coordinator relays the answers.
- **"Fine" on the screenshots**, once per branch that has screens (D, E, F, H, I; each branch's last step): the execution session sends the coordinator the green run and one line per screen; the Owner looks at `look: <screen>`, phone and computer.
- **The real site**, Task 27: a person opens it on a phone and on a computer.

A stop holds only its own branch. Branches that do not need the answer go on.

## How a task runs

As slice 1's plan, word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved.

**Where a branch runs.** Branches A, B and C are logic and run in the cloud. Branches D, E, F, H and I are screens: the coordinator chooses whether each runs in the cloud, judged from the screenshots, or as a local session on the Owner's computer with the Owner steering (CLAUDE.md, "Where sessions run"). Either way every test runs in CI.

## Branches

Ten branches. Each starts from `main` only after what it needs is merged and green; at most three pull requests are open at once.

| # | Branch | Tasks | Needs on `main` | Ends with |
|---|---|---|---|---|
| A | `slice-3/themes` | 1 to 3 | slice 1 | the colour data, contrast, and which combinations are offered, with the colours each gives |
| B | `slice-3/page-rules` | 4 to 8 | slice 1 | the pages tables, the rules for an address and a link, the pages service, and a deleted account's page removed |
| C | `slice-3/order` | 9 to 12 | slice 2's branches M, P and S | the list of live games, members' play per game, the order, the feed service |
| D | `slice-3/feed` | 13 to 15 | C; slice 2's branch F | the feed at `/`, share, and the feed at `/g/<game>` |
| E | `slice-3/feed-controls` | 16, 17 | D | sound and the current clip, the two hints |
| F | `slice-3/paywall-clip` | 18, 19 | D | the paywall card over the dimmed clip, with its pip mark |
| G | `slice-3/photo` | 20, 21 | B; slice 2's branch D; Q2 | a maker's photo, stored and served |
| H | `slice-3/maker-page` | 22, 23 | B, D; Q1 for Task 23 | `/<handle>`: games, links, colours; link taps; social icons |
| I | `slice-3/edit-page` | 24 to 26 | H (and G, if Q2 is A) | the four `/make/page` screens |
| J | `slice-3/real-site` | 27 | all of the above | design 8's lines for this slice, in journeys and on the real site |

A and B use nothing of slice 2 and nothing of each other, so they can run side by side, and before slice 2 is merged if the coordinator and the Owner choose. G can run beside C to F.

## File map

```
prisma/schema/pages.prisma               MakerPage, PageLink                                  (branch B)
src/lib/colour.ts                        contrast(a, b): WCAG's ratio between two hex colours (branch A)
src/lib/random.ts                        seededNumber(seed, key): the same number for the same two words (branch C)
src/params/handle.ts                     SvelteKit's matcher: is this path a maker's address   (branch H)
src/features/pages/
  pages.ts               entry (server)
  pages.browser.ts       entry for components and src/params: no server code
  themes.ts              arrange, THEMES, themeById, DEFAULT_THEME
  handle.ts              HANDLE, cleanHandle, handleProblem, RESERVED_HANDLES
  links.ts               cleanLinkUrl, linkProblem, siteNameOf, moveLink, MAX_LINKS; SOCIAL_SITES, socialSiteOf (Task 23)
  words.ts               timesWords: "1 time", "12 times"
  photo.ts               the photo rules: types, 5 MB, first bytes, keys                       (branch G)
  photo-crop.ts          cropSquare: which square of a picture to keep (browser)               (branch G)
  service.ts             savePage, saveTheme, the link actions, pageOf, pageByHandle, countView, tapLink, handlesOf, savePhoto
  services.ts            built once
  MakerPage.svelte       a maker's page, in its own colours
  ThemePicker.svelte     the grid of colour choices
  library/colours.json           the 159 colours, as the data set has them
  library/colours-LICENSE.txt    the data set's MIT licence
  library/colours-source.json    where the file came from: package, version, tarball, integrity, bytes, sha256
  library/social-icons.json, social-icons-LICENSE.txt    (Task 23, if Q1 is A)
src/features/feed/
  feed.ts                entry (server)
  feed.browser.ts        entry for components
  order.ts               feedOrder, NEW_FOR_MS, PLAYED_WINDOW_MS
  service.ts             feed({ first, phone }): the clips, in order
  services.ts            built once
  current.ts             currentOf: which clip is on screen (browser)
  share.ts               shareLink: the share sheet, or copy, or say how (browser)
  Feed.svelte            the feed
  ClipBackdrop.svelte    one clip, dimmed, behind the paywall card
src/features/games/service.ts            gains liveGames                                       (branch C)
src/features/play/sessions.ts            gains memberBeatsByGame                               (branch C)
src/features/play/gate.ts                the media name also serves a photo key                (branch G)
src/features/accounts/deletion.ts        the purge removes a person's page (branch B) and photo (branch G)
src/lib/look.css                         gains pip (branch F)
src/routes/
  +layout.svelte                         no wordmark on the feed and on a maker's page
  +page.server.ts, +page.svelte          the feed (the placeholder goes)
  g/[game]/+page.server.ts, +page.svelte the feed, opened at that clip (the placeholder card goes)
  join/+page.server.ts, +page.svelte     the clip behind the card; the pip mark
  [handle=handle]/+page.server.ts, +page.svelte     a maker's page
  [handle=handle]/out/[link]/+server.ts             a tap on a link, counted, then sent on
  make/page/, make/page/photo/, make/page/colours/, make/page/links/    the maker edits their page
  make/+page.svelte                      gains "Your page"
tests/browser/support/feed.ts            clipOf(page, slug)
tests/browser/support/pages.ts           makePage, pageCounts: a page made straight in the database, for journeys before the edit screens exist
tests/features/pages/…  tests/features/feed/…  tests/lib/colour.test.ts, random.test.ts   mirror src/
tests/browser/feed.test.ts, feed-controls.test.ts, maker-page.test.ts, edit-page.test.ts, feed-and-page.test.ts; game-page.test.ts, join.test.ts and pay.test.ts change; home.test.ts goes with the placeholder page
```

## Review Focus

Each line names an input the design implies and no ordinary test would meet. Each has its test in the task named.

1. No game is live yet (the real site, the day before the first game is accepted): `/` shows one plain line and the way to an account, not an empty or broken screen (Tasks 12, 13).
2. Someone opens a shared link to a game that has since been taken off: a missing page with a way back, not a feed of other games under the wrong address (Tasks 12, 15).
3. A maker asks for an address that is one of Ruken's own (`me`, `make`, `g`, `fonts`), or a route added later takes a word that is not on the list: refused; and the test that reads `src/routes/` fails until the word is listed (Task 5).
4. Two people save the same address at the same moment: one has it, the other is told it is taken, and neither sees "Something went wrong" (Task 7).
5. A link that is not https (`http://`, `javascript:`, `data:`, an address with a name and password in it): refused when saved; and `/<handle>/out/<link>` only ever sends on to an address that was stored after that check (Tasks 6, 22).
6. `/<handle>/out/<link>` with a link from another maker's page, a hidden link or a made-up id: a missing page, and nothing is counted (Tasks 7, 22).
7. A theme number posted by hand that is not offered (unreadable, or not a number): refused, and the page keeps its colours (Tasks 3, 7).
8. Every offered combination, not a sample: text on its ground and the label on its button are both 4.5:1 or more (Task 3).
9. A maker opens their own page and taps their own links: the counts do not move (Tasks 7, 22).
10. A very long name, one line or link title on a phone: nothing scrolls sideways, on the feed or on a page (Tasks 13, 22).
11. A phone meets a computer-only game in the feed: no Play; "This one needs a computer." and a button that shares its link (Tasks 12, 14).
12. A browser with neither a share sheet nor a clipboard, and a person who closes the share sheet without sharing: a plain line in the first case, nothing at all in the second (Task 14).
13. A web page or an SVG named `me.png`: refused by its first bytes; and the `media` name serves nothing that is not a clip key or a photo key (Tasks 20, 21).
14. A deleted account: its page is a missing page, its address is free for someone else, and its photo's address answers 404 (Tasks 8, 20).
15. Games that tie in the order: the same seed gives the same order every time, and a game's place does not depend on the order the database answered in (Task 11).
16. A person who never swipes and never taps: Play is there, the hints do not cover it, and with reduced motion nothing fades or glides (Tasks 13, 17).
17. The paywall card opened with a `next` that names a game that is not live, or is not a game's play address at all: the card on the felt, never an error (Task 18).

---

# Branch A: `slice-3/themes`

### Task 1: The colour data

**Files:**
- Create: `src/features/pages/library/colours.json`, `src/features/pages/library/colours-LICENSE.txt`, `src/features/pages/library/colours-source.json`, `src/features/pages/themes.ts` (first part)
- Test: `tests/features/pages/colours.test.ts`

**Where the file comes from.** In a scratch folder outside the repository: `npm pack dictionary-of-colour-combinations@1.0.2`, unpack, and copy `package/colors.json` to `colours.json` byte for byte (Prettier must not reformat it: add the path to `.prettierignore`). `colours-LICENSE.txt` is a copy of `src/lib/dictionary-of-colour-combinations-LICENSE.txt` (design 5.3: the licence is recorded beside the data). `colours-source.json` holds `{ "package", "version", "tarball", "integrity", "path", "bytes", "sha256" }` as slice 1's `static/fonts/sources.json` does, with the numbers the execution session measured from its own download; they must equal "Found while planning", 1, or stop and report. The package is not added to `package.json`.

**Interfaces:**
- Produces, in `themes.ts`: `interface WadaColour { name: string; hex: string; combinations: number[] }`; `WADA_COLOURS: readonly WadaColour[]` (the file's 159, in its order, those three keys only); `coloursOf(combination: number): string[]` (the hex of each colour whose `combinations` holds that number, in the file's order; empty for an unknown number).

- [ ] **Step 1 (red):**

```ts
it("holds the book's 159 colours", () => { expect(WADA_COLOURS).toHaveLength(159); });
it("writes every colour as # and six lower-case hex digits", () => { for (const c of WADA_COLOURS) expect(c.hex, c.name).toMatch(/^#[0-9a-f]{6}$/); });
it("holds combinations 1 to 348, each of two, three or four colours", () => {
  for (let n = 1; n <= 348; n += 1) expect([2, 3, 4], `combination ${n}`).toContain(coloursOf(n).length);
  expect(coloursOf(349)).toEqual([]); expect(coloursOf(0)).toEqual([]);
});
it("has 120 combinations of two, 120 of three and 108 of four", () => { /* count coloursOf(n).length for n in 1..348 */ });
it("is the file its source record names", () => { /* sha256 and byte length of colours.json equal colours-source.json; version is "1.0.2" */ });
it("keeps the MIT licence beside the data", () => { /* colours-LICENSE.txt contains "The MIT License" and "Matt DesLauriers" */ });
it("holds every colour the look names", () => { /* each of the ten token values in src/lib/look.css is some WADA_COLOURS hex */ });
```

  Stubs for `WADA_COLOURS` (an empty array) and `coloursOf`. Push. Expected: `verify` fails in `colours.test.ts` ("not built yet", or length 0).
- [ ] **Step 2 (green):** the three files and the code. Push. Expected: all pass, the layer test included (only `pages` reads its `library/`).

### Task 2: Contrast, in the app

**Files:**
- Create: `src/lib/colour.ts`
- Modify: `tests/support/look-tokens.ts` (its `contrast` becomes `export { contrast } from "../../src/lib/colour.ts"`)
- Test: `tests/lib/colour.test.ts`

**Interfaces:**
- Produces: `contrast(a: string, b: string): number`, WCAG's contrast ratio between two `#rrggbb` colours, 1 to 21, the same either way round. The body moves from `tests/support/look-tokens.ts` unchanged.

- [ ] **Step 1 (red):** `contrast("#000000", "#ffffff")` is 21; a colour with itself is 1; `contrast(a, b)` equals `contrast(b, a)`; `contrast("#ffffff", "#112f2c")` is 14.3 to one decimal and `contrast("#ffffff", "#006eb8")` is 5.4 (design 5.8's table). Stub. Push. Expected: `verify` fails in `colour.test.ts` with "not built yet".
- [ ] **Step 2 (green):** move the code. Push. Expected: all pass; `tests/lib/look.test.ts` passes unchanged.

### Task 3: Which combinations are offered, and the colours each gives

**Files:**
- Modify: `src/features/pages/themes.ts`
- Create: `src/features/pages/pages.browser.ts` (first part)
- Test: `tests/features/pages/themes.test.ts`

**Interfaces:**
- Consumes: `coloursOf`, `contrast`.
- Produces:
  - `MIN_CONTRAST = 4.5`.
  - `interface Arrangement { ground: string; text: string; button: string; buttonText: string }`.
  - `arrange(colours: readonly string[]): Arrangement | null`. It tries every way of giving four jobs to the combination's own colours where `text` is not `ground`, `button` is not `ground`, and `buttonText` is not `button`. An arrangement's score is the smaller of `contrast(text, ground)` and `contrast(buttonText, button)`. The highest score wins; between equal scores, the one found first when `ground`, then `text`, then `button`, then `buttonText` each run through the colours in their given order. A best score under `MIN_CONTRAST` is null (design 5.3: not offered).
  - `interface Theme extends Arrangement { id: number; colours: string[] }`.
  - `THEMES: readonly Theme[]`: for each combination 1 to 348 whose `arrange` is not null, in number order.
  - `DEFAULT_THEME: Theme`: `{ id: 0, colours: ["#112f2c", "#ffffff"], ground: "#112f2c", text: "#ffffff", button: "#ffffff", buttonText: "#111314" }` (the Card Table's felt, chalk, paper and ink).
  - `offeredTheme(id: number): Theme | null` (null unless `id` is a whole number that is one of `THEMES`); `themeById(id: number): Theme` (`offeredTheme(id)`, or `DEFAULT_THEME`).
  - `pages.browser.ts` re-exports `THEMES`, `DEFAULT_THEME`, `type Theme`. `themes.ts` imports only `src/lib/colour.ts` and the JSON, so a browser may bundle it.

- [ ] **Step 1 (red):**

```ts
it("gives two readable colours each other's jobs", () => {
  expect(arrange(["#000000", "#ffffff"])).toEqual({ ground: "#000000", text: "#ffffff", button: "#ffffff", buttonText: "#000000" });
});
it("offers nothing when no pair is readable", () => { expect(arrange(["#777777", "#888888"])).toBeNull(); expect(arrange(["#777777", "#888888", "#808080"])).toBeNull(); });
it("picks the most readable pair for the text, whatever order the colours come in", () => {
  const a = arrange(["#888888", "#000000", "#ffffff"]);
  expect(contrast(a?.text ?? "", a?.ground ?? "")).toBe(21);
  expect(arrange(["#888888", "#000000", "#ffffff"])).toEqual({ ground: "#000000", text: "#ffffff", button: "#ffffff", buttonText: "#000000" });
});
it("never uses one colour for a thing and what is written on it", () => { /* for every THEMES entry: text !== ground, button !== ground, buttonText !== button */ });
it("every offered theme is readable: its text and its button's label", () => {                    // Review Focus 8
  expect(THEMES.length).toBeGreaterThan(0);
  for (const t of THEMES) {
    expect(contrast(t.text, t.ground), `combination ${t.id}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.buttonText, t.button), `combination ${t.id}`).toBeGreaterThanOrEqual(4.5);
  }
});
it("every combination that is not offered has no readable arrangement", () => { /* for n in 1..348 not in THEMES: arrange(coloursOf(n)) is null */ });
it("a theme uses only its own combination's colours", () => { /* each of the four is in t.colours, and t.colours equals coloursOf(t.id) */ });
it("refuses a number that is not offered", () => {                                                 // Review Focus 7
  for (const id of [0, -1, 349, 1.5, Number.NaN]) expect(offeredTheme(id)).toBeNull();
  expect(themeById(349)).toBe(DEFAULT_THEME);
});
it("the default theme is readable too", () => { /* both ratios of DEFAULT_THEME are 4.5 or more */ });
it("says how many are offered", () => { console.log(`offered themes: ${THEMES.length} of 348`); });
```

  Stubs. Push. Expected: `verify` fails in `themes.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Read `offered themes: N of 348` from the run's log and write `N` in `docs/superpowers/progress.md` beside this task (CLAUDE.md: a fact is measured, never written by hand). If `N` is under 50, report it to the coordinator before going on: the picker would be thin. Branch A is ready to merge.

---

# Branch B: `slice-3/page-rules`

### Task 4: The pages tables

**Files:**
- Create: `prisma/schema/pages.prisma`, `prisma/migrations/<timestamp>_pages/migration.sql`
- Modify: `prisma/schema/accounts.prisma` (the `User` relation)
- Test: `tests/features/pages/schema.pg.test.ts`

| Model | Columns |
|---|---|
| `MakerPage` | `id` (cuid(2)), `userId` unique (a `User`, `onDelete: Restrict`), `handle` unique, `name`, `oneLine` default `""`, `themeId Int` default 0 (0: the default colours), `photoKey?` unique, `views Int` default 0, `createdAt`, `updatedAt` |
| `PageLink` | `id` (cuid(2)), `pageId` (a `MakerPage`, `onDelete: Cascade`), `kind PageLinkKind`, `title`, `url`, `position Int`, `hidden Boolean` default false, `taps Int` default 0, `createdAt`, `updatedAt`; index on (`pageId`, `position`) |

Enum `PageLinkKind { link, game_elsewhere }`.

In the migration SQL, by hand: CHECK `MakerPage_handle_check` (`"handle" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` and 3 to 30 characters); CHECK `MakerPage_name_check` (1 to 40 characters); CHECK `MakerPage_oneLine_check` (100 at most); CHECK `MakerPage_counts_check` (`"views" >= 0 AND "themeId" >= 0`); CHECK `PageLink_url_check` (`"url" ~ '^https://'` and 500 characters at most); CHECK `PageLink_title_check` (1 to 60 characters); CHECK `PageLink_taps_check` (`"taps" >= 0`). No add-only trigger: these rows are a maker's to change, and the two counts only ever rise by one in code.

- [ ] **Step 1 (red):**

```ts
it("makes the pages tables", async () => { /* arrayContaining ["MakerPage", "PageLink"] */ });
it("gives one account one page, and one address one page", async () => { /* a second page for the user rejects; a second page with the handle rejects */ });
it("refuses an address with a capital, a slash, a space, a doubled hyphen, or of 2 or 31 characters", async () => { /* each rejects; 'abc' and 'a-b-c' pass */ });
it("refuses a link that is not https", async () => { /* 'http://x.test', 'javascript:alert(1)' reject; 'https://x.test' passes */ });   // Review Focus 5
it("removes a page's links with the page", async () => { /* delete the page: its links are gone */ });
```

  Push. Expected: `postgres` fails in `schema.pg.test.ts`: the tables do not exist.
- [ ] **Step 2 (green):** the schema and the migration, made with `prisma migrate diff` from the schema on `main`, as slice 1's Task 21 did. Push. Expected: all pass, the drift test included.

### Task 5: The rules for a maker's address

**Files:**
- Create: `src/features/pages/handle.ts`
- Modify: `src/features/pages/pages.browser.ts`
- Test: `tests/features/pages/handle.test.ts`

**Interfaces:**
- Produces:
  - `HANDLE = /^[a-z0-9]+(-[a-z0-9]+)*$/`, `HANDLE_MIN = 3`, `HANDLE_MAX = 30`.
  - `isHandleShape(value: string): boolean` (the pattern and the two lengths; it does not look at the reserved words, so a reserved word still reaches its own route).
  - `cleanHandle(raw: string): string`: trimmed, lower-cased, a leading `@` dropped.
  - `RESERVED_HANDLES: ReadonlySet<string>`: `admin`, `make`, `me`, `g`, `join`, `sign-in`, `sign-up`, `sign-out`, `forgot-password`, `reset-password`, `goodbye`, `api`, `jobs`, `webhooks`, `healthz`, `legal`, `fonts`, `favicon`, `robots`, `ruken`, `about`, `help`, `support`, `terms`, `privacy`, `feed`, `play`, `game`, `games`, `pay`, `split`, `staff`, `team`, `official`, `login`, `logout`, `signin`, `signup`, `settings`, `account`, `www`, `static`, `assets`, `media`, `app`, `new`, `null`, `undefined`.
  - `handleProblem(raw: string): string | null`, on the cleaned value, the first of: under 3, "Use at least 3 letters or numbers."; over 30, "That's too long. Use 30 characters or fewer."; not the pattern, "Use only letters, numbers and hyphens."; reserved, "That one is taken. Pick another." (the same words as an address someone else has: which words Ruken keeps is nobody's business).
  - `pages.browser.ts` re-exports `isHandleShape`.

- [ ] **Step 1 (red):**

```ts
it.each([["  @Maker  ", "maker"], ["Night-Owl", "night-owl"]])("cleans %j to %j", (raw, clean) => { expect(cleanHandle(raw)).toBe(clean); });
it.each([["ab", "Use at least 3 letters or numbers."], ["a".repeat(31), "That's too long. Use 30 characters or fewer."],
  ["night owl", "Use only letters, numbers and hyphens."], ["night--owl", "Use only letters, numbers and hyphens."], ["-owl", "Use only letters, numbers and hyphens."],
  ["büro", "Use only letters, numbers and hyphens."], ["me", "Use at least 3 letters or numbers."], ["make", "That one is taken. Pick another."], ["Admin", "That one is taken. Pick another."]])(
  "refuses %j: %s", (raw, words) => { expect(handleProblem(raw)).toBe(words); });
it.each(["maker", "night-owl", "a1b", "a".repeat(30)])("takes %j", (raw) => { expect(handleProblem(raw)).toBeNull(); });
it("keeps every address Ruken itself uses", () => {                                               // Review Focus 3
  // The first-level folders of src/routes (without a leading "[" or "+") and the first-level names in static/,
  // with and without their extension: each one that has a handle's shape must be reserved. (`g` and `me` are too short to be anyone's.)
  for (const name of routeAndStaticNames()) if (isHandleShape(name)) expect(RESERVED_HANDLES.has(name), name).toBe(true);
});
```

  `routeAndStaticNames()` is a helper in the test, read from disk. Stubs. Push. Expected: `verify` fails in `handle.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 6: The rules for a link

**Files:**
- Create: `src/features/pages/links.ts`
- Test: `tests/features/pages/links.test.ts`

**Interfaces:**
- Produces, all pure:
  - `MAX_LINKS = 30`, `LINK_TITLE_MAX = 60`, `LINK_URL_MAX = 500`.
  - `cleanLinkUrl(raw: string): string | null`: the trimmed address when `new URL` reads it, its protocol is `https:`, its host holds a dot, it has no user name and no password, and it is 500 characters at most; otherwise null. It answers the address as the person typed it (trimmed), not a rewritten one.
  - `linkProblem(input: { title: string; url: string }): string | null`, the first of: an empty title, "Give the link a name."; a title over 60, "A link's name can be up to 60 characters."; an address over 500, "That address is too long."; `cleanLinkUrl` null, "A link starts with https://".
  - `siteNameOf(url: string): string`: where a game somewhere else lives, for its card. By host: `store.steampowered.com` → "Steam"; `itch.io` or a name ending `.itch.io` → "itch.io"; `play.google.com` → "Google Play"; `apps.apple.com` → "the App Store"; `store.epicgames.com` → "Epic Games"; `www.gog.com` or `gog.com` → "GOG"; anything else, the host without a leading `www.`.
  - `moveLink(ids: readonly string[], id: string, direction: "up" | "down"): string[]`: the list with `id` swapped with its neighbour; unchanged at either end or for an unknown id.

- [ ] **Step 1 (red):**

```ts
it.each(["http://example.com", "javascript:alert(1)", "data:text/html,x", "https://user:pw@example.com", "https://localhost", "example.com", "", "https://" + "a".repeat(500) + ".com"])(
  "refuses %j", (url) => { expect(cleanLinkUrl(url)).toBeNull(); });                              // Review Focus 5
it("keeps a good address as it was typed", () => { expect(cleanLinkUrl("  https://store.steampowered.com/app/1/My_Game/?x=1 ")).toBe("https://store.steampowered.com/app/1/My_Game/?x=1"); });
it.each([[{ title: " ", url: "https://a.com" }, "Give the link a name."], [{ title: "a".repeat(61), url: "https://a.com" }, "A link's name can be up to 60 characters."],
  [{ title: "Steam", url: "http://a.com" }, "A link starts with https://"]])("says what is wrong with %j", (input, words) => { expect(linkProblem(input)).toBe(words); });
it.each([["https://store.steampowered.com/app/1", "Steam"], ["https://maker.itch.io/game", "itch.io"], ["https://www.example.com/x", "example.com"]])("%j is on %s", (url, name) => { expect(siteNameOf(url)).toBe(name); });
it("moves a link up and down, and leaves the ends alone", () => {
  expect(moveLink(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
  expect(moveLink(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  expect(moveLink(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
  expect(moveLink(["a", "b", "c"], "x", "up")).toEqual(["a", "b", "c"]);
});
```

  Stubs. Push. Expected: `verify` fails in `links.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 7: The pages service

**Files:**
- Create: `src/features/pages/service.ts`, `src/features/pages/services.ts`, `src/features/pages/pages.ts`
- Test: `tests/features/pages/service.pg.test.ts`

**Interfaces:**
- Consumes: Tasks 3 to 6.
- Produces: `class PageError extends Error` with `code: "INVALID" | "TAKEN" | "NOT_FOUND"`, whose `message` is words for a person; `createPagesService(deps: { db: PrismaClient; clock: Clock })` returning:
  - `savePage(userId: string, input: { handle: string; name: string; oneLine: string }): Promise<{ handle: string }>`: makes the person's page or changes it. `handleProblem` gives `PageError("INVALID", …)`, except its "taken" words, which are `TAKEN`; a name empty after trimming, `"Your page needs a name."`; over 40, `"A name can be up to 40 characters."`; a one line over 100, `"The one line can be up to 100 characters."`; an address another page has (found before writing, and again as Prisma's unique error `P2002` when two people save at once), `PageError("TAKEN", "That one is taken. Pick another.")`.
  - `saveTheme(userId: string, themeId: number): Promise<void>`: `offeredTheme(themeId)` null and `themeId` not 0, `PageError("INVALID", "Pick one of the colours shown.")`; no page yet, `NOT_FOUND`.
  - `addLink(userId: string, input: { kind: PageLinkKind; title: string; url: string }): Promise<void>`: `linkProblem` gives `INVALID`; a page with `MAX_LINKS` already, `PageError("INVALID", "A page can have up to 30 links. Remove one first.")`; the new link goes last, with the address `cleanLinkUrl` answered.
  - `moveLinkOf(userId: string, linkId: string, direction: "up" | "down"): Promise<void>` (the page's links renumbered 0, 1, 2… in `moveLink`'s order, in one transaction), `setHidden(userId: string, linkId: string, hidden: boolean): Promise<void>`, `removeLink(userId: string, linkId: string): Promise<void>`. A link that is not on this person's page: `NOT_FOUND`, and nothing changes.
  - `pageOf(userId: string): Promise<OwnPage | null>`, the maker's own view: `{ handle, name, oneLine, themeId, photoKey, views, links: { id, kind, title, url, hidden, taps }[] }`, links in order.
  - `pageByHandle(handle: string): Promise<PublicPage | null>`, a visitor's view: `{ id, makerUserId, handle, name, oneLine, theme: Theme, photoKey, links: { id, kind, title, site: string }[] }`: only links that are not hidden, in order; `theme` from `themeById`; `site` from `siteNameOf`. No address of a link and no count is in it.
  - `countView(pageId: string, viewerUserId: string | null): Promise<void>`: `views` raised by one in the database (`{ increment: 1 }`), unless the viewer is the page's maker.
  - `tapLink(handle: string, linkId: string, viewerUserId: string | null): Promise<string | null>`: the link's address when it is a link of that page and not hidden, with `taps` raised by one unless the viewer is the maker; otherwise null and nothing is counted.
  - `handlesOf(userIds: readonly string[]): Promise<Map<string, string>>`: each of those accounts that has a page, and its address.
  - `pagesServices(): { service }` in `services.ts`, built once with `prisma()` and `systemClock`.
  - `pages.ts` re-exports `pagesServices`, `PageError`, `type OwnPage`, `type PublicPage`, `type Theme`, `THEMES`, `MAX_LINKS`.

- [ ] **Step 1 (red):**

```ts
it("makes a page, and changes it", async () => { /* savePage twice for one user: one row; the second handle and name are kept */ });
it("says each thing that is wrong in words", async () => { /* one case per line above: code and message */ });
it("gives an address to one person only", async () => {                                            // Review Focus 4
  await service.savePage(a, { handle: "maker", name: "A", oneLine: "" });
  await expect(service.savePage(b, { handle: "Maker", name: "B", oneLine: "" })).rejects.toMatchObject({ code: "TAKEN", message: "That one is taken. Pick another." });
});
it("two people saving one address at once: one has it, one is told it is taken", async () => {
  const results = await Promise.allSettled([service.savePage(a, { handle: "same", name: "A", oneLine: "" }), service.savePage(b, { handle: "same", name: "B", oneLine: "" })]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "TAKEN" } });
});
it("frees the old address when a maker changes theirs", async () => { /* a: maker → owl; b can take maker */ });
it("keeps a page's colours when a number that is not offered is sent", async () => {               // Review Focus 7
  await service.saveTheme(a, THEMES[0]!.id);
  await expect(service.saveTheme(a, 349)).rejects.toMatchObject({ code: "INVALID", message: "Pick one of the colours shown." });
  expect((await service.pageOf(a))?.themeId).toBe(THEMES[0]!.id);
});
it("adds links last, moves them, hides them and removes them", async () => { /* add x, y, z; move z up; hide x; remove y: pageOf lists z, x(hidden) and pageByHandle lists z only */ });
it("refuses a link that is not https and stores nothing", async () => { /* 'javascript:alert(1)': INVALID "A link starts with https://"; no row */ });
it("stops at thirty links", async () => { /* the 31st: the words above */ });
it("lets nobody change another maker's link", async () => { /* b moves, hides, removes a's link: NOT_FOUND each; a's link is as it was */ });
it("shows a visitor no hidden link, no address and no count", async () => { /* the keys of pageByHandle's links are exactly id, kind, site, title */ });
it("counts a visitor's view and tap, and not the maker's own", async () => {                       // Review Focus 9
  await service.countView(page.id, null); await service.countView(page.id, b); await service.countView(page.id, a);
  expect(await service.tapLink("maker", link.id, null)).toBe("https://example.com/x");
  expect(await service.tapLink("maker", link.id, a)).toBe("https://example.com/x");
  expect(await service.pageOf(a)).toMatchObject({ views: 2, links: [{ taps: 1 }] });
});
it("sends nobody on from a hidden link, another page's link or a made-up one", async () => {       // Review Focus 6
  /* each answers null; every taps stays 0 */ });
it("finds the addresses of the makers it is asked about", async () => { /* handlesOf([a, b, c]) where c has no page: a Map of two */ });
```

  Stubs. Push. Expected: `postgres` fails in `service.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, the layer test included.

### Task 8: A deleted account's page goes with it

**Files:**
- Modify: `src/features/accounts/deletion.ts`
- Test: `tests/features/accounts/purge.pg.test.ts` (add cases)

`purgeDueAccounts` gains one line inside its transaction, beside the others: `tx.makerPage.deleteMany({ where: { userId } })` (the links go with the page). `accounts` imports no feature for it: the table is reached through the one database client, as slice 2's Task 15 does for a GitHub connection.

- [ ] **Step 1 (red):** in `purge.pg.test.ts`: a person with a page and two links asks to be deleted; before the 14 days the page is still there; after the job the page and its links are gone, another account can take the same address, and the `User` row is still there as `deleted` (Review Focus 14). Push. Expected: `postgres` fails in `purge.pg.test.ts`: the page is still there after the job, and the address is still taken.
- [ ] **Step 2 (green):** the line. Push. Expected: all pass. Branch B is ready to merge.

---

# Branch C: `slice-3/order`

Needs slice 2's branches M, P and S on `main` (`GameReview`, `PlaySession`, `PlayBeat`, `accept`).

### Task 9: The live games, and when each first went live

**Files:**
- Modify: `src/features/games/service.ts`, `src/features/games/games.ts`
- Test: `tests/features/games/service.pg.test.ts` (add cases)

**Interfaces:**
- Produces, added to `createGamesService`: `liveGames(filter?: { makerUserId?: string }): Promise<ListedGame[]>` with `interface ListedGame extends LiveGame { liveSince: Date }`. Every game whose state is `live` (of that maker only, when the filter names one), built as `liveGameBySlug` builds one; `liveSince` is the `decidedAt` of the game's earliest `GameReview` row with decision `accepted`. In no promised order. `games.ts` re-exports `type ListedGame`.

- [ ] **Step 1 (red):** a draft, a waiting, a sent-back and a taken-off game are not listed, and a live one is, with its two clip keys; `liveSince` is the first acceptance, and stays so after an update is accepted and after the game is taken off, put back and accepted again; the filter lists one maker's games only. Stub. Push. Expected: `postgres` fails in `service.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 10: How much members played each game

**Files:**
- Modify: `src/features/play/sessions.ts`, `src/features/play/play.ts` if `playServices().service` does not already carry every method of the service
- Test: `tests/features/play/sessions.pg.test.ts` (add cases)

**Interfaces:**
- Produces, added to `createPlayService`: `memberBeatsByGame(since: Date): Promise<Map<string, number>>`: for each game, the number of `PlayBeat` rows that are `attentive`, were received at or after `since`, and belong to a `PlaySession` whose basis is `member`. One query that the database adds up (`$queryRaw`, grouped by the session's `gameId`); a game with none is not in the map. A comment says why it counts beats and not `countedMs`: the feed only needs to know which game was played more, and this is one indexed sum.

- [ ] **Step 1 (red):** with `TestClock`: a member's three attentive beats and one that is not: 3; a free game's beats, staff's and a maker's own: not counted; a beat from before `since`: not counted; two games: two entries. Stub. Push. Expected: `postgres` fails in `sessions.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 11: The order

**Files:**
- Create: `src/lib/random.ts`, `src/features/feed/order.ts`
- Test: `tests/lib/random.test.ts`, `tests/features/feed/order.test.ts`

**Interfaces:**
- Produces:
  - `seededNumber(seed: string, key: string): number` in `src/lib/random.ts`: the 32-bit FNV-1a hash of `seed + "\n" + key` over its UTF-16 code units (start `2166136261`; for each unit, exclusive-or it in, then `Math.imul(hash, 16777619)`; `>>> 0` at the end). The same two words always give the same whole number from 0 to 4,294,967,295.
  - In `order.ts`: `NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000`, `PLAYED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000`, `interface Ranked { id: string; liveSinceMs: number; played: number }`, and `feedOrder(games: readonly Ranked[], nowMs: number, seed: string): string[]`: first the games that went live less than `NEW_FOR_MS` ago, newest first; then the rest, most played first. Games that tie (the same `liveSinceMs` among the new, the same `played` among the rest) go by `seededNumber(seed, id)`, smallest first, then by `id`.

- [ ] **Step 1 (red):**

```ts
const DAY = 24 * 60 * 60 * 1000; const now = 100 * DAY;
it("puts newly accepted games first, newest first", () => {
  expect(feedOrder([{ id: "old", liveSinceMs: now - 30 * DAY, played: 999 }, { id: "new", liveSinceMs: now - 2 * DAY, played: 0 }, { id: "newer", liveSinceMs: now - DAY, played: 0 }], now, "s")).toEqual(["newer", "new", "old"]);
});
it("then the rest by how much members played them", () => {
  expect(feedOrder([{ id: "a", liveSinceMs: 0, played: 5 }, { id: "b", liveSinceMs: 0, played: 50 }, { id: "c", liveSinceMs: 0, played: 0 }], now, "s")).toEqual(["b", "a", "c"]);
});
it("a game stops being new at seven days", () => {
  expect(feedOrder([{ id: "played", liveSinceMs: 0, played: 1 }, { id: "week-old", liveSinceMs: now - 7 * DAY, played: 0 }], now, "s")).toEqual(["played", "week-old"]);
});
it("gives ties the same order every time, whatever order they came in", () => {                    // Review Focus 15
  const tied = ["a", "b", "c", "d", "e"].map((id) => ({ id, liveSinceMs: 0, played: 0 }));
  const once = feedOrder(tied, now, "2026-11-30");
  expect(feedOrder([...tied].reverse(), now, "2026-11-30")).toEqual(once);
  expect(once).toEqual([...once].sort((x, y) => seededNumber("2026-11-30", x) - seededNumber("2026-11-30", y)));
});
it("gives ties another order on another day", () => { /* over the seeds "2026-11-30" to "2026-12-09", the five tied games come out in at least two different orders */ });
it("answers nothing for no games", () => { expect(feedOrder([], now, "s")).toEqual([]); });
// random.test.ts
it("gives the same number for the same words, and a whole one", () => { /* equal twice; Number.isInteger; 0 <= n <= 0xffffffff */ });
it("keeps the seed and the key apart", () => { expect(seededNumber("ab", "c")).not.toBe(seededNumber("a", "bc")); });
```

  Stubs. Push. Expected: `verify` fails in both files with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 12: The feed service

**Files:**
- Create: `src/features/feed/service.ts`, `src/features/feed/services.ts`, `src/features/feed/feed.ts`
- Test: `tests/features/feed/service.test.ts`

**Interfaces:**
- Consumes: `ListedGame` (Task 9), `memberBeatsByGame` (Task 10), `handlesOf` (Task 7), `feedOrder` (Task 11), `chicagoDayOf`, `gamesServices().address`.
- Produces:
  - `FEED_MAX = 50`.
  - `interface FeedClip { slug: string; name: string; oneLine: string; upright: string; wide: string; needsComputer: boolean; makerHandle: string | null }` (`upright` and `wide` are whole addresses on the `media` name; `makerHandle` is null for a maker with no page).
  - `createFeedService(deps: { liveGames(): Promise<ListedGame[]>; memberBeatsByGame(since: Date): Promise<Map<string, number>>; handlesOf(userIds: readonly string[]): Promise<Map<string, string>>; mediaAddress: string; clock: Clock })` returning `feed(input: { first?: string; phone: boolean }): Promise<FeedClip[] | null>`: the live games in `feedOrder` (played since `PLAYED_WINDOW_MS` ago; the seed is `chicagoDayOf` the clock's time), the first `FEED_MAX` of them. With `first`, that game leads and the others follow in their order; a `first` that is not a live game's slug answers null. `needsComputer` is true for a computer-only game when `phone` is true. No game is live: an empty list.
  - `feedServices(): { service }` in `services.ts`, built once from `gamesServices()`, `playServices()`, `pagesServices()` and `systemClock`.
  - `feed.ts` re-exports `feedServices`, `type FeedClip`.

- [ ] **Step 1 (red):** with plain functions for the three deps and `TestClock` (no database):

```ts
it("answers the clips in the feed's order, with whole clip addresses", async () => {
  /* two old games, b played more than a: slugs ["b", "a"]; upright is "https://media.games.test/clips/…/upright-….mp4" */ });
it("opens at the game that was asked for, then the rest in order", async () => { /* first: "a" → ["a", "b"] */ });
it("answers null for a game that is not live", async () => { expect(await service.feed({ first: "gone", phone: false })).toBeNull(); });   // Review Focus 2
it("answers an empty feed when no game is live", async () => { expect(await service.feed({ phone: false })).toEqual([]); });               // Review Focus 1
it("marks a computer-only game on a phone, and not on a computer", async () => { /* needsComputer true, then false */ });                   // Review Focus 11
it("names the maker's page when they have one", async () => { /* makerHandle "maker" for one, null for the other */ });
it("asks for play since seven days ago, and seeds ties with the Chicago day", async () => { /* the since it was called with is clock - PLAYED_WINDOW_MS; two clocks on one Chicago day give one order */ });
it("stops at fifty", async () => { /* 60 live games: 50 clips; with first set to the 60th by order, it still leads and the list is 50 */ });
```

  Stubs. Push. Expected: `verify` fails in `service.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, the layer test included (`feed` reaches `games`, `play` and `pages` only through their entry files). Branch C is ready to merge.

---

# Branch D: `slice-3/feed`

Needs branch C, and slice 2's branch F (`/g/<game>`, `/g/<game>/play`, the browser-entry rule) on `main`.

### Task 13: The feed (`/`)

**Files:**
- Create: `src/features/feed/Feed.svelte`, `src/features/feed/feed.browser.ts`, `tests/browser/feed.test.ts`, `tests/browser/support/feed.ts`
- Modify: `src/routes/+page.server.ts`, `src/routes/+page.svelte`, `src/routes/+layout.svelte`, `tests/architecture.test.ts`, `tests/browser/home.test.ts`, and the case in `tests/browser/look.test.ts` that checks the placeholder home page
- Test: `tests/browser/feed.test.ts`, `tests/architecture.test.ts` (add cases)

**The screen** (design 5.1; like, save, follow, report and the two tabs are not built):

```
┌─────────────────────┐
│                  (person)   to /me, or /sign-in
│   the game's clip,  │
│   full screen,      │
│   looping           │
│─────────────────────│
│ @maker              │   a flat dark band
│ Game name           │
│ one line            │
│ [      Play       ] │
└─────────────────────┘
   swipe up: next game
```

- `load` (`/`): `feedServices().service.feed({ phone: isPhone(request.headers.get("user-agent")) })`, and `account`: `"/me"` for someone signed in, `"/sign-in"` otherwise. The page is `<Feed clips={data.clips} account={data.account} />` and a `<title>Ruken</title>`; the route file has no class and no style.
- `Feed.svelte`, what a journey and a screen reader find:
  - One `<main>` that is the scroller: the window's height (`100dvh`), `overflow-y: scroll`, `scroll-snap-type: y mandatory`.
  - One `<section data-slug={slug} aria-label={name}>` per clip: the window's size, `scroll-snap-align: start`, `scroll-snap-stop: always` (one swipe, one game).
  - In it, `<video muted loop playsinline>` filling the section (`object-fit: cover`), with two `<source>` elements: the upright clip with `media="(orientation: portrait)"`, then the wide one. The first clip has `autoplay` and `preload="auto"`; the others `preload="none"`, so a phone does not fetch fifty clips.
  - The band at the bottom: `@<handle>` as a link to `/<handle>` (only when `makerHandle` is not null); the name as `<h2>`; the one line as `<p>`, two lines at most; then `<a href="/g/<slug>/play">Play</a>`. When `needsComputer`: the line "This one needs a computer." in place of Play (its "Share the link" button arrives with share, Task 14).
  - The account link, at the top right of the window: `<a href={account} aria-label="Your account">` or `aria-label="Sign in"`, a person drawn as two plain shapes.
  - The arrow keys: Down (and Page Down, Space) brings the next section to the top, Up (and Page Up) the one before, by `scrollIntoView`; with reduced motion the move is instant (`behavior: "auto"`).
  - No game is live: one `<main>` on the felt with the line "No games here yet." and the account link.
- Its styles, in the component: the band is `ink` at 60% (`rgb(17 19 20 / 0.6)`) with chalk text, 1rem inside, and room for a phone's home bar (`env(safe-area-inset-bottom)`); the name is the look's statement face (Young Serif, 24px), the one line is body text (18px), the handle is 14px at weight 600; Play is as wide as the band (24rem at most), 48px tall at least, 12px corners, paper with an ink label, weight 600, and scales to 0.97 when pressed; the account link is a 48px target. Colours and fonts come from the look's custom properties (`var(--ink)`, `var(--font-display)`), never written again.
- `src/routes/+layout.svelte`: no wordmark where `page.route.id` is `/` or `/g/[game]` (the second for Task 15). The list is one constant, `BARE_ROUTES`, with a comment: these screens fill the window.
- `tests/architecture.test.ts` gains two cases, with a comment each: a `.svelte` file under `src/features/` is imported from outside its feature only through that feature's `.browser.ts`; a file under `src/params/` reaches a feature only through its `.browser.ts`.
- `tests/browser/support/feed.ts`: `clipOf(page: Page, slug: string): Locator`, `page.locator(`section[data-slug="${slug}"]`)`.

Grandma: the game is the whole screen. The one thing with words to press is Play. A person who does nothing still sees the clip, the game's name and Play.

- [ ] **Step 1 (red):**

```ts
test.beforeEach(forgetRateLimits);
test("Ruken opens straight into the feed, with the right clip for the screen", async ({ page, browser }, testInfo) => {   // design 8
  await addGame(browser);
  await page.goto("/");
  await expect(page).toHaveTitle("Ruken");
  await expect(page.getByText("Coming soon")).toHaveCount(0);
  const first = page.locator("section[data-slug]").first();
  const box = await boxOf(first); const size = page.viewportSize();
  expect(Math.abs(box.width - (size?.width ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs(box.height - (size?.height ?? 0))).toBeLessThanOrEqual(1);
  const sources = first.locator("video source");
  await expect(sources.nth(0)).toHaveAttribute("media", "(orientation: portrait)");
  await expect(sources.nth(0)).toHaveAttribute("src", /^http:\/\/media\.localhost:8788\/clips\/[a-z2-7]{10}\/upright-[0-9a-f]{16}\.mp4$/);
  await expect(sources.nth(1)).toHaveAttribute("src", /\/wide-[0-9a-f]{16}\.mp4$/);
  // The upright clip is offered to an upright screen only: the phone project is upright, the computer project is wide.
  expect(await page.evaluate(() => matchMedia("(orientation: portrait)").matches)).toBe(testInfo.project.name === "phone");
  await expect(page.locator("video[autoplay]")).toHaveCount(1);
  await showTheOwner(page, testInfo, "the feed");
});
test("a clip shows the game's name, its line and Play, and Play is the only thing with words to press", async ({ page, browser }) => {
  const game = await addGame(browser, { name: "Tiny game" });
  await page.goto("/");
  const clip = clipOf(page, game.slug);
  await clip.scrollIntoViewIfNeeded();
  await expect(clip.getByRole("heading", { level: 2, name: "Tiny game" })).toBeVisible();
  await expect(clip.getByRole("link", { name: "Play" })).toHaveAttribute("href", `/g/${game.slug}/play`);
  for (const button of await page.getByRole("button").all()) expect((await button.innerText()).trim()).toBe("");
});
test("Play is easy to hit and has the look's corners", async ({ page, browser }) => { /* its box is 48px tall or more; border-top-left-radius "12px"; background paper, colour ink */ });
test("the words under a clip read over any clip", async ({ page, browser }) => {
  /* the band's computed background is rgba(17, 19, 20, 0.6); mixed over white that is rgb(112, 113, 113) to the nearest whole number;
     contrast of chalk on that mix, worked out in the test with `contrast`, is 4.5 or more */ });
test("the arrow keys go to the next game and back", async ({ page, browser }) => {
  await addGame(browser); await addGame(browser);
  await page.goto("/");
  const sections = page.locator("section[data-slug]");
  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => Math.round((await boxOf(sections.nth(1))).y)).toBe(0);
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => Math.round((await boxOf(sections.nth(0))).y)).toBe(0);
});
test("the way to an account is one mark at the top", async ({ page, browser }) => {
  /* signed out: a link named "Sign in" to /sign-in, 48px by 48px or more; after signUp(page) and back at "/": a link named "Your account" to /me */ });
test("a very long name does not push the feed sideways", async ({ page, browser }) => {              // Review Focus 10
  /* addGame(browser, { name: "W".repeat(60) }); open "/": document.documentElement.scrollWidth equals clientWidth */ });
test("the feed has no Ruken wordmark above it", async ({ page, browser }) => { /* no link named "Ruken" in a header */ });
```

  A game a journey has just made is the newest in the feed, so it is among the first fifty at `/`; from Task 15 on, journeys open the feed at their own game instead. `tests/browser/home.test.ts` describes the placeholder page ("Coming soon", a "Sign in" button on the felt), which design 7.5 says the feed replaces: its cases are removed and the file with them, and `look.test.ts` loses its case for that page. That is a screen replaced, not a test loosened; the report line names both. `boxOf` is slice 1's (`tests/browser/support/look.ts`). Push. Expected: `browser` fails in `feed.test.ts` ("Coming soon" is there; no `section[data-slug]`). The two architecture cases pass at once if slice 2's rule already covers them; say so.
- [ ] **Step 2 (green):** the component, the route, the layout. Push. Expected: all pass. The empty feed ("No games here yet.") is not reached by a journey, because the journeys' database always holds a game; Task 12 pins the empty list, and Task 27 looks at the line on the real site if no game is live there yet. Say so in the report line.

### Task 14: Share

**Files:**
- Create: `src/features/feed/share.ts`
- Modify: `src/features/feed/Feed.svelte`, `src/features/feed/feed.browser.ts`
- Test: `tests/features/feed/share.test.ts`, `tests/browser/feed.test.ts` (add cases)

**Interfaces:**
- Produces, pure, with no browser API named in it:
  - `shareAddress(origin: string, slug: string): string`: `` `${origin}/g/${slug}` `` (design 5.1: "That is what Share sends").
  - `shareLink(tools: { share?: (data: { title: string; url: string }) => Promise<void>; copy?: (text: string) => Promise<void> }, link: { title: string; url: string }): Promise<"shared" | "closed" | "copied" | "manual">`. With `share`: `"shared"` when it settles; `"closed"` when it rejects with an error named `AbortError` (the person closed the sheet); any other rejection falls through to copying. With `copy` and no usable `share`: `"copied"`, or `"manual"` when it rejects. With neither: `"manual"`.
  - `SHARE_WORDS: Record<"copied" | "manual", string>`: `"Link copied."` and `"Copy the address from the bar at the top."` (slice 2's words).
- In `Feed.svelte`: at the right of each clip, above the band, `<button aria-label="Share">`, a 48px target with an arrow drawn as one plain shape. It calls `shareLink` with `navigator.share` and `navigator.clipboard.writeText` where the browser has them, the game's name and `shareAddress(location.origin, slug)`. `"copied"` and `"manual"` show their words in a `<p role="status">` beside the button for 4 seconds; `"shared"` and `"closed"` show nothing. A computer-only game on a phone gets, under "This one needs a computer.", `<button>Share the link</button>`, which does the same (design 5.2); it is the one other button with words, and only there.

Grandma: one mark, one tap, and the phone's own share sheet opens. Where there is none, one short line says what happened or what to do.

- [ ] **Step 1 (red):**

```ts
const link = { title: "Tiny game", url: "https://ruken.test/g/tiny-game" };
it("builds the address Share sends", () => { expect(shareAddress("https://ruken.test", "tiny-game")).toBe("https://ruken.test/g/tiny-game"); });
it("uses the share sheet when there is one", async () => { /* share resolves: "shared"; copy was not called; share got the link */ });
it("says nothing when the person closes the sheet", async () => {                                   // Review Focus 12
  const share = () => Promise.reject(Object.assign(new Error("closed"), { name: "AbortError" }));
  expect(await shareLink({ share, copy: () => Promise.resolve() }, link)).toBe("closed");
});
it("copies when the sheet fails or is not there", async () => { /* share rejects with TypeError → "copied"; no share → "copied"; copy got link.url */ });
it("says how to copy by hand when nothing works", async () => { expect(await shareLink({}, link)).toBe("manual"); /* and when copy rejects */ });
// tests/browser/feed.test.ts
test("Share tells the person what happened", async ({ page, browser }) => {
  const game = await addGame(browser);
  await page.clock.install();
  await page.goto("/"); const clip = clipOf(page, game.slug); await clip.scrollIntoViewIfNeeded();
  await clip.getByRole("button", { name: "Share" }).click();                                         // the test browser has no share sheet
  await expect(clip.getByRole("status")).toHaveText(/^(Link copied\.|Copy the address from the bar at the top\.)$/);
  await page.clock.runFor(4_000);
  await expect(clip.getByRole("status")).toHaveCount(0);
});
test("a computer-only game says so on a phone, and offers its link", async ({ page, browser }, testInfo) => {   // Review Focus 11
  /* addGame(browser, { playsOn: "computer_only" }); "/": on the phone project the clip has "This one needs a computer.", no Play link,
     and "Share the link" shows one of the two lines; on the computer project it has Play. showTheOwner "a computer-only game in the feed" (phone). */ });
```

  The second case of Task 13 ("Play is the only thing with words to press") gains the exception: a button named "Share the link" is allowed inside a clip that says "This one needs a computer." Stubs. Push. Expected: `verify` fails in `share.test.ts` ("not built yet"); `browser` fails in the two new cases (no button named "Share").
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 15: A game's address opens the feed at that clip (`/g/<game>`)

**Files:**
- Modify: `src/routes/g/[game]/+page.server.ts`, `src/routes/g/[game]/+page.svelte`, `tests/browser/game-page.test.ts`, and every journey that presses Play on `/g/<slug>` (`play.test.ts`, `pay.test.ts`, `play-time.test.ts`, `take-off.test.ts`; find them with a search for `name: "Play"`)
- Test: `tests/browser/game-page.test.ts`

- `load`: `liveGameBySlug(params.game)`, null is a 404 as today; `arrival.remember(cookies, { makerUserId: game.makerUserId, path: url.pathname })` stays exactly as slice 2 wrote it; then `feed({ first: params.game, phone })` (null is the same 404) and `account`, as Task 13. The page is `<Feed … />` with the title `<name> · Ruken`. The placeholder card and its own share script go; nothing else of the route changes.
- Slice 2's cases in `game-page.test.ts`, one by one: "shows its name, its line, its clip and Play" keeps every check but three: the name is found as a level-2 heading inside `clipOf(page, game.slug)`, the sources are found under that clip's `video`, and `expectOneCard` and "no button" go (the screen is no longer a card; Task 13's case covers the buttons); its screenshot is named "the feed, opened at a game". "The clip's address answers anyone", "remembers its maker's link" and "a game that is not there" stay as they are. "A computer-only game says so on a phone" stays, found inside the clip. In the other journey files, `page.getByRole("link", { name: "Play" })` becomes `clipOf(page, game.slug).getByRole("link", { name: "Play" })`, because the page now holds a Play for each game after the first. No check is dropped from them.

- [ ] **Step 1 (red):** the changes above, and three new cases: the opened game's clip is the first section and the next section is another game; `/g/<slug>` has no wordmark header; a game its maker took off answers the missing page with "Back to Ruken" (Review Focus 2; `take-off` helpers from slice 2's Task 31). Push. Expected: `browser` fails in `game-page.test.ts` (no `section[data-slug]` on the placeholder card).
- [ ] **Step 2 (green):** the route. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the green run and one line per screen for the Owner: "the feed", "a computer-only game in the feed", "the feed, opened at a game". Mark the branch ready after "fine".

---

# Branch E: `slice-3/feed-controls`

### Task 16: The clip on screen plays, and a tap turns sound on

**Files:**
- Create: `src/features/feed/current.ts`
- Modify: `src/features/feed/Feed.svelte`
- Test: `tests/features/feed/current.test.ts`, `tests/browser/feed-controls.test.ts`

**Interfaces:**
- Produces: `ON_SCREEN = 0.6` and `currentOf(ratios: readonly number[]): number`: the index of the largest ratio when it is `ON_SCREEN` or more (the first of equals), otherwise -1.
- In `Feed.svelte`: an `IntersectionObserver` on the sections (thresholds 0, 0.6, 1) keeps each section's visible share; the section `currentOf` names gets `data-current="true"`, its video is played and set to `preload="auto"` with the one after it, and every other video is paused and put back to its start. A `play()` the browser refuses is ignored: the clip stays still and everything else works. Sound: over each clip, under the band and the marks, one `<button aria-label="Sound" aria-pressed={sound}>` the size of the clip. Pressing it flips `sound`; every video's `muted` is `!sound`, so sound stays as set from one game to the next (design 5.1). A small speaker mark at the top left shows which it is (a plain shape, with a stroke through it when off). With no script, the first clip plays without sound, as the server sent it.

Grandma: tap the game and you hear it. Tap again and it is quiet. Nothing to find, nothing to read.

- [ ] **Step 1 (red):**

```ts
it("names the clip that fills most of the screen", () => { expect(currentOf([0, 0.9, 0.1])).toBe(1); });
it("names nothing while no clip is mostly on screen", () => { expect(currentOf([0.5, 0.5])).toBe(-1); expect(currentOf([])).toBe(-1); });
it("takes the first of two equal clips", () => { expect(currentOf([0.6, 0.6])).toBe(0); });
// tests/browser/feed-controls.test.ts
test("only the clip on screen is the current one", async ({ page, browser }) => {
  const game = await addGame(browser); await addGame(browser);
  await page.goto(`/g/${game.slug}`);
  const sections = page.locator("section[data-slug]");
  await expect(sections.nth(0)).toHaveAttribute("data-current", "true");
  await page.keyboard.press("ArrowDown");
  await expect(sections.nth(1)).toHaveAttribute("data-current", "true");
  await expect(page.locator('section[data-current="true"]')).toHaveCount(1);
});
test("a tap turns sound on, it stays on for the next game, and a tap turns it off", async ({ page, browser }) => {
  /* open /g/<slug>; every video is muted and Sound has aria-pressed "false";
     click the first clip's Sound: its video's muted is false, aria-pressed "true";
     ArrowDown: the second clip's video is not muted either; click its Sound: every video is muted again */ });
test("Sound never covers Play, Share or the way to an account", async ({ page, browser }) => { /* pressing Play still goes to /g/<slug>/play; pressing Share still shows its line */ });
```

  The journeys' clips are not playable video ("Found while planning", 5), so no case asserts that a video is playing. Stub for `currentOf`. Push. Expected: `verify` fails in `current.test.ts` ("not built yet"); `browser` fails in `feed-controls.test.ts` (no `data-current`, no button named "Sound").
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 17: The two hints on a first open

**Files:**
- Modify: `src/features/feed/Feed.svelte`
- Test: `tests/browser/feed-controls.test.ts` (add cases)

Design 5.7, "A viewer's first open". After the page's script starts, and only when the browser's `localStorage` has no `rk_seen_hints`, the first clip shows two lines in one `<div role="status">`, in the middle of the clip and clear of the band: with a touch screen (`navigator.maxTouchPoints > 0`), "Swipe up for the next game" and "Tap for sound"; without one, "Scroll down for the next game" and "Click for sound". They are chalk on the same flat dark band as the words below, 18px, in a panel with 20px corners. The first scroll of the feed, the first press of Sound or the first key takes them away and writes `rk_seen_hints`, so they never show again on that device. They fade over 300ms; with reduced motion they are removed at once. They are never on any clip but the first, and with no script they are never there.

Grandma: each hint is one short line, says what to do on the device in the person's hand, and goes away by itself the first time they do it.

- [ ] **Step 1 (red):**

```ts
test("a first open shows two hints, in the words of the device", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser);
  await page.goto(`/g/${game.slug}`);
  const hints = page.getByRole("status").filter({ hasText: "next game" });
  const phone = testInfo.project.name === "phone";
  await expect(hints).toContainText(phone ? "Swipe up for the next game" : "Scroll down for the next game");
  await expect(hints).toContainText(phone ? "Tap for sound" : "Click for sound");
  await showTheOwner(page, testInfo, "the feed on a first open");
});
test("the hints never cover Play", async ({ page, browser }) => { /* the hints' box and Play's box do not overlap */ });                    // Review Focus 16
test("the first swipe takes them away, for good", async ({ page, browser }) => {
  /* ArrowDown: the hints are gone (toHaveCount(0)); reload: they do not come back; localStorage has rk_seen_hints */ });
test("the first tap takes them away too", async ({ page, browser }) => { /* a new context; press Sound: gone */ });
test("the second game never has them", async ({ page, browser }) => { /* a new context; the hints are inside the first section only */ });
test("with reduced motion nothing fades", async ({ page, browser }) => {
  /* page.emulateMedia({ reducedMotion: "reduce" }); open; ArrowDown; the hints are gone at the next check with no wait, and the feed's
     computed scroll-behavior is "auto" */ });
```

  Push. Expected: `browser` fails in the new cases (no hints).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.
- [ ] **Step 3: if the phone project shows the computer's words.** Then Playwright's phone does not report a touch screen through `navigator.maxTouchPoints`. Report what it reports, and what `matchMedia("(hover: none)").matches` is there. Do not make the test accept either wording.
- [ ] **Step 4:** send the coordinator the green run and one line for "the feed on a first open". Mark the branch ready after "fine".

---

# Branch F: `slice-3/paywall-clip`

### Task 18: The paywall card over the clip the person tapped

**Files:**
- Create: `src/features/feed/ClipBackdrop.svelte`
- Modify: `src/features/feed/feed.browser.ts`, `src/routes/join/+page.server.ts`, `src/routes/join/+page.svelte`
- Test: `tests/browser/join.test.ts` (add cases)

Design 5.2 (Owner, 2026-11-14): the card is laid over the clip they tapped, which stays on screen, dimmed, behind it; where there is no clip, the same card sits on the felt.

- `load` gains `backdrop: { upright: string; wide: string } | null`. `backFromPaywall(next)` answers `/g/<slug>` only when `next` is exactly a game's play address; then `liveGameBySlug(slug)`, and for a live game its two clip addresses (`gamesServices().address("media") + "/" + key`). Any other `next`, or a game that is not live: null, and `gamesServices()` is not called at all, so the card still opens for `/join?next=/me` on a site with no games settings.
- `ClipBackdrop.svelte`, props `{ upright, wide }`: one `<video muted loop autoplay playsinline aria-hidden="true" tabindex="-1">` with the two sources as the feed has them, fixed to the window behind everything, and over it one flat layer of `ink` at 60%. It takes no press and no focus, and a screen reader does not meet it.
- `/join`'s page puts `<ClipBackdrop … />` before its `<main class="card">` when `backdrop` is not null. The card, its words and its buttons do not change.

Grandma: the person still sees the game they tapped, with the price on a card in front of it: what it costs, what happens next, one button, and "Not now" back to the game.

- [ ] **Step 1 (red):**

```ts
test("the price card sits over the clip the person tapped", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser);
  await page.goto(`/g/${game.slug}`);
  await clipOf(page, game.slug).getByRole("link", { name: "Play" }).click();
  await expect(page).toHaveURL(`/join?next=%2Fg%2F${game.slug}%2Fplay`);
  const behind = page.locator('video[aria-hidden="true"]');
  await expect(behind.locator("source").first()).toHaveAttribute("src", new RegExp(`/clips/${game.publicId}/upright-[0-9a-f]{16}\\.mp4$`));
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  await expectOneCard(page);
  await expect(page.getByRole("link", { name: "Not now" })).toHaveAttribute("href", `/g/${game.slug}`);
  await showTheOwner(page, testInfo, "the paywall card over a clip");
});
test("the clip behind the card cannot be pressed or tabbed to", async ({ page, browser }) => { /* tabindex "-1"; pressing Tab from the top never focuses it; a click at the window's corner does nothing */ });
test("the card sits on the felt when it was not reached from a game", async ({ page }) => { /* /join?next=/me: no video; the card shows */ });
test("the card sits on the felt for a game that is not live, or an address that is not a game's", async ({ page }) => {   // Review Focus 17
  /* /join?next=/g/no-such-game/play and /join?next=/g/x/play/beat: no video; the heading shows; status 200 */ });
```

  Push. Expected: `browser` fails in the first two cases (no video behind the card).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, slice 1's and slice 2's `/join` journeys included.

### Task 19: The pip mark on the paywall card

**Files:**
- Modify: `src/lib/look.css`, `tests/lib/look.test.ts` (`CLASSES` gains `pip`), `src/routes/join/+page.svelte`, and the `/join` journeys that today expect no pip red on the card
- Test: `tests/lib/look.test.ts` (add cases), `tests/browser/join.test.ts` (add cases)

Design 5.8 (Owner, 2026-11-14, "Keep it"): one small pip-red mark makes the paywall card read as a playing card. If `pip` is already in `CLASSES` on `main` when this task starts, stop and report: someone built it first.

| Class | Goes on | What it does |
|---|---|---|
| `pip` | one empty `<span aria-hidden="true">` on the price card | a 12px square of `pip`, turned 45 degrees (a diamond), 1.25rem from the card's top and from its right edge. `.card` becomes its anchor (`position: relative`) |

The span is the first thing inside the price card (the card that shows the price and "Continue"), and is not on the "You're already a member." card or the "Your membership is paused" card. Nothing else in the site uses `--pip`.

- [ ] **Step 1 (red):** `tests/lib/look.test.ts`: `CLASSES` holds `pip`; `look.css` has one rule that uses `var(--pip)`, and its selector is `.pip`; the `.pay`, `button` and `.button` rules do not use it. `tests/browser/join.test.ts`:

```ts
test("the price card has one small red mark, and it is not a button", async ({ page }, testInfo) => {
  await page.goto("/join");
  const red = page.locator(".card .pip");
  await expect(red).toHaveCount(1);
  expect(await pipRed(page)).toHaveLength(1);                                    // the mark, and nothing else on the page
  const box = await boxOf(red); expect(box.width).toBeLessThanOrEqual(20); expect(box.height).toBeLessThanOrEqual(20);
  for (const button of await page.locator("button, a.button").all()) await expect(button).not.toHaveCSS("background-color", rgb(token("--pip")));
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await showTheOwner(page, testInfo, "the paywall card");
});
test("a member's card has no mark", async ({ page }) => { /* payAsNewMember(page); /join: pipRed(page) is [] */ });
```

  Where a slice 1 journey asserts `pipRed(page)` is empty on the price card, it now asserts exactly the one mark and that no button is red; say which cases changed in the report line. Push. Expected: `verify` fails in `look.test.ts` (no such rule); `browser` fails in the first new case.
- [ ] **Step 2 (green):** the rule and the span. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the green run and one line each for "the paywall card over a clip" and "the paywall card". Mark the branch ready after "fine".

---

# Branch G: `slice-3/photo`

Needs branch B, slice 2's branch D (the gate) on `main`, and the answer to Q2. Under answer B this branch is not built.

### Task 20: A maker's photo: the rules, saving it, and removing it

**Files:**
- Create: `src/features/pages/photo.ts`, `src/features/pages/photo-crop.ts`
- Modify: `src/features/pages/service.ts`, `src/features/pages/services.ts`, `src/features/pages/pages.ts`, `src/features/pages/pages.browser.ts`, `src/features/accounts/deletion.ts`, `src/routes/jobs/purge-accounts/+server.ts`
- Test: `tests/features/pages/photo.test.ts`, `tests/features/pages/photo-crop.test.ts`, `tests/features/pages/service.pg.test.ts` (add cases), `tests/features/accounts/purge.pg.test.ts` (add a case)

**Interfaces:**
- Produces:
  - In `photo.ts`: `PHOTO_MAX_BYTES = 5_000_000`; `type PhotoContentType = "image/jpeg" | "image/png" | "image/webp"`; `looksLikePhoto(bytes: Uint8Array, contentType: PhotoContentType): boolean` (JPEG starts `FF D8 FF`; PNG starts `89 50 4E 47 0D 0A 1A 0A`; WebP has `RIFF` at 0 and `WEBP` at 8); `photoProblem(upload: { contentType: string; bytes: Uint8Array }): string | null`, the first of: not one of the three types, "A photo is a JPEG, PNG or WebP picture."; over the limit, "That photo is `<size>`. A photo can be up to 5 MB." (the size written as slice 2's `clipProblem` writes one; export that small formatter from `games.ts` rather than copy it); first bytes wrong, "That file doesn't look like a picture. Save it as a JPEG or PNG and try again."; `photoKeyFor(random16Hex: string, contentType: PhotoContentType): string`, `photos/<16 hex>.<jpg|png|webp>`; `isPhotoKey(key: string): boolean`, exactly that shape.
  - In `photo-crop.ts`, pure: `PHOTO_SIDE = 512` and `cropSquare(width: number, height: number): { x: number; y: number; side: number }`, the largest square in the middle of a picture. `pages.browser.ts` re-exports both.
  - `createPagesService`'s deps gain `files: FileStore` (`pagesServices()` passes `fileStore()`), and it gains `savePhoto(userId: string, upload: { contentType: string; bytes: Uint8Array }): Promise<void>` (`photoProblem` gives `INVALID`; no page yet, `NOT_FOUND`; else the bytes go under a new key, the page's `photoKey` is set, and then the old object, if any, is deleted) and `removePhoto(userId: string): Promise<void>` (the key cleared, then the object deleted).
  - `purgeDueAccounts`'s deps gain `files: FileStore` (from `src/lib/files/store.ts`; the job's route passes `fileStore()`): it reads the page's `photoKey` before deleting the page and deletes that object once the transaction is done.

- [ ] **Step 1 (red):** `photo.test.ts`: each type's first bytes pass and are refused under another type's name; one case per line of `photoProblem`'s words; a web page and an SVG's text sent as `image/png` are refused by their first bytes (Review Focus 13); `isPhotoKey` takes `photos/0123456789abcdef.png` and refuses `photos/../x.png`, `photos/0123456789abcdef.svg`, `photos/0123456789abcdef.html`, a clip key and a key under `files/`. `photo-crop.test.ts`: `cropSquare(4000, 3000)` is `{ x: 500, y: 0, side: 3000 }`; `cropSquare(300, 900)` is `{ x: 0, y: 300, side: 300 }`; a square is itself. `service.pg.test.ts`, with `MemoryFileStore`: a photo is stored and its key remembered; a second takes its place and the first object goes; a refused one stores nothing; `removePhoto` clears both. `purge.pg.test.ts`: after the job, the deleted person's photo is not in the store (Review Focus 14). Stubs. Push. Expected: `verify` fails in the two unit files, `postgres` in the two others, with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 21: The gate serves a photo

**Files:**
- Modify: `src/features/play/gate.ts`
- Test: `tests/features/play/gate.test.ts` (add cases)

Slice 2's gate, step 4 ("A clip", on the `media` name), takes one more key shape. The path without its first slash must pass the clip pattern or the photo pattern, `^photos/[0-9a-f]{16}\.(jpg|png|webp)$`, written out in `gate.ts` beside the clip pattern (the gate imports no feature). A photo is served exactly as a clip is: its type from `servedTypeFor`, `cache-control: public, max-age=31536000, immutable`, `cross-origin-resource-policy: cross-origin`, to anyone. Nothing else about the gate changes. The gate is deployed by the deploy command that already deploys it; there is no step for the Owner.

- [ ] **Step 1 (red):**

```ts
it("sends a photo to anyone, to keep for a year", async () => { /* http://media.games.test/photos/0123456789abcdef.png: 200, image/png, immutable, CORP cross-origin */ });
it("serves nothing from the media name that is not a clip or a photo", async () => {              // Review Focus 13
  /* /photos/0123456789abcdef.svg, /photos/0123456789abcdef.html, /photos/../files/aaaaaaaaaa/p1/index.html, /photos/: 404 each, and the store is never asked */ });
it("never serves a photo from a game's own name", async () => { /* http://g-aaaaaaaaaa.games.test/photos/0123456789abcdef.png: refused as any address without a pass is */ });
it("the gate's photo pattern is the pages feature's", () => { /* for a list of good and bad keys, the pattern in gate.ts agrees with isPhotoKey */ });
```

  Push. Expected: `verify` fails in `gate.test.ts`: the photo is 404.
- [ ] **Step 2 (green):** the pattern. Push. Expected: all pass, slice 2's gate journeys included. Branch G is ready to merge.

---

# Branch H: `slice-3/maker-page`

Needs branches B and D. Task 23 needs the answer to Q1.

### Task 22: A maker's page (`/<handle>`)

**Files:**
- Create: `src/features/pages/MakerPage.svelte`, `src/params/handle.ts`, `src/routes/[handle=handle]/+page.server.ts`, `src/routes/[handle=handle]/+page.svelte`, `src/routes/[handle=handle]/out/[link]/+server.ts`, `tests/browser/support/pages.ts`, `tests/browser/maker-page.test.ts`
- Modify: `src/features/pages/pages.browser.ts`, `src/routes/+layout.svelte` (`BARE_ROUTES` gains `/[handle=handle]`), `tests/browser/pay.test.ts`
- Test: `tests/browser/maker-page.test.ts`, `tests/browser/pay.test.ts` (one case)

**The screen** (design 5.3; Follow and Report are not built):

```
       (photo)
      Maker Name
       @maker
  one line about me
       ● ● ●               the combination's colours
 ┌─────┐ ┌─────┐
 │clip │ │clip │           their games on Ruken
 │Name │ │Name │
 │▶Play│ │▶Play│
 └─────┘ └─────┘
 [  My Discord       ]     their links, in their order
 ┌───────────────────┐
 │ My other game     │     a game somewhere else
 │ A game on Steam   │
 └───────────────────┘
        Ruken
```

- `src/params/handle.ts`: `export const match = (value: string) => isHandleShape(value)`, from `pages.browser.ts`. A path of another shape (a capital, a dot) never reaches the page and is the ordinary missing page; Ruken's own routes are fixed paths, which SvelteKit always tries first.
- `load`: `pageByHandle(params.handle)`, null is a 404; the maker's live games from `gamesServices().service.liveGames({ makerUserId })`, newest `liveSince` first, each with its name, slug and upright clip address; `membershipServices().arrival.remember(cookies, { makerUserId, path: url.pathname })` (slice 1: a maker's page is an arrival); `countView(page.id, <the caller's user id, or null>)`; the photo's address (`address("media") + "/" + photoKey`) or null. It awaits each (slice 1: nothing outlives the request's database client).
- `GET /<handle>/out/<link>`: `tapLink(params.handle, params.link, <the caller's user id, or null>)`; null is a 404; otherwise a 303 to that address (`redirect(303, url, { external: true })`, as `/join` does for Stripe). The address was checked as https when it was saved and is read from the database, never from the request.
- `MakerPage.svelte`, what a journey and a screen reader find: one `<main data-theme={theme.id}>` that sets the four colours as custom properties with `style:` directives; the photo as `<img alt="" width="96" height="96">`, round, or with no photo the first letter of the name in a circle of the button colour (`aria-hidden`); `<h1>` the name; `@handle`; the one line, if there is one; one small dot per colour of `theme.colours` (`aria-hidden`); when the maker has live games, `<section aria-label="Games">` with one `<article>` per game: its upright clip (`<video muted loop autoplay playsinline>`), its name as `<h2>`, and `<a href="/g/<slug>/play">Play</a>`; `<nav aria-label="Links">` with, in order, a link as `<a href="/<handle>/out/<id>" rel="nofollow ugc noopener">title</a>` and a game somewhere else as one `<a>` holding the title and the line "A game on `<site>`"; last, a small `<a href="/">Ruken</a>`.
- Its styles, in the component: the ground and text are the theme's; a link is a button in the theme's button colours, the page's width (30rem at most), 48px tall at least, 12px corners, weight 600; a game's card and a game somewhere else are cards with 20px corners in the button colours; games sit two to a row on a phone and up to four on a wide screen, each clip 9 by 16; headings are Young Serif and text is Schibsted Grotesk, from the look's custom properties; everything is centred in one column; pressing a link scales it to 0.97, and with reduced motion nothing moves.
- `tests/browser/support/pages.ts`: `makePage(email: string, page: { handle: string; name: string; oneLine?: string; themeId?: number; links?: { kind: "link" | "game_elsewhere"; title: string; url: string; hidden?: boolean }[] }): Promise<{ handle: string; linkIds: string[] }>`, rows written straight into the journeys' database (the edit screens arrive in branch I), and `pageCounts(handle: string): Promise<{ views: number; taps: number[] }>`. `freshHandle(): string` gives each journey an address of its own (`m-` and eight random letters).

Grandma: a visitor sees who this is, their games, then their links. Each game has Play. Each link says where it goes. Nothing else is on the page.

- [ ] **Step 1 (red):**

```ts
test.beforeEach(forgetRateLimits);
test("a maker's page shows their games, their links and their chosen colours, at its own short address", async ({ page, browser }, testInfo) => {   // design 8
  const game = await addGame(browser, { name: "Tiny game" });
  const theme = THEMES[0]!;
  const made = await makePage(game.makerEmail, { handle: freshHandle(), name: "Night Owl", oneLine: "I make small games.", themeId: theme.id,
    links: [{ kind: "link", title: "My Discord", url: "https://discord.gg/example" }, { kind: "game_elsewhere", title: "My other game", url: "https://store.steampowered.com/app/1" },
            { kind: "link", title: "Old thing", url: "https://example.com/old", hidden: true }] });
  await page.goto(`/${made.handle}`);
  await expect(page).toHaveTitle("Night Owl · Ruken");
  await expect(page.getByRole("heading", { level: 1, name: "Night Owl" })).toBeVisible();
  await expect(page.getByText(`@${made.handle}`)).toBeVisible();
  const games = page.getByRole("region", { name: "Games" });
  await expect(games.getByRole("heading", { name: "Tiny game" })).toBeVisible();
  await expect(games.getByRole("link", { name: "Play" })).toHaveAttribute("href", `/g/${game.slug}/play`);
  await expect(games.locator("video source").first()).toHaveAttribute("src", new RegExp(`/clips/${game.publicId}/upright-`));
  const links = page.getByRole("navigation", { name: "Links" }).getByRole("link");
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveText("My Discord");
  await expect(links.nth(0)).toHaveAttribute("href", `/${made.handle}/out/${made.linkIds[0]}`);
  await expect(links.nth(1)).toContainText("My other game"); await expect(links.nth(1)).toContainText("A game on Steam");
  await expect(page.getByText("Old thing")).toHaveCount(0);
  const main = page.locator("main");
  await expect(main).toHaveCSS("background-color", rgb(theme.ground)); await expect(main).toHaveCSS("color", rgb(theme.text));
  await expect(links.nth(0)).toHaveCSS("background-color", rgb(theme.button)); await expect(links.nth(0)).toHaveCSS("color", rgb(theme.buttonText));
  await expect(links.nth(0)).toHaveCSS("border-top-left-radius", "12px"); await expect(links.nth(1)).toHaveCSS("border-top-left-radius", "20px");
  await showTheOwner(page, testInfo, "a maker's page");
});
test("a page with no colours picked wears Ruken's own", async ({ page, browser }, testInfo) => { /* themeId left out: main is felt with chalk text; showTheOwner "a maker's page, Ruken's colours" */ });
test("a page with no games shows no games", async ({ page }) => { /* signUp in its own context; makePage; no region named "Games"; the links are there */ });
test("landing on a maker's page remembers their link", async ({ page, browser }) => { /* the rk_arrival cookie is set, HttpOnly, Lax */ });
test("a visitor's open and tap are counted, and the maker's own are not", async ({ page, browser, request }) => {          // Review Focus 9
  /* a visitor opens the page: pageCounts views 1. request.get(`/${handle}/out/${linkId}`, { maxRedirects: 0 }): 303, location "https://discord.gg/example"; taps [1, 0].
     signInAs(page, makerEmail), open the page and the out address: views 1, taps [1, 0] still. */ });
test("nobody is sent on from a hidden link, another page's link or a made-up one", async ({ request }) => {               // Review Focus 6
  /* each answers 404; no count moved */ });
test("an address nobody has is a missing page with a way back", async ({ page }) => { /* /no-such-maker-xyz → 404, "We can't find that page.", "Back to Ruken"; /Night-Owl (a capital) → 404 */ });
test("Ruken's own addresses still open Ruken's own screens", async ({ page }) => { /* /me goes to sign-in; /join shows the card */ });
test("long words do not push a page sideways, and its links are easy to hit", async ({ page, browser }) => {              // Review Focus 10
  /* a 40-character name of "W", a 60-character link title: scrollWidth equals clientWidth; each link's box is 48px tall or more */ });
test("a clip in the feed names its maker's page", async ({ page, browser }) => { /* after makePage for a game's maker: clipOf(page, slug) has a link "@<handle>" to /<handle> */ });
// tests/browser/pay.test.ts
test("a member's sign-up records the maker's page they came through", async ({ page, browser }) => {                      // design 8
  /* a visitor lands on /<handle>, presses Play on the maker's game, signs up, pays;
     membershipStartsOf(member.email) is [{ broughtByUserId: game.makerUserId, arrivalPath: `/${handle}` }] */ });
```

  `THEMES` and `rgb` are imported by the test from `src/features/pages/themes.ts` and slice 1's look support. Push. Expected: `browser` fails in `maker-page.test.ts` (404 at `/<handle>`) and in the new `pay.test.ts` case; "Ruken's own addresses" and the missing-page case pass already, say so.
- [ ] **Step 2 (green):** the component, the matcher, the two routes, the layout's list. Push. Expected: all pass, the architecture test included (`src/params/` reaches `pages` through its browser entry).

### Task 23: Social icons (waits for Q1)

Written for answer A. Under B, the same links are shown in the same row as small buttons with the site's name, and no file is copied: leave out `social-icons.json`, its licence and its source record, and the icon cases below. Under C, this task is not built.

**Files:**
- Create: `src/features/pages/library/social-icons.json`, `social-icons-LICENSE.txt`, `social-icons-source.json`, `prisma/migrations/<timestamp>_social_links/migration.sql`
- Modify: `prisma/schema/pages.prisma` (`PageLinkKind` gains `social`), `src/features/pages/links.ts`, `service.ts`, `MakerPage.svelte`, `tests/browser/support/pages.ts`
- Test: `tests/features/pages/links.test.ts`, `service.pg.test.ts`, `tests/features/pages/social-icons.test.ts`, `tests/browser/maker-page.test.ts` (add cases)

**Where the icons come from.** In a scratch folder outside the repository: `npm pack simple-icons` at the newest version on the day, noted with its tarball address and integrity in `social-icons-source.json`. From each mark's `.svg` in the package, copy only the `d` of its one `<path>` (the marks are drawn in a 24 by 24 box) into `social-icons.json` as `{ "<site id>": "<d>" }`. `social-icons-LICENSE.txt` is the package's licence file, which must say CC0 1.0; if it says anything else, or a mark below is not in the package, stop and report (a missing mark's site is then left out, with the coordinator's answer). The package is not added to `package.json`.

**Interfaces:**
- Produces, in `links.ts`: `interface SocialSite { id: string; name: string; hosts: string[] }` and `SOCIAL_SITES`: `youtube` "YouTube" (`youtube.com`, `www.youtube.com`, `youtu.be`), `twitch` "Twitch" (`twitch.tv`, `www.twitch.tv`), `discord` "Discord" (`discord.gg`, `discord.com`), `x` "X" (`x.com`, `twitter.com`), `bluesky` "Bluesky" (`bsky.app`), `instagram` "Instagram" (`instagram.com`, `www.instagram.com`), `tiktok` "TikTok" (`tiktok.com`, `www.tiktok.com`), `steam` "Steam" (`store.steampowered.com`, `steamcommunity.com`), `itch` "itch.io" (`itch.io` and any name ending `.itch.io`), `github` "GitHub" (`github.com`); `socialSiteOf(url: string): SocialSite | null`.
- `addLink` with kind `social` whose address is on none of them: `PageError("INVALID", "We don't have an icon for that site yet. Add it as a link.")`. `pageByHandle`'s links gain `social: { id: string; name: string } | null`.
- `MakerPage.svelte`: after the links, `<nav aria-label="Elsewhere">` with one `<a href="/<handle>/out/<id>" aria-label="<site name>" rel="nofollow ugc noopener">` per social link, a 48px round target in the page's text colour holding the mark (`<svg viewBox="0 0 24 24" aria-hidden="true"><path d={…} /></svg>`, filled with `currentColor`). They are not among the "Links".

Grandma: a row of marks a person already knows, each named for a screen reader, each one tap.

- [ ] **Step 1 (red):** `links.test.ts`: `socialSiteOf` names each site from one of its addresses, takes `https://maker.itch.io/game` as itch.io, and answers null for `https://example.com`. `service.pg.test.ts`: a social link on a known site is stored; on an unknown one it is refused with the words above. `social-icons.test.ts`: every `SOCIAL_SITES` id has a path in the file and the file has no other key; each path starts with `M` and holds only path letters, digits, spaces, commas, dots and minus signs (nothing that could be markup); the licence file holds "CC0"; the source record names the package, its version and the tarball's integrity. `maker-page.test.ts`: a social link shows under "Elsewhere" as a link named "YouTube", 48px by 48px or more, going through `/out/`, and is not under "Links"; `showTheOwner` "a maker's page with social icons". Stubs. Push. Expected: `verify` fails in the unit files, `postgres` in the service's (the enum value is missing), `browser` in the new case.
- [ ] **Step 2 (green):** the files, the migration (`ALTER TYPE "PageLinkKind" ADD VALUE 'social'`), the code. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the green run and one line each for "a maker's page", "a maker's page, Ruken's colours" and "a maker's page with social icons". Mark the branch ready after "fine".

---

# Branch I: `slice-3/edit-page`

Needs branch H (and G, when Q2 is A). Four small screens, each one paper card with one thing to do. All four need an account: signed out, the person goes to sign-in and comes back, as slice 2's `/make` does. Slice 4's onboarding uses the first for its step 1 and the others for its step 2.

### Task 24: Your page (`/make/page`)

**Files:**
- Create: `src/routes/make/page/+page.server.ts`, `src/routes/make/page/+page.svelte`, `src/features/pages/words.ts`, `tests/browser/edit-page.test.ts`
- Modify: `src/features/pages/pages.ts`, `src/routes/make/+page.svelte` (one link, "Your page", to `/make/page`)
- Test: `tests/features/pages/words.test.ts`, `tests/browser/edit-page.test.ts`, `tests/browser/make.test.ts` (one case)

**The screen**, before the person has a page:

```
Your page

Your address
[ yourname ]
People find your page at <this site>/yourname. Use letters, numbers and hyphens.

Your name
[ ]

One line about you
[ ]
You can leave this empty.

[ Save ]

Back to your games
```

Once there is a page, the fields hold what was saved, the note reads "People find your page at `<this site>/<handle>`.", and under the button:

```
See your page
Opened 12 times.

Add a photo            (or "Change your photo"; only when Q2 is A)
Pick your colours
Your links
```

- `<this site>` is `url.host`, read from the request, never written in the repository.
- `load`: `pageOf(caller.userId)`; `saved` is true when the address has `?saved=1`.
- Action `save`: `savePage`. A `PageError` answers `fail(error.code === "TAKEN" ? 409 : 400, …)` with its words in `<p class="problem" role="alert">` above the button and the three fields as typed. Success: a 303 to `/make/page?saved=1`, which shows `<p role="status">Saved. Your page is live.</p>` at the top of the card.
- `words.ts`, pure: `timesWords(count: number): string`, "1 time" for one and "`<n>` times" for any other number, with a comma in thousands ("1,204 times"). `pages.ts` re-exports it. The page writes "Opened `<timesWords(views)>`."

Grandma: three fields, each with a label that says what goes in it, and one button. A refusal says what to fix. After saving, one line says the page is live, and "See your page" shows it.

Look: `<main class="card">`; `h1`; plain `label`s and `input`s; the two notes are `note`; the refusal is `problem`; Save is the card's one filled button; every other way on is a plain link. No new class.

- [ ] **Step 1 (red):** `words.test.ts`: 0, 1, 2 and 1204. `edit-page.test.ts`:

```ts
test.beforeEach(forgetRateLimits);
test("a maker makes their page, and it is live at once", async ({ page }, testInfo) => {
  await signUp(page);
  await page.goto("/make/page");
  await expectOneCard(page); await showTheOwner(page, testInfo, "your page, before it is made");
  const handle = freshHandle();
  await page.getByLabel("Your address").fill(handle);
  await page.getByLabel("Your name").fill("Night Owl");
  await page.getByLabel("One line about you").fill("I make small games.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. Your page is live.");
  await expect(page.getByText("Opened 0 times.")).toBeVisible();
  await showTheOwner(page, testInfo, "your page, saved");
  await page.getByRole("link", { name: "See your page" }).click();
  await expect(page).toHaveURL(`/${handle}`);
  await expect(page.getByRole("heading", { level: 1, name: "Night Owl" })).toBeVisible();
});
test("someone signed out is sent to sign in, and comes back", async ({ page }) => { /* /make/page → /sign-in?next=%2Fmake%2Fpage */ });
test("each refusal says what to fix and keeps what was typed", async ({ page, browser }) => {
  /* "ab" → "Use at least 3 letters or numbers."; "make" → "That one is taken. Pick another."; another maker's address → the same words (409);
     an empty name → "Your page needs a name."; after each, the three fields hold what was typed and the alert is visible */ });
test("changing the address moves the page", async ({ page }) => { /* save as one address, then another: the old one is a missing page, the new one opens */ });
test("the maker's area links to the page", async ({ page }) => { /* /make has a link "Your page" to /make/page */ });
```

  Stub for `timesWords`. Push. Expected: `verify` fails in `words.test.ts` ("not built yet"); `browser` fails in `edit-page.test.ts` (404 at `/make/page`) and in the `/make` case.
- [ ] **Step 2 (green):** the route, the words, the link. Push. Expected: all pass.

### Task 25: Your colours and your photo (`/make/page/colours`, `/make/page/photo`)

**Files:**
- Create: `src/features/pages/ThemePicker.svelte`, `src/routes/make/page/colours/+page.server.ts`, `+page.svelte`, and, when Q2 is A, `src/routes/make/page/photo/+page.server.ts`, `+page.svelte`
- Modify: `src/features/pages/pages.browser.ts`
- Test: `tests/browser/edit-page.test.ts` (add cases)

Both screens send someone with no page yet to `/make/page`.

**`/make/page/colours`:**

```
Pick your colours

(•) [ Aa ▬ ]  Ruken's own colours
( ) [ Aa ▬ ]  ( ) [ Aa ▬ ]  ( ) [ Aa ▬ ]  …      one for each offered combination

[ Save ]

Back to your page
```

- `ThemePicker.svelte`, props `{ themes: readonly Theme[]; chosen: number }`: one `<div role="radiogroup" aria-label="Colours">`; in it, for `DEFAULT_THEME` and then each of `themes`, a `<label>` holding `<input type="radio" name="theme" value={id}>` and a tile. A tile is the theme's ground, 20px corners, with "Aa" in its text colour and a short bar in its button colours, 48px tall at least; the chosen one has a ring in the look's `ink`. Each radio is named "Ruken's own colours" or "Colours `<id>`" (`aria-label`). The tiles' colours are set with `style:` directives inside this component, which is why it is a component of the feature and not markup in the route.
- The page is the card, its `h1`, a `<form method="POST">` around the picker, and Save. Action `save`: the posted `theme` as a number; `saveTheme`; a refusal shows its words; success goes to `/make/page?saved=1`.

Grandma: tap the colours you like, press Save. Each tile shows what words and buttons will look like in it.

**`/make/page/photo`** (when Q2 is A):

```
Your photo

[ the photo now, if there is one ]

Choose a picture
[ file field ]
A JPEG, PNG or WebP, up to 5 MB.

[ Save photo ]

Remove photo          (quiet; only when there is one)
Back to your page
```

- The file field accepts `image/jpeg,image/png,image/webp`. Action `save`: a request whose `content-length` is over `PHOTO_MAX_BYTES` plus 100,000 is refused before its body is read, with the size line's words; else `savePhoto` with the file's bytes and type; a refusal shows its words; success goes to `/make/page?saved=1`. Action `remove`: `removePhoto`, then the same.
- The page's own script, when the browser can: on choosing a picture it draws `cropSquare` of it onto a canvas `PHOTO_SIDE` wide at most and puts the JPEG it gets back in the field in the picture's place (`canvas.toBlob(…, "image/jpeg", 0.85)`, a `DataTransfer` to set the field's files). If any step is not there or fails, the picture is sent as it was chosen. A comment says why: a phone's photo is several megabytes, and a redrawn one also carries none of the details a camera writes into a file.

Grandma: choose a picture, press Save photo. A refusal says what kind of file works.

Look, both: `<main class="card">`, `h1`, `label`, `input`, `note`, `problem`, one filled button; "Remove photo" is a `quiet` button. No new class: the tiles' styles are the component's.

- [ ] **Step 1 (red):**

```ts
test("a maker picks their colours and the page wears them", async ({ page }, testInfo) => {
  /* signUp, save a page. /make/page → "Pick your colours". expectOneCard; showTheOwner "pick your colours".
     Check the radio named `Colours ${THEMES[2]!.id}`, Save → "Saved. Your page is live." Open /<handle>: main's background is rgb(THEMES[2].ground), its colour rgb(THEMES[2].text).
     Back, check "Ruken's own colours", Save: the page is felt and chalk again. */ });
test("every tile is easy to hit, and there is one for each offered combination", async ({ page }) => { /* radios: THEMES.length + 1; each label's box is 48px tall or more */ });
test("a number that is not offered is refused, and the colours stay", async ({ page }) => {                             // Review Focus 7
  /* post theme=349 to the form's action with page.request, signed in: 400; /<handle> keeps its colours */ });
test("someone with no page yet is sent to make one first", async ({ page }) => { /* signUp; /make/page/colours and /make/page/photo → /make/page */ });
// when Q2 is A:
test("a maker adds a photo, changes it and removes it", async ({ page }, testInfo) => {
  /* tinyPng(): the 67 bytes of a 1 by 1 PNG, from base64 "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".
     Choose it, Save photo → saved. /<handle> has an img whose src matches /^http:\/\/media\.localhost:8788\/photos\/[0-9a-f]{16}\.(jpg|png)$/ and that address answers 200 as an image.
     showTheOwner "your photo". Save another: a new address, and the first answers 404. Remove photo: the page shows the name's first letter and the address answers 404. */ });
test("a file that is not a picture is refused in words", async ({ page }) => {                                           // Review Focus 13
  /* a file named me.png holding "<html>": "That file doesn't look like a picture. Save it as a JPEG or PNG and try again."; an .svg: "A photo is a JPEG, PNG or WebP picture." */ });
```

  Push. Expected: `browser` fails in the new cases (404 at both addresses).
- [ ] **Step 2 (green):** the picker and the routes. Push. Expected: all pass.

### Task 26: Your links (`/make/page/links`)

**Files:**
- Create: `src/routes/make/page/links/+page.server.ts`, `+page.svelte`
- Test: `tests/browser/edit-page.test.ts` (add cases)

**The screen:**

```
Your links

My Discord                tapped 3 times
  Up · Down · Hide · Remove
Old thing (hidden)        tapped 0 times
  Up · Down · Show · Remove

Add a link
Name
[ ]
Address
[ https:// ]
(•) A link
( ) A game somewhere else
( ) A small icon, for YouTube, Discord and the like      (only when Q1 is A or B)

[ Add link ]

Back to your page
```

With no links: "You haven't added a link yet." in place of the list. Someone with no page yet is sent to `/make/page`.

- The list is a `<ul>`; each link is its title (with " (hidden)" when hidden), "tapped `<timesWords(taps)>`" as a `note`, and four `quiet` buttons, each in a small `<form method="POST">` with the link's id in a hidden field: actions `up`, `down`, `hide` or `show`, `remove`. Up on the first and Down on the last are not shown.
- Action `add`: `addLink` with the name, the address and the kind; a refusal shows its words in `problem` above "Add link" with what was typed kept; success comes back to this screen with the new link last and the form empty.
- Every action answers with a 303 back to `/make/page/links`, so a reload never repeats it. A `NOT_FOUND` (a link that is not this person's) is the missing page.
- "Remove" asks nothing first: "Hide" is the safe choice beside it, and a removed link is two fields to add again.

Grandma: what is on the page is listed as it will appear, each with plain words for what can be done to it. Adding one is two fields and a button.

Look: `<main class="card">`; the kinds are `choice` rows (slice 1's radio rows); the per-link buttons are `quiet`; "Add link" is the card's one filled button. No new class.

- [ ] **Step 1 (red):**

```ts
test("a maker adds links, orders them, hides one and removes one", async ({ page }, testInfo) => {
  /* signUp, save a page. /make/page → "Your links": "You haven't added a link yet."
     Add "My Discord" https://discord.gg/example (A link); add "My other game" https://store.steampowered.com/app/1 (A game somewhere else); add "Old thing" https://example.com/old.
     expectOneCard; showTheOwner "your links". /<handle> lists them in that order, the second as a card that says "A game on Steam".
     "Up" on "Old thing" twice: it is first, here and on the page. "Hide" on it: " (hidden)" here, gone from the page; "Show": back.
     "Remove" on "My other game": gone from both. */ });
test("a link's taps are shown in words", async ({ page, request }) => { /* a visitor's request to /<handle>/out/<id>; the list says "tapped 1 time" */ });
test("a link that is not https is refused, and what was typed stays", async ({ page }) => {                               // Review Focus 5
  /* "http://example.com" → "A link starts with https://"; "javascript:alert(1)" → the same; an empty name → "Give the link a name."; the two fields keep their text */ });
test("nobody changes another maker's links", async ({ page, browser }) => { /* post remove with another maker's link id, signed in as someone else: 404; the link is still on its page */ });
test("the card has one filled button", async ({ page }) => { /* filledButtons(page) has count 1: "Add link" */ });
```

  When Q1 is A or B, one more case: "A small icon" with a YouTube address shows under "Elsewhere" on the page, and with `https://example.com` is refused with "We don't have an icon for that site yet. Add it as a link." Push. Expected: `browser` fails in the new cases (404 at `/make/page/links`).
- [ ] **Step 2 (green):** the route. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the green run and one line each for "your page, before it is made", "your page, saved", "pick your colours", "your photo" and "your links". Mark the branch ready after "fine".

---

# Branch J: `slice-3/real-site`

### Task 27: Design 8's lines for this slice, and the real site

**Files:**
- Create: `tests/browser/feed-and-page.test.ts`
- Modify: `docs/superpowers/progress.md`

- [ ] **Step 1: the two lines, end to end, through the real screens.** One journey: a maker (the one `addGame` made, signed in with `signInAs`) makes their page on `/make/page`, picks a combination, adds a link; a visitor in another context opens `/`, finds that game's clip in the feed with `@<handle>` under it, follows it to `/<handle>`, sees the game, the link and the chosen colours there, presses Play and meets the price card over that game's clip. Every part was built and tested by the tasks before, so this journey passes on its first push: a test with no red, and the report line says so. If it fails, the defect is in the task that owns the failing screen: fix it there, test first.
- [ ] **Step 2:** set slice 3's lines in `docs/superpowers/progress.md`: which of design 8's lines now have a journey ("The site opens straight into the feed, on a phone and on a computer, with the right clip for the screen", "A maker's page shows their games, their links and their chosen colours, at its own short address", and "A member's sign-up records the maker's link they came through" from a maker's page as well as from a game's address).
- [ ] **Step 3: what a person checks on the real site**, the Owner or the coordinator with the Owner, on a phone and on a computer, once every branch is on `main` and deployed. Nothing is typed into the repository; progress.md records what was checked, by whom and when, with no address and no email. The site's address opens the feed, or "No games here yet." while no game is live; with FloorFifty live, its upright clip fills a phone held upright and its wide clip fills a computer's window; a tap turns the sound on and it stays on; the two hints show once and are gone after the first swipe; Share opens the phone's share sheet; signed out, Play shows the price card over the clip, with its small red mark and the Blue "Continue to payment" after sign-up; the Owner's own page, made on `/make/page` with a photo, a combination and two links, opens at its short address in those colours, its game plays its clip, and a tap on a link from another device raises the count on "Your links".
- [ ] **Step 4:** set slice 3's row in progress.md from what is true: "done" only when every branch is merged, `main` is green, and Step 3 passed.

---

## Notes for the plans that follow

- **Slice 4 (submitting and the admin portal).** The maker's onboarding wraps this slice's screens: step 1 is `/make/page`'s address field, with the one thing it lacks, saying at once whether a name is free (design 5.7), which needs a small address of its own that answers free or taken; step 2 is the photo, the one line and the colours. Report goes on the feed's right side under Share and at the foot of a maker's page (design 5.1 and 5.3 show where). Taking a page down and suspending an account need a way for `pageByHandle` to answer nothing for that page; nothing here has one. Changing a live game's clips through review is still slice 4's.
- **Like, save, follow and the two tabs** are a later spec (design 5.1). The feed's right side and the top of the screen have room where the design's sketch puts them, and `/me` gains "what they saved" and "who they follow" then (design 5.6).
- **The privacy text** (the Owner's, before live mode) should say that Ruken counts how often a maker's page is opened and its links are tapped, with no record of who did.
- Worth the Owner's eye before launch, left out on purpose: the counts include visits by programs as well as people, and are totals with no days; the feed adds up a week of members' beats on every open, and if the Worker's numbers ever show it slow the first thing to try is a sum kept per day; the feed holds fifty games with no way to see more; a photo sent from a browser with no script is stored as the camera wrote it, details and all, since nothing on the server redraws a picture; a maker who changes their address breaks the old one for anyone who saved it; an address typed with a capital letter is a missing page, not a redirect; while an account waits its 14 days, its page stays up.
- The feed's and the page's styles live in their components. If a third screen ever needs the same clip, band or button, that is the time to move the shared part into one component; until then each keeps its own.
