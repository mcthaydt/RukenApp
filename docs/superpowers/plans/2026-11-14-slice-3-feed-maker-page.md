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
| `/g/[game]/+page.server.ts` and `+page.svelte` (the placeholder card), `tests/browser/game-page.test.ts` | slice 2, Task 20 | replaced by the feed opened at that clip (Task 14) |
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
6. **Every journey shares one database**, so the feed at `/` holds every game any journey made, in an order no journey controls. Journeys of the feed open it at a game they made (`/g/<slug>`), find that clip by its `data-slug`, and assert order only in unit and database tests. From Task 14 on, slice 2's journeys that press Play on `/g/<slug>` must find the link inside that clip too, because the page then holds more than one Play.
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
  - **The words under a clip sit on a flat dark band** (`ink` at 60%), so chalk text reads over any clip (4.9:1 over a white clip, measured in Task 13's test). No gradient.
  - **The paywall card over the clip is `/join` itself**: when its `next` is `/g/<game>/play` and that game is live, the page shows that game's clip behind the card, dimmed. One page, one address, working with no script; the person sees the price over the clip they tapped. Where there is no clip (`/join?next=/me`), the card sits on the felt as today (design 5.2).
  - **The pip mark** is a 12px pip-red diamond in the top right corner of the price card, and is not there for a member or a paused membership (they see no price).
  - **A maker's address** (design 10): 3 to 30 characters, lower-case letters, digits and single hyphens between them; not a word Ruken uses (Task 5's list, which a test ties to the folders in `src/routes/` and `static/`). It can be changed; the old one is free at once.
  - **A page belongs to an account, not to a game**: anyone signed in can make one, before or after their first game (design 5.3: "live as soon as the maker saves it").
  - **A theme is one of Wada's combinations, by its number.** Code picks, from the combination's own colours, the ground, the text, the button and the button's label that read best (Task 3). The page also shows all the combination's colours as a row of small dots, so a three- or four-colour combination still looks like itself. A page with no theme picked wears the Card Table's own colours.
  - **A link is one of two kinds** the maker picks: "A link" (a button) or "A game somewhere else" (a card with the game's name and where it is, as "A game on Steam", worked out from the address). Thirty links at most.
  - **Counts are two numbers**, kept on the page and on each link and raised by one in the database each time: the page was opened, a link was tapped. A maker's own opens and taps are not counted. A tap is counted by sending the visitor through `/<handle>/out/<link>`, which works with no script.
  - **While an account waits its 14 days to be deleted, its page stays up.** When the daily job finishes the deletion, the page, its links and its photo go, and the address is free.
  - **A photo** is a JPEG, PNG or WebP, 5 MB at most as it arrives, checked by its first bytes. With script, the page first cuts it to a square of 512px at most in the browser, so a phone's photo is small before it is sent.

## Where execution stops and waits for the Owner

There is no command for the Owner in this slice: no new setting, secret, bucket or address. The stops are:

- **Q1** before Task 23 and **Q2** before branch G (Tasks 20 and 21), above. The coordinator relays the answers.
- **"Fine" on the screenshots**, once per branch that has screens (D, E, F, H, I): the execution session sends the coordinator the green run and one line per screen; the Owner looks at `look: <screen>`, phone and computer.
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
| D | `slice-3/feed` | 13, 14 | C; slice 2's branch F | the feed at `/` and at `/g/<game>` |
| E | `slice-3/feed-controls` | 15 to 17 | D | sound and the current clip, share, the two hints |
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
  links.ts               linkProblem, siteNameOf, moveLink, MAX_LINKS; SOCIAL_SITES, socialSiteOf (Task 23)
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
src/lib/look.css                         gains pip (branch F), swatch (branch I)
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
tests/browser/feed.test.ts, feed-controls.test.ts, maker-page.test.ts, edit-page.test.ts; game-page.test.ts, home.test.ts, join.test.ts, pay.test.ts change
```

## Review Focus

Each line names an input the design implies and no ordinary test would meet. Each has its test in the task named.

1. No game is live yet (the real site, the day before the first game is accepted): `/` shows one plain line and the way to an account, not an empty or broken screen (Tasks 12, 13).
2. Someone opens a shared link to a game that has since been taken off: a missing page with a way back, not a feed of other games under the wrong address (Tasks 12, 14).
3. A maker asks for an address that is one of Ruken's own (`me`, `make`, `g`, `fonts`), or a route added later takes a word that is not on the list: refused; and the test that reads `src/routes/` fails until the word is listed (Task 5).
4. Two people save the same address at the same moment: one has it, the other is told it is taken, and neither sees "Something went wrong" (Task 7).
5. A link that is not https (`http://`, `javascript:`, `data:`, an address with a name and password in it): refused when saved; and `/<handle>/out/<link>` only ever sends on to an address that was stored after that check (Tasks 6, 22).
6. `/<handle>/out/<link>` with a link from another maker's page, a hidden link or a made-up id: a missing page, and nothing is counted (Tasks 7, 22).
7. A theme number posted by hand that is not offered (unreadable, or not a number): refused, and the page keeps its colours (Tasks 3, 7).
8. Every offered combination, not a sample: text on its ground and the label on its button are both 4.5:1 or more (Task 3).
9. A maker opens their own page and taps their own links: the counts do not move (Tasks 7, 22).
10. A very long name, one line or link title on a phone: nothing scrolls sideways, on the feed or on a page (Tasks 13, 22).
11. A phone meets a computer-only game in the feed: no Play; "This one needs a computer." and a button that shares its link (Tasks 12, 13).
12. A browser with neither a share sheet nor a clipboard, and a person who closes the share sheet without sharing: a plain line in the first case, nothing at all in the second (Task 16).
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
  // with and without their extension: each one that has a handle's shape must be reserved.
  for (const name of routeAndStaticNames()) if (isHandleShape(name) || name.length < 3) expect(RESERVED_HANDLES.has(name) || name.length < 3, name).toBe(true);
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

- [ ] **Step 1 (red):** in `purge.pg.test.ts`: a person with a page and two links asks to be deleted; before the 14 days the page is still there; after the job the page and its links are gone, another account can take the same address, and the `User` row is still there as `deleted` (Review Focus 14). Push. Expected: `postgres` fails in `purge.pg.test.ts`: the job fails on the page's `Restrict` (or the page is still there).
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
