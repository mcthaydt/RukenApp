# Ruken from your computer: a command line and an MCP for makers

Date: 2026-11-22. Status: **spec, reworked after plan audit 1 (FAIL, 9 red) plan audit 2 (FAIL, 5 red) and plan audit 3 (FAIL, 2 red, `audits/2026-11-22-ruken-from-your-computer-3-plan-audit.md`); waiting on plan audit 4 and the owner's D2 (section 9).** Lane 3 overall: pull request 1 adds a migration and a new way to sign in. The other pull requests are lane 2.

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-22 13:50 UTC:** "Also, are we able to create an MCP? It'd be great if makers could do all the things we do in the browser, but through their IDE; we're creating a new video for vertical and horizontal for floor fifty, I'd like it if we should just have it send it via. CLI"
- **Owner, 2026-11-22 13:51 UTC:** "Do everything from the CLI, not just new videos, that's just what prompted the question"

So the goal is full parity: everything a maker does on Ruken's maker screens in the browser, done from a terminal or from an AI agent in their editor. Videos come first only because they are the first thing the owner needs; they are build order, not the goal.

## 1. The outcome

A maker types `npx ruken sign-in` once, presses **Yes** on Ruken in their browser, and from then on can do everything in section 3 from their terminal, or ask their AI agent to do it through the same program run as an MCP server (`npx ruken mcp`). Ruken's server applies every rule it applies to the browser: who owns what, review for live games, the 18+ rules, file and size limits. A maker can see every computer that can act for them and remove any of them in one press.

The first thing shipped (pull request 1): `npx ruken video floor-fifty upright floor-fifty-upright.mp4` and `... wide ...` send the owner's two new Floor Fifty videos, which then wait for review like any live game's new video.

## 2. The shape

```
 maker's computer                                   ruken.io (the Worker)
 ┌───────────────────────────┐   HTTPS + key   ┌──────────────────────────────┐
 │ npx ruken <command>       │ ──────────────▶ │ /api/v1/...  (JSON)          │
 │ npx ruken mcp  (stdio)    │                 │   reads the key, then calls  │
 │   reads files from disk   │                 │   the same games and pages   │
 │   key in ~/.config/ruken  │                 │   services the screens call  │
 └───────────────────────────┘                 └──────────────────────────────┘
```

