# Slice 2: Games and Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A maker submits a game from their GitHub repository, staff accept it, a member plays it, and the time is recorded.

**Architecture:** Two new features in the one SvelteKit app: `games` (a game, its clips, its files, pulling them from GitHub, its state) and `play` (who may play, the play pass, the game frame, play time). Game files and clips live in one R2 bucket. A second, small Cloudflare Worker, the game gate, serves them from a different address than Ruken's: clips to anyone, a game's files only under a short-lived play pass that Ruken's app signs and the gate checks. Ruken's own page measures play time and reports it; the server's clock records it. A game gets there the way the design says (5.4): its maker connects GitHub on the site, picks the repository, adds two clips and sends it for review; a staff member accepts it or sends it back.

**Tech Stack:** as slice 1 (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers with `@sveltejs/adapter-cloudflare` 8.0.2 and Wrangler 4.156.0, Hyperdrive in front of Neon). New: Cloudflare R2, through the Workers binding; GitHub's REST API, through plain `fetch`. **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md` (sections 5.2, 5.4, 5.5 "Acceptance", 5.7 "The first time in a game", 5.8, 6 "What never counts toward pay" and "The rest of the makers' share", 7.1 to 7.3, 8, 10, 11). Read it with `CLAUDE.md`, `AGENTS.md` and slice 1's plan (`docs/superpowers/plans/2026-11-13-slice-1-accounts-membership.md`), above all its "How a task runs", "The look" and "Notes for the plans that follow".

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
- Nobody types a fact. A game's size, file count and commit are measured from the pull; play time is measured by Ruken's page and stamped by the server's clock; no screen or form has a field for an amount or a count.
- Play facts are only ever added, never changed (`PlaySession`, `PlayBeat`, `GamePull`).
- Time comes from an injected `Clock`. Feature code never calls `Date.now()` or `new Date()` with no argument. Browser tests move time with Playwright's `page.clock`, never with a sleep.
- Layers: `games` may import `accounts` and `membership`; `play` may import those and `games`; `make` and `admin` sit above both. All four are already in `FEATURE_ORDER`. Shared helpers with no feature logic go in `src/lib/`. Tests live only in `tests/`, mirroring `src/`.
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
| `Caller`, `locals.caller`, `signedInOnly`, `staffRolesOf`, the `StaffAssignment` table and `StaffRole`, `authServices()` | Tasks 1, 10, 11 | who is asking, the maker's screens, and whether they are staff |
| `membershipServices().service.isMember(userId)`, `membershipServices().arrival.remember(cookies, { makerUserId, path })` | Task 26 | may this person play; the arrival from `/g/<game>` |
| `/join?next=…`, its "Not now" link, `safeNextPath` | Tasks 3, 27 | the paywall on the way to a game |
| The stand-in Stripe, `payAsNewMember(page)`, `signUp(page)`, `signUpInItsOwnContext(browser)` | Tasks 13, 27, 29 | journeys that need a member |
| The daily job's secret check on `POST /jobs/purge-accounts` (`Authorization: Bearer <JOBS_SECRET>`, 404 without it), `JOBS_SECRET` in the journeys' settings | Task 20 | the first staff account (Task 29) |
| `reject_append_only_change()`, the trigger function in the membership migration | Task 21 | the add-only tables |
| `src/lib/look.css`, `CLASSES`, `tests/lib/look.test.ts`, `expectOneCard`, `showTheOwner`, `pipRed`, `token`, `rgb`, `forgetRateLimits` | Tasks 13, 35 to 37 | the look of the two new screens |
| `src/routes/+error.svelte` | Task 12 | a game that is not there |
| The purge keeps the `User` row (status `deleted`) | Task 20 | a deleted maker's or member's play facts keep their account id |

## Found while planning

Read on 2026-11-13. Where a page or a package and this plan disagree when execution reads it, stop and report.

