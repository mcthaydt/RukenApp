# Slice 2: Games and Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A member can play a pulled game, and the time is recorded.

**Architecture:** Two new features in the one SvelteKit app: `games` (a game, its clips, its files, pulling them from GitHub, its state) and `play` (who may play, the play pass, the game frame, play time). Game files and clips live in one R2 bucket. A second, small Cloudflare Worker, the game gate, serves them from a different address than Ruken's: clips to anyone, a game's files only under a short-lived play pass that Ruken's app signs and the gate checks. Ruken's own page measures play time and reports it; the server's clock records it.

**Tech Stack:** as slice 1 (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers with `@sveltejs/adapter-cloudflare` 8.0.2 and Wrangler 4.156.0, Hyperdrive in front of Neon). New: Cloudflare R2, through the Workers binding; GitHub's REST API, through plain `fetch`. **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md` (sections 5.2, 5.4, 5.7 "The first time in a game", 5.8, 6 "What never counts toward pay" and "The rest of the makers' share", 7.1 to 7.3, 8, 10, 11). Read it with `CLAUDE.md`, `AGENTS.md` and slice 1's plan (`docs/superpowers/plans/2026-11-13-slice-1-accounts-membership.md`), above all its "How a task runs", "The look" and "Notes for the plans that follow".

**Old repository:** `mcthaydt/RukenAppFailed` at commit `188e8a07546ba19c431468ddf2624e3cc4173d4e`, written below as `OLD/`. Attach it read-only (`add_repo`, access "read") and clone it beside this repository. Do not register it as a repository root.