- **Call: one HTTP API, one program.** The command line and the MCP are one npm package with no dependencies of its own. `npx ruken mcp` runs it as a local MCP server over stdio; every MCP tool is a command line command underneath. **Why local, not a hosted MCP:** a video is up to 30 MB on the maker's disk, and a local program can read it and send it as a plain upload; a hosted MCP would need the agent to pass 30 MB through its tool arguments.
- **Call: no MCP library.** The MCP's stdio protocol (`initialize`, `tools/list`, `tools/call`) is small enough to write in the package (about 150 lines), so a published package that holds a maker's key pulls in nothing it doesn't need. If the plan audit finds the protocol needs more than that, the plan names `@modelcontextprotocol/sdk` and its exact version, and it goes to the owner as a new dependency before the build uses it.
- **Call: the API calls the services, never the screens.** Each endpoint is a thin route under `src/routes/api/v1/` that reads the key, then calls the same `gamesServices()` and `pagesServices()` functions the browser's form actions call. A rule that today lives only in a form action (section 5.3) moves into the service, or into one shared helper both call, in the same pull request, so the two can never say different things.
- **Where the package lives:** `packages/ruken/` in this repo. `pnpm-workspace.yaml` exists today and says "One app, no workspaces"; PR 1 edits it to add `packages: [".", "packages/*"]` and changes its comment. Its version and its name follow decision D2.
- **Plain JavaScript, no build step (audit 1, R6).** Node refuses to strip types from files under `node_modules`, which is where `npx` puts a package, so the package is written in JavaScript (ES modules, JSDoc types checked through `// @ts-check`; PR 1 adds `packages/ruken/**/*.js` to `tsconfig.json`'s `include` so `pnpm typecheck` covers it, audit 2, R2-5). `engines.node` is `>=22`: Node 20 reached end of life on 2026-04-30, so 22 is the oldest line still supported on 2026-11-22 (audit 2, N2-1). A test packs it (`pnpm pack`), installs the tarball in a temp folder outside the repo, and runs `npx ruken --help` there (A16). It is a unit test, `tests/packages/ruken-pack.test.ts`, run by `pnpm test` (audit 2, N2-5).
- **One file per command group (audit 1, R7; audit 2, R2-3).** `packages/ruken/commands/{account,games,github,page}.js`, words in `packages/ruken/words/{account,games,github,page}.js`, the parity rows in `packages/ruken/parity/{account,games,github,page}.json`, the command prefix (`npx ruken`, or the D2 alternative) in one place, `words/prefix.js`, so the help guide, the MCP line and every message change together.

## 3. Parity: every maker action, and its command

Every action in the browser's maker screens today (`src/routes/make/**`, inventoried at `16dee78`) has a command, an MCP tool, and an endpoint. "Game" is the game's address word (its slug, as in `ruken.io/make/floor-fifty`).

### 3.1 Signing in

| In the browser | Command | MCP tool | Endpoint |
|---|---|---|---|
| (new) let a computer act for you | `ruken sign-in` | none: the maker signs in from the terminal once | `POST /api/v1/sign-in/start`, `POST /api/v1/sign-in/finish` |
| (new) see who you are | `ruken whoami` | `whoami` | `GET /api/v1/me` |
| (new) stop this computer acting for you | `ruken sign-out` | none | `DELETE /api/v1/me/key` |

### 3.2 Games

| In the browser | Command | MCP tool | Endpoint |
|---|---|---|---|
| Your games list (`/make`) | `ruken games` | `list_games` | `GET /api/v1/games` |
| Start a game (`/make/new`) | `ruken new "<name>"` | `start_game` | `POST /api/v1/games` |
| A game's screen: state, what is left, what was sent back, what waits for review, decision day words (`/make/[game]`) | `ruken game <game>` | `show_game` | `GET /api/v1/games/<game>` |
| Answer name, one line, age, 18+ marks, other websites (`/make/[game]/[question]`, `answer`) | `ruken set <game> name\|line\|age\|marks\|websites <value>`; to make a game 18+ with its marks in one go, as the browser's `/make/<game>/marks?age=18` does: `ruken set <game> age 18 --marks gore,drugs` (audit 2, R2-4) | `set_answer` (takes `age` and `marks` together) | `PATCH /api/v1/games/<game>` (`age` and `marks` in one body) |
| Files: GitHub repository, branch, folder (`files` question) | `ruken files <game> <owner/repo> [--branch b] [--folder f]` | `set_files` | `PATCH /api/v1/games/<game>` (`files`) |
| Upright and wide video (`clip`) | `ruken video <game> upright\|wide <file>` | `send_video` | `PUT /api/v1/games/<game>/videos/<upright\|wide>` |
| Keep the old one (`keepOld`) | `ruken keep-old <game> upright\|wide\|age` | `keep_old` | `DELETE /api/v1/games/<game>/waiting/<part>` |
| The maker agreement (`/make/[game]/agreement`) | `ruken agree <game>`: prints the agreement in full, then asks the maker to type `yes` | none: see 5.4 | `POST /api/v1/agreement` |
| Check and send, and send again (`check`, `send`, `sendAgain`) | `ruken send <game>` | `send_for_review` | `POST /api/v1/games/<game>/send` |
| Send a new version of a live game (`newVersion`) | `ruken update <game>` | `send_new_version` | `POST /api/v1/games/<game>/new-version` |
| Show the player count on or off (`playerCount`) | `ruken player-count <game> on\|off` | `set_player_count` | `PATCH /api/v1/games/<game>` (`playerCount`) |
| Take a game off Ruken (`take-off`) | `ruken take-off <game>` (asks to type the game's name) | `take_off` (needs `confirm: "<game>"`) | `POST /api/v1/games/<game>/take-off` |
| Put it back (`putBack`) | `ruken put-back <game>` | `put_back` | `POST /api/v1/games/<game>/put-back` |
| Delete the files a taken-off game left (`deleteLeft`) | `ruken delete-files <game>` (asks to type the name) | `delete_left_files` (needs `confirm`) | `DELETE /api/v1/games/<game>/files` |
| Throw a game away (`throwAway`) | `ruken throw-away <game>` (asks to type the name) | none (D3: only the person, in the terminal) | `DELETE /api/v1/games/<game>` |

**Call:** the "seen" press on the accepted screen is not carried over. It only closes a screen that the command line never shows.

### 3.3 GitHub

| In the browser | Command | MCP tool | Endpoint |
|---|---|---|---|
| Is GitHub connected | `ruken github` | `github_status` | `GET /api/v1/github` |
| Connect GitHub, choose it on GitHub (`/make/github`) | `ruken github connect`: opens the browser at `ruken.io/make/github` and waits until it is connected | `github_status` answers the link to open | (browser only: GitHub's own sign-in needs a browser) |
| Your repositories and their branches (`/make/github/branches`) | `ruken repos`, `ruken branches <owner/repo>` | `list_repos`, `list_branches` | `GET /api/v1/github/repos`, `GET /api/v1/github/repos/<owner>/<repo>/branches` |

### 3.4 Your page

| In the browser | Command | MCP tool | Endpoint |
|---|---|---|---|
| See your page (`/make/page`) | `ruken page` | `show_page` | `GET /api/v1/page` |
| Make your page, change its address, name, one line (`make`, rooms) | `ruken page set address\|name\|line <value>` | `set_page` | `PUT /api/v1/page` (makes it the first time), `PATCH /api/v1/page` |
| Its colours (theme room) | `ruken page colours` lists them, `ruken page set colours <number>` | `set_page` | `PATCH /api/v1/page` (`theme`) |
| Your photo (`answer` with a photo, `removePhoto`) | `ruken page photo <file>`, `ruken page photo --remove` | `set_photo`, `remove_photo` | `PUT /api/v1/page/photo`, `DELETE /api/v1/page/photo` |
| Links: list, add, change words, change where it goes, hide, move up and down, remove (`/make/page/links/**`) | `ruken links`, `ruken links add "<title>" <url>`, `ruken links set <n> title\|url <value>`, `ruken links hide\|show\|up\|down\|remove <n>` | `list_links`, `add_link`, `change_link`, `remove_link` | `GET`/`POST /api/v1/page/links`, `PATCH`/`DELETE /api/v1/page/links/<id>` |
| Take your page down (`take-down`) | `ruken page take-down` (asks to type the address) | none (D3: only the person, in the terminal) | `DELETE /api/v1/page` |

### 3.5 Not carried over

- **Call:** the account screens (`/me`: membership and its payment portal, change password, delete my account) stay browser only. They are not maker work, and a key that can change a password or delete an account turns a lost laptop into a lost account. The command line says where to go: `ruken account` prints `ruken.io/me`.
- **Call:** staff commands (`/jobs/*`) are not part of this. They keep their own secret.

**A check that fails by itself (criterion A1):** a test lists every named form action and every `+server.ts` handler under `src/routes/make/` and fails if one is in neither a row of `packages/ruken/parity/*.json` nor the "not carried over" list (`packages/ruken/parity/not-carried.json`, written by PR 1). A new maker screen added later without a command fails that test. The rows live in four files, `packages/ruken/parity/{account,games,github,page}.json` (audit 2, R2-3). PR 1 writes all four with every row of section 3, each row `"built": false` except its own; PR 2 sets its rows built in `games.json` and `github.json` only, PR 3 in `page.json` only, so the two never touch the same file. A1 passes when every action is in some row, every built row has its command and its endpoint (a browser-only row such as `github connect` says `"endpoint": null, "browserOnly": true`, and A1 then checks only the command, audit 3, N3-3), and, only once `packages/ruken/mcp.js` exists (PR 4), every built row also has its MCP tool. So every pull request is green on its own (audit 1, R7).

## 4. Signing a computer in

### 4.1 What the maker sees (owner's decision D1)

1. In the terminal: `npx ruken sign-in`. It prints, in plain words:
   `Open ruken.io/link and press Yes. Your code is KBTR-WMPQ.` and opens that page in the browser for them, with the code already in it (`ruken.io/link?code=KBTR-WMPQ`).
2. In the browser, signed in as usual (sign in first if not): one screen, **"Let this computer use your Ruken?"**, the code in big letters, one big **Yes** button and a plain **No** link. Above the button, facts a stranger cannot choose (audit 1, R1): **where it was asked from and when**, from the city and country of the `start` request ("Asked from Lisbon, Portugal, 40 seconds ago"; where this comes from in code is 4.5), and the name the computer gives itself, labelled as such ("It calls itself: Dana's MacBook"). The page says: "Only press Yes if you just typed `npx ruken sign-in` yourself."
   - When the place of the `start` request and the place of this browser's request differ (city or country, both from `placeOf`, 4.5), a warning sits above the button in the warning colour: "This was asked from Lisbon, Portugal. You're in Chicago, United States. If you didn't just type `npx ruken sign-in`, press No." Yes stays, since a maker on a VPN or a second network is real; No is then shown as the bigger button.
   - The code is prefilled from the address (D1); without one, the screen asks for it, and Yes works only on a code within 10 minutes of its `start`.
3. The terminal says `Signed in as @<handle>. You can close the browser.` and stores the key.

### 4.2 Your computers (browser)

A new screen, **Your computers**, linked from the account page (`/me`): at most 20 computers per maker (a 21st Yes says "You have 20 computers. Remove one first."); one row per computer (its name, when it was let in, when it was last used), each with **Rename** and **Remove**. Remove takes effect on the next request that computer makes. With none, it says "No computers can use your Ruken." and how to add one (`npx ruken sign-in`).

### 4.3 The key

- A random 32-byte key, written `rk_` plus base32, shown to the terminal once and stored on the server only as its SHA-256. The terminal keeps it in `~/.config/ruken/key` (Windows: `%APPDATA%\ruken\key`) with owner-only permissions; `RUKEN_KEY` in the environment wins over the file, for CI.
- A sign-in code: 8 letters from an alphabet with no look-alikes, good for 10 minutes and for one Yes. `start` also returns a random device secret, kept only in the terminal; `finish` needs the code and that secret (stored as `deviceSecretHash`), so knowing the code alone never collects the key (audit 1, N5).
- **Limits (audit 1, R4), all with the existing `createRateLimiter` (`src/lib/server/rate-limit.ts`, `api:` keys; its rows are kept 24 hours, longer than any window here), so no new table:** `start` at most 10 an hour per address; `finish` at most once every 5 seconds per code (faster gets "slow down"); a typed code that is wrong 5 times from one address refused for 10 minutes; Yes at most 20 an hour per maker.
- **Call:** a key stops working when the maker removes it, signs out on that computer, changes their password (`changePassword`, `credentials.ts`), resets it by text (the reset in `auth.ts`, which already ends sessions; the key delete goes inside its own try/catch in `onPasswordReset`, since a throw there would stop better-auth signing devices out, and a test makes the key delete fail and checks sessions still end, audit 2, N2-2), asks to delete their account (`requestDeletion`, `deletion.ts`: keys are deleted at once, as sessions end), or has not used it for 90 days (audit 1, R2, R3).
- **A key follows the account as a session does (audit 1, R2).** On every request a key gives a `user` caller only when the account's status is `active`, the same test `handle.ts` makes for a session; a key on a `pending_deletion` account answers 401. Using a key is not a sign-in: it never calls `restoreOnSignIn`, so a key cannot undo a deletion.
- **Call:** the sign-in pause (`sign-in-pause-plugin.ts`) does **not** touch keys. It is per phone number and started by anyone's wrong guesses, so tying keys to it would let a stranger switch off a maker's computers (audit 1, R3).
- **Call:** a key can do the maker actions in section 3 and nothing else. `/api/v1/*` is the only place a key is read, and there it is the only thing read: `/api/v1` ignores the session cookie, so a browser tab can never act through it. Every other route ignores the `Authorization` header as it does today, so a key can never open `/me`, money or membership (audit 1, N8).
- No log line, error report or problem answer holds the `Authorization` header or a key; a test sends a key that fails and searches the captured log for it (audit 1, N6).
- `lastUsedAt` is written at most once an hour per key, not on every request (audit 1, N4).

### 4.4 The data (lane 3: migration)

One new table, `ComputerKey`: `id`, `userId` (cascade on account delete), `name` (up to 60 characters), `keyHash` (unique), `createdAt`, `lastUsedAt`, plus `ComputerSignIn` for the 10-minute codes: `code` (unique), `deviceSecretHash`, `name`, `startedFrom` (Cloudflare's city and country for `start`, as words), `userId` (null until Yes), `answer` (`yes`, `no` or null), `expiresAt`. Wrong tries are counted by the rate limiter, not here. Expired codes are deleted when read and when `start` runs (the 10 oldest expired each time), so `cloudflare/crons.js` is not touched (audit 1, N3). No change to any existing table.

### 4.5 Where a request comes from (audit 2, R2-1)

- One function answers it: `placeOf(request): { city: string | null; country: string | null }`, added to the existing `Platform` (`src/lib/server/platform.ts`) as a required member; PR 1 adds it to every existing test platform (`tests/lib/server/platform.test.ts`, `tests/lib/server/background.test.ts`, `tests/features/accounts/auth.pg.test.ts`), so `pnpm typecheck` stays green (audit 3, R3-2). The Cloudflare platform (`src/lib/server/cloudflare.ts`) fills it from `request.cf.city` and `request.cf.country`; the country code is turned into its name with `Intl.DisplayNames`. A place with no city says the country only; no place at all says "somewhere we can't tell", and the different-place warning is not shown on a null.
- **First step of PR 1:** prove that `event.request.cf.city` and `.country` reach this function on this adapter (`@sveltejs/adapter-cloudflare` through `cloudflare/worker.js`), by a temporary log line read with `wrangler dev`. If they do not arrive, stop and report to the coordinator: reading them in `cloudflare/worker.js` is a lane 3 path this plan does not own.
- **How it is checked:** the warning case is a server test of the `/link` load and its Yes action (`tests/routes/link.pg.test.ts`, run by `pnpm test:pg`, audit 3, R3-2), with a test platform whose `placeOf` answers what each test sets: same place (no warning), different city, different country, no place. The browser journey (A2) runs on `wrangler dev`, which gives every request the same place, so it covers the same-place screen. Nothing in production reads a test value.

## 5. Rules that must hold server-side

### 5.1 Every endpoint

- Answers `401 {"problem":"Sign in again: npx ruken sign-in"}` without a working key, and `404` for a game, link or page the key's maker does not own (never `403`: it does not say the thing exists).
- Calls the same service function the browser's action calls, inside the same rules. Every problem comes back as `{"problem": "<the same words the screen shows>"}` with the same 4xx status family.
- HTTPS only. Under the same condition as today's redirect (the site's own address is https, `https-only.ts`), and inside `httpsOnly` before its redirect, `/api/v1` answers a plain-HTTP request with `400 {"problem":"Use https://ruken.io."}` and no redirect (audit 2, R2-2). It answers 400, not a redirect, since the key has already crossed the wire and a redirect invites it again. The journeys' site is `http://localhost:4173`, so there it does nothing, as the redirect does nothing (audit 3, N3-2). `https-only.ts` keeps redirecting every other route. The CLI refuses any Ruken address that is not `https://`, except `http://localhost` for tests (audit 1, R9).
- At most 120 requests a minute and 30 uploads an hour **per maker**, counted across all their keys (audit 1, R4); over that, `429` with "Wait a minute and try again."

### 5.2 Uploads

- A video is the raw file as the request body, with its `Content-Type`; refused before the body is read when `Content-Length` is over the clip limit (30 MB, `CLIP_MAX_BYTES`), as the `clip` action does, and with `411 {"problem":"Send the video again."}` when there is no `Content-Length` at all (audit 1, R4). The body is then read once with `arrayBuffer()`, as the browser path does, within the Worker's 128 MB (audit 1, N7). `clipProblem` then checks type, size and first bytes. The photo upload does the same with `photoProblem`.
- The CLI and the MCP check a file's extension (`.mp4`, `.webm`, `.mov`; for a photo the extensions `photoProblem` takes) and its size before reading it, and never print a file's contents in a message (audit 1, N2).
- A live game's new video is held for review (`saveHeldClip`), exactly as from the browser; players keep the old one until it is accepted.

### 5.3 Rules that live in form actions today, and their new homes (audit 1, R5)

Each moves into the games or pages service (or a helper both the form action and the endpoint call). The form action then calls the same thing, and its existing journeys stay green unchanged.

| Rule, where it is today | New home | PR |
|---|---|---|
| Ownership: `own-game.server.ts`, `own-page.server.ts` (404 for anyone else's) | `ownGame(slug, userId)` in the games service (it exists: `service.ts` `ownGame`, by id; a by-slug wrapper added) and `pageOf` in the pages service; one `ownGameOr404` helper in `src/features/games/` both callers use | 1 |
| A video only for `upright` or `wide`, and only in a state where the game is asked it (`askedQuestion`, `[question]/+page.server.ts`) | `saveClip` refuses a shape the game's state does not ask, with the screen's words | 1 |
| The body-size refusal before reading (`CLIP_REQUEST_MAX_BYTES`, same file) | one `bodyTooBig(request, max)` helper in `src/lib/server/`, used by the `clip` action, the video endpoint and the photo endpoint; a missing `Content-Length` counts as too big on the API (the form action keeps today's behaviour) | 1 |
| `keepOld` only for a live game, and which part (`[question]/+page.server.ts:437-447`) | `keepTheOldOne` refuses a game that is not live, and a part that is not `upright_video`, `wide_video` or `age_rating` | 1 |
| The agreement before send: `hasAgreed` (`src/features/make/agreement.ts`), checked in `check/+page.server.ts:25` and `send` | Not in the games service: `make` sits above `games` (`tests/architecture.test.ts`), and `sendForReview` is also run by `putBack` and a live game's saved change, which do not ask for the agreement today (audit 3, R3-1). One helper, `sendWhenAgreed(gameId, userId)` in `src/features/make/send.ts`, exported from `make.ts`, checks `hasAgreed` and refuses with "You need to agree to Ruken's maker agreement first.", then calls `sendForReview`. The check screen's `send` and `sendAgain` actions and the `send` and `new-version` endpoints call it. `put-back` and a live game's saved change stay as they are in the browser: no agreement check | 2 |
| Every question answered before send (`firstUnanswered`, `check/+page.server.ts`) | `sendForReview` already refuses with "Answer every question first." (`service.ts:493`); the words stay, and the API adds the first open question's name in a `question` field | 2 |
| `liveSend` (`make/[game]/+page.server.ts`): whether a live game offers a new version, a send again, or nothing | a `liveSendOf(game)` helper in `src/features/games/`, read by the screen and by `send` and `new-version` endpoints | 2 |
| `isBeingMadeEighteen` (`[question]/+page.server.ts`): marks asked before a past-draft game becomes 18+ | `saveAnswer` refuses an 18+ age on a past-draft game without marks in the same answer, with the screen's words; the CLI's `--marks` and the API's one body carry both (3.2) | 2 |
| `playerCount`, `putBack`, `deleteLeft` (`make/[game]/+page.server.ts`), `take-off`, `throw-away` (`throw-away/+page.server.ts:11`) state checks | the service functions (`setShowsPlayerCount`, `putBack`, `deleteLeftFiles`, `takeOff`, `throwAway`) refuse a state the screen would not offer | 2 |
| A page's rooms, link edits and take-down (`make/page/**`) | already in the pages service (`savePage`, `saveTheme`, `addLink`, `updateLink`, `moveLinkOf`, `setHidden`, `removeLink`, `savePhoto`, `removePhoto`, `removePage`); PR 3 checks each action for any other route-only rule and adds a row here if it finds one | 3 |

### 5.4 What an agent may not do alone

- **Call:** an AI agent cannot accept the maker agreement. The MCP has no tool for it; when the agreement is what blocks sending, `send_for_review` answers "You need to agree to Ruken's maker agreement first. Run `npx ruken agree <game>` in your terminal, or open ruken.io/make/<game>/agreement." A person reads and agrees.
- **Call:** the MCP tools that are hard to undo (take off, delete the files left) need `confirm` set to the game's address word, and the tool description says to ask the person first. The command line asks the person to type it.
- **D3, decided. Owner, 2026-11-22 14:10 UTC, on a card: "No, only the person (terminal)".** `confirm` is not a person's check, since an agent knows the address word and a prompt hidden in a repository could supply it (audit 1, N1). So **throw away** and **take the page down**, which cannot be undone, have no MCP tool; when asked, the MCP's `show_game` and `show_page` answers say the terminal command for the person to run, as for the agreement.
- Sending for review never accepts. Review stays staff's (`/jobs/review` and later slice 4).

## 6. Words (the drunk-grandma test)

- Every command prints one or two plain sentences and, when something is next, the exact command to type: `Sent. Floor Fifty's new upright video waits for review. See it with: npx ruken game floor-fifty`.
- `npx ruken` with nothing after it prints the ten most used commands, one line each, and `npx ruken help <command>` the rest. No jargon: "video", not "clip"; "address", not "slug"; "send for review", not "submit".
- Every wait shows it (the `this-repo` rule): an upload prints a progress line that moves; `sign-in` prints "Waiting for you to press Yes..." with a spinner.
- New help guide `ruken.io/help/use-ruken-from-your-computer`, on the `/help` list: sign in, send a video, the MCP line to paste into an editor (`{"command":"npx","args":["-y","ruken","mcp"]}`), and Your computers. The AI-helper prompt in `get-your-game-on-ruken/agent-prompt.ts` gains one line: if the maker has the Ruken MCP, use it to send the game.

## 7. Acceptance criteria

Each is observed by a program unless it says otherwise. "The CLI" is `node packages/ruken/bin.js`, run by the Playwright journeys against the test server, so the journeys use it like a person does.

1. **A1 parity:** the parity test at the end of section 3 passes, and fails when an action is added under `src/routes/make/` with no entry.
2. **A2 sign-in:** a journey runs `sign-in`, presses Yes in the browser as the same maker, and `whoami` prints their handle. Pressing No, a code older than 10 minutes, a code already used, and `finish` with the right code but the wrong device secret each leave the CLI saying so and holding no key. The code entered 5 times wrong is refused. A code started from another place (the test sets Cloudflare's city and country for `start` and for the browser differently) shows the warning above Yes, with No as the bigger button.
3. **A3 your computers, CRUD:** the journey sees the computer on Your computers (read), renames it (update), removes it (delete), and the CLI's next command then answers "Sign in again". Sign-in is the create. A second computer signs in, runs `sign-out`, and then `whoami` answers "Sign in again" and that computer is gone from Your computers (audit 2, R2-4).
4. **A4 keys only reach section 3:** with a valid key in `Authorization`, `/me`, `/me/password`, `/me/delete`, `/join`, the Stripe webhook and every `/jobs/*` answer exactly as they do with no header. A removed key, an expired key (its `createdAt` and `lastUsedAt` moved back 91 days in the database, since the journeys cannot move the site's clock, audit 2, N2-3), a key after a password change, a key after a password reset by text, and a key after Delete my account (the account is `pending_deletion`) each get 401 from every `/api/v1` route, and that 401 does not restore the account. A sign-in pause on the maker's number leaves their key working. `/api/v1` with a session cookie and no key gets 401. A key that fails is not in the captured log. The plain-HTTP case is in `httpsOnly`'s own unit test (`tests/features/accounts/https-only.test.ts`), with an https site address as its redirect test has: `/api/v1` over plain HTTP gets 400 with no `Location`, and every other route still gets the redirect (audit 2, R2-2).
5. **A5 no one else's things:** maker B's key gets 404 from every `/api/v1/games/<A's game>/*`, `/api/v1/page/links/<A's link>` route, for every method, and A's game is unchanged after.
6. **A6 games CRUD through the CLI (audit 1, R8: every row of 3.2 and 3.3 is a step that reads its effect back with `game <game>` and in the browser):**
   1. `github` (not connected, prints the connect line); `github connect` with the browser opener stubbed to the journey's own page, which then connects GitHub the way the existing journeys do, and the command's wait ends with "Connected" (audit 2, N2-6); `github` (connected); `repos`; `branches <repo>`.
   2. `games` (the list, without the new game), `new`, `games` (the list holds it), then `set name`, `set line`, `files` (with branch and folder), `video upright`, `video wide`, `set age 12`, `set websites`.
   3. `send` before agreeing: refused with the agreement words. `agree` (typing `yes`), then `send`. Staff send the files back by the existing review command; `send` again after `files` is fixed (send again).
   4. Staff accept; the game is live on the feed and its page (read).
   5. `player-count <game> on`, then `off`: the count shows, then not, on the game's page.
   6. `video <game> upright` (update): waits for review, players still see the old one; `keep-old <game> upright`: players' video unchanged, nothing waits. `set age 16` on the live game waits; `keep-old <game> age`: the old rating stays. `files` change on the live game, then `update <game>` (new version): waits for review.
   7. `take-off` (leaves the feed), `put-back` (returns), `take-off` again, `delete-files` (the files screen says they are gone), and `throw-away` on a second game (delete); `games` no longer lists it.
7. **A7 18+:** a game whose age is set to 18+ through the CLI asks "marks"; sending without marks is refused with the browser's words; once live, a signed-out browser gets the adults-only screen for it, as for a game made in the browser. A second, live 12+ game: `set <game> age 18` alone is refused with "Choose its 18+ marks too: npx ruken set <game> age 18 --marks <marks>" (in `words/games.js`; the browser sends the maker on to the marks question instead, audit 3, N3-1); `set <game> age 18 --marks gore` is held for review like the browser's change (audit 2, R2-4).
8. **A8 page CRUD through the CLI (audit 1, R8):** a journey makes the page (`page set address`), sets its name and line, lists `page colours` and sets one, sets the photo, adds two links, sets one's title and url, moves it `up` and `down`, `hide`s and `show`s it, removes one, removes the photo, changes the address with `page set address` (the old address shows the missing page, the new one the page), and reads each change back on `ruken.io/<handle>` in the browser; then takes the page down and the address shows the missing page.
9. **A9 uploads:** a 31 MB file, a `.txt` renamed `.mp4`, and a GIF each get the browser's own refusal words, and nothing is stored (the bucket's key count is unchanged).
10. **A10 MCP:** a test drives `bin.js mcp` over stdio with `initialize`, `tools/list` and one `tools/call` per tool, each against state prepared so the call succeeds, and reads its effect back through the API (audit 1, R8); each tool's result matches its command's. The tools in 5.4 refuse without `confirm`; no tool accepts the agreement, throws a game away or takes a page down (D3).
11. **A11 limits:** the 121st request in a minute and the 31st upload in an hour get 429 with the plain words, also when spread over two keys of one maker; the 11th `start` in an hour from one address gets 429; a video `PUT` with no `Content-Length` gets 411 and nothing is stored; the 21st computer is refused.
12. **A12 words:** every message the CLI prints is in `packages/ruken/words/`, and a test fails on any of the words "slug", "clip", "submit", "token", "API", "endpoint", "auth" in it. A fresh reviewer reads `npx ruken` and `npx ruken help` output and the two new screens against the drunk-grandma test (a person's check, recorded in the audit).
13. **A13 screens:** the Yes screen and Your computers pass the visual check (`visual-check`) on the three device profiles, keyboard alone included.
14. **A14 Floor Fifty (the owner's ask, by the owner):** after pull request 1 is deployed, the owner sends the two new Floor Fifty videos with two commands, and `npx ruken game floor-fifty` says both wait for review. Run by the owner, since it uses the owner's account and files.
15. **A15 checks:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (with the pack test, A16), `pnpm test:pg`, `pnpm test:browser` and `pnpm build` exit 0 on each pull request's head, and CI is green.
16. **A16 the package runs from npm's place (audit 1, R6):** the pack test in section 2 passes: `pnpm pack`, install in a temp folder outside the repo, `npx ruken --help` exits 0 and prints the help.

## 8. Plan: four pull requests

Each row is a unit. Units in one pull request run in this order on its branch. Pull requests 2 and 3 share no files (PR 1 lays out one file per command group and one parity file per group that already holds every row, so PR 2 fills only games and GitHub files and PR 3 only page files; their journeys are separate files under `tests/browser/`) and run side by side once pull request 1 is on `main`; pull request 4 waits on 2 and 3 because it wraps their commands.

| PR | Unit | Lane | Waits on | Owns | Output | Check |
|---|---|---|---|---|---|---|
| 1 | Keys and sign-in | 3 | spec merged | `prisma/schema/`, `prisma/migrations/`, `src/features/accounts/computer-keys.ts`, `handle.ts` (the key read under `/api/v1`, the cookie ignored there), `https-only.ts`, `credentials.ts`, `auth.ts`, `deletion.ts` (keys removed), `src/hooks.server.ts` (if the key read needs it), `src/lib/server/platform.ts`, `cloudflare.ts` (`placeOf`), `src/routes/link/`, `src/routes/me/computers/`, `src/routes/me/+page.svelte` (the link), `src/routes/api/v1/sign-in/`, `src/routes/api/v1/me/`, `tests/browser/` (new journeys), `tests/routes/link.pg.test.ts`, `tests/features/accounts/https-only.test.ts`, `tests/features/accounts/computer-keys.pg.test.ts`, `tests/features/accounts/auth.pg.test.ts` (the reset test, N2-2, and its test platforms), `tests/lib/server/platform.test.ts`, `tests/lib/server/background.test.ts` (their test platforms gain `placeOf`), `src/features/accounts/accounts.ts` (the entry file exports the key services) | sign-in and Your computers | A2, A3, A4, A11 |
| 1 | Videos first | 3 | the unit above | `src/routes/api/v1/games/` (list, show, videos, waiting), `src/features/games/` (the PR 1 rows of 5.3), `src/routes/make/own-game.server.ts`, `src/routes/make/[game]/[question=question]/+page.server.ts` (the form actions call the moved rules), `src/lib/server/body-size.ts`, `packages/ruken/` (the layout, all four `parity/*.json` with every row and `parity/not-carried.json`, `commands/account.js`, the PR 1 part of `commands/games.js` and `words/`), `pnpm-workspace.yaml`, `pnpm-lock.yaml` (the new workspace importer, so `--frozen-lockfile` passes), `tsconfig.json` (`include`), `tests/packages/` (A1, A16), `tests/browser/` (new journeys) | the owner can send Floor Fifty's videos | A5 (games read), A9, A14, A16 |
| 2 | Games, the rest | 2 | PR 1 | the rest of `src/routes/api/v1/games/`, `src/routes/api/v1/github/`, `src/routes/api/v1/agreement/`, the PR 2 rows of 5.3 in `src/features/games/`, `src/features/make/send.ts` (`sendWhenAgreed`) and `src/features/make/make.ts` (its export), the form actions that call them (`src/routes/make/[game]/+page.server.ts`, `check/`, `take-off/`, `throw-away/`, `[question=question]/+page.server.ts`), `commands/games.js`, `commands/github.js`, `words/games.js`, `words/github.js`, `parity/games.json`, `parity/github.json`, `tests/browser/` (A6, A7 journeys) | every row of 3.2 and 3.3 | A1 (rows up to 2), A5, A6, A7 |
| 3 | Your page | 2 | PR 1 | `src/routes/api/v1/page/`, `src/features/pages/` (PR 3 rows of 5.3), `src/routes/make/page/**` (only if its check finds a route-only rule), `commands/page.js`, `words/page.js`, `parity/page.json`, `tests/browser/` (A8 journey) | every row of 3.4 | A1 (rows up to 3), A5, A8 |
| 4 | MCP and the guide | 2 | PRs 2, 3 | `packages/ruken/mcp.js`, `packages/ruken/bin.js` (the `mcp` command), `parity/*.json` (tool names; PRs 2 and 3 are merged by then), `src/routes/help/use-ruken-from-your-computer/`, `src/routes/help/+page.svelte` (the list), `src/routes/help/get-your-game-on-ruken/agent-prompt.ts`, `tests/packages/` (A10, A12) | `npx ruken mcp`, the help guide | A1 full, A10, A12, A13 |

The implementer ticks each step below on its branch and the coordinator copies the percentage into `progress.md`.

### Pull request 1
- [ ] Live-state file `docs/superpowers/live/<branch>.md` written.
- [ ] First: prove `request.cf.city` and `.country` reach `placeOf` on this adapter (4.5); stop and report if not.
- [ ] Failing checks first: A2, A3, A4, A9 and the CLI part of A14 (against the test server), the `/link` place tests, written and red.
- [ ] `ComputerKey` and `ComputerSignIn` (with `startedFrom`) in the schema; migration generated by `prisma migrate dev`, never written by hand.
- [ ] `computer-keys.ts`: make a code (with device secret and `startedFrom`), say Yes or No, finish (code plus device secret), read a key (hash, 90-day expiry, account `active`, `lastUsedAt` at most hourly), remove, rename, the 20-computer limit; keys removed in `changePassword`, in the reset by text, and in `requestDeletion`.
- [ ] `/link` Yes screen (where and when it was asked, the name it calls itself, the different-place warning) and `/me/computers` (list, rename, remove), each wait showing it; link from `/me`.
- [ ] `/api/v1/sign-in/*`, `/api/v1/me`, `DELETE /api/v1/me/key`; the key read only under `/api/v1`, the cookie ignored there, plain HTTP answered 400 there, no key in any log.
- [ ] The PR 1 rows of 5.3 moved, the form actions calling the same code, their journeys unchanged and green.
- [ ] `GET /api/v1/games`, `GET /api/v1/games/<game>`, `PUT .../videos/<shape>`, `DELETE .../waiting/<part>`.
- [ ] Limits per maker and on `start` with `createRateLimiter`; 411 for no `Content-Length` (A11).
- [ ] `packages/ruken/` in JavaScript: `bin.js`, the per-group layout, `words/prefix.js`, the four `parity/*.json` with every row, the PR 1 commands; the HTTPS-only address check; the extension and size check before reading a file; `pnpm-workspace.yaml`, `pnpm-lock.yaml` and `tsconfig.json` edited; the pack test (A16).
- [ ] All A-checks for this PR green locally; visual check of the two screens; live-state file deleted; handed to the implementation audit by commit.

### Pull request 2
- [ ] Live-state file; failing journeys A6, A7 and A5 for every new route.
- [ ] `sendWhenAgreed` in `src/features/make/send.ts`, called by the check screen's `send` and `sendAgain` and by the `send` and `new-version` endpoints; `put-back` and live saves unchanged (audit 3, R3-1).
- [ ] The other PR 2 rows of 5.3 moved into the games service or their helper, the form actions calling the same thing (their existing journeys stay green unchanged).
- [ ] Endpoints and commands for every row of 3.2 and 3.3, their rows in `parity/games.json` and `parity/github.json` set built.
- [ ] Green; live-state file deleted; handed to the audit.

### Pull request 3
- [ ] Live-state file; failing journeys A8 and A5 for the page routes.
- [ ] PR 3 rows of 5.3 checked; endpoints and commands for every row of 3.4, their rows in `parity/page.json` set built.
- [ ] Green; live-state file deleted; handed to the audit.

### Pull request 4
- [ ] Live-state file; failing A10 and A12.
- [ ] `mcp.js` over stdio; tools mapped to commands; the 5.4 refusals; no tool for throw away or take the page down (D3).
- [ ] The help guide and its line on `/help`; the agent-prompt line.
- [ ] Words review and visual check (A12, A13); green; live-state file deleted; handed to the audit.

### After pull request 1 merges (outside the repo, needs the owner)
- The owner deploys (`pnpm run deploy`, which runs the migration).
- Publishing (audit 1, R9). Under D2 option A, the first publishes are by hand from the owner's computer, which needs no secret: `npm login` once, then `pnpm --filter ruken publish --access public`. Publishing from CI (npm's trusted publishing from GitHub Actions, so no npm token is saved) would change `.github/workflows/`, a rule path the rule-mix hook keeps apart, so it would be its own lane 3 pull request, and it is not part of this spec. Until the first publish, the owner runs it from a checkout: `node packages/ruken/bin.js video floor-fifty upright <file>`.

## 9. Decisions for the owner

- **D1: How a computer signs in. Decided. Owner, 2026-11-22 13:55 UTC, on a card: "Press Yes on Ruken".** It was recommended: **press Yes on Ruken** (4.1): nothing to copy, and a key never passes through the maker's clipboard or chat with an agent. Other option: a **"Make a key"** button on Your computers that shows a key once to paste into the terminal (simpler to build by about a screen, but makers copy secrets into config files and agent chats).
- **D2: The package name and who publishes it.** Recommended: **`ruken` on npm** (free on 2026-11-22: `registry.npmjs.org/ruken` answers 404), published by hand from the owner's npm account (section 8); makers type `npx ruken`. That needs the owner's npm account (new access) with two-step sign-in on. Other option: no npm; ruken.io serves the package file and makers type `npx https://ruken.io/ruken.tgz` (no new account, longer to type). With that option the name `ruken` stays free on npm for anyone to take, and makers or agents who type `npx ruken` from habit would run a stranger's code beside their key, so the owner should still reserve the name, which needs the npm account anyway (audit 1).
- **D3: Can an AI agent throw a game away or take a page down? Decided. Owner, 2026-11-22 14:10 UTC, on a card: "No, only the person (terminal)".** The MCP has no tool for those two (section 5.4).

## 10. Boundaries

- New: one npm package with no dependencies (pending D2), two tables, two screens, one help guide. No CI or workflow change. No new paid service, no new Cloudflare product, no spend.
- Not in this: hosted MCP, OAuth for agents, staff commands, account screens, anything from slices 3 to 5 that is not built yet. When a new maker screen ships later, A1 makes it bring its command.
- Expected duration (estimate): pull request 1 about half a day including its audits; all four about two days.

## 11. Answered by plan audit 1

- Per-key and per-maker limits reuse `createRateLimiter` (`src/lib/server/rate-limit.ts`); no counter table (R4).
- A 30 MB `PUT` is read once with `arrayBuffer()` after the length check, as the browser path is; no streaming (N7).