1. **The old game host had no pass.** `OLD/apps/game-host/src/handler.ts` kept games apart from Ruken and from each other by address only: each game on its own name, `g-<publicId>.rukengames.com`, with files served from `builds/<publicId>/<buildId>/<path>`, content types from an allow-list and never from the file, one path-normalising function, byte ranges, and no cookie ever set. Anyone with the address could load the files. Its "launch token" (`OLD/packages/core/src/runtime/launch-token.ts`) proved only that a heartbeat belonged to a session. So: the file serving is carried; the pass is new, in the launch token's format (`v1.<payload>.<mac>`, HMAC-SHA256, compared in constant time).
2. **Cloudflare's limits fit a pull inside one request** (https://developers.cloudflare.com/workers/platform/limits/, Workers Paid): 10,000 subrequests a request, and "a subrequest is any request a Worker makes using the Fetch API or to Cloudflare services like R2"; 30 seconds of CPU by default, where waiting on the network does not count; 128 MB of memory; "no hard limit on duration for HTTP-triggered Workers. As long as the client remains connected, the Worker can continue". A request body may be 100 MB on Cloudflare's Free and Pro plans, so a 30 MB clip fits.
3. **R2's `put` needs a length it knows** (https://developers.cloudflare.com/r2/api/workers/workers-api-reference/): a stream of unknown length is refused. A file from a tarball is therefore held in memory, one at a time, before it is stored, which is why one file has its own, smaller limit.
4. **Two local Workers can share one local R2 bucket, if they start one after the other.** Measured in a scratch folder outside this repository on 2026-11-13 with Wrangler 4.156.0: two `wrangler dev` processes given the same `--persist-to` folder and the same bucket name; an object put by one was read by the other, with a byte range, at `http://g-abc.localhost:8788`, whose host name reached the Worker unchanged. Started at the same moment, one of them stopped with `SQLITE_BUSY: database is locked`. So the journeys start the gate only after the app answers (Task 14). A second run there, laid out as Task 14 lays it out, showed three more things: a gate at `cloudflare/games/worker.ts` that imports TypeScript from `src/` by relative path is bundled by `wrangler dev` as it is; a relative `--persist-to .wrangler/state` is read from the folder the command runs in, not from the config's folder, so both Workers name the same one; and with `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` a setting passed in the environment reaches the gate as `env.PLAY_PASS_SECRET`. Wrangler also writes a `.wrangler/` folder beside the gate's config. Still open until CI runs it: the same under Playwright on GitHub's runner.
5. **Workers Builds' own token can deploy a second Worker and use R2**: it is made with "Workers Scripts (edit) … Workers R2 Storage (edit) … Workers Routes (edit) for all zones on the account" (https://developers.cloudflare.com/workers/ci-cd/builds/configuration/). So the gate is deployed by the same deploy command as the app (Task 14). Not settled by reading: whether a route added from the Owner's command line stays after a later deploy whose config names no route (Task 24 checks it, with one fix).
6. **A route may use a wildcard name** (`*.example.com/*`), needs a proxied DNS record for the names it serves, and the most specific route wins (https://developers.cloudflare.com/workers/configuration/routing/routes/).
7. **The old "recent input" rule cannot be kept.** The old page learned about input from the SDK inside the game. With no SDK, Ruken's page cannot see inside a frame on another address. Design 5.2 already names what counts: on screen, tab showing, frame focused.
8. **GitHub** (REST API version `2022-11-28`): an app signs a short RS256 token with its private key; `GET /repos/{owner}/{repo}/installation` answers the installation for a repository the app was installed on (404 when it was not); `POST /app/installations/{id}/access_tokens` gives a one-hour token that can be narrowed to one repository and `contents: read`; `GET /repos/{owner}/{repo}/commits/{ref}` with `Accept: application/vnd.github.sha` answers the commit's id as text; `GET /repos/{owner}/{repo}/tarball/{ref}` redirects to the files as a `.tar.gz`. GitHub hands out the key as PKCS#1 (`BEGIN RSA PRIVATE KEY`); Web Crypto imports PKCS#8 only, so the code wraps the key itself and the Owner converts nothing (Task 8). The old repository's GitHub code (`OLD/packages/api-contract/src/github.ts`) was a contract only, with nothing behind it; none of it is carried.

## The Owner's decisions, the open questions, and the Calls in this plan

- **Owner, 2026-11-13** (design 5.2, 5.4, 6, 8, as approved and revised): games are plain web games with no SDK; a game's files load only with a play pass; play time is measured by Ruken's page; FloorFifty is free on launch day for everyone with no account; free play, staff play and a maker's own play never count for pay; the cap is 180 minutes per member, per game, per America/Chicago day; clips are upright and wide, video, 30 MB each; Ruken pulls a game's files through a Ruken GitHub App that the Owner creates.
- **Owner, 2026-11-13** (relayed by the coordinator), where games live: a separate domain used only for games, each game on its own name under it (`g-<id>.<games domain>`), clips at `media.<games domain>`. A game can then never touch Ruken's cookies, and games cannot read each other's saves. Which domain is not settled (the old plan's may already be owned); it is written `GAMES-DOMAIN` below and never in the repository, and buying one, if needed, is the Owner's first step of G3.
- **Owner, 2026-11-13** (relayed by the coordinator), how a game gets on the site: "Users should be able to upload it on the site by connecting their github and selecting repo then adding whatever else they need". So there is no staff door and no command for adding a game. The maker's submit path (design 5.4) is built in this slice: connect GitHub through the Ruken GitHub App, pick the repository, the branch and folder with their defaults, the two clips, "Plays on", the maker agreement once, Send for review. FloorFifty reaches the real site the way any maker's game will.
  - The coordinator's instructions with it: acceptance still needs a person (design 5.5), so this slice has the smallest staff Accept and Send back, one list and one page behind slice 1's staff roles, which slice 4's admin portal absorbs. The maker's three-step onboarding (design 5.7) stays in slice 4: its first two steps need the handle and the page, which arrive in slice 3; this slice builds its step 3.
  - What slice 4 then keeps: the three-step onboarding; the admin portal around the acceptance queue (its other queues, admin sessions, the authenticator code, two superadmins, granting roles); the mails to a maker (accepted, sent back, taken down); taking a game down; marking a game free with a reason; reports and moderation.
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
  - **Before the feed exists**, `/g/<game>` is one paper card: the game's name, its one line, its clip playing without sound, and Play. It is a placeholder, like the home page; slice 3 replaces it with the feed opened at that clip. The home page does not list games: on the real site a game is reached by its address, which its maker's page for it links to once it is live.
  - **Submitting is two screens, not one form**: the fields and the repository, then the game's own page with its files, its two clips and Send for review. Two 30 MB videos in one form would sit in the Worker's memory together; one clip per request does not. And a refused pull is seen before anything is sent.
  - **Connecting GitHub asks GitHub who the person is.** The installation number GitHub puts in the address after an install can be typed by anyone, so Ruken does not trust it: it uses GitHub's sign-in for apps to ask which installations the person can reach, stores those, and pulls only from a repository under one of them. That needs the app's client id and secret (G2).
  - **A live game's update**: "Pull the latest" on a live game pulls and sends the update for review in one press; the game stays live on its old files until staff accept.
  - **The first staff account** is made by one command behind `JOBS_SECRET` that works only while there is no staff account at all (Task 29). Staff accept games in this slice without the authenticator code, which arrives with slice 4; accepting is not a money action.
  - **No mail yet** when a game is accepted or sent back; the maker's page says where the game stands. Slice 4 brings the mails.
  - **The in-game line** ("Tap ← to go back to the feed", design 5.7) is built here with the play screen, not in slice 3, as the coordinator asked. ← goes to `/g/<game>`, which is the feed at that clip once slice 3 lands.
  - **The way back is a slim bar above the game**, not a button over it, so Ruken never covers a game's own buttons.
  - **Pulling.** The pull resolves the branch to one commit, then reads that commit's tarball twice: once to check everything and store nothing, once to store. A refused game leaves nothing behind. Files go to `files/<public id>/<pull id>/<path>`; a new pull never touches the live one's files (design 5.4: "the old ones stay live until then").
  - **Clips are served to anyone** from `media.<games domain>`, kept for a year by browsers (a new upload gets a new address).
  - **Game states** are the design's four plus the one before sending: `draft`, `waiting`, `live`, `sent_back`, `taken_down`. This slice moves a game through all but `taken_down`, which arrives with moderation in slice 4.
  - **A game's address** (`/g/<slug>`) is made from its name: lower case, letters and digits, other runs become one hyphen, 3 to 40 characters; a taken one gets `-2`, `-3`. Its public id, used in the games' address and in R2, is ten random characters of `a-z2-7` and never changes, so a renamed game keeps its saves.

## Open items: FloorFifty

A separate session is checking whether FloorFifty runs as a plain web game without the old SDK (design 11). Nothing else in this plan depends on its answer. These do, and stay open until the coordinator forwards the findings:

- **O1. The size limits.** `MAX_GAME_BYTES`, `MAX_GAME_FILES` and `MAX_FILE_BYTES` (Task 4) are set from FloorFifty's measured export: its total bytes, its number of files and its largest file. The rule for turning the measurement into limits is fixed now: each limit is the measured number times four, rounded up to a round number, and `MAX_FILE_BYTES` is never above 64 MB (a file is held in memory while it is stored, and a Worker has 128 MB). The numbers themselves are not written until they are measured.
- **O2. Does it run without the SDK**, and if not, what changes in FloorFifty's own repository. Those changes are not part of this plan: they are an Owner item, listed under G4.
- **O3. Which branch and folder** of `SNEKPRTY/FloorFifty` hold a ready-to-run `index.html`, whether its addresses are relative, and whether any file is kept in Git LFS (the pull refuses both an absolute address and an LFS pointer, and says so).
- **O4. Its two clips**: an upright and a wide video, 30 MB or less each, are the Owner's to make (design 9).

- **O5. The maker agreement's text.** A maker accepts it once, on their first submission (design 5.4). The old repository's legal pages were drafts waiting for counsel (slice 1 found the same for terms and privacy). The text is the Owner's; Task 28 cannot ship without it, and `MAKER_AGREEMENT_VERSION` is its date.

Task 24 (the real site) cannot be finished until O1 to O5 are closed.

## Where execution stops and waits for the Owner

The execution session reports to the coordinator and asks for each of these with the exact lines below. Each line is one command for Windows PowerShell, run in the repository's folder; a step goes to a website only where no command can do it, and says so. Words in CAPITALS are the Owner's own values and are never written in the repository.

**G1, asked for when branch B starts; branch B is not marked ready until it is done.** Once branch B is on `main`, the app's deploy names the bucket, and a deploy fails if the bucket does not exist.

1. `pnpm install; pnpm exec wrangler login` (opens the browser once to sign in to Cloudflare; no command can do that part).
2. `pnpm exec wrangler r2 bucket create ruken-games`
3. Say "done".

**G2, asked for when branch C starts; needed before branch E merges** (once the connect screens are on `main`, the real site's `/make` needs these settings).

1. `Start-Process "https://github.com/settings/apps/new?name=Ruken&url=https://SITE&public=true&webhook_active=false&contents=read&request_oauth_on_install=true&callback_urls[]=https://SITE/make/github/callback"` (a website: GitHub has no command for making an app. The page opens filled in: public, no webhook, read-only access to a repository's contents, and sign-in during installation, coming back to the site. Press "Create GitHub App". On the app's page: note the "App ID" and the "Client ID"; press "Generate a new client secret" and copy it; press "Generate a private key", which downloads a `.pem` file. The app's short name is the last part of its public address, `github.com/apps/SHORT-NAME`.)
2. `"APP-ID" | pnpm exec wrangler secret put GITHUB_APP_ID`
3. `"CLIENT-ID" | pnpm exec wrangler secret put GITHUB_APP_CLIENT_ID`
4. `pnpm exec wrangler secret put GITHUB_APP_CLIENT_SECRET` (it asks for the value; paste the client secret there, so it is never in the window's history).
5. `"SHORT-NAME" | pnpm exec wrangler secret put GITHUB_APP_SLUG`
6. `Get-Content -Raw "PATH-TO-THE-DOWNLOADED.pem" | pnpm exec wrangler secret put GITHUB_APP_PRIVATE_KEY`
7. Keep the `.pem` file somewhere safe or delete it; it is a key. Say "done". (Installing the app on FloorFifty's repository is not a step here: the site's own "Connect GitHub" does it.)

**G3, asked for when branch D starts; needed for G4.**

1. A website, because no command can buy a domain or change its DNS. If no games domain is owned yet, buy one (Cloudflare: Domain Registration → Register Domains; or any registrar). It must be on this Cloudflare account and say "Active" (if it is not listed, "Onboard a domain" and follow it). Everything after this step is a command. Then that domain → DNS → Records → Add record: Type `AAAA`, Name `*`, IPv6 address `100::`, Proxy status "Proxied".
2. `git switch main; git pull; pnpm install; pnpm exec wrangler deploy --config cloudflare/games/wrangler.jsonc --route "*.GAMES-DOMAIN/*"` (from `main` as it is now, so what goes out is what was merged: makes the gate Worker, `ruken-games`, if the site's own deploy has not already, and gives it every name under the games domain).
3. `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $s = [BitConverter]::ToString($b) -replace '-',''; $s | pnpm exec wrangler secret put PLAY_PASS_SECRET; $s | pnpm exec wrangler secret put PLAY_PASS_SECRET --config cloudflare/games/wrangler.jsonc` (one new random secret, given to both Workers; it is never shown).
4. `"https://SITE" | pnpm exec wrangler secret put SITE_ORIGIN --config cloudflare/games/wrangler.jsonc`
5. `"https://{name}.GAMES-DOMAIN" | pnpm exec wrangler secret put GAME_ADDRESS_PATTERN` (type `{name}` as it is: the site fills it in).
6. `(Invoke-WebRequest "https://media.GAMES-DOMAIN/__ruken/health").Content` (expect `ok`). Say "done", and tell the coordinator the games domain.

**G4, at Task 24, after O1 to O5.** One command, then the site itself (Task 24 has the steps): make the Owner's account the first staff account; submit FloorFifty on `/make` like any maker; accept it on `/admin/games`; play it. FloorFifty's own repository must first hold a folder that runs as a plain web game (O2, O3); changing that repository is the Owner's, not this plan's.

## How a task runs, and carrying a file

As slice 1's plan, word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved. **Carrying a file** means: copy it from `OLD/` to the new path, rewrite its imports, remove what the task lists under "Trim", remove old-plan references from comments, change nothing else; its tests are carried the same way.

## Branches

Ten branches, in this order. Each starts from `main` only after the one before it is merged and green. Tasks 25 to 30 were added when the Owner chose the maker's own submit path, so their numbers are out of order, as slice 1's are.

| # | Branch | Tasks | Ends with |
|---|---|---|---|
| A | `slice-2/game` | 1 to 5 | the games tables and the pure rules: a game's address and id, safe paths and file types, the file check, the clip rules |
| B | `slice-2/storage` | 6, 7 | the R2 bucket behind one small interface; saving a clip (waits for G1) |
| C | `slice-2/github-pull` | 8 to 11 | signing in to GitHub as the app, reading a tarball, the pull, the games service |
| D | `slice-2/gate` | 12 to 14 | the play pass, the gate's handler, and the gate running as its own Worker in the journeys |
| E | `slice-2/connect-github` | 15, 25 | a maker connects GitHub on the site; a stand-in GitHub for the journeys (waits for G2) |
| M | `slice-2/submit` | 26 to 28 | a maker submits a game and sees it "Waiting for review" |
| P | `slice-2/play-rules` | 16 to 18 | the play tables, who may play and what counts, sessions and beats |
| S | `slice-2/accept` | 29, 30 | the first staff account; staff accept a game or send it back |
| F | `slice-2/play` | 19 to 23 | the two screens, play time, design 8's journeys |
| G | `slice-2/real-site` | 24 | FloorFifty submitted, accepted and played on the real site (waits for G3, G4 and the open items) |

## File map

```
prisma/schema/games.prisma               Game, GamePull, GameClip                       (branch A)
prisma/schema/play.prisma                PlaySession, PlayBeat                          (branch P)
prisma/schema/make.prisma                GitHubInstallation, MakerAgreement             (branches E, M)
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
src/lib/server/job-secret.ts             hasJobSecret(request)                          (branch S)
src/lib/look.css                         gains clip, stage, bar, back, frame            (branch F)
src/features/games/
  games.ts             entry
  ids.ts               slugOf, newPublicId, PUBLIC_ID
  files-check.ts       checkGameFiles, the three limits, the words of each refusal
  clips.ts             the clip rules: types, 30 MB, first bytes, keys
  addresses.ts         gameAddress(pattern, name)
  github.ts            the GitHub App: its token, a commit, a tarball, an installation's repositories
  github-connect.ts    who the person is on GitHub, and which installations they can reach
  review.ts            the maker's words for each state
  pull.ts              pullGame: check, then store, then one GamePull row
  service.ts           createGame, pullLatest, saveClip, sendForReview, accept, sendBack, liveGameBySlug
  services.ts          built once from the settings
src/features/make/
  make.ts              entry
  agreement.ts         hasAgreed, agree, MAKER_AGREEMENT_VERSION
src/features/admin/
  admin.ts             entry
  staff-only.ts        staffOnly(caller, roles)
src/features/play/
  play.ts              entry (server)
  play.browser.ts      entry for a page's own script: no server code
  pass.ts              makePass, checkPass
  gate.ts              handleGameRequest: the gate, as one function
  frame.ts             GAME_FRAME_SANDBOX, GAME_FRAME_ALLOW
  may-play.ts          playBasis, isPhone, backFromPaywall
  time.ts              the beat rules and countedMs
  sessions.ts          startPlay, startReviewPlay, recordBeat, playSummary
  attention.ts         the page's watcher: attentive since the last beat taken (browser)
  services.ts          built once from the settings
src/routes/
  g/[game]/+page.server.ts, +page.svelte            the game's page (placeholder card)
  g/[game]/play/+page.server.ts, +page.svelte       the game, in its frame
  g/[game]/play/beat/+server.ts                     a beat
  make/, make/new/, make/[game]/                    the maker's area, the new-game form, a game's page
  make/github/, make/github/callback/               connecting GitHub
  legal/maker-agreement/                            the Owner's text
  admin/games/, admin/games/[game]/                 staff: the waiting list, Accept and Send back
  jobs/first-owner/+server.ts                       the first staff account
tests/support/memory-file-store.ts       a FileStore in memory
tests/support/tar.ts                     tarGz(files): a .tar.gz made in a test
tests/support/rsa.ts                     a fresh RSA key pair, PKCS#1, for tests
tests/fixtures/tiny-game/                index.html, main.js, img/dot.png: the journeys' game
tests/browser/support/fake-github-server.ts   a stand-in GitHub over HTTP
tests/browser/support/when-up.ts         waits for an address, then lets the next command start
tests/browser/support/game.ts            startGame, uploadClip, submitGame, signInAsStaff, addGame: helpers for journeys
tests/cloudflare/games-worker.test.ts    the gate's config and entry, read as text
tests/lib/files/…  tests/features/games/…  tests/features/play/…   mirror src/
tests/browser/game-gate.test.ts, connect-github.test.ts, make.test.ts, first-owner.test.ts, accept.test.ts, game-page.test.ts, play.test.ts, play-time.test.ts
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
16. The first-staff command called without the secret, or after a staff account exists: nothing is granted (Task 29).
17. A maker types, or a callback carries, a repository or an installation that is someone else's: refused, and nothing of theirs is read (Tasks 15, 25, 27).
18. A live game whose update is sent back: still live, on its old files (Task 26).
19. Someone who is not staff opens the staff pages, or another maker opens a game's page in the maker's area: a missing page (Tasks 28, 30).

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

First, before any code: send the coordinator G2 word for word. Nothing in this branch waits for it; branch E is not marked ready until it is done.

### Task 8: Signing in to GitHub as the app

**Files:**
- Create: `src/features/games/github.ts`, `tests/support/rsa.ts`
- Test: `tests/features/games/github.test.ts`

**Interfaces:**
- Produces:
  - `appToken(input: { appId: string; privateKeyPem: string; nowMs: number }): Promise<string>`: an RS256 JWT with `iss` the app id, `iat` sixty seconds before now and `exp` nine minutes after, signed with Web Crypto (`RSASSA-PKCS1-v1_5`, SHA-256). The key may be PKCS#8 (`BEGIN PRIVATE KEY`) or PKCS#1 (`BEGIN RSA PRIVATE KEY`, what GitHub downloads), with or without a last line break (Wrangler trims the end of a secret it is piped); a PKCS#1 key is wrapped into PKCS#8 in code, by `pkcs8FromPkcs1(der: Uint8Array): Uint8Array`, with a comment that says why (Web Crypto imports only PKCS#8, and the Owner should not have to convert a key). Any other text throws `GITHUB_APP_PRIVATE_KEY is not a private key in PEM form.`
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
  - `goLive(gameId: string, pullId: string): Promise<void>` (Task 26 replaces it with sending for review and accepting; until then it is what makes a game live in tests): the pull must be this game's and both clips must exist, else `GameError("NOT_READY", "A game needs its files, an upright clip and a wide clip before it can go live.")`; then `state: "live"`, `livePullId`, `stateReason: null`, in one update.
  - `liveGameBySlug(slug: string): Promise<LiveGame | null>` with `interface LiveGame { id: string; publicId: string; slug: string; name: string; oneLine: string; playsOn: GamePlaysOn; freeToPlay: boolean; makerUserId: string; livePullId: string; clips: { upright: string; wide: string } }` (`clips` holds the two keys). Null unless the state is `live`.
  - `gameAddress(pattern: string, name: string): string` in `addresses.ts`: the pattern with `{name}` filled in; `checkAddressPattern(pattern)` throws unless it is one origin (no path, no trailing slash) that holds `{name}` exactly once as the whole first label, and is `https://`, or `http://` on a `localhost` name.
  - `gamesServices(): { service; address(name: string): string }` in `services.ts`, built once from `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, optional `GITHUB_API_BASE` and `GAME_ADDRESS_PATTERN`, with `prisma()`, `systemClock` and `fileStore()`. `GITHUB_API_BASE` is accepted only when it starts with `http://127.0.0.1:`; anything else throws at start, so a real site cannot be pointed at a stand-in.
  - `games.ts` re-exports `gamesServices`, `GameError`, `type LiveGame`, `type ClipShape`, `type GamePlaysOn`, `CLIP_MAX_BYTES`, `isClipKey`.
- This slice builds no way to send a game back or take it down: nothing here uses one. Slice 4 does.

- [ ] **Step 1 (red):** one case per refusal of `createGame` with its words; two games named "Floor Fifty" get `floor-fifty` and `floor-fifty-2`; `goLive` without a wide clip refuses with the words above and with both clips makes the game live; `liveGameBySlug` is null for a draft and answers the two clip keys for a live game; `addresses.test.ts`: `gameAddress("https://{name}.games.test", "g-aaaaaaaaaa")` is `https://g-aaaaaaaaaa.games.test`, `http://{name}.localhost:8788` is accepted, and `http://{name}.games.test`, `https://games.test`, `https://{name}.games.test/x` and `https://x.{name}.games.test` each throw; `services.test.ts`: `GITHUB_API_BASE=https://evil.example` throws, a missing `GAME_ADDRESS_PATTERN` throws "Missing setting GAME_ADDRESS_PATTERN". Stubs. Push. Expected: `postgres` fails in `service.pg.test.ts`, `verify` in the other two, with "not built yet".
- [ ] **Step 2 (green):** the code, and the four new names in `.env.example` with fake values and a line each. Push. Expected: all pass, the layer test included. Branch C is ready to merge.

---

# Branch D: `slice-2/gate`

First, before any code: send the coordinator G3 word for word. Nothing in this branch waits for it.

### Task 12: The play pass

**Files:**
- Create: `src/features/play/pass.ts`
- Test: `tests/features/play/pass.test.ts`

**Interfaces:**
- Produces, with `node:crypto` only (both Workers have `nodejs_compat`), in the pattern of slice 1's `arrival.ts` and `OLD/packages/core/src/runtime/launch-token.ts`:
  - `PASS_LIFE_MS = 4 * 60 * 60 * 1000`.
  - `interface PassClaims { game: string; pull: string; expiresAtMs: number }`.
  - `makePass(claims: PassClaims, secret: string): string`: `v1.<payload>.<mac>`; the payload is `{ "g": game, "p": pull, "exp": <whole seconds> }` as JSON in base64url; the mac is HMAC-SHA256 over `"ruken-play-pass-v1:" + payload`, in base64url.
  - `checkPass(value: string, secret: string, nowMs: number): PassClaims | null`: null for anything but three dot-separated parts starting `v1`, a mac that does not match (compared with `timingSafeEqual`), JSON that does not parse, a `g` that does not match `PUBLIC_ID`'s pattern (written out here, so this file imports no feature), a `p` that is not 1 to 64 characters of `[A-Za-z0-9-]`, an `exp` that is not a whole number, or a pass whose time has come (`nowMs >= exp * 1000`). It never throws. An empty secret throws at once in both functions: `The play pass secret is not set.`
- The file imports nothing from the app, so the gate can bundle it.

- [ ] **Step 1 (red):**

```ts
const claims = { game: "aaaaaaaaaa", pull: "0b0e6c2e-3f0a-4a8e-9d0a-1c2d3e4f5a6b", expiresAtMs: 1_800_000_000_000 };
it("opens what it made, until it runs out", () => {
  const pass = makePass(claims, "s");
  expect(checkPass(pass, "s", 1_799_999_999_999)).toEqual(claims);
  expect(checkPass(pass, "s", 1_800_000_000_000)).toBeNull();
});
it("holds nothing but a game, a pull and a time", () => {
  const payload = JSON.parse(Buffer.from(makePass(claims, "s").split(".")[1] ?? "", "base64url").toString());
  expect(Object.keys(payload).sort()).toEqual(["exp", "g", "p"]);
});
it("is one path segment", () => { expect(makePass(claims, "s")).toMatch(/^[A-Za-z0-9_.-]+$/); });
it("ignores a pass made with another secret", () => { expect(checkPass(makePass(claims, "other"), "s", 0)).toBeNull(); });
it("ignores a payload changed after signing", () => { /* swap in another game's payload, keep the mac: null */ });
it.each(["", "v1", "v1.a", "v2.a.b", "a.b.c.d", "v1.!!.!!"])("ignores %j", (value) => { expect(checkPass(value, "s", 0)).toBeNull(); });
it("refuses to work with no secret", () => { expect(() => makePass(claims, "")).toThrow("The play pass secret is not set."); });
```

  Stubs. Push. Expected: `verify` fails in `pass.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 13: The gate

**Files:**
- Create: `src/features/play/gate.ts`
- Test: `tests/features/play/gate.test.ts`

**Interfaces:**
- Consumes: `checkPass` (Task 12), `FileStore`, `normalizePath`, `servedTypeFor`, `parseRange`, `matchesEtag` (Tasks 3, 6). It imports those files by relative path and nothing else: no entry file, no Prisma, no SvelteKit.
- Produces: `handleGameRequest(request: Request, deps: { files: FileStore; passSecret: string; siteOrigin: string; nowMs: number }): Promise<Response>`, after `handle` and `serveFile` in `OLD/apps/game-host/src/handler.ts`, with the old environments, local names, single-game and beta settings, pointer records, channels, preload pages and embeds all trimmed. In order:
  1. A method other than `GET` or `HEAD`: 405 with `allow: GET, HEAD`.
  2. `/__ruken/health`: 200 `ok`, `cache-control: no-store`. `/robots.txt`: `User-agent: *\nDisallow: /\n`.
  3. The host's first label decides. `media`: step 4. `g-<ten characters of a-z2-7>`: step 5. Anything else: 404.
  4. **A clip.** The path without its first slash must pass `isClipKey`'s pattern (written out in this file) or the answer is 404. Served from that key with `cache-control: public, max-age=31536000, immutable` and `cross-origin-resource-policy: cross-origin`, to anyone.
  5. **A game file.** The path is `/<pass>/<rest>`. `checkPass(pass, passSecret, nowMs)` null, or its `game` is not the host's game: **403** with the one line below, and the bucket is never asked. `/<pass>` with no slash after it: 308 to `/<pass>/`. `normalizePath(rest)` null: 400. `rest` empty: `index.html`. The key is `files/<game>/<pull>/<path>`; no such file: 404.
  6. Serving, for both: the type from `servedTypeFor` and never from the file; `etag`; `If-None-Match` answers 304; a `Range` answers 206 or 416 as the carried code does; a precompressed `.br` or `.gz` file is sent as it is under its `content-encoding` and never as a range (the carried `encodeBody: "manual"`); `HEAD` answers the headers with no body.
- Headers on every answer: `x-content-type-options: nosniff`, `referrer-policy: no-referrer` (so a pass in an address is never sent on to a third site), `x-robots-tag: noindex`, and `content-security-policy` with `frame-ancestors <siteOrigin>` (only Ruken's site may put a game in a frame). A game file also gets `cross-origin-resource-policy: same-origin`, `cache-control: private, max-age=14400` and the carried `permissions-policy` (`gamepad=(self), fullscreen=(self), autoplay=(self), camera=(), microphone=(), geolocation=(), payment=(), usb=()`). An answer that is not a file is plain text with `content-security-policy: default-src 'none'; frame-ancestors <siteOrigin>` and `cache-control: no-store`.
- The words, shown inside the game's frame, each one line: 403, "This game's link has run out. Go back and press Play again."; 404, "Not found."; 400, "We could not read that address."
- No answer ever has a `set-cookie` header, and the handler never reads `cookie`.

Grandma: a person only ever sees the 403 line, inside the frame, under Ruken's bar with its ← (Task 21); it says what happened and what to do.

- [ ] **Step 1 (red):** against `MemoryFileStore` holding `files/aaaaaaaaaa/p1/index.html`, `…/main.js`, `…/img/dot.png`, `…/data/level.bin`, `…/big.js.br`, and one clip; `get(url)` builds a request to `http://g-aaaaaaaaaa.games.test` and calls the handler with a pass made in the test:

```ts
it("serves the game's page under a good pass", async () => {
  const response = await get(`/${pass}/`);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(response.headers.get("content-security-policy")).toContain("frame-ancestors https://ruken.test");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
it("loads nothing without a pass", async () => {                        // design 8: has not paid, cannot load
  for (const path of ["/", "/index.html", "/main.js", "/files/aaaaaaaaaa/p1/index.html", "/v1.x.y/index.html"]) {
    expect((await get(path)).status).toBe(403);
  }
  expect(files.reads).toEqual([]);                                      // the bucket was never asked
});
it("refuses a pass made for another game", async () => { /* pass for bbbbbbbbbb on g-aaaaaaaaaa: 403 */ });      // Review Focus 1
it("refuses a pass that has run out, in words a person can act on", async () => {                                // Review Focus 3
  const response = await get(`/${pass}/main.js`, { nowMs: claims.expiresAtMs });
  expect(response.status).toBe(403);
  expect(await response.text()).toBe("This game's link has run out. Go back and press Play again.");
});
it.each(["../p2/index.html", "..%2fp2/index.html", "a//b", "a%5cb", "%2e%2e/%2e%2e/clips/x"])("refuses the path %j and never asks the bucket", async (rest) => {   // Review Focus 2
  /* 400 or 404, never 200; files.reads is empty */ });
it("serves a file it does not know as plain bytes", async () => { /* data/level.bin and a name with no dot: application/octet-stream, nosniff */ });   // Review Focus 11
it("answers a byte range", async () => { /* Range: bytes=1-2 → 206, content-range, two bytes */ });
it("answers 304 to a matching etag", async () => {});
it("sends a precompressed file as it is", async () => { /* big.js.br: content-encoding br, type text/javascript, no accept-ranges */ });
it("sends a clip to anyone, to keep for a year", async () => { /* http://media.games.test/<clip key>: 200, video/mp4, immutable, CORP cross-origin */ });
it("serves nothing else from the media name", async () => { /* /files/aaaaaaaaaa/p1/index.html on media: 404 */ });
it("never sets a cookie and never reads one", async () => {             // Review Focus 14
  /* every response above has no set-cookie; a request with a cookie header gets the same answer */ });
it("refuses a POST", async () => { /* 405, allow: GET, HEAD */ });
it("is not found on any other name", async () => { /* http://www.games.test/: 404 */ });
```

  `MemoryFileStore` gains `reads: string[]` (every key `head` or `get` was asked for). Stub. Push. Expected: `verify` fails in `gate.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 14: The gate as its own Worker

**Files:**
- Create: `cloudflare/games/wrangler.jsonc`, `cloudflare/games/worker.ts`, `tests/browser/support/when-up.ts`
- Modify: `package.json` (the `deploy` script), `playwright.config.ts`, `tsconfig.json` (`include` gains `cloudflare`), and `.gitignore`, `.prettierignore` and `eslint.config.js` if their `.wrangler/` line is tied to the top folder (Wrangler writes `cloudflare/games/.wrangler/` too; it must be ignored at any depth)
- Test: `tests/cloudflare/games-worker.test.ts`, `tests/browser/game-gate.test.ts`, `tests/wrangler.test.ts` (add a case)

**Interfaces:**
- Produces:
  - `cloudflare/games/wrangler.jsonc`, whole. Comments sit on lines of their own.

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  // The game gate: a second Worker, so a game's files never come from Ruken's own address.
  "name": "ruken-games",
  "main": "worker.ts",
  "compatibility_date": "2026-10-01",
  // Node's crypto, for checking a play pass.
  "compatibility_flags": ["nodejs_compat"],
  // Its address is every name under the games domain, a route the Owner adds from the command line.
  // The domain is not written here: this repository is public.
  "workers_dev": false,
  "preview_urls": false,
  "observability": { "enabled": true },
  // The same bucket the site writes to. The gate only reads it.
  "r2_buckets": [{ "binding": "GAME_FILES", "bucket_name": "ruken-games" }]
}
```

  - `cloudflare/games/worker.ts`: `export default { fetch(request, env) { return handleGameRequest(request, { files: r2FileStore(env.GAME_FILES), passSecret: env.PLAY_PASS_SECRET, siteOrigin: env.SITE_ORIGIN, nowMs: Date.now() }); } }`, with `interface Env { GAME_FILES: R2Bucket; PLAY_PASS_SECRET: string; SITE_ORIGIN: string }` declared in the file. It imports `../../src/features/play/gate.ts` and `../../src/lib/files/r2-store.ts` directly and nothing else, with a comment that says why: `play.ts`, the feature's entry, brings the database with it, and this Worker has none. `Date.now()` is allowed here and only here: this file is the edge where the real clock is read, as `systemClock` is for the app.
  - `package.json`: `"deploy": "prisma migrate deploy && wrangler deploy && wrangler deploy --config cloudflare/games/wrangler.jsonc"`. The gate goes out after the app, with the same build's token ("Found while planning", 5).
  - `tests/browser/support/when-up.ts`: `node tests/browser/support/when-up.ts <url>` asks the address once a second and exits 0 at the first 200, or 1 after 170 seconds.
  - `playwright.config.ts`: one more `webServer` entry, `command: "node tests/browser/support/when-up.ts http://localhost:4173/healthz && pnpm exec wrangler dev --config cloudflare/games/wrangler.jsonc --port 8788 --persist-to .wrangler/state"`, ready when `http://localhost:8788/__ruken/health` answers 200, `timeout: 240_000`, with `env`: `PLAY_PASS_SECRET: "test-only-play-pass-secret"`, `SITE_ORIGIN: "http://localhost:4173"`, `CLOUDFLARE_INCLUDE_PROCESS_ENV: "true"`. The comment says why it waits: two local Workers that open the same storage folder at the same moment stop with "database is locked" ("Found while planning", 4). The app's `env` gains `PLAY_PASS_SECRET` (the same value) and `GAME_ADDRESS_PATTERN: "http://{name}.localhost:8788"`.

- [ ] **Step 1 (red):** `games-worker.test.ts` (reads files as text; the config is parsed after dropping the `//` lines): the name is `ruken-games`; `main` is `worker.ts`; `compatibility_flags` contains `nodejs_compat`; `workers_dev` and `preview_urls` are false; `r2_buckets` is the one entry above; there is no `vars`, `route`, `routes` or `hyperdrive` key; the text holds no `https://` but the schema's own line and nothing matching `/[a-z0-9-]+\.(com|net|org|io|dev|gg|games)\b/` (no real address); `worker.ts` imports exactly the two files named above. `tests/wrangler.test.ts`: the `deploy` script contains `wrangler deploy --config cloudflare/games/wrangler.jsonc` after the app's `wrangler deploy`. `game-gate.test.ts`:

```ts
test("the gate answers on its own address", async ({ page }) => {
  expect((await page.goto("http://media.localhost:8788/__ruken/health"))?.status()).toBe(200);
});
test("a game's address gives nothing without a pass", async ({ page }) => {
  const response = await page.goto("http://g-aaaaaaaaaa.localhost:8788/index.html");
  expect(response?.status()).toBe(403);
  await expect(page.getByText("This game's link has run out. Go back and press Play again.")).toBeVisible();
});
```

  Push. Expected: `verify` fails in `games-worker.test.ts` and `wrangler.test.ts` (no such file, no such script); `browser` fails in `game-gate.test.ts` (nothing listens on 8788).
- [ ] **Step 2 (green):** the files. Push. Expected: all pass, and every earlier journey passes with the fourth server running.
- [ ] **Step 3: if green does not come.** One thing here could not be settled by reading. Signs: the gate's `wrangler dev`, or the app's, stops with `SQLITE_BUSY` or "database is locked", or the `browser` job times out starting servers. One fix: give the gate its own folder (`--persist-to .wrangler/games-state`) and stop; the journeys of Tasks 15 to 23 need the shared bucket, so report to the coordinator with the log lines and wait. Any other failure of the green push: stop and report at once (CLAUDE.md, Pace: no fourth attempt).

Branch D is ready to merge.

---

# Branch E: `slice-2/connect-github`

Owner, 2026-11-13: "Users should be able to upload it on the site by connecting their github and selecting repo then adding whatever else they need". So a game reaches the site through the maker's own screens, FloorFifty included. Branches E, M and S build that path: connecting GitHub, the submit screens, and the smallest staff Accept and Send back.

### Task 15: A maker's GitHub connection

**Files:**
- Create: `prisma/schema/make.prisma` (first part), `prisma/migrations/<timestamp>_github_connection/migration.sql`, `src/features/games/github-connect.ts`
- Modify: `prisma/schema/accounts.prisma` (relation), `src/features/games/github.ts`, `src/features/games/service.ts`, `src/features/games/services.ts`, `src/features/games/games.ts`, `.env.example`
- Test: `tests/features/games/github-connect.test.ts`, `tests/features/games/connection.pg.test.ts`

**Why it is more than a link.** After a maker installs the Ruken app, GitHub sends them back with an installation's number in the address. A number in an address can be typed by anyone, and an installation can read private repositories. So Ruken never trusts that number: it asks GitHub, as the person (GitHub's sign-in for apps), which installations that person can reach, and stores only those.

**The table** (`prisma/schema/make.prisma`): `GitHubInstallation`: `id`, `userId` (a `User`), `installationId` (`BigInt`), `accountLogin`, `createdAt`, `updatedAt`; unique on (`userId`, `installationId`); index on `userId`. A row means: GitHub said this person can reach this installation.

**Interfaces:**
- Produces, in `github-connect.ts`, each with the injected `fetch`, `apiBase` (default `https://api.github.com`) and `webBase` (default `https://github.com`):
  - `signInUrl(input: { clientId: string; state: string; webBase?: string }): string`: `{webBase}/login/oauth/authorize?client_id=…&state=…`.
  - `installUrl(input: { appSlug: string; state: string; webBase?: string }): string`: `{webBase}/apps/{appSlug}/installations/new?state=…`.
  - `sealState(userId: string, nowMs: number, secret: string): string` and `openState(value: string | undefined, userId: string, nowMs: number, secret: string): boolean`: the arrival cookie's pattern (HMAC-SHA256 over `"ruken-github-state-v1:" + payload`), holding the account's id and the time; it opens only for the same account and for ten minutes. It stops someone from finishing a connection that another person started.
  - `installationsOf(input: { code: string; clientId: string; clientSecret: string; … }): Promise<{ installationId: bigint; accountLogin: string }[]>`: `POST {webBase}/login/oauth/access_token` (JSON, `Accept: application/json`) for the person's token, then `GET {apiBase}/user/installations` with it, every page. The person's token is used once and never stored. A refused code throws `GameError("NOT_CONNECTED", "GitHub didn't finish connecting. Try again.")`.
- Added to `GitHub` (Task 8): `repositoriesOf(installationId: bigint): Promise<{ fullName: string; defaultBranch: string; private: boolean }[]>` (`GET /installation/repositories` with that installation's token, every page, 300 repositories at most), and `installationOf(repo: string): Promise<bigint | null>` (what `/repos/{repo}/installation` answers).
- Added to the games service:
  - `rememberInstallations(userId: string, found: { installationId: bigint; accountLogin: string }[]): Promise<void>`: upserts each, and removes this person's rows that GitHub no longer lists.
  - `repositoriesFor(userId: string): Promise<{ fullName: string; defaultBranch: string }[]>`: over the person's stored installations, sorted by name. An installation GitHub no longer knows (404) is dropped from the table and skipped.
  - `createGame` and `pullLatest` now check that `github.installationOf(repo)` is one of the maker's stored installations, else `GameError("NOT_CONNECTED", "Ruken can't see that repository. Choose it on GitHub, then try again.")`. A maker can only pull a repository they themselves connected.
- Settings: `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`, optional `GITHUB_WEB_BASE` (accepted only when it starts with `http://127.0.0.1:`, like `GITHUB_API_BASE`). `gamesServices()` gains `connect: { signInUrl(state), installUrl(state), installationsOf(code) }`.

- [ ] **Step 1 (red):** `github-connect.test.ts`: the two addresses, exactly; a state opens for its own account within ten minutes and not for another account, a changed value, or after ten minutes and one millisecond; `installationsOf` posts the code with the id and the secret, asks `/user/installations` with the token it got, follows a second page, and never puts the token or the secret in an error. `connection.pg.test.ts`: `rememberInstallations` stores what GitHub listed and forgets what it stopped listing; `repositoriesFor` lists both installations' repositories by name; **a maker cannot make or pull a game from a repository under someone else's installation** (the fake `installationOf` answers an id the maker does not hold: `NOT_CONNECTED`, and `tarball` is never called). Every earlier `createGame` and `pullGame` test gains a stored installation. Stubs. Push. Expected: `verify` fails in `github-connect.test.ts`, `postgres` in `connection.pg.test.ts` (no table; "not built yet").
- [ ] **Step 2 (green):** the code, the migration and the four names in `.env.example`. Push. Expected: all pass.

### Task 25: Connecting on the site, and a stand-in GitHub

**Files:**
- Create: `src/routes/make/github/+server.ts`, `src/routes/make/github/callback/+server.ts`, `tests/browser/support/fake-github-server.ts`, `tests/fixtures/tiny-game/index.html`, `main.js`, `img/dot.png`
- Modify: `playwright.config.ts`
- Test: `tests/browser/connect-github.test.ts`

**Interfaces:**
- `GET /make/github` (signed in, else to sign-in and back): sets nothing but a fresh state and redirects (303) to `signInUrl`. `GET /make/github?choose=1`: the same, to `installUrl` (GitHub's own page for choosing repositories).
- `GET /make/github/callback?code=…&state=…`: signed out, to sign-in. A state that does not open, or no code: redirect to `/make/new?github=failed`. Otherwise `installationsOf(code)`, `rememberInstallations`, and redirect to `/make/new`. GitHub comes back here both after signing in and after choosing repositories, because the app is set to ask for sign-in during installation (G2).
- **The stand-in GitHub.** `fake-github-server.ts` is a plain `node:http` server on `127.0.0.1:12112`, started by Playwright, ready when `GET /ready` answers 200. It holds one installation (number 1, account `ruken-test`) with two repositories, `ruken-test/tiny-game` and `ruken-test/broken-game` (no `index.html`). It answers: `GET /login/oauth/authorize` (redirects at once to the app's callback with `code=test-code` and the `state` it was given); `GET /apps/ruken-test-app/installations/new` (the same redirect, with `installation_id=1&setup_action=install`); `POST /login/oauth/access_token`; `GET /user/installations`; `GET /installation/repositories`; and Task 8's four calls for both repositories, the tarballs made at start with `tarGz` from `tests/fixtures/` under a top folder. Every API call must carry an `Authorization` header or gets 401. `POST /next-commit` gives `tiny-game` a new commit id.
- **The tiny game.** `index.html` holds `<h1>Tiny game</h1>`, `<button id="tap">Tap</button>`, an `<img src="img/dot.png">` and `<script src="main.js"></script>`; `main.js` sets `document.body.dataset.loaded = "yes"` and writes into `<pre id="seen">` the JSON of what a game can see: `{ referrer: document.referrer, search: location.search, hash: location.hash, name: window.name, cookie: document.cookie }`. `dot.png` is a one-pixel PNG. All addresses are relative.
- `playwright.config.ts`: the third server; the app's `env` gains `GITHUB_APP_ID: "1"`, `GITHUB_APP_SLUG: "ruken-test-app"`, `GITHUB_APP_CLIENT_ID: "test-client"`, `GITHUB_APP_CLIENT_SECRET: "test-only-client-secret"`, `GITHUB_API_BASE` and `GITHUB_WEB_BASE` (both `http://127.0.0.1:12112`), and `GITHUB_APP_PRIVATE_KEY`, a PKCS#1 key made when the config loads with `generateKeyPairSync` (never a file).

- [ ] **Step 1 (red):**

```ts
test("connecting GitHub comes back with the maker's repositories remembered", async ({ page }) => {
  const maker = await signUp(page);
  await page.goto("/make/github");
  await expect(page).toHaveURL("/make/new");                       // through the stand-in and back; /make/new itself arrives in Task 27
  expect(await installationsOf(maker.email)).toMatchObject([{ installationId: 1n, accountLogin: "ruken-test" }]);
});
test("a callback with a state nobody started is refused, and nothing is remembered", async ({ page }) => {
  const maker = await signUp(page);
  await page.goto("/make/github/callback?code=test-code&state=made-up");
  await expect(page).toHaveURL("/make/new?github=failed");
  expect(await installationsOf(maker.email)).toEqual([]);
});
test("signed out, connecting asks for sign-in first", async ({ page }) => { /* /make/github → /sign-in?next=… */ });
```

  `installationsOf(email)` goes in `tests/browser/support/database.ts`. Until Task 27, `/make/new` is a 404, and `toHaveURL` still holds: say so in the report line. Commit the stand-in and the fixtures with the tests. Push. Expected: `browser` fails in `connect-github.test.ts`: 404 at `/make/github`.
- [ ] **Step 2 (green):** the two routes. Push. Expected: all pass. Branch E is ready to merge.

---

# Branch M: `slice-2/submit`

### Task 26: Sending a game for review: the rules and the tables

**Files:**
- Create: `prisma/migrations/<timestamp>_review/migration.sql`, `src/features/games/review.ts`, `src/features/make/make.ts`, `src/features/make/agreement.ts`
- Modify: `prisma/schema/games.prisma`, `prisma/schema/make.prisma`, `src/features/games/service.ts`, `src/features/games/games.ts`
- Test: `tests/features/games/review.test.ts`, `tests/features/games/review.pg.test.ts`, `tests/features/make/agreement.pg.test.ts`

**The tables:** `Game` gains `pendingPullId?` unique (a `GamePull`: the files waiting for a person's yes). New `GameReview`: `id`, `gameId`, `pullId`, `staffUserId` (a `User`), `decision ReviewDecision { accepted, sent_back }`, `reason?`, `decidedAt`, `createdAt`; added and never changed (the add-only trigger); CHECK `GameReview_reason_check` (a `sent_back` row has a reason of 1 to 500 characters). It is the record design 5.5 asks of every staff action: who, what, when. New `MakerAgreement`: `id`, `userId` unique, `version`, `acceptedAt`, `createdAt`; added and never changed.

**Interfaces:**
- Produces, pure, in `review.ts`: `stateWords(game: { state: GameState; stateReason: string | null; hasPending: boolean }): string`, the maker's plain words (design 5.4): `draft` → "Not sent yet"; `waiting` → "Waiting for review"; `live` → "Live"; `live` with files pending → "Live. Your update is waiting for review"; `live` with a reason and nothing pending → "Live. Your update was sent back: `<reason>`"; `sent_back` → "Sent back: `<reason>`"; `taken_down` → "Taken down: `<reason>`".
- Added to the games service (the old `goLive` of Task 11 is replaced by these, and its tests move here):
  - `sendForReview(gameId: string, makerUserId: string): Promise<void>`: the game is this maker's; its newest pull exists; both clips exist; else `GameError("NOT_READY", …)` with the first of: "Pull your game's files first.", "Add an upright clip.", "Add a wide clip." Then `pendingPullId` is the newest pull, and a game that is not live becomes `waiting`. A live game stays live on its old files (design 5.4: "the old ones stay live until then").
  - `waitingGames(): Promise<{ slug; name; makerEmail; sentAt }[]>`: every game with a pending pull, oldest first.
  - `accept(gameId: string, staffUserId: string): Promise<void>`: in one transaction, `livePullId` becomes the pending pull, `pendingPullId` and `stateReason` null, state `live`, and one `GameReview` row. Nothing pending: `GameError("NOT_READY", "Nothing is waiting for review.")`.
  - `sendBack(gameId: string, staffUserId: string, reason: string): Promise<void>`: the reason is 1 to 500 characters after trimming, else `GameError("INVALID", "Say what the maker should fix.")`; then `pendingPullId` null, `stateReason` the reason, state `sent_back` unless the game is live, and one `GameReview` row.
  - `gamesOf(makerUserId)` and `gameForMaker(slug, makerUserId)`: what the maker's screens show (name, state words, the newest pull's count and bytes or none, which clips exist, the repository). `gameForReview(slug)`: the same for staff, plus the pending pull's id and the two pending clip keys.
- `src/features/make/`: `MAKER_AGREEMENT_VERSION` (a date, set when the Owner's text is in: open item O5), `hasAgreed(db, userId): Promise<boolean>` and `agree(db, clock, userId): Promise<void>` (one row, once; a repeat adds nothing) in `agreement.ts`; `make.ts` re-exports them. `make` sits above `games` in the layer order.

- [ ] **Step 1 (red):** `review.test.ts`: one case per line of `stateWords`. `review.pg.test.ts`: each refusal of `sendForReview` with its words; sending makes a draft `waiting`; `accept` makes it live on those files and writes one review row with the staff account; `sendBack` with no reason refuses, with one stores it; **a live game whose update is sent back is still live on its old files**; **a live game whose update is accepted is live on the new files, and the old pull's files are still in the bucket**; `waitingGames` is oldest first; another maker cannot send someone else's game (`NOT_FOUND`). `agreement.pg.test.ts`: not agreed, then agreed; a second `agree` leaves one row. Stubs. Push. Expected: `verify` fails in `review.test.ts`, `postgres` in the two others.
- [ ] **Step 2 (green):** the code and the migration. Push. Expected: all pass.

### Task 27: The maker's area and the new-game form (`/make`, `/make/new`)

**Files:**
- Create: `src/routes/make/+page.server.ts`, `+page.svelte`, `src/routes/make/new/+page.server.ts`, `+page.svelte`
- Test: `tests/browser/make.test.ts`

Both need an account (signed out: to sign-in and back). The maker's three-step onboarding (design 5.7: pick your address, your page, your first game) stays in slice 4: its first two steps need the handle and the page, which arrive with slice 3. This slice builds what will be its step 3.

**`/make`:**

```
Your games

Tiny game        Waiting for review
Other game       Sent back: The clip is sideways.

[ Add a game ]
```

With no games: "You haven't added a game yet." and the same button. Each name links to `/make/<slug>`.

**`/make/new`**, before GitHub is connected:

```
New game

Ruken copies your game from your GitHub repository.
It needs a folder with an index.html that runs in a browser.

[ Connect GitHub ]
```

After, the form (design 5.4):

```
New game

Name          [                         ]
One line      [                         ]
Game files    [ ruken-test/tiny-game  ▾ ]   Choose other repositories on GitHub
              ▸ Change the branch or folder
Plays on      (•) Phone and computer   ( ) Computer only

[ Next: add your clips ]
```

- "Connect GitHub" is a link to `/make/github`; "Choose other repositories on GitHub" a link to `/make/github?choose=1`. Connected with no repository chosen yet: "Ruken can't see any of your repositories yet." and one link, "Choose repositories on GitHub".
- "Change the branch or folder" opens two fields: Branch ("Leave empty for your main branch.") and Folder ("Leave empty if index.html is at the top.").
- The action `create`: `createGame` (the repository must be one of `repositoriesFor(userId)`), then `pullLatest`, then redirect (303) to `/make/<slug>`. A refused name or line shows its words above the button and keeps what was typed. A refused pull is not a failed form: the game is made, and its page says what to fix.
- `?github=failed` shows "GitHub didn't finish connecting. Try again." above "Connect GitHub".

Grandma: one thing per screen: connect, then four short fields and one button; the branch and folder stay closed unless wanted; every refusal says what to fix.

Look: `<main class="card">` on both; "Add a game" and "Connect GitHub" are `class="button"`; "Next: add your clips" is the form's one `<button>`; the other links stay links; the hints are `note`; a refusal is `problem`. No red.

- [ ] **Step 1 (red):**

```ts
test("a new maker is asked to connect GitHub, then picks a repository", async ({ page }) => {
  await signUp(page);
  await page.goto("/make");
  await expect(page.getByText("You haven't added a game yet.")).toBeVisible();
  await page.getByRole("link", { name: "Add a game" }).click();
  await page.getByRole("link", { name: "Connect GitHub" }).click();
  await expect(page.getByLabel("Game files")).toHaveValue("ruken-test/broken-game");       // the list, by name
  await expectOneCard(page); await showTheOwner(page, "the new-game form");
});
test("the form makes the game, pulls its files and goes to its page", async ({ page }) => {
  /* connect; fill Name "Tiny game <random>", One line; choose ruken-test/tiny-game; press "Next: add your clips" */
  await expect(page).toHaveURL(/\/make\/tiny-game-[a-z0-9]+$/);
});
test("a name that is too short is refused in words, and what was typed stays", async ({ page }) => { /* "!!" → "Pick a name with at least three letters or numbers." */ });
test("a repository typed by hand that was never connected is refused", async ({ page }) => {
  /* change the select's value to "someone/else" with page.evaluate, submit → "Ruken can't see that repository. Choose it on GitHub, then try again." */ });
test("signed out, the maker's area asks for sign-in", async ({ page }) => { /* /make → /sign-in?next=%2Fmake */ });
```

  Push. Expected: `browser` fails in `make.test.ts`: 404 at `/make`.
- [ ] **Step 2 (green):** the two routes. Push. Expected: all pass.

### Task 28: A game's page in the maker's area (`/make/<game>`)

**Files:**
- Create: `src/routes/make/[game]/+page.server.ts`, `+page.svelte`, `src/routes/legal/maker-agreement/+page.svelte`
- Test: `tests/browser/make.test.ts` (add cases)

```
Tiny game
Not sent yet

Game files    ruken-test/tiny-game · 3 files, 1 MB        [ Pull the latest ]
Upright clip  Added                                        [ choose a file ] [ Upload ]
Wide clip     Not added yet. A video, up to 30 MB.         [ choose a file ] [ Upload ]

[x] I agree to the maker agreement

[ Send for review ]
```

- The second line is `stateWords`. When the last pull was refused, the Game files line reads the refusal itself (Task 4's words) in place of the count.
- Each clip is a form of its own with one file and one button. A request whose `content-length` is over 31,000,000 bytes is refused with "A clip can be up to 30 MB." before its body is read; then `saveClip`. Its refusals are Task 5's words, beside that clip.
- The agreement line shows only until the maker has agreed once; "maker agreement" links to `/legal/maker-agreement`. Sending without the tick: "Tick the box to agree to the maker agreement."
- "Send for review": `agree` (when ticked), then `sendForReview`. After it, the state line reads "Waiting for review" and one line under it: "Come back here to see when it's live." (Design 5.7's line is "We'll email you when it's live"; the mail arrives in slice 4, and a screen must not promise a mail that is not sent, so slice 4 changes the line with it.)
- For a live game, "Pull the latest" pulls and sends the update for review in one press, and the state reads "Live. Your update is waiting for review".
- A live game's page has one more link under its name, "See it on Ruken", to `/g/<slug>`.
- Someone else's game, or none: 404.
- `/legal/maker-agreement` shows the Owner's text (open item O5). Until the text is in the repository, this task cannot ship: stop and report.

**Calls** (the Owner can overrule): the design's sketch has one form and one button; this is two screens (the form, then this page). Two 30 MB videos in one form would be held in the Worker's memory together with their copies, near its 128 MB; one clip per request stays well under. And a pull that is refused is then shown before anything is sent.

Grandma: the page reads top to bottom as a checklist: files, upright, wide, agree, send. Each line says where it stands; the last button is the only filled one.

Look: `<main class="card">`; "Send for review" is the one plain `<button>`; "Pull the latest" and the two "Upload" buttons are `class="quiet"`; the state line is a `statement`; hints are `note`; refusals `problem`.

- [ ] **Step 1 (red):**

```ts
test("a maker submits a game and sees it waiting for review", async ({ page }) => {          // design 8
  const slug = await startGame(page);                         // the steps of Task 27's second test
  await expect(page.getByText("Not sent yet")).toBeVisible();
  await expect(page.getByText(/3 files/)).toBeVisible();
  await uploadClip(page, "Upright clip"); await uploadClip(page, "Wide clip");
  await page.getByLabel("I agree to the maker agreement").check();
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText("Waiting for review")).toBeVisible();
  await expect(page.getByText("Come back here to see when it's live.")).toBeVisible();
  await expectOneCard(page); await showTheOwner(page, "a game waiting for review");
});
test("sending without clips says which one is missing", async ({ page }) => { /* "Add an upright clip." */ });
test("sending without agreeing says so, and the second game does not ask again", async ({ page }) => {});
test("a web page named as a video is refused beside its clip", async ({ page }) => { /* "That file doesn't look like a video. Export it as MP4 or WebM and try again." */ });
test("a repository with no index.html says what to fix, on the game's page", async ({ page }) => {
  /* choose ruken-test/broken-game → "We couldn't find an index.html at the top of that folder. Ruken starts a game from index.html." */ });
test("another maker cannot open this game's page", async ({ page, browser }) => { /* 404 */ });
```

  `startGame(page)` and `uploadClip(page, label)` (a file made in the test: four length bytes, `ftyp`, zeros, named `clip.mp4`) go in `tests/browser/support/game.ts`. Push. Expected: `browser` fails in the new cases: 404 at `/make/<slug>`.
- [ ] **Step 2 (green):** the route. Push. Expected: all pass. Branch M is ready to merge after the Owner has seen its screens' screenshots and said "fine" (as slice 1's Task 37 step 3).

---

# Branch P: `slice-2/play-rules`

### Task 16: The play tables

**Files:**
- Create: `prisma/schema/play.prisma`, `prisma/migrations/<timestamp>_play/migration.sql`
- Modify: `prisma/schema/accounts.prisma`, `prisma/schema/games.prisma` (relations)
- Test: `tests/features/play/schema.pg.test.ts`

| Model | Columns |
|---|---|
| `PlaySession` | `id` (set in code), `gameId` (a `Game`), `pullId` (a `GamePull`), `userId?` (a `User`; null: nobody was signed in), `basis PlayBasis`, `tokenHash`, `startedAt`, `createdAt`; index on (`userId`, `startedAt`) and on (`gameId`, `startedAt`) |
| `PlayBeat` | `id` (`BigInt`, autoincrement), `sessionId` (a `PlaySession`), `receivedAt`, `attentive Boolean`; index on (`sessionId`, `receivedAt`) |

Enum `PlayBasis { member, free_game, staff, own_game }`. No `updatedAt` on either: a row is added and never changed. In the SQL, by hand: CHECK `PlaySession_tokenHash_check` (64 lower-case hex characters); CHECK `PlaySession_basis_check` (`"userId" IS NOT NULL OR "basis" = 'free_game'`: only a free game is played by nobody); the add-only trigger on both tables.

These rows are everything slice 5 needs for the 180-minute rule: the member (`userId`), the game, why the play was allowed, and each beat's time on the server's clock, from which the America/Chicago day is worked out.

- [ ] **Step 1 (red):** the two tables exist; `UPDATE` and `DELETE` on each reject; a session with no user and basis `member` rejects, with `free_game` passes; a token hash of the wrong shape rejects. Push. Expected: `postgres` fails in `schema.pg.test.ts`: the tables do not exist.
- [ ] **Step 2 (green):** the schema and the migration. Push. Expected: all pass.

### Task 17: Who may play, and what counts

**Files:**
- Create: `src/features/play/may-play.ts`, `src/features/play/time.ts`, `src/features/play/frame.ts`
- Test: `tests/features/play/may-play.test.ts`, `time.test.ts`, `frame.test.ts`

**Interfaces:**
- Produces, all pure:
  - `type PlayBasis = "member" | "free_game" | "staff" | "own_game"` and `playBasis(input: { game: { freeToPlay: boolean; makerUserId: string }; viewer: { userId: string; isStaff: boolean; isMember: boolean } | null }): PlayBasis | null`. Null means the paywall. When more than one reason holds, the first of `own_game`, `staff`, `free_game`, `member` wins: design 6 says the first three never count for pay, so a member's play of a free game must not be recorded as a member's.
  - `isPhone(userAgent: string | null): boolean`: true when it contains `Mobi` or `Android`.
  - `backFromPaywall(next: string): string`: `/g/<slug>` when `next` is exactly `/g/<slug>/play` (slug as Task 1's CHECK), otherwise `/`.
  - In `time.ts`: `BEAT_EVERY_MS = 15_000`, `BEAT_TOO_SOON_MS = 5_000`, `LONGEST_COUNTED_GAP_MS = 45_000`, `PLAY_SESSION_LIFE_MS = 24 * 60 * 60 * 1000`, and `countedMs(startedAtMs: number, beats: readonly { atMs: number; attentive: boolean }[]): number`: beats in time order; each attentive beat adds the time since the beat before it (or since the start), `LONGEST_COUNTED_GAP_MS` at most; a beat that is not attentive adds nothing; every beat becomes the "before" of the next.
  - In `frame.ts`: `GAME_FRAME_SANDBOX = "allow-scripts allow-same-origin allow-pointer-lock"` and `GAME_FRAME_ALLOW = "gamepad; fullscreen; autoplay"`, carried from `OLD/packages/sdk-host/src/game-frame.ts` with `game-frame.test.ts`.

- [ ] **Step 1 (red):**

```ts
const game = { freeToPlay: false, makerUserId: "maker" };
const viewer = { userId: "u", isStaff: false, isMember: false };
it("sends a stranger and a non-member to the paywall", () => {
  expect(playBasis({ game, viewer: null })).toBeNull();
  expect(playBasis({ game, viewer })).toBeNull();
});
it("lets a member in, as a member", () => { expect(playBasis({ game, viewer: { ...viewer, isMember: true } })).toBe("member"); });
it("lets anyone into a free game, with no account", () => { expect(playBasis({ game: { ...game, freeToPlay: true }, viewer: null })).toBe("free_game"); });
it("never records a member's play of a free game as a member's", () => {
  expect(playBasis({ game: { ...game, freeToPlay: true }, viewer: { ...viewer, isMember: true } })).toBe("free_game"); });
it("records staff as staff and a maker on their own game as that, member or not", () => {
  expect(playBasis({ game, viewer: { ...viewer, isStaff: true, isMember: true } })).toBe("staff");
  expect(playBasis({ game, viewer: { userId: "maker", isStaff: true, isMember: true } })).toBe("own_game");
});
it("a maker is a stranger on someone else's game", () => { expect(playBasis({ game, viewer: { ...viewer, userId: "other-maker" } })).toBeNull(); });

it("counts the server's time between attentive beats", () => {
  expect(countedMs(0, [{ atMs: 15_000, attentive: true }, { atMs: 30_000, attentive: true }])).toBe(30_000);
});
it("counts nothing for a beat that says the person looked away, and starts again after it", () => {
  expect(countedMs(0, [{ atMs: 15_000, attentive: false }, { atMs: 30_000, attentive: true }])).toBe(15_000);
});
it("forgives two lost beats and no more", () => {                         // Review Focus 7
  expect(countedMs(0, [{ atMs: 45_000, attentive: true }])).toBe(45_000);
  expect(countedMs(0, [{ atMs: 600_000, attentive: true }])).toBe(45_000);
});
it("never counts more than the clock saw, however many beats arrive", () => {
  const flood = Array.from({ length: 100 }, (_, i) => ({ atMs: 100 * (i + 1), attentive: true }));
  expect(countedMs(0, flood)).toBe(10_000);
});
it("counts nothing with no beats", () => { expect(countedMs(0, [])).toBe(0); });   // Review Focus 15
it.each([["/g/floor-fifty/play", "/g/floor-fifty"], ["/me", "/"], ["/g/x/play/beat", "/"], ["/g/UP/play", "/"]])("Not now from %j goes to %j", (next, back) => { expect(backFromPaywall(next)).toBe(back); });
it("knows a phone by what it says it is", () => { /* a Pixel's and an iPhone's User-Agent: true; a desktop Chrome's and null: false */ });
```

  `frame.test.ts`: the two exact strings, and the sandbox holds none of `allow-top-navigation`, `allow-popups`, `allow-forms`, `allow-modals`, `allow-downloads`. Stubs. Push. Expected: `verify` fails in the three files with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 18: Sessions and beats

**Files:**
- Create: `src/features/play/sessions.ts`, `src/features/play/services.ts`, `src/features/play/play.ts`
- Modify: `.env.example`
- Test: `tests/features/play/sessions.pg.test.ts`, `tests/features/play/services.test.ts`

**Interfaces:**
- Consumes: `playBasis`, the time rules, `makePass`, `PASS_LIFE_MS`, `LiveGame`, `RateLimiter`.
- Produces, from `createPlayService(deps: { db: PrismaClient; clock: Clock; rateLimiter: RateLimiter; passSecret: string; address(name: string): string })`:
  - `startPlay(input: { game: LiveGame; viewer: { userId: string; isStaff: boolean; isMember: boolean } | null; clientAddress: string }): Promise<{ frameUrl: string; session: { id: string; token: string } } | { refused: "join" | "busy" }>`. `playBasis` null: `{ refused: "join" }` and nothing is stored. More than `PLAY_STARTS_PER_ADDRESS` (`{ limit: 30, windowSeconds: 60 }`, key `play:start:<clientAddress>`, both declared in this file): `{ refused: "busy" }`. Otherwise: a `PlaySession` row (`id` from `randomUUID()`, the basis, the game's `livePullId`, `startedAt` from the clock, `tokenHash` the SHA-256 in hex of a 32-byte random token in base64url); `frameUrl` is `` `${address("g-" + game.publicId)}/${makePass({ game: game.publicId, pull: game.livePullId, expiresAtMs: now + PASS_LIFE_MS }, passSecret)}/` ``. The token itself is answered once and never stored.
  - `recordBeat(input: { sessionId: string; token: string; attentive: boolean }): Promise<"recorded" | "too_soon" | "over" | "unknown">`. No such session, or the token's hash does not match (compared with `timingSafeEqual`): `unknown`. The clock is past `startedAt + PLAY_SESSION_LIFE_MS`: `over`. The session's latest beat (or its start) is less than `BEAT_TOO_SOON_MS` ago: `too_soon`, and nothing is stored. Otherwise one `PlayBeat` row with the clock's time. Two beats in the same instant may both be stored; `countedMs` gives the second one nothing.
  - `playSummary(gameId: string): Promise<{ sessions: number; beats: number; countedSeconds: number }>`: over every session of the game, `countedMs` summed and rounded down to seconds.
  - `playServices(): { service }` in `services.ts`, built once from `PLAY_PASS_SECRET`, with `prisma()`, `systemClock`, a `RateLimiter` and `gamesServices().address`.
  - `play.ts` re-exports `playServices`, `backFromPaywall`, `isPhone`, `GAME_FRAME_SANDBOX`, `GAME_FRAME_ALLOW`, `type PlayBasis`.

- [ ] **Step 1 (red):** with `TestClock`:

```ts
it("gives a member a frame address under a pass for that game's live files, and records why they could play", async () => {
  const started = await service.startPlay({ game, viewer: member, clientAddress: "203.0.113.1" });
  const url = new URL(frameUrlOf(started));
  expect(url.origin).toBe(`https://g-${game.publicId}.games.test`);
  expect(url.search).toBe(""); expect(url.hash).toBe("");
  expect(checkPass(url.pathname.split("/")[1] ?? "", "s", clock.epochMs())).toEqual({ game: game.publicId, pull: game.livePullId, expiresAtMs: clock.epochMs() + PASS_LIFE_MS });
  expect(await prisma.playSession.findMany()).toMatchObject([{ userId: member.userId, gameId: game.id, pullId: game.livePullId, basis: "member" }]);
});
it("stores nothing for someone who may not play", async () => { /* { refused: "join" }; no rows */ });
it("records a free game played by nobody", async () => { /* viewer null, freeToPlay: basis "free_game", userId null */ });
it("never stores the token itself", async () => { /* no column of the row equals the token; tokenHash is sha256(token) */ });
it("takes a beat from the session's own token only", async () => {            // Review Focus 7
  expect(await service.recordBeat({ sessionId: a.id, token: b.token, attentive: true })).toBe("unknown");
  expect(await service.recordBeat({ sessionId: "nope", token: a.token, attentive: true })).toBe("unknown");
  expect(await prisma.playBeat.count()).toBe(0);
});
it("stamps a beat with the server's clock", async () => {
  clock.advance(15_000);
  expect(await service.recordBeat({ sessionId: a.id, token: a.token, attentive: true })).toBe("recorded");
  expect((await prisma.playBeat.findFirstOrThrow()).receivedAt).toEqual(new Date(clock.epochMs()));
});
it("drops a beat that comes too soon after the last", async () => { /* advance 1 s: "too_soon", no row */ });
it("stops taking beats a day after the session started", async () => { /* advance 24 h + 1 ms: "over" */ });
it("adds up what counted", async () => { /* three beats 15 s apart, the second not attentive: countedSeconds 30, beats 3, sessions 1 */ });
it("slows down an address that opens games too fast", async () => { /* the 31st start in a minute: { refused: "busy" } */ });
```

  `services.test.ts`: a missing `PLAY_PASS_SECRET` throws "Missing setting PLAY_PASS_SECRET". Stubs. Push. Expected: `postgres` fails in `sessions.pg.test.ts`, `verify` in `services.test.ts`, with "not built yet".
- [ ] **Step 2 (green):** the code; `PLAY_PASS_SECRET` in `.env.example`. Push. Expected: all pass, the layer test included (`play` reaches `games` and `membership` only through their entry files).

Branch P is ready to merge.

---

# Branch S: `slice-2/accept`

Acceptance needs a person (design 5.5). This is the smallest version of it: one staff-only list and one staff-only page, behind slice 1's staff roles. Slice 4's admin portal takes both screens in as its acceptance queue and adds what is not here.

### Task 29: The first staff account

**Files:**
- Create: `src/lib/server/job-secret.ts`, `src/routes/jobs/first-owner/+server.ts`
- Modify: `src/routes/jobs/purge-accounts/+server.ts` (uses `hasJobSecret`), `src/features/accounts/staff.ts`, `src/features/accounts/accounts.ts`
- Test: `tests/lib/server/job-secret.test.ts`, `tests/features/accounts/staff.pg.test.ts` (add cases), `tests/browser/first-owner.test.ts`

Slice 1 has the staff table and nothing that grants a role. Without one, nobody could accept FloorFifty.

- `hasJobSecret(request: Request): boolean`: the check slice 1's Task 20 wrote inside `/jobs/purge-accounts` (`Authorization: Bearer <JOBS_SECRET>`, compared in constant time), moved here unchanged so both use one.
- `grantFirstOwner(db, clock, email: string): Promise<"granted" | "already_one" | "no_account">` in `staff.ts`: when no `StaffAssignment` row exists at all, the account with that email gets the role `owner`. Once any staff row exists it only ever answers `already_one`. So it can make the first staff account and never a second.
- `POST /jobs/first-owner`, JSON `{ "email" }`: 404 without the secret; then `granted` → 200 `{ "granted": true }`, `already_one` → 409 `{ "problem": "There is already a staff account." }`, `no_account` → 400 `{ "problem": "No account has that email. Sign up on the site first." }`.
- Slice 4 brings the rest of the old rules (two superadmins, the authenticator code, admin sessions, granting roles in the portal). Accepting a game is not a money action, so this slice does not wait for them. Worth the Owner's eye.

- [ ] **Step 1 (red):** `job-secret.test.ts`: no header, a wrong secret and `Bearer ` alone are false; the right one is true. `staff.pg.test.ts`: granted once; a second call for anyone answers `already_one` and adds nothing; an unknown email is `no_account`. `first-owner.test.ts`: without the secret 404 and no row; with it 200, and `staffRolesOf` then holds `owner`; again 409. (The journeys' database is shared, so this file runs its "granted" case only when no staff row exists yet and otherwise asserts the 409: write it so either order of files passes.) Stubs. Push. Expected: `verify` and `postgres` fail with "not built yet"; `browser` fails with 404 where 200 or 409 is expected.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, slice 1's purge-job tests included.

### Task 30: Accept and Send back (`/admin/games`)

**Files:**
- Create: `src/features/admin/admin.ts`, `src/features/admin/staff-only.ts`, `src/routes/admin/games/+page.server.ts`, `+page.svelte`, `src/routes/admin/games/[game]/+page.server.ts`, `+page.svelte`
- Modify: `src/features/play/sessions.ts` (`startReviewPlay`), `src/features/play/play.ts`, `tests/browser/support/game.ts`
- Test: `tests/features/admin/staff-only.test.ts`, `tests/features/play/sessions.pg.test.ts` (add a case), `tests/browser/accept.test.ts`

This branch comes after branch P (Tasks 16 to 18), because the staff page plays the game.

- `staffOnly(caller: Caller, roles: readonly StaffRole[]): { userId: string }` in `src/features/admin/staff-only.ts`: throws SvelteKit's `error(404)` for anyone signed out or without one of `owner`, `head_curator`, `curator`. 404, not "forbidden", so the address looks like any address the site does not have.
- `startReviewPlay(input: { game: { id; publicId }; pullId: string; staffUserId: string }): Promise<{ frameUrl: string; session: … }>` in `play`: `startPlay` for files that are not live yet; the session's basis is `staff`, so it never counts for pay.

**`/admin/games`:**

```
Games waiting for review

Tiny game     maker@example.com     sent 2 hours ago
```

Oldest first; none: "Nothing is waiting." Each name links to its page.

**`/admin/games/<game>`:**

```
Tiny game
A game for the tests.
By maker@example.com · ruken-test/tiny-game · 3 files, 1 MB · Phone and computer

[ upright clip ]   [ wide clip ]

[ the game, playing in its frame ]

Played so far: 2 sessions, 1 minute counted.

[ Accept ]

Send back, and say what to fix   [                          ]   [ Send back ]
```

- "Accept" calls `accept`; "Send back" calls `sendBack` with the reason, which the maker then sees on their page. Both return to the list. A reason left empty: "Say what the maker should fix."
- "Played so far" is `playSummary`: how a person checks, on the real site, that play time was recorded (design 8), until slice 5 gives it a real home.
- Both clips play with their controls, so staff can watch them (design 5.5).

Grandma: the list says what is waiting; the page shows the clips and the game, then two choices, and the one that needs words has its field beside it.

Look: `<main class="card">` on the list. The review page is wider than a card can hold a game: `<main>` with no card, the clips `clip`, the game `frame` inside a box of fixed height; "Accept" is its one plain `<button>`, "Send back" is `class="quiet"`. No red: nothing here spends money.

**The journeys' helper.** `addGame(browser, options?: { name?: string; playsOn?: "phone_and_computer" | "computer_only"; free?: boolean }): Promise<{ slug: string; publicId: string; makerEmail: string; makerUserId: string }>` in `tests/browser/support/game.ts`: in a browser context of its own, a maker signs up, connects, submits `ruken-test/tiny-game` with both clips (Tasks 27 and 28's steps); then a staff account (a second sign-up, given the `curator` role through `tests/browser/support/database.ts`, as nothing on the site grants one) accepts it. For `free`, it sets `freeToPlay` on the row the same way (the portal that sets it arrives in slice 4). Every journey of branch F gets its game this way, through the real screens.

- [ ] **Step 1 (red):** `staff-only.test.ts`: signed out, a member with no role and a `finance` role are 404; `curator` passes. The `sessions.pg.test.ts` case: `startReviewPlay` records basis `staff` and a pass for the pending pull. `accept.test.ts`:

```ts
test("staff accept a waiting game, and it is live at its address", async ({ page, browser }) => {      // design 8
  const waiting = await submitGame(browser);                    // a maker's steps, up to "Waiting for review"
  await signInAsStaff(page);
  await page.goto("/admin/games");
  await page.getByRole("link", { name: waiting.name }).click();
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");   // staff play it before it is live
  await showTheOwner(page, "a game being reviewed");
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page).toHaveURL("/admin/games");
  expect((await page.goto(`/g/${waiting.slug}`))?.status()).toBe(200);
});
test("staff send a game back, and the maker reads why", async ({ page, browser }) => {
  /* Send back with "The clip is sideways." → the maker's /make/<slug> reads "Sent back: The clip is sideways." */ });
test("sending back needs a reason", async ({ page, browser }) => { /* "Say what the maker should fix." */ });
test("a game is not at its address until staff accept it", async ({ page, browser }) => { /* /g/<slug> is 404 while waiting */ });
test("the staff pages are not there for anyone else", async ({ page }) => { /* signed out and a plain member: 404 on both */ });
```

  Stubs. Push. Expected: `verify` fails in `staff-only.test.ts`, `postgres` in the new case, `browser` in `accept.test.ts` (404 at `/admin/games` for staff).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch S is ready to merge after the Owner's "fine" on its screenshots.

---

# Branch F: `slice-2/play`

### Task 19: The look of a game's page and of the play screen

**Files:**
- Modify: `src/lib/look.css`, `tests/lib/look.test.ts` (`CLASSES`), `tests/browser/support/look.ts` if it lists classes
- Test: `tests/lib/look.test.ts` (add cases)

Five classes, each with its rule here and its first use in Tasks 20 and 21 (slice 1: a class arrives with its rule, its first use and its name in `CLASSES`). Design 5.8's tokens only; no new colour.

| Class | Goes on | What it does |
|---|---|---|
| `clip` | a `<video>` in a card | a block as wide as the card, at most 60% of the window's height, 20px corners, `ink` behind it while it loads, `object-fit: cover` |
| `stage` | the play screen's `<main>` | fills the window (`100dvh`, no gutter, no width limit), `felt-deep` ground, a column: the bar, then the frame |
| `bar` | the strip above the game | 48px tall, `felt-deep`, chalk text at 14px, its contents in a row with a 0.5rem gap |
| `back` | the ← link in the bar | a 48px by 48px target; the arrow is chalk on `felt-raised`, a full pill (design 5.8: `felt-raised` is for secondary buttons; this is its first rule) |
| `frame` | the game's `<iframe>` | takes all the room left, no edge, `felt-deep` behind it while the game loads |

**Calls in the look** (the Owner can overrule): the play screen has no paper card, because the thing to do there is the game itself; the bar is 48px so ← is as easy to hit as any button; the line in the bar is 14px `chalk` (`chalk` on `felt-deep` is 13.1:1), a note beside a control, not running text; nothing on either screen moves, so reduced motion changes nothing, and the line in the bar leaves without a fade.

- [ ] **Step 1 (red):** `tests/lib/look.test.ts`: `CLASSES` holds the five names; `look.css` has a rule for each; the `back` rule's two colours are the tokens above and their contrast, measured from the tokens as Task 35 does, is at least 4.5:1; the `bar` and `back` rules name 3rem (48px). Push. Expected: `verify` fails in `look.test.ts`: no such rules.
- [ ] **Step 2 (green):** the rules. Push. Expected: all pass. (The slice 1 case "every class in `CLASSES` is used by a screen", if it exists as built, fails until Task 21: if so, do Tasks 19 to 21 as one red and one green for that case and say so in the report line.)

### Task 20: A game's page (`/g/<game>`)

**Files:**
- Create: `src/routes/g/[game]/+page.server.ts`, `src/routes/g/[game]/+page.svelte`
- Test: `tests/browser/game-page.test.ts`

**The screen**, a placeholder until the feed (slice 3) opens at this clip:

```
Tiny game
A game for the tests.

[ the clip, playing without sound, looping ]

[ Play ]
```

On a phone, for a game marked computer only, the last line is instead:

```
This one needs a computer.
[ Share the link ]
```

- `load`: `liveGameBySlug(params.game)`; null is a 404 (the error page's words). Then `membershipServices().arrival.remember(cookies, { makerUserId: game.makerUserId, path: url.pathname })`: this is the arrival slice 1 built ahead of its caller. It answers the name, the one line, the two clip addresses (`gamesServices().address("media") + "/" + key`) and `needsComputer` (`game.playsOn === "computer_only" && isPhone(request.headers.get("user-agent"))`).
- The clip is one `<video class="clip" muted loop autoplay playsinline>` with two `<source>` elements: the upright clip with `media="(orientation: portrait)"`, then the wide one. No sound here: the tap for sound belongs to the feed (design 5.1, slice 3).
- Play is `<a class="button" href="/g/<slug>/play">Play</a>`: a link, so it works with no script, and the page's one filled button.
- "Share the link" is a `<button>`: it calls `navigator.share({ title: <name>, url: location.href })` where the browser has it; otherwise it copies the address and the line under it reads "Link copied." If neither works, the line reads "Copy the address from the bar at the top." The script is in the page; it imports nothing from a feature.
- The page's title is `<name> · Ruken`.

Grandma: the name says what this is; the clip shows it; Play is the only button. On a phone that cannot play it, one line says why and the one button does the next best thing.

Look: `<main class="card">`; the name is the card's `h1`; the one line is ordinary text; the video is `clip`; "This one needs a computer." is ordinary text, not a `problem` (nothing went wrong). No red.

- [ ] **Step 1 (red):**

```ts
test.beforeEach(forgetRateLimits);
test("a game's page shows its name, its line, its clip and Play", async ({ page, browser }) => {
  const game = await addGame(browser, { name: "Tiny game" });
  await page.goto(`/g/${game.slug}`);
  await expect(page.getByRole("heading", { name: "Tiny game" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play" })).toHaveAttribute("href", `/g/${game.slug}/play`);
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page).toHaveTitle("Tiny game · Ruken");
  const sources = page.locator("video.clip source");
  await expect(sources.nth(0)).toHaveAttribute("media", "(orientation: portrait)");
  await expect(sources.nth(0)).toHaveAttribute("src", new RegExp(`^http://media\\.localhost:8788/clips/${game.publicId}/upright-[0-9a-f]{16}\\.mp4$`));
  await expect(sources.nth(1)).toHaveAttribute("src", /\/wide-[0-9a-f]{16}\.mp4$/);
  await expectOneCard(page); await showTheOwner(page, "a game's page");
});
test("the clip's address answers anyone, as video", async ({ page, browser }) => { /* page.goto(the src) → 200, content-type video/mp4 */ });
test("landing on a game's page remembers its maker's link", async ({ page, browser }) => {
  const game = await addGame(browser);
  await page.goto(`/g/${game.slug}`);
  expect((await page.context().cookies()).find((cookie) => cookie.name === "rk_arrival")).toMatchObject({ httpOnly: true, sameSite: "Lax" });
});
test("a game that is not there is a missing page with a way back", async ({ page }) => { /* /g/no-such-game → 404, "Back to Ruken" */ });
test("a computer-only game says so on a phone, and offers its link", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser, { playsOn: "computer_only" });
  await page.goto(`/g/${game.slug}`);
  if (testInfo.project.name === "phone") {
    await expect(page.getByText("This one needs a computer.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Play" })).toHaveCount(0);
    await page.getByRole("button", { name: "Share the link" }).click();          // the test browser has no share sheet
    await expect(page.getByText(/^(Link copied\.|Copy the address from the bar at the top\.)$/)).toBeVisible();
    await showTheOwner(page, "a computer-only game on a phone");
  } else {
    await expect(page.getByRole("link", { name: "Play" })).toBeVisible();
  }
});
```

  Push. Expected: `browser` fails in `game-page.test.ts`: 404 at `/g/<slug>` (the missing-game test passes already; say so in the report line).
- [ ] **Step 2 (green):** the route. Push. Expected: all pass.

### Task 21: Playing (`/g/<game>/play`)

**Files:**
- Create: `src/routes/g/[game]/play/+page.server.ts`, `src/routes/g/[game]/play/+page.svelte`
- Modify: `src/routes/join/+page.server.ts` ("Not now" uses `backFromPaywall`)
- Test: `tests/browser/play.test.ts`, `tests/browser/join.test.ts` (one case)

**The screen:**

```
[←]  Tap ← to go back to the feed
┌─────────────────────────────────┐
│                                 │
│   the game, in its own frame    │
│                                 │
└─────────────────────────────────┘
```

- `load`, in this order: `liveGameBySlug` (null: 404); a computer-only game on a phone: redirect (303) to `/g/<slug>`; `startPlay` with the caller (`isStaff` from `staffRolesOf`, `isMember` from `isMember`; signed out: `viewer: null`) and `getClientAddress()`. `{ refused: "join" }`: redirect (303) to `` `/join?next=${encodeURIComponent(`/g/${slug}/play`)}` ``. `{ refused: "busy" }`: the error page with 429 and "You've opened a lot of games just now. Try again in a minute." Otherwise it answers `{ name, slug, frameUrl, session }`.
- The page is `<main class="stage">`: a `<div class="bar">` holding `<a class="back" href="/g/<slug>" aria-label="Back to the feed">←</a>` and `<p role="status">Tap ← to go back to the feed</p>`; then `<iframe class="frame" title="<name>" src={frameUrl} sandbox={GAME_FRAME_SANDBOX} allow={GAME_FRAME_ALLOW} referrerpolicy="no-referrer">`. The frame has no `name`, and the page sends it no message.
- The line (design 5.7, "The first time in a game") shows for 5 seconds and is then removed from the page; it shows only the first time on a device (a `localStorage` entry, `rk_seen_back`, set when it is first shown). With no script it simply stays.
- ← is a plain link: it works with no script, by keyboard, and whatever the game is doing.
- The page's title is `<name> · Ruken`. The session's token is in the page's data for its own script (Task 22) and nowhere in the frame's address.
- `/join`: "Not now" goes to `backFromPaywall(next)`.

Grandma: the game fills the screen; the one thing of Ruken's is ←, and one short line says what it does, then gets out of the way. Someone who has not paid sees the price card, not a broken game.

Look: `stage`, `bar`, `back`, `frame` (Task 19). No card, no red.

- [ ] **Step 1 (red):**

```ts
test("a member presses Play and the game loads, in a frame on another address", async ({ page, browser }) => {
  const game = await addGame(browser);
  await payAsNewMember(page);
  await page.goto(`/g/${game.slug}`);
  await page.getByRole("link", { name: "Play" }).click();
  const frame = page.locator("iframe.frame");
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(frame).toHaveAttribute("src", new RegExp(`^http://g-${game.publicId}\\.localhost:8788/v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/$`));
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");   // main.js ran: a second file loaded under the pass
  await showTheOwner(page, "a game being played");
});
test("the game sees nothing about the player", async ({ page, browser }) => {
  /* as above, then read #seen inside the frame */
  expect(JSON.parse(seen)).toMatchObject({ referrer: "", search: "", hash: "", name: "", cookie: "" });
  expect(await page.locator("iframe.frame").getAttribute("name")).toBeNull();
});
test("someone who has not paid gets the price card, and the files do not load", async ({ page, browser }) => {   // design 8; Review Focus 9
  const game = await addGame(browser);
  await page.goto(`/g/${game.slug}/play`);
  await expect(page).toHaveURL(`/join?next=%2Fg%2F${game.slug}%2Fplay`);
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  expect((await page.goto(`http://g-${game.publicId}.localhost:8788/index.html`))?.status()).toBe(403);
});
test("Not now on the price card goes back to the game's page", async ({ page, browser }) => { /* href is /g/<slug> */ });
test("a stranger signs up, pays, and is in the game they tapped", async ({ page, browser }) => {               // design 8
  const game = await addGame(browser);
  await page.goto(`/g/${game.slug}`);
  await page.getByRole("link", { name: "Play" }).click();
  /* the card → Continue → sign up → Continue to payment → Pay (the steps of slice 1's Task 29) */
  await expect(page).toHaveURL(`/g/${game.slug}/play`);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
});
test("anyone can play a free game without an account", async ({ page, browser }) => {                          // design 8
  const game = await addGame(browser, { free: true });
  await page.goto(`/g/${game.slug}/play`);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
});
test("a member whose membership has ended gets the price card on reload", async ({ page, browser }) => {       // Review Focus 8
  /* payAsNewMember, open the game, then delete the account's membership the way slice 1's journeys end one
     (cancel now at the stand-in and wait for /me to say "You're not a member."), reload /g/<slug>/play → /join */ });
test("the way back is one link, and its line shows once", async ({ page, browser }) => {
  /* free game. await page.clock.install() before goto. The line "Tap ← to go back to the feed" is visible;
     page.clock.runFor(5_000) → it is gone; reload → it does not show again.
     The link named "Back to the feed" is at least 48px by 48px and goes to /g/<slug>. */ });
test("a phone that opens a computer-only game's play address is sent to its page", async ({ page, browser }, testInfo) => {   // Review Focus 10
  /* phone project only: /g/<slug>/play → toHaveURL(/g/<slug>) */ });
test("nothing on the play screen is red, and nothing scrolls sideways", async ({ page, browser }) => { /* pipRed(page) is []; scrollWidth equals clientWidth */ });
```

  If slice 1's stand-in Stripe has no way to end a membership at once from a journey, the eighth test instead sets the member's `PremiumMembership` row to `ended` through `tests/browser/support/database.ts`; say which in the report line. Push. Expected: `browser` fails in `play.test.ts`: 404 at `/g/<slug>/play`; the `join.test.ts` case fails on the link's address (`/`).
- [ ] **Step 2 (green):** the route and the one line in `/join`. Push. Expected: all pass.

### Task 22: Play time

**Files:**
- Create: `src/features/play/attention.ts`, `src/features/play/play.browser.ts`, `src/routes/g/[game]/play/beat/+server.ts`
- Modify: `src/routes/g/[game]/play/+page.svelte`, `tests/architecture.test.ts`
- Test: `tests/features/play/attention.test.ts`, `tests/architecture.test.ts` (add cases), `tests/browser/play-time.test.ts`

**A feature's browser entry.** Slice 1 left this to the first slice that needs it. A page's own script may import from a feature only through `src/features/<feature>/<feature>.browser.ts`. `tests/architecture.test.ts` gains two rules, in this task, with a comment for each: a `.svelte` file and a `+page.ts` reach a feature only through its `.browser.ts` entry (a `+page.server.ts`, a `+server.ts` and the hook keep using `<feature>.ts`); and no file reachable from a `.browser.ts` entry imports `src/lib/server/`, a `node:` module, a feature's server entry, or the generated Prisma client. So the database can never be pulled into a browser's bundle.

**Interfaces:**
- Produces:
  - `createAttention(): { look(now: { tabShowing: boolean; frameOnScreen: boolean; frameFocused: boolean }): void; report(): boolean; taken(): void }` in `attention.ts`, pure, with no browser API in it. `look` is called once a second and whenever the tab is hidden; any look where one of the three is false marks the stretch as broken. `report()` answers whether every look since the last `taken()` was attentive, and false when there was no look at all. `taken()` starts a new stretch; it is called only when the server took the beat, so a beat that was lost is still spoken for by the next one.
  - `play.browser.ts` re-exports `createAttention` and `BEAT_EVERY_MS`.
  - `POST /g/<game>/play/beat`, JSON body `{ "session": string, "token": string, "attentive": boolean }`: a body of any other shape, or over 1,000 bytes, answers 400; `recordBeat`'s `recorded` answers 204, `too_soon` 429, `over` 410, `unknown` 404. It reads no cookie and needs no sign-in: the session's token is the proof, so free play by nobody is recorded too.
  - In the page's script: one timer looks once a second (`document.visibilityState === "visible"`; the frame's box overlaps the window; `document.activeElement` is the frame and `document.hasFocus()`); `visibilitychange` looks at once; every `BEAT_EVERY_MS` it posts `report()` with `fetch(…, { keepalive: true })` and calls `taken()` on a 204; a 410 or 404 stops the timer; on `pagehide` it sends one last beat with `navigator.sendBeacon`. It never focuses the frame itself: time starts when the person first taps or clicks the game.

- [ ] **Step 1 (red):**

```ts
// tests/features/play/attention.test.ts
const yes = { tabShowing: true, frameOnScreen: true, frameFocused: true };
it("says no before it has looked at all", () => { expect(createAttention().report()).toBe(false); });        // Review Focus 15
it("says yes when every look was attentive", () => { const a = createAttention(); a.look(yes); a.look(yes); expect(a.report()).toBe(true); });
it.each(["tabShowing", "frameOnScreen", "frameFocused"] as const)("one look without %s breaks the stretch", (key) => {
  const a = createAttention(); a.look(yes); a.look({ ...yes, [key]: false }); a.look(yes); expect(a.report()).toBe(false);
});
it("keeps a broken stretch until the server has taken a beat", () => {
  const a = createAttention(); a.look({ ...yes, frameFocused: false }); a.report(); a.look(yes);
  expect(a.report()).toBe(false);          // the beat was lost: the next one still speaks for the whole stretch
  a.taken(); a.look(yes); expect(a.report()).toBe(true);
});
```

```ts
// tests/browser/play-time.test.ts
test("a member's play time is recorded against that game", async ({ page, browser }) => {                     // design 8
  const game = await addGame(browser);
  await payAsNewMember(page);
  await page.clock.install();
  await page.goto(`/g/${game.slug}/play`);
  await page.frameLocator("iframe.frame").getByRole("button", { name: "Tap" }).click();     // the frame now has focus
  await page.clock.runFor(16_000);                                                           // one beat is due
  await expect.poll(async () => (await playOf(game.slug)).beats).toBe(1);
  await expect.poll(async () => (await beatsOf(game.slug)).at(-1)?.attentive).toBe(true);
  expect(await sessionsOf(game.slug)).toMatchObject([{ basis: "member", gameId: game.id }]);
});
test("no time counts while the person has not touched the game", async ({ page, browser }) => {
  /* free game; clock.install; goto; runFor(16_000); poll: one beat, attentive false; countedSeconds 0 */ });
test("free play by nobody is recorded, as free", async ({ page, browser }) => { /* sessions: [{ basis: "free_game", userId: null }] */ });
test("a beat with a wrong token is not taken", async ({ request }) => { /* POST …/play/beat with a made-up session and token → 404 */ });
test("a beat of the wrong shape is refused", async ({ request }) => { /* { session: 1 } → 400; a 2,000-byte body → 400 */ });
```

  `playOf(slug)` (the sessions, the beats and the counted seconds, worked out with `countedMs`), `beatsOf` and `sessionsOf` go in `tests/browser/support/database.ts`. The journeys move the page's timers with `page.clock` and wait with `expect.poll`; none sleeps. The server stamps beats with the real clock, so the journeys assert that a beat was recorded and whether it was attentive, never how many seconds counted beyond zero; the counting itself is Task 17's and Task 18's. Stubs for `createAttention`. Push. Expected: `verify` fails in `attention.test.ts` ("not built yet") and in the two new architecture cases if the page already imports wrongly (it should not: they pass, say so); `browser` fails in `play-time.test.ts`: no beat arrives (404 at the beat address).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.
- [ ] **Step 3: if the focus journey fails on `phone` only.** Playwright's phone project sends touch as mouse events; if a click inside the frame does not make it `document.activeElement` there, report it with what `document.activeElement` was. Do not make the page focus the frame, and do not drop the focus rule.

### Task 23: Design 8's journeys, from a real link

**Files:**
- Modify: `tests/browser/pay.test.ts`
- Test: `tests/browser/pay.test.ts`

Slice 1 proved "A member's sign-up records the maker's link they came through" with a cookie the test wrote, because no link existed. Now one does.

- [ ] **Step 1:** rewrite that journey: `addGame` (its maker is a real account); the visitor opens `/g/<slug>`, presses Play, signs up, pays; then `membershipStartsOf(member.email)` is `[{ broughtByUserId: game.makerUserId, arrivalPath: "/g/<slug>" }]`. Add: a visitor who lands on game A's page, then on game B's (another maker), and pays is recorded with B's maker (the last arrival wins). Remove `arrivalCookie` from `tests/browser/support/database.ts` if nothing else uses it. Both journeys pass on the first push, because Tasks 20 and 21 built what they need: this task is a test change with no red, and the report line says so. If either fails, that is a defect in Task 20's `arrival.remember` call: fix it there, test first.
- [ ] **Step 2:** set slice 2's lines in `docs/superpowers/progress.md`: which of design 8's lines now have a journey ("A stranger signs up, pays … and is in the game they tapped", "That member's play time is recorded against that game", "Someone who has not paid cannot load a game's files", "Anyone can play [a free game] without an account", "A member's sign-up records the maker's link they came through"). Branch F is ready to merge after the Owner has seen the screenshots of its green run (the game's page, the computer-only line on a phone, the play screen) and said "fine"; send the coordinator the run's id and one line per screen, as slice 1's Task 37 step 3 does. After two rounds without "fine", stop.

---

# Branch G: `slice-2/real-site`

### Task 24: FloorFifty, pulled and played on the real site

No code unless a check fails. Nothing here is typed into the repository. It needs G1, G2 and G3 done, the open items O1 to O5 closed, and every branch before it on `main` and deployed.

- [ ] **Step 1: the gate's route outlives a deploy.** After the first merge to `main` that follows G3, the Owner runs `(Invoke-WebRequest "https://media.GAMES-DOMAIN/__ruken/health").Content` again and expects `ok`. If it fails, the automatic deploy dropped the route the Owner added by hand. One fix, on a small branch with its test first: the deploy command reads the games domain from a build variable (`wrangler deploy --config cloudflare/games/wrangler.jsonc --route "*.$GAMES_DOMAIN/*"`), and the Owner adds `GAMES_DOMAIN` under the `ruken` Worker's build variables (a website step: Workers Builds has no command for it). Then stop and report.
- [ ] **Step 2: G4.** Send these to the coordinator word for word, with the branch and the folder from O3 filled in. Only the first is a command; the rest is the site itself, used the way any maker and any staff member will use it.
  1. `$secret = Read-Host "JOBS_SECRET"; Invoke-RestMethod -Method Post -Uri "https://SITE/jobs/first-owner" -Headers @{ Authorization = "Bearer $secret" } -ContentType "application/json" -Body (@{ email = "THE-OWNER'S-ACCOUNT-EMAIL" } | ConvertTo-Json)` (expect `granted: True`. The secret is the one from slice 1's S1 and stays in this window only. Sign up on the site first.)
  2. On the site, signed in as that account: `/make` → "Add a game" → "Connect GitHub" (GitHub asks which repositories Ruken may read: choose the account that owns FloorFifty, "Only select repositories", FloorFifty) → Name "Floor Fifty", its one line, the repository, the branch and folder under "Change the branch or folder" → "Next: add your clips" → upload the upright and the wide clip → tick the agreement → "Send for review".
  3. `/admin/games` → Floor Fifty → watch both clips, play it → "Accept".
  4. `/make/floor-fifty` → "See it on Ruken" → Play. After a minute of play as a member, `/admin/games/floor-fifty` reads "Played so far" with counted time above zero.
- [ ] **Step 3: what a person checks**, the Owner or the coordinator with the Owner, on a phone and on a computer, and what is recorded in progress.md (what was checked, by whom, when; no address, no email): the file count and size on the maker's page equal O1's measurement; the game's page shows the right clip for the screen; signed out, Play shows the price card; a member (Stripe test mode, from slice 1's Task 31) lands in the game after paying and it runs; ← goes back; the counted seconds rose; the game's own address without a pass (`https://g-<public id>.GAMES-DOMAIN/index.html`, the public id read from the frame's address while playing) shows "This game's link has run out…" and no game.
- [ ] **Step 4:** if the pull fails on the real site with Cloudflare's "exceeded resource limits", report the Worker's log line (CPU or memory) and the game's measured size. Do not raise a limit or change the pull without the coordinator's answer. If FloorFifty loads and does not run, that is O2: report what the browser's console says; the fix is in FloorFifty's repository, which is the Owner's.
- [ ] **Step 5:** set slice 2's row in progress.md from what is true: "done" only when every branch is merged, main is green, and Step 3 passed.

---

## Notes for the plans that follow

- **Slice 3 (the feed).** `/g/<game>` becomes the feed opened at that clip; its `load` keeps the `arrival.remember` call. The clip addresses come from `gamesServices().address("media")`. The feed's Play goes to `/g/<game>/play`, which already decides between the game, the paywall and "needs a computer"; the feed shows "This one needs a computer" from the same `isPhone`. "Share the link" on the placeholder page is the seed of the feed's share. The feed's order needs "how much members played in the last seven days": `countedMs` over `member` sessions is the measure. `/<handle>` calls `arrival.remember` the same way.
- **Slice 4 (submitting and the admin portal).** The submit path and the smallest Accept and Send back are already here (Owner, 2026-11-13). Slice 4 keeps: the maker's three-step onboarding (address, page, first game), with `/make/new` as its step 3; the admin portal around `/admin/games` (its other queues, admin sessions, the authenticator code, two superadmins, granting roles, with `/jobs/first-owner` replaced by the carried first-owner rule); the mails to a maker when a game is accepted, sent back or taken down, and the line "We'll email you when it's live" in place of "Come back here to see when it's live."; `taken_down` and moderation; the staff action that sets `freeToPlay` with a reason; editing a game's name, line and "Plays on" after it is made; connecting the bank; and deleting a game's old pulls from the bucket. A taken-down game stops at once for new plays (`liveGameBySlug` is null); a pass already given lasts up to four hours unless the files are deleted.
- **Slice 5 (money).** Play that counts: sessions with basis `member` only. Time: `countedMs` over a session's beats, cut at America/Chicago midnight by each beat's `receivedAt`, at most 180 minutes per member, per game, per day. Two sessions of one member can overlap (two tabs, two devices); count each moment once. `PlaySession.pullId` says which files were played, should a dispute need it.
- **The privacy text** (the Owner's, before live mode) should say that Ruken records when a game is open and has the person's attention, and that a game runs on another address and may talk to its maker's servers.
- Worth the Owner's eye before launch, left out on purpose: a rule on where a game's scripts may connect; a sweep of old `PlayBeat` rows (four a minute for each person playing; nothing removes them); a limit on beats per session beyond "not sooner than five seconds"; ending a pass early when a game is taken down.
- The gate has no cache in front of the bucket. If the Worker's numbers ever show it slow, Cloudflare's cache API in front of `files/` is the first thing to try; a file's address already changes with every pull.
- A browser keeps a game's files only for the life of one pass (the address changes with each Play). If FloorFifty's size makes that slow on a phone, a pass shared by everyone for a fixed window would let the browser keep the files; that is a change to the pass, for the Owner's yes.