**Planned against:** `main` at `adc9590` (slice 1's branches A to D merged) plus what slice 1's plan says branches L, E0, E, F, G and H will produce. Execution of slice 2 starts only when slice 1 is merged and green (design 7.5). "What this plan relies on from slice 1", below, names each piece; if one is not on `main` as named when its task starts, stop and report.

## Global Constraints

- No session runs tests, lint or typecheck itself. Push, then read CI on the pull request (CLAUDE.md, Owner 2026-11-13).
- Every task is test-first, in two pushes, exactly as slice 1's "How a task runs" says: red (the test and stubs that throw `not built yet`), then green. A pull request is opened as a draft at the first push and marked ready only when its branch's last task is green.
- No new dependency. Anything that seems to need one is a stop: report it with the exact name and version, for the Owner's yes.
- `.github/workflows/ci.yml` does not change in this slice. The journeys' extra servers are started by `playwright.config.ts`.
- This repository is public. No secret, real address or key goes in: not the site's address, not the games' address, not the GitHub App's id or key. Test values are plainly fake. The RSA key the tests need is made fresh when Playwright or a test starts and is never a file in the repository.
- **Games are untrusted.** A game's files are never served from Ruken's own address. The game's frame gets no query, no fragment, no message, no cookie and no referrer from Ruken: the play pass names a game and a set of files, never a person.
- **Without a pass the files do not load.** Every address of a game file contains a pass that the gate checks on every request.
- Nobody types a fact. A game's size, file count and commit are measured from the pull; play time is measured by Ruken's page and stamped by the server's clock; no screen, form or door has a field for an amount or a count.
- Play facts are only ever added, never changed (`PlaySession`, `PlayBeat`, `GamePull`).
- Time comes from an injected `Clock`. Feature code never calls `Date.now()` or `new Date()` with no argument. Browser tests move time with Playwright's `page.clock`, never with a sleep.
- Layers: `games` may import `accounts` and `membership`; `play` may import those and `games`. Both are already in `FEATURE_ORDER`. Shared helpers with no feature logic go in `src/lib/`. Tests live only in `tests/`, mirroring `src/`.
- Comments say why, never which plan asked. A carried file loses its old-plan references (`P4 §8`, `R-25`, `M2.1f` and the like) and keeps the reason.
- Every screen and message passes the drunk grandma test. The words in this plan are the words to ship; a change to them is a deviation to report.
- Ruken's own screens wear the Card Table look from `src/lib/look.css` and only its classes. This slice adds five classes, each with its rule, its first use and its name in `CLASSES` (Task 19). No file under `src/routes/` gets a `<style>` block, a `style=` attribute or a colour of its own. Nothing in this slice is pip red.
- Every journey file starts with `test.beforeEach(forgetRateLimits)`, and every new screen is attached with `showTheOwner` for the Owner to see before its branch is marked ready (slice 1, Task 37).

## What this plan relies on from slice 1

| Piece | From | Used for |
|---|---|---|
| `prisma()`, `databasePerRequest`, `PrismaClient` and enums from `src/lib/server/db.ts`; two generated clients | Task 34 | every table read and write |
| `platform()`, `setPlatform`, `src/lib/server/cloudflare.ts` (the only file that imports `cloudflare:workers`) | Tasks 33, 34 | the R2 bucket reaches the app the same way |
| `wrangler.jsonc`, `tests/wrangler.test.ts`, the `deploy` script, `pnpm generate` running `wrangler types` | Tasks 16, 34 | the bucket binding; the gate's deploy |
| `requireEnv`, `optionalEnv` | Task 3 | settings |
| `Clock`, `systemClock`, `chicagoDayOf`, `TestClock` | Task 2 | every time |
| `RateLimiter`, `createRateLimiter` | Task 4 | the play-start limit |
| `startTestDatabase()`, `tests/browser/support/database.ts` (`userIdOf`, `membershipStartsOf`) | Tasks 1, 29, 34 | database tests; journeys that must read a row |
| `Caller`, `locals.caller`, `staffRolesOf`, `authServices()` | Tasks 10, 11 | who is asking, and whether they are staff |
| `membershipServices().service.isMember(userId)`, `membershipServices().arrival.remember(cookies, { makerUserId, path })` | Task 26 | may this person play; the arrival from `/g/<game>` |
| `/join?next=…`, its "Not now" link, `safeNextPath` | Tasks 3, 27 | the paywall on the way to a game |
| The stand-in Stripe, `payAsNewMember(page)`, `signUp(page)`, `signUpInItsOwnContext(browser)` | Tasks 13, 27, 29 | journeys that need a member |
| The daily job's secret check on `POST /jobs/purge-accounts` (`Authorization: Bearer <JOBS_SECRET>`, 404 without it), `JOBS_SECRET` in the journeys' settings | Task 20 | the staff door (Task 15) |
| `reject_append_only_change()`, the trigger function in the membership migration | Task 21 | the add-only tables |
| `src/lib/look.css`, `CLASSES`, `tests/lib/look.test.ts`, `expectOneCard`, `showTheOwner`, `pipRed`, `token`, `rgb`, `forgetRateLimits` | Tasks 13, 35 to 37 | the look of the two new screens |
| `src/routes/+error.svelte` | Task 12 | a game that is not there |
| The purge keeps the `User` row (status `deleted`) | Task 20 | a deleted maker's or member's play facts keep their account id |

## Found while planning

Read on 2026-11-13. Where a page or a package and this plan disagree when execution reads it, stop and report.

1. **The old game host had no pass.** `OLD/apps/game-host/src/handler.ts` kept games apart from Ruken and from each other by address only: each game on its own name, `g-<publicId>.rukengames.com`, with files served from `builds/<publicId>/<buildId>/<path>`, content types from an allow-list and never from the file, one path-normalising function, byte ranges, and no cookie ever set. Anyone with the address could load the files. Its "launch token" (`OLD/packages/core/src/runtime/launch-token.ts`) proved only that a heartbeat belonged to a session. So: the file serving is carried; the pass is new, in the launch token's format (`v1.<payload>.<mac>`, HMAC-SHA256, compared in constant time).
2. **Cloudflare's limits fit a pull inside one request** (https://developers.cloudflare.com/workers/platform/limits/, Workers Paid): 10,000 subrequests a request, and "a subrequest is any request a Worker makes using the Fetch API or to Cloudflare services like R2"; 30 seconds of CPU by default, where waiting on the network does not count; 128 MB of memory; "no hard limit on duration for HTTP-triggered Workers. As long as the client remains connected, the Worker can continue". A request body may be 100 MB on Cloudflare's Free and Pro plans, so a 30 MB clip fits.
3. **R2's `put` needs a length it knows** (https://developers.cloudflare.com/r2/api/workers/workers-api-reference/): a stream of unknown length is refused. A file from a tarball is therefore held in memory, one at a time, before it is stored, which is why one file has its own, smaller limit.
4. **Two local Workers can share one local R2 bucket, if they start one after the other.** Measured in a scratch folder outside this repository on 2026-11-13 with Wrangler 4.156.0: two `wrangler dev` processes given the same `--persist-to` folder and the same bucket name; an object put by one was read by the other, with a byte range, at `http://g-abc.localhost:8788`, whose host name reached the Worker unchanged. Started at the same moment, one of them stopped with `SQLITE_BUSY: database is locked`. So the journeys start the gate only after the app answers (Task 14). Still open until CI runs it: the same under Playwright on GitHub's runner.
5. **Workers Builds' own token can deploy a second Worker and use R2**: it is made with "Workers Scripts (edit) … Workers R2 Storage (edit) … Workers Routes (edit) for all zones on the account" (https://developers.cloudflare.com/workers/ci-cd/builds/configuration/). So the gate is deployed by the same deploy command as the app (Task 14). Not settled by reading: whether a route added from the Owner's command line stays after a later deploy whose config names no route (Task 24 checks it, with one fix).
6. **A route may use a wildcard name** (`*.example.com/*`), needs a proxied DNS record for the names it serves, and the most specific route wins (https://developers.cloudflare.com/workers/configuration/routing/routes/).
7. **The old "recent input" rule cannot be kept.** The old page learned about input from the SDK inside the game. With no SDK, Ruken's page cannot see inside a frame on another address. Design 5.2 already names what counts: on screen, tab showing, frame focused.
8. **GitHub** (REST API version `2022-11-28`): an app signs a short RS256 token with its private key; `GET /repos/{owner}/{repo}/installation` answers the installation for a repository the app was installed on (404 when it was not); `POST /app/installations/{id}/access_tokens` gives a one-hour token that can be narrowed to one repository and `contents: read`; `GET /repos/{owner}/{repo}/commits/{ref}` with `Accept: application/vnd.github.sha` answers the commit's id as text; `GET /repos/{owner}/{repo}/tarball/{ref}` redirects to the files as a `.tar.gz`. GitHub hands out the key as PKCS#1 (`BEGIN RSA PRIVATE KEY`); Web Crypto imports PKCS#8 only, so the code wraps the key itself and the Owner converts nothing (Task 8). The old repository's GitHub code (`OLD/packages/api-contract/src/github.ts`) was a contract only, with nothing behind it; none of it is carried.

## The Owner's decisions, the open questions, and the Calls in this plan

- **Owner, 2026-11-13** (design 5.2, 5.4, 6, 8, as approved and revised): games are plain web games with no SDK; a game's files load only with a play pass; play time is measured by Ruken's page; FloorFifty is free on launch day for everyone with no account; free play, staff play and a maker's own play never count for pay; the cap is 180 minutes per member, per game, per America/Chicago day; clips are upright and wide, video, 30 MB each; Ruken pulls a game's files through a Ruken GitHub App that the Owner creates.
- **Asked of the Owner through the coordinator, not yet answered** (the plan is written for the recommended answer; its pull request stays a draft until these are in):
  - **Q1. Where games live.** A (recommended, planned for): a second domain used only for games, each game on its own name under it (`g-<id>.<games domain>`), clips at `media.<games domain>`. A game can then never touch Ruken's cookies, and games cannot read each other's saves. B: names under the site's own domain; same code, weaker (a game on a sister name can plant cookies for the whole domain). C: Cloudflare's free `workers.dev` address; every game shares one address, and Tasks 13, 14 and 24 would change.
  - **Q2. The staff door.** Before slice 4 brings the submit form and the admin portal, nothing can put a game on the site. A (recommended, planned for): three job addresses behind `JOBS_SECRET` (Task 15), called by the Owner with one-line commands, removed by slice 4. B: no door; slice 2 is proven only in CI with a tiny test game, and FloorFifty first meets the real gate, R2 and GitHub App in slice 4, days before launch. C: a script on the Owner's computer that writes to Neon and R2 directly, which needs both sets of credentials on that computer.
- **Calls** (the Owner can overrule):
  - **The pass.** `v1.<payload>.<mac>`: the payload is `{ g: <the game's public id>, p: <the pull's id>, exp: <seconds> }` as JSON in base64url; the mac is HMAC-SHA256 over `"ruken-play-pass-v1:" + payload` with `PLAY_PASS_SECRET`. It sits in the address as the first folder: `https://g-<id>.<games domain>/<pass>/index.html`. So every file the game asks for by a relative address carries it, with no cookie (browsers block cookies in a frame from another site) and nothing for the game to do. It holds nothing about the person.
  - **The pass lasts 4 hours.** A game loads files as it goes (the next level, a sound), so a pass that ended after a minute would break a game in the middle. Four hours is longer than the 180 minutes a day that count for pay. A pass that leaks lets a stranger load that one game until it runs out; it cannot be renewed.
  - **Its own secret.** `PLAY_PASS_SECRET` is held by both Workers and is not `BETTER_AUTH_SECRET`, so the gate holds nothing that could forge a sign-in or an arrival.
  - **A game's addresses must be relative** (`assets/main.js`, not `/assets/main.js`), as on itch.io. The pull refuses an `index.html` that loads from the top of the site, and says how to fix it.
  - **The frame.** `sandbox="allow-scripts allow-same-origin allow-pointer-lock"` and `allow="gamepad; fullscreen; autoplay"`, both carried from `OLD/packages/sdk-host/src/game-frame.ts`, plus `referrerpolicy="no-referrer"`. `allow-same-origin` means the game's own address, which it needs to keep its saves; popups, forms, downloads, modals and navigating Ruken's page are all left out. The gate's headers allow only Ruken's site to frame a game.
  - **A game may talk to its own servers.** The gate sets no rule on where a game's scripts may connect (the old one took that from a manifest that no longer exists). Whether a game does something it should not is judged at acceptance (design 5.5). Worth the Owner's eye.
  - **Play time.** While a game is open, Ruken's page looks once a second: is the tab showing, is the frame on screen, does the frame have focus. Every 15 seconds it sends a beat that says one thing: "attentive the whole time since the last beat you took: yes or no". The server stamps the beat with its own clock and stores it. A beat with "yes" counts the server's time since the beat before it (or since the session started), up to 45 seconds; a beat with "no" counts nothing. So the total can never pass real time on the server's clock, one or two lost beats are forgiven, and a longer silence counts 45 seconds at most. Nothing counts until the person first taps or clicks inside the game, because the frame has no focus before that.
  - **What is stored.** One `PlaySession` row per opening of a game (the game, the pull, the person or nobody, and why they could play: `member`, `free_game`, `staff` or `own_game`), and one `PlayBeat` row per beat (the server's time, attentive or not). Rows are never changed. When more than one reason applies, the one that does not count for pay wins: own game, then staff, then a free game, then member. Slice 5 counts `member` sessions only and applies the 180-minute cap from the beats' times in America/Chicago; two tabs of one member overlap in the rows and slice 5 must not count the same minute twice.
  - **Every reload is a new session**, with its own secret for its beats. A session takes beats for 24 hours (the carried lifetime).
  - **Free is a flag on the game** (`freeToPlay`), false for every game. Slice 2 reads it; only tests set it. The admin portal (slice 4) sets it with a reason, recorded like any staff action.
  - **A phone** is a browser whose `User-Agent` contains `Mobi` or `Android`. A tablet that says it is a computer is treated as one.
  - **Play lands in the game.** The Play button goes to `/g/<game>/play`; someone who may not play is sent to `/join?next=/g/<game>/play`, so after paying they are in the game (design 5.2), not back on its page. Slice 1's note said `next=/g/<game>`; this is the one change to it. "Not now" on the paywall then goes to `/g/<game>`.
  - **Before the feed exists**, `/g/<game>` is one paper card: the game's name, its one line, its clip playing without sound, and Play. It is a placeholder, like the home page; slice 3 replaces it with the feed opened at that clip. The home page does not list games: on the real site a game is reached by its address, which the door's answer gives.
  - **The in-game line** ("Tap ← to go back to the feed", design 5.7) is built here with the play screen, not in slice 3, as the coordinator asked. ← goes to `/g/<game>`, which is the feed at that clip once slice 3 lands.
  - **The way back is a slim bar above the game**, not a button over it, so Ruken never covers a game's own buttons.
  - **Pulling.** The pull resolves the branch to one commit, then reads that commit's tarball twice: once to check everything and store nothing, once to store. A refused game leaves nothing behind. Files go to `files/<public id>/<pull id>/<path>`; a new pull never touches the live one's files (design 5.4: "the old ones stay live until then").
  - **Clips are served to anyone** from `media.<games domain>`, kept for a year by browsers (a new upload gets a new address).
  - **Game states** are the design's four plus the one before sending: `draft`, `waiting`, `live`, `sent_back`, `taken_down`. This slice only moves a game to `live` (through the door). Slice 4 brings the rest, and their words.
  - **A game's address** (`/g/<slug>`) is made from its name: lower case, letters and digits, other runs become one hyphen, 3 to 40 characters; a taken one gets `-2`, `-3`. Its public id, used in the games' address and in R2, is ten random characters of `a-z2-7` and never changes, so a renamed game keeps its saves.

## Open items: FloorFifty

A separate session is checking whether FloorFifty runs as a plain web game without the old SDK (design 11). Nothing in Tasks 1 to 23 depends on its answer. These do, and stay open until the coordinator forwards the findings:

- **O1. The size limits.** `MAX_GAME_BYTES`, `MAX_GAME_FILES` and `MAX_FILE_BYTES` (Task 4) are set from FloorFifty's measured export: its total bytes, its number of files and its largest file. The rule for turning the measurement into limits is fixed now: each limit is the measured number times four, rounded up to a round number, and `MAX_FILE_BYTES` is never above 64 MB (a file is held in memory while it is stored, and a Worker has 128 MB). The numbers themselves are not written until they are measured.
- **O2. Does it run without the SDK**, and if not, what changes in FloorFifty's own repository. Those changes are not part of this plan: they are an Owner item, listed under G4.
- **O3. Which branch and folder** of `SNEKPRTY/FloorFifty` hold a ready-to-run `index.html`, whether its addresses are relative, and whether any file is kept in Git LFS (the pull refuses both an absolute address and an LFS pointer, and says so).
- **O4. Its two clips**: an upright and a wide video, 30 MB or less each, are the Owner's to make (design 9).

Task 24 (the real site) cannot be finished until O1 to O4 are closed.

## Where execution stops and waits for the Owner

The execution session reports to the coordinator and asks for each of these with the exact lines below. Each line is one command for Windows PowerShell, run in the repository's folder; a step goes to a website only where no command can do it, and says so. Words in CAPITALS are the Owner's own values and are never written in the repository.

**G1, asked for when branch B starts; branch B is not marked ready until it is done.** Once branch B is on `main`, the app's deploy names the bucket, and a deploy fails if the bucket does not exist.

1. `pnpm install; pnpm exec wrangler login` (opens the browser once to sign in to Cloudflare; no command can do that part).
2. `pnpm exec wrangler r2 bucket create ruken-games`
3. Say "done".

**G2, asked for when branch C starts; needed for G4.**

1. `Start-Process "https://github.com/settings/apps/new?name=Ruken&url=https://SITE&public=true&webhook_active=false&contents=read&metadata=read"` (a website: GitHub has no command for making an app. The page opens filled in. Press "Create GitHub App", then "Generate a private key", which downloads a `.pem` file. Note the "App ID" number at the top.)
2. `"APP-ID" | pnpm exec wrangler secret put GITHUB_APP_ID`
3. `Get-Content -Raw "PATH-TO-THE-DOWNLOADED.pem" | pnpm exec wrangler secret put GITHUB_APP_PRIVATE_KEY`
4. `Start-Process "https://github.com/apps/APP-NAME-IN-THE-ADDRESS-BAR/installations/new"` (a website: choose the account that owns FloorFifty, "Only select repositories", FloorFifty, Install.)
5. Keep the `.pem` file somewhere safe or delete it; it is a key. Say "done".

**G3, asked for when branch D starts; needed for G4. It follows the Owner's answer to Q1.**

1. A website, because no command can buy a domain or change its DNS: the games domain is on this Cloudflare account and says "Active" (if it is not there, "Onboard a domain" and follow it). Then that domain → DNS → Records → Add record: Type `AAAA`, Name `*`, IPv6 address `100::`, Proxy status "Proxied".
2. `pnpm exec wrangler deploy --config cloudflare/games/wrangler.jsonc --route "*.GAMES-DOMAIN/*"` (makes the gate Worker, `ruken-games`, and gives it every name under the games domain).
3. `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $s = [BitConverter]::ToString($b) -replace '-',''; $s | pnpm exec wrangler secret put PLAY_PASS_SECRET; $s | pnpm exec wrangler secret put PLAY_PASS_SECRET --config cloudflare/games/wrangler.jsonc` (one new random secret, given to both Workers; it is never shown).
4. `"https://SITE" | pnpm exec wrangler secret put SITE_ORIGIN --config cloudflare/games/wrangler.jsonc`
5. `"https://{name}.GAMES-DOMAIN" | pnpm exec wrangler secret put GAME_ADDRESS_PATTERN` (type `{name}` as it is: the site fills it in).
6. `(Invoke-WebRequest "https://media.GAMES-DOMAIN/__ruken/health").Content` (expect `ok`). Say "done", and tell the coordinator the games domain.

**G4, at Task 24, after O1 to O4.** The lines are in Task 24: add FloorFifty through the door, upload its two clips, make it live, play it. FloorFifty's own repository must first hold a folder that runs as a plain web game (O2, O3); changing that repository is the Owner's, not this plan's.

## How a task runs, and carrying a file

As slice 1's plan, word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved. **Carrying a file** means: copy it from `OLD/` to the new path, rewrite its imports, remove what the task lists under "Trim", remove old-plan references from comments, change nothing else; its tests are carried the same way.

## Branches

Seven branches, in this order. Each starts from `main` only after the one before it is merged and green.

| # | Branch | Tasks | Ends with |
|---|---|---|---|
| A | `slice-2/game` | 1 to 5 | the games tables and the pure rules: a game's address and id, safe paths and file types, the file check, the clip rules |
| B | `slice-2/storage` | 6, 7 | the R2 bucket behind one small interface; saving a clip (waits for G1) |
| C | `slice-2/github-pull` | 8 to 11 | signing in to GitHub as the app, reading a tarball, the pull, the games service |
| D | `slice-2/gate` | 12 to 14 | the play pass, the gate's handler, and the gate running as its own Worker in the journeys |
| E | `slice-2/door` | 15 | the staff door, and a stand-in GitHub for the journeys |
| F | `slice-2/play` | 16 to 23 | who may play, sessions and beats, the two screens, play time, design 8's journeys |
| G | `slice-2/real-site` | 24 | FloorFifty pulled and played on the real site (waits for G2, G3, G4 and the open items) |

## File map

```
prisma/schema/games.prisma               Game, GamePull, GameClip                       (branch A)
prisma/schema/play.prisma                PlaySession, PlayBeat                          (branch F)
wrangler.jsonc                           gains the R2 bucket                            (branch B)
cloudflare/games/wrangler.jsonc          the gate Worker: its name, the bucket, no address (branch D)
cloudflare/games/worker.ts               what Cloudflare runs for the gate: settings in, handleGameRequest out
src/lib/files/safe-path.ts               normalizePath: one decoded path, or null
src/lib/files/content-types.ts           servedTypeFor: the type a file is served with, never from the file
src/lib/files/byte-range.ts              parseRange, matchesEtag
src/lib/files/store.ts                   FileStore: head, get, put, delete
src/lib/files/r2-store.ts                r2FileStore(bucket)
src/lib/files/tar.ts                     tarEntries: the files in a .tar.gz stream
src/lib/server/files.ts                  setFileStore, fileStore: the bucket, set once by the hook
src/lib/server/job-secret.ts             hasJobSecret(request)                          (branch E)
src/lib/look.css                         gains clip, stage, bar, back, frame            (branch F)
src/features/games/
  games.ts             entry
  ids.ts               slugOf, newPublicId, PUBLIC_ID
  files-check.ts       checkGameFiles, the three limits, the words of each refusal
  clips.ts             the clip rules: types, 30 MB, first bytes, keys
  addresses.ts         gameAddress(pattern, name)
  github.ts            the GitHub App: its token, a commit, a tarball
  pull.ts              pullGame: check, then store, then one GamePull row
  service.ts           createGame, pullLatest, saveClip, goLive, liveGameBySlug, summary
  services.ts          built once from the settings
src/features/play/
  play.ts              entry (server)
  play.browser.ts      entry for a page's own script: no server code
  pass.ts              makePass, checkPass
  gate.ts              handleGameRequest: the gate, as one function
  frame.ts             GAME_FRAME_SANDBOX, GAME_FRAME_ALLOW
  may-play.ts          playBasis, isPhone, backFromPaywall
  time.ts              the beat rules and countedMs
  sessions.ts          startPlay, recordBeat, playSummary
  attention.ts         the page's watcher: attentive since the last beat taken (browser)
  services.ts          built once from the settings
src/routes/
  g/[game]/+page.server.ts, +page.svelte            the game's page (placeholder card)
  g/[game]/play/+page.server.ts, +page.svelte       the game, in its frame
  g/[game]/play/beat/+server.ts                     a beat
  jobs/games/+server.ts                             the door: add, pull, make live
  jobs/games/[game]/+server.ts                      the door: what Ruken holds about a game
  jobs/games/[game]/clips/[shape]/+server.ts        the door: a clip
tests/support/memory-file-store.ts       a FileStore in memory
tests/support/tar.ts                     tarGz(files): a .tar.gz made in a test
tests/support/rsa.ts                     a fresh RSA key pair, PKCS#1, for tests
tests/fixtures/tiny-game/                index.html, main.js, img/dot.png: the journeys' game
tests/browser/support/fake-github-server.ts   a stand-in GitHub over HTTP
tests/browser/support/when-up.ts         waits for an address, then lets the next command start
tests/browser/support/game.ts            addGame(), playFrame(page): helpers for journeys
tests/cloudflare/games-worker.test.ts    the gate's config and entry, read as text
tests/lib/files/…  tests/features/games/…  tests/features/play/…   mirror src/
tests/browser/game-gate.test.ts, game-page.test.ts, play.test.ts, play-time.test.ts, door.test.ts
```

## Review Focus

Each line names an input the design implies and no ordinary test would meet. Each has its test in the task named.

1. A pass made for one game, used on another game's address: refused (Task 13).
2. An address that tries to climb out of a game's folder (`..`, `%2e%2e`, an encoded slash, a backslash): refused, and never read from the bucket (Tasks 3, 13).
3. A pass that ran out while the game is still open: a late file gets one plain line, not a blank frame, and no file (Task 13).
4. A game whose `index.html` loads `/assets/main.js` from the top of the site: refused at the pull with words that say how to fix it, not live and broken (Task 4).
5. A repository that keeps its big files in Git LFS, or holds a link to another file: refused with the file's name (Task 4).
6. A repository whose files pass the limit halfway through: nothing is stored, and the game that is live stays live (Task 10).
7. A beat sent with another session's secret, sent too soon, or sent after a long silence: never more counted time than the server's clock saw (Tasks 17, 18).
8. A member whose membership ended reloads a game they still have open: the paywall, not the game (Task 21).
9. Someone signed out opens `/g/<game>/play` for a game that is not free: the paywall, and the gate gives them nothing without a pass (Tasks 21, 23).
10. A phone opens a computer-only game's play address directly: back to the game's page, which says so (Task 21).
11. A file with no extension, or one Ruken does not know: served as plain bytes that a browser will not run, never guessed from its contents (Task 3).
12. A private key in either of the two forms GitHub and OpenSSL write: both sign (Task 8).
13. A clip that is a web page named `clip.mp4`: refused by its first bytes (Tasks 5, 7).
14. The gate never sets a cookie and never reads one (Task 13).
15. A person who never taps the game: no time counts, and the page still works (Tasks 17, 22).
16. The door called without the secret: 404, and nothing is made (Task 15).

---

# Branch A: `slice-2/game`

### Task 1: The games tables

**Files:**
- Create: `prisma/schema/games.prisma`, `prisma/migrations/<timestamp>_games/migration.sql`
- Modify: `prisma/schema/accounts.prisma` (the `User` relation)
- Test: `tests/features/games/schema.pg.test.ts`

**The tables:**

| Model | Columns |
|---|---|
| `Game` | `id` (cuid(2)), `publicId` unique, `slug` unique, `makerUserId` (a `User`, `onDelete: Restrict`), `name`, `oneLine`, `playsOn GamePlaysOn`, `state GameState` default `draft`, `stateReason?`, `freeToPlay` default false, `repoFullName`, `repoBranch?` (null: the repository's own default), `repoFolder` default `""`, `livePullId?` unique (a `GamePull`), `createdAt`, `updatedAt`; index on `makerUserId` |
| `GamePull` | `id` (set in code), `gameId` (a `Game`), `commitSha`, `fileCount Int`, `totalBytes BigInt`, `pulledAt`, `createdAt`; index on `gameId`. No `updatedAt`: one row per pull that passed the checks, added and never changed |
| `GameClip` | `id`, `gameId` (a `Game`), `shape ClipShape`, `key` unique, `contentType`, `bytes Int`, `createdAt`, `updatedAt`; unique on (`gameId`, `shape`) |

Enums: `GamePlaysOn { phone_and_computer, computer_only }`, `GameState { draft, waiting, live, sent_back, taken_down }`, `ClipShape { upright, wide }`.

In the migration SQL, by hand: CHECK `Game_publicId_check` (`"publicId" ~ '^[a-z2-7]{10}$'`); CHECK `Game_slug_check` (`"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` and 3 to 40 characters); CHECK `Game_repoFolder_check`, copied from `OLD/packages/db/prisma/migrations/20261105000000_n26_0_github_releases/migration.sql` lines 96 to 102 (no leading or trailing slash, no `..` step, 200 characters at most); CHECK `Game_live_check` (`"state" <> 'live' OR "livePullId" IS NOT NULL`); CHECK `GamePull_commitSha_check` (`"commitSha" ~ '^[0-9a-f]{40}$'`); CHECK `GamePull_counts_check` (`"fileCount" > 0 AND "totalBytes" > 0`); and the add-only trigger on `GamePull` (`reject_append_only_change()`, which slice 1's membership migration made).

- [ ] **Step 1 (red):**

```ts
it("makes the games tables", async () => { /* arrayContaining ["Game", "GamePull", "GameClip"] */ });
it("refuses a public id that is not ten characters of a-z and 2-7", async () => { /* 'FLOOR50' rejects */ });
it("refuses a slug with a slash, a capital or a space", async () => { /* each rejects */ });
it("refuses a folder that climbs out of the repository", async () => { /* '../x', '/x', 'x/' each reject; '' and 'web/build' pass */ });
it("refuses a live game with no files", async () => { /* state 'live', livePullId null: rejects */ });
it("refuses to change or delete a pull", async () => { /* UPDATE and DELETE on "GamePull" reject */ });
it("keeps one clip of each shape per game", async () => { /* a second upright rejects */ });
```

  Push. Expected: `postgres` fails in `schema.pg.test.ts`: the tables do not exist.
- [ ] **Step 2 (green):** the schema and the migration, made with `prisma migrate diff` from the schema on `main` to the new one, as slice 1's Task 21 did. Push. Expected: all pass, the drift test included.

### Task 2: A game's address and its id

**Files:**
- Create: `src/features/games/ids.ts`
- Test: `tests/features/games/ids.test.ts`

**Interfaces:**
- Produces: `PUBLIC_ID = /^[a-z2-7]{10}$/` (carried from `OLD/packages/manifest/src/features/origins/origins.ts` line 90); `newPublicId(randomBytes?: (n: number) => Uint8Array): string` (ten characters of `abcdefghijklmnopqrstuvwxyz234567`, from `crypto.getRandomValues` by default); `slugOf(name: string): string | null`.

- [ ] **Step 1 (red):**

```ts
it.each([["Floor Fifty", "floor-fifty"], ["  Büro: 2000!  ", "buro-2000"], ["A--B__c", "a-b-c"]])("turns %j into %j", (name, slug) => { expect(slugOf(name)).toBe(slug); });
it("cuts a long name at 40 characters, never ending in a hyphen", () => { expect(slugOf("a".repeat(39) + " b c")).toBe("a".repeat(39)); });
it.each(["", "!!", "ab"])("has no address for %j", (name) => { expect(slugOf(name)).toBeNull(); });
it("makes a public id of ten characters, a-z and 2-7", () => { expect(newPublicId()).toMatch(PUBLIC_ID); });
it("uses the bytes it is given", () => { expect(newPublicId(() => new Uint8Array(10))).toBe("aaaaaaaaaa"); });
```

  Stubs. Push. Expected: `verify` fails in `ids.test.ts` with "not built yet".
- [ ] **Step 2 (green):** `slugOf` lower-cases, strips accents (`normalize("NFKD")` and drop combining marks), turns every run of other characters into one hyphen, trims hyphens, cuts at 40, and answers null under 3. Push. Expected: all pass.

### Task 3: Safe paths, file types and byte ranges

**Files:**
- Create: `src/lib/files/safe-path.ts`, `src/lib/files/content-types.ts`, `src/lib/files/byte-range.ts`
- Test: `tests/lib/files/safe-path.test.ts`, `content-types.test.ts`, `byte-range.test.ts`

**Interfaces:**
- Produces:
  - `normalizePath(raw: string): string | null`, carried whole from `OLD/apps/game-host/src/paths.ts`. Its tests are the path cases of `OLD/apps/game-host/src/serve.test.ts`, rewritten to call the function.
  - `CONTENT_TYPES`, `interface ServedType { contentType: string; encoding?: "br" | "gzip" }` and `servedTypeFor(path: string): ServedType`, from `OLD/packages/validation/src/features/files/content-types.ts` with `OLD/packages/validation/tests/features/files/file-types.test.ts`. One change: the old `contentTypeFor` answered null for an extension off its list, because the old upload refused such files. The design's pull does not (5.4 checks only what it lists), so `servedTypeFor` answers `{ contentType: "application/octet-stream" }` for anything it does not know, a name with no dot and a dot-file included. Served with `nosniff`, a browser will not run it.
  - `interface ByteRange { offset: number; length: number }`, `parseRange(header: string | null, size: number): ByteRange | "none" | "unsatisfiable"` and `matchesEtag(header: string | null, etag: string): boolean`, carried whole from `OLD/apps/game-host/src/handler.ts`, with their cases from `serve.test.ts`.
- These three files import nothing but each other, so the gate Worker can bundle them.

- [ ] **Step 1 (red):** the carried tests, with the carried null cases of the type test changed to expect plain bytes (Review Focus 11), and for Review Focus 2:

```ts
it.each(["../x", "a/../../x", "a//b", "a/./b", "a\\b", "%2e%2e/x", "a%2fb", "a%5cb", "a%00b", "%E0%A4%A"])("refuses %j", (raw) => { expect(normalizePath(raw)).toBeNull(); });
it("stores a name in its composed Unicode form", () => { expect(normalizePath("cafe%CC%81.png")).toBe("café.png"); });
it.each(["LICENSE", ".htaccess", "setup.exe", "main.js.constructor"])("serves %j as plain bytes", (path) => {
  expect(servedTypeFor(path)).toEqual({ contentType: "application/octet-stream" });
});
```

  (`%2e%2e/x` decodes to `../x`, which the segment check refuses.) Stubs. Push. Expected: `verify` fails in the three files with "not built yet".
- [ ] **Step 2 (green):** carry the three. Push. Expected: all pass.

### Task 4: Checking a game's files

**Files:**
- Create: `src/features/games/files-check.ts`
- Test: `tests/features/games/files-check.test.ts`

**Interfaces:**
- Produces:
  - `MAX_GAME_BYTES`, `MAX_GAME_FILES`, `MAX_FILE_BYTES`: **open item O1.** Their values are measured, not guessed. This task starts only when the coordinator has forwarded FloorFifty's numbers and this plan has been updated with the three values; if it has not, stop and report.
  - `interface PulledFile { path: string; size: number; kind: "file" | "link" | "lfs" }` (`path` is relative to the game's folder, as the tarball wrote it; `lfs` is a file that starts with `version https://git-lfs.github.com/spec/v1`).
  - `checkGameFiles(files: readonly PulledFile[], indexHtml: string | null): { ok: true; fileCount: number; totalBytes: number } | { ok: false; problem: string }`. `indexHtml` is the text of the top `index.html`, or null when there is none. The first failing rule wins, in this order, with these words (design 5.4: "A refusal says what to fix"):

| Rule | Words |
|---|---|
| no files at all | We couldn't find that folder in your repository. Check the folder's name and pull again. |
| no `index.html` at the top | We couldn't find an index.html at the top of that folder. Ruken starts a game from index.html. |
| a `link` | `<path>` is a link to another file. Ruken copies real files only. Replace it with the file itself. |
| an `lfs` file | `<path>` is kept in Git LFS, and Ruken can't pull those yet. Add the real file to the repository. |
| a path `normalizePath` refuses, or over 300 characters | One of your files has a name Ruken can't serve: `<path>`. Rename it and pull again. |
| more than `MAX_GAME_FILES` | Your game has `<count>` files. The most Ruken takes is `<limit>`. |
| a file over `MAX_FILE_BYTES` | `<path>` is `<size>`. The biggest single file Ruken takes is `<limit>`. |
| over `MAX_GAME_BYTES` in all | Your game's files add up to `<size>`. The most Ruken takes is `<limit>`. |
| `indexHtml` has a `src="/…"` or `href="/…"` that is not `//…` | index.html loads `<address>` from the top of the site. On Ruken a game lives in a folder, so write it without the first slash: `<address without the slash>`. |

  Sizes are written by `megabytes(bytes: number): string` in the same file: whole megabytes of 1,000,000 bytes, rounded up, with a thousands comma (`"41 MB"`); counts get the comma too.

- [ ] **Step 1 (red):** one case per row with its exact words, a passing case (`index.html`, `main.js`, `img/a.png`) that answers the count and the bytes, and:

```ts
it("accepts an address that starts with two slashes or a scheme", () => { /* src="//cdn.example/x.js" and href="https://example/x.css": ok */ });
it("names the first address that starts at the top of the site", () => {   // Review Focus 4
  expect(checkGameFiles(tiny, '<script src="/assets/main.js"></script>')).toEqual({ ok: false,
    problem: "index.html loads /assets/main.js from the top of the site. On Ruken a game lives in a folder, so write it without the first slash: assets/main.js." });
});
```

  Stubs. Push. Expected: `verify` fails in `files-check.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 5: The clip rules

**Files:**
- Create: `src/features/games/clips.ts`
- Test: `tests/features/games/clips.test.ts`

**Interfaces:**
- Produces, from `OLD/packages/core/src/catalog/card-video.ts` with `card-video.test.ts`: `CLIP_MAX_BYTES = 30_000_000` (the old `CARD_VIDEO_MAX_BYTES`), `type ClipContentType = "video/mp4" | "video/webm"`, `isClipContentType(value)`, `looksLikeVideo(bytes, contentType)` whole.
- Changed: the shapes are `upright` and `wide` (the design's words; the old ones were `portrait` and `landscape`). The key is `clips/<publicId>/<shape>-<16 hex>.<mp4|webm>`: `clipKeyFor(publicId: string, shape: ClipShape, random16Hex: string, contentType: ClipContentType): string` and `isClipKey(key: string): boolean` (exactly that shape and nothing else). The old key held the file's SHA-256; a random part needs no hashing of 30 MB in a Worker and still gives every upload its own address.
- `clipProblem(upload: { contentType: string; bytes: Uint8Array }): string | null`, with these words: not a clip type, "Clips are MP4 or WebM video."; over the limit, "That clip is `<size>`. A clip can be up to 30 MB."; first bytes wrong, "That file doesn't look like a video. Export it as MP4 or WebM and try again."
- Trim: `parseCardVideoKey` and its type (the gate only needs `isClipKey`).

- [ ] **Step 1 (red):** the carried cases under the new names; one case per line of `clipProblem`'s words; `isClipKey` refuses `clips/aaaaaaaaaa/../x.mp4`, a key under `files/`, a third shape, and an `.html` (Review Focus 13: a page's bytes under `video/mp4` are refused by `looksLikeVideo`). Stubs. Push. Expected: `verify` fails in `clips.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch A is ready to merge.

---

# Branch B: `slice-2/storage`

First, before any code: send the coordinator G1 word for word. The branch is not marked ready until G1 is done.

### Task 6: The bucket, behind one small interface

**Files:**
- Create: `src/lib/files/store.ts`, `src/lib/files/r2-store.ts`, `src/lib/server/files.ts`, `tests/support/memory-file-store.ts`
- Modify: `wrangler.jsonc`, `src/lib/server/cloudflare.ts`, `src/hooks.server.ts`, `playwright.config.ts`
- Test: `tests/lib/files/store.test.ts`, `tests/lib/server/files.test.ts`, `tests/wrangler.test.ts` (add cases)

**Interfaces:**
- Produces:
  - In `store.ts`: `interface StoredFile { size: number; etag: string }` and

```ts
export interface FileStore {
  head(key: string): Promise<StoredFile | null>;
  get(key: string, range?: ByteRange): Promise<{ file: StoredFile; body: ReadableStream<Uint8Array> } | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}
```

  - `r2FileStore(bucket: R2Bucket): FileStore` in `r2-store.ts`: `head`, `get` (with `{ range }` when given), `put`, `delete` on the binding; the etag is R2's `httpEtag`. `R2Bucket` is a global type from `worker-configuration.d.ts`; the file imports only `store.ts`, so both Workers can bundle it.
  - `MemoryFileStore implements FileStore` in `tests/support/`, with `keys(): string[]`. Its etag is `"<size>-<a counter>"`.
  - `setFileStore(open: () => FileStore): void` and `fileStore(): FileStore` in `src/lib/server/files.ts`, after `platform.ts`'s pattern: `fileStore()` throws `No file store is set. src/hooks.server.ts sets it.` before `setFileStore`. A setter of its own, not a new member of `Platform`, so no slice 1 test that builds a `Platform` changes.
  - `wrangler.jsonc` gains, with a comment on a line of its own: `"r2_buckets": [{ "binding": "GAME_FILES", "bucket_name": "ruken-games" }]`. `src/lib/server/cloudflare.ts` gains `export const cloudflareFiles = (): FileStore => r2FileStore(env.GAME_FILES)`; `src/hooks.server.ts` gains `setFileStore(cloudflareFiles)`.
  - `playwright.config.ts`: the app's command gains `--persist-to .wrangler/state`, so the gate (Task 14) can be given the same folder.

- [ ] **Step 1 (red):** `store.test.ts` runs one set of cases against `MemoryFileStore` (it is what every later test trusts): `get` of a missing key is null; `put` then `get` answers the bytes and their size; `get` with `{ offset: 1, length: 2 }` answers those two bytes; `put` twice keeps the second; `delete` removes; `head` answers the size without a body. `files.test.ts`: `fileStore()` throws the message above before anything is set, and answers the store after. `tests/wrangler.test.ts`: `r2_buckets` is exactly one entry, `GAME_FILES` on `ruken-games`, with no `remote` key and no `preview_bucket_name`; `playwright.config.ts` contains `--persist-to .wrangler/state`. Stubs for `setFileStore`, `fileStore` and `r2FileStore`. Push. Expected: `verify` fails in `files.test.ts` ("not built yet") and in `wrangler.test.ts` (no `r2_buckets`).
- [ ] **Step 2 (green):** the code. Push. Expected: all three jobs pass; every journey still passes with the bucket bound (Miniflare makes a local one). If `wrangler dev` or `wrangler types` refuses the binding, stop and report with the log line.

### Task 7: Saving a clip

**Files:**
- Create: `src/features/games/service.ts` (first part)
- Test: `tests/features/games/service.pg.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 5, 6.
- Produces: `class GameError extends Error` with `code: "INVALID" | "NOT_FOUND" | "NOT_CONNECTED" | "FILES_REFUSED" | "NOT_READY"`, whose `message` is words for a person; `createGamesService(deps: { db: PrismaClient; clock: Clock; files: FileStore; github: GitHub })` returning, in this task, `saveClip(gameId: string, shape: ClipShape, upload: { contentType: string; bytes: Uint8Array }): Promise<void>`. It throws `GameError("INVALID", clipProblem(upload))` for a refused clip and stores nothing; otherwise it puts the bytes under a new `clipKeyFor(…)` key, upserts the game's `GameClip` row for that shape, and then deletes the old object, if there was one. (`GitHub` arrives in Task 8; until then the type is declared in `service.ts` as an empty interface and Task 8 replaces it.)

- [ ] **Step 1 (red):**

```ts
it("stores a clip and remembers where", async () => {
  await service.saveClip(game.id, "upright", { contentType: "video/mp4", bytes: mp4Bytes() });
  const clip = await prisma.gameClip.findFirstOrThrow({ where: { gameId: game.id, shape: "upright" } });
  expect(clip.key).toMatch(/^clips\/[a-z2-7]{10}\/upright-[0-9a-f]{16}\.mp4$/);
  expect(files.keys()).toEqual([clip.key]);
});
it("a new clip takes the old one's place and the old file goes", async () => { /* save twice: one row, one key, the second */ });
it("refuses a page named as a video and stores nothing", async () => {            // Review Focus 13
  await expect(service.saveClip(game.id, "wide", { contentType: "video/mp4", bytes: new TextEncoder().encode("<html>") }))
    .rejects.toMatchObject({ code: "INVALID", message: "That file doesn't look like a video. Export it as MP4 or WebM and try again." });
  expect(files.keys()).toEqual([]);
});
```

  `mp4Bytes()` is a helper in the test: four length bytes, then `ftyp`, then zeros. Stubs. Push. Expected: `postgres` fails in `service.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch B is ready to merge once G1 is done.

---

# Branch C: `slice-2/github-pull`

First, before any code: send the coordinator G2 word for word. Nothing in this branch waits for it.

### Task 8: Signing in to GitHub as the app

**Files:**
- Create: `src/features/games/github.ts`, `tests/support/rsa.ts`
- Test: `tests/features/games/github.test.ts`

**Interfaces:**
- Produces:
  - `appToken(input: { appId: string; privateKeyPem: string; nowMs: number }): Promise<string>`: an RS256 JWT with `iss` the app id, `iat` sixty seconds before now and `exp` nine minutes after, signed with Web Crypto (`RSASSA-PKCS1-v1_5`, SHA-256). The key may be PKCS#8 (`BEGIN PRIVATE KEY`) or PKCS#1 (`BEGIN RSA PRIVATE KEY`, what GitHub downloads); a PKCS#1 key is wrapped into PKCS#8 in code, by `pkcs8FromPkcs1(der: Uint8Array): Uint8Array`, with a comment that says why (Web Crypto imports only PKCS#8, and the Owner should not have to convert a key). Any other text throws `GITHUB_APP_PRIVATE_KEY is not a private key in PEM form.`
  - `interface GitHub { commitOf(repo: string, branch: string | null): Promise<string>; tarball(repo: string, commitSha: string): Promise<ReadableStream<Uint8Array>> }` and `createGitHub(options: { appId: string; privateKeyPem: string; clock: Clock; fetch?: typeof fetch; apiBase?: string }): GitHub`. Each method first gets a token for that one repository: `GET {apiBase}/repos/{repo}/installation` with the app token, then `POST {apiBase}/app/installations/{id}/access_tokens` with the body `{ "repositories": ["<name>"], "permissions": { "contents": "read" } }`. `commitOf` is `GET /repos/{repo}/commits/{branch ?? "HEAD"}` with `Accept: application/vnd.github.sha`; `tarball` is `GET /repos/{repo}/tarball/{commitSha}`, following its redirect, and answers the body. Every request sends `User-Agent: ruken` and `X-GitHub-Api-Version: 2022-11-28`. `apiBase` defaults to `https://api.github.com`. The chosen `fetch` is called as a plain function (Workers refuse `fetch` called as a method of another object).
  - What GitHub's refusals become: a 404 from `/installation`, `GameError("NOT_CONNECTED", "Ruken can't see that repository. Install the Ruken app on it in GitHub, then try again.")`; a 404 or 422 from `/commits/…`, `GameError("INVALID", "We couldn't find that branch in your repository.")`; anything else that is not 2xx, an `Error` naming the status and the path, never the token.
  - `repo` is checked first against `/^[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/`, and a branch against 1 to 200 characters with no space, `..` or control character: a failing one throws `GameError("INVALID", …)` before any request, so nothing a person typed is ever put into a GitHub address unchecked.
  - `freshRsaKey(): { pkcs1Pem: string; pkcs8Pem: string; publicKey: KeyObject }` in `tests/support/rsa.ts`, from `node:crypto`'s `generateKeyPairSync("rsa", { modulusLength: 2048 })`. No key is a file in the repository.

- [ ] **Step 1 (red):**

```ts
it.each(["pkcs1Pem", "pkcs8Pem"] as const)("signs with a %s key, and the public key agrees", async (form) => {   // Review Focus 12
  const key = freshRsaKey();
  const [header, payload, signature] = (await appToken({ appId: "42", privateKeyPem: key[form], nowMs: 1_800_000_000_000 })).split(".");
  expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
  expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({ iss: "42", iat: 1_799_999_940, exp: 1_800_000_540 });
  expect(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), key.publicKey, Buffer.from(signature, "base64url"))).toBe(true);
});
it("refuses a key that is not PEM", async () => { /* rejects with the message above */ });
it("asks for a token for one repository, read only, then for the commit", async () => {
  /* a fake fetch records calls and answers { id: 7 }, { token: "ghs_test_fake" }, then the sha as text.
     Expect, in order: GET …/repos/acme/game/installation (Authorization: Bearer <a JWT>),
     POST …/app/installations/7/access_tokens with the body above,
     GET …/repos/acme/game/commits/HEAD with Authorization: Bearer ghs_test_fake; the answer is the sha. */
});
it("says so when the app is not installed on the repository", async () => { /* 404 → NOT_CONNECTED, the words above */ });
it("says so when the branch is not there", async () => { /* 422 → INVALID, the words above */ });
it.each(["acme", "acme/game/extra", "acme/ga me", "../x"])("refuses the repository name %j before asking GitHub", async (repo) => { /* INVALID; fetch never called */ });
it("never puts the token in an error", async () => { /* a 500 from the tarball: the message has no "ghs_" */ });
```

  Stubs. Push. Expected: `verify` fails in `github.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 9: Reading a tarball

**Files:**
- Create: `src/lib/files/tar.ts`, `tests/support/tar.ts`
- Test: `tests/lib/files/tar.test.ts`

**Interfaces:**
- Produces:
  - `tarEntries(gzipped: ReadableStream<Uint8Array>): AsyncGenerator<TarEntry>` with `interface TarEntry { path: string; kind: "file" | "directory" | "link" | "other"; size: number; bytes(limit: number): Promise<Uint8Array> }`. It unzips with `DecompressionStream("gzip")` and reads 512-byte headers. A regular file (type `0` or NUL) is `file`; `5` is `directory`; `1` and `2` are `link`; a pax header (`x`) or a GNU long name (`L`) gives the next entry its full path; a pax global header (`g`) is skipped; anything else is `other`. `bytes(limit)` reads the entry's content and throws `RangeError` if `size` is over `limit`, before reading; an entry whose `bytes` was not asked for is skipped without being held in memory. A file that ends in the middle of an entry throws `The download ended early.`
  - `tarGz(files: readonly { path: string; content: Uint8Array | string; link?: true }[]): Promise<Uint8Array>` in `tests/support/tar.ts`: writes ustar headers (a pax `x` header for a path over 100 characters), two empty blocks at the end, gzipped with `CompressionStream`. Test code only.
- It imports nothing, so it has no feature logic and the Worker can bundle it.

- [ ] **Step 1 (red):** round trips through `tarGz`: three files come back with their paths, sizes and bytes, in order; a 150-character path comes back whole; a link is `link`; an entry not read is skipped and the next one is still right; `bytes(10)` on a 11-byte file throws `RangeError`; a tarball cut in half throws "The download ended early."; a 5 MB file read in 64 KB chunks comes back the same (the reader must not depend on how the stream is cut). Stub `tarEntries`. Push. Expected: `verify` fails in `tar.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 10: The pull

**Files:**
- Create: `src/features/games/pull.ts`
- Test: `tests/features/games/pull.pg.test.ts`

**Interfaces:**
- Consumes: `GitHub` (Task 8), `tarEntries` (Task 9), `checkGameFiles` and the limits (Task 4), `FileStore` (Task 6), `normalizePath` (Task 3).
- Produces: `pullGame(deps: { db: PrismaClient; clock: Clock; github: GitHub; files: FileStore }, gameId: string): Promise<{ id: string; commitSha: string; fileCount: number; totalBytes: number }>`.
  1. Read the game's `repoFullName`, `repoBranch`, `repoFolder` and `publicId`. `commitSha = await github.commitOf(…)`.
  2. **First pass, storing nothing.** Read `github.tarball(repo, commitSha)`. GitHub puts everything under one top folder; an entry counts when its path, after that top folder, sits under `repoFolder`. Build the `PulledFile` list (a file of 200 bytes or less is read to see whether it is an LFS pointer; the top `index.html` is read, up to 2 MB, for the address check). Stop reading as soon as the count or the total passes its limit. `checkGameFiles` decides; a refusal throws `GameError("FILES_REFUSED", problem)`.
  3. **Second pass.** `pullId = randomUUID()`. Read the same commit's tarball again and `put` each file under `files/<publicId>/<pullId>/<normalizePath(path)>`.
  4. Insert the `GamePull` row with that id, the commit, the count and the bytes, and answer it. The game's `livePullId` is not touched.
- The key uses the path as `normalizePath` answers it for the percent-encoded path, so the name stored is the name the gate will look for.

- [ ] **Step 1 (red):** a fake `GitHub` whose `tarball` answers `tarGz(…)` of a top folder `acme-game-0123abc/` and counts its calls:

```ts
it("stores the game's files under a new pull and records what it measured", async () => {
  const pull = await pullGame(deps, game.id);
  expect(files.keys().sort()).toEqual([`files/${game.publicId}/${pull.id}/img/dot.png`, `files/${game.publicId}/${pull.id}/index.html`, `files/${game.publicId}/${pull.id}/main.js`]);
  expect(await prisma.gamePull.findUniqueOrThrow({ where: { id: pull.id } })).toMatchObject({ commitSha: SHA, fileCount: 3, totalBytes: BigInt(TOTAL) });
});
it("takes only the folder the maker picked", async () => { /* repoFolder "web/build": README.md at the top is not stored; web/build/index.html is stored as index.html */ });
it("stores nothing when the files are refused, and leaves the live game alone", async () => {   // Review Focus 6
  /* a game already live on pull A; the next tarball has no index.html */
  await expect(pullGame(deps, game.id)).rejects.toMatchObject({ code: "FILES_REFUSED" });
  expect(files.keys()).toEqual(keysOfPullA);
  expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).livePullId).toBe(pullA.id);
  expect(await prisma.gamePull.count({ where: { gameId: game.id } })).toBe(1);
});
it("refuses a pointer to Git LFS by name", async () => { /* message names the path */ });           // Review Focus 5
it("reads the commit it resolved, both times", async () => { /* tarball called twice, both with SHA */ });
it("a second pull gets its own folder and the first one's files stay", async () => { /* both sets of keys present */ });
```

  Stub. Push. Expected: `postgres` fails in `pull.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 11: The games service

**Files:**
- Create: `src/features/games/addresses.ts`, `src/features/games/services.ts`, `src/features/games/games.ts`
- Modify: `src/features/games/service.ts`, `.env.example`
- Test: `tests/features/games/service.pg.test.ts` (add cases), `tests/features/games/addresses.test.ts`, `tests/features/games/services.test.ts`

**Interfaces:**
- Produces, added to `createGamesService`:
  - `createGame(input: { makerUserId: string; name: string; oneLine: string; playsOn: GamePlaysOn; repo: { fullName: string; branch: string | null; folder: string } }): Promise<{ id: string; slug: string; publicId: string }>`. `name` is 1 to 60 characters after trimming and `oneLine` 1 to 100, else `GameError("INVALID", "A game needs a name." | "A game's name can be up to 60 characters." | "A game needs one line about it." | "The one line can be up to 100 characters.")`; a name with no address (`slugOf` null), `"Pick a name with at least three letters or numbers."`; a taken slug gets `-2`, `-3`, up to `-9`, then `"That name is taken. Pick another."`. The repository name and the folder are checked as Task 8 and Task 1's CHECK do.
  - `pullLatest(gameId): Promise<…>`: `pullGame` with the service's own deps.
  - `goLive(gameId: string, pullId: string): Promise<void>`: the pull must be this game's and both clips must exist, else `GameError("NOT_READY", "A game needs its files, an upright clip and a wide clip before it can go live.")`; then `state: "live"`, `livePullId`, `stateReason: null`, in one update.
  - `liveGameBySlug(slug: string): Promise<LiveGame | null>` with `interface LiveGame { id: string; publicId: string; slug: string; name: string; oneLine: string; playsOn: GamePlaysOn; freeToPlay: boolean; makerUserId: string; livePullId: string; clips: { upright: string; wide: string } }` (`clips` holds the two keys). Null unless the state is `live`.
  - `summary(slug: string): Promise<{ slug; publicId; state; name; pull: { commitSha; fileCount; totalBytes: string } | null; clips: ClipShape[] } | null>`, for the door.
  - `gameAddress(pattern: string, name: string): string` in `addresses.ts`: the pattern with `{name}` filled in; `checkAddressPattern(pattern)` throws unless it is one origin (no path, no trailing slash) that holds `{name}` exactly once as the whole first label, and is `https://`, or `http://` on a `localhost` name.
  - `gamesServices(): { service; address(name: string): string }` in `services.ts`, built once from `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, optional `GITHUB_API_BASE` and `GAME_ADDRESS_PATTERN`, with `prisma()`, `systemClock` and `fileStore()`. `GITHUB_API_BASE` is accepted only when it starts with `http://127.0.0.1:`; anything else throws at start, so a real site cannot be pointed at a stand-in.
  - `games.ts` re-exports `gamesServices`, `GameError`, `type LiveGame`, `type ClipShape`, `type GamePlaysOn`, `CLIP_MAX_BYTES`, `isClipKey`.
- This slice builds no way to send a game back or take it down: nothing here uses one. Slice 4 does.

- [ ] **Step 1 (red):** one case per refusal of `createGame` with its words; two games named "Floor Fifty" get `floor-fifty` and `floor-fifty-2`; `goLive` without a wide clip refuses with the words above and with both clips makes the game live; `liveGameBySlug` is null for a draft and answers the two clip keys for a live game; `addresses.test.ts`: `gameAddress("https://{name}.games.test", "g-aaaaaaaaaa")` is `https://g-aaaaaaaaaa.games.test`, `http://{name}.localhost:8788` is accepted, and `http://{name}.games.test`, `https://games.test`, `https://{name}.games.test/x` and `https://x.{name}.games.test` each throw; `services.test.ts`: `GITHUB_API_BASE=https://evil.example` throws, a missing `GAME_ADDRESS_PATTERN` throws "Missing setting GAME_ADDRESS_PATTERN". Stubs. Push. Expected: `postgres` fails in `service.pg.test.ts`, `verify` in the other two, with "not built yet".
- [ ] **Step 2 (green):** the code, and the four new names in `.env.example` with fake values and a line each. Push. Expected: all pass, the layer test included. Branch C is ready to merge.

---
