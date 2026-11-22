# Ruken from your computer: a command line and an MCP for makers

Date: 2026-11-22. Status: **spec, waiting on its plan audit and one owner decision (D2, section 9).** Lane 3 overall: pull request 1 adds a migration and a new way to sign in. The other pull requests are lane 2.

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
- **Where the package lives:** `packages/ruken/` in this repo, a pnpm workspace package (`pnpm-workspace.yaml` is new). Its version and its name follow decision D2.

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
| Answer name, one line, age, 18+ marks, other websites (`/make/[game]/[question]`, `answer`) | `ruken set <game> name\|line\|age\|marks\|websites <value>` | `set_answer` | `PATCH /api/v1/games/<game>` |
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
| Throw a game away (`throwAway`) | `ruken throw-away <game>` (asks to type the name) | `throw_away` (needs `confirm`) | `DELETE /api/v1/games/<game>` |

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
| Take your page down (`take-down`) | `ruken page take-down` (asks to type the address) | `take_down_page` (needs `confirm`) | `DELETE /api/v1/page` |

### 3.5 Not carried over

- **Call:** the account screens (`/me`: membership and its payment portal, change password, delete my account) stay browser only. They are not maker work, and a key that can change a password or delete an account turns a lost laptop into a lost account. The command line says where to go: `ruken account` prints `ruken.io/me`.
- **Call:** staff commands (`/jobs/*`) are not part of this. They keep their own secret.

**A check that fails by itself (criterion A1):** a test lists every named form action and every `+server.ts` handler under `src/routes/make/` and fails if one is in neither the parity table in `packages/ruken/parity.json` nor its "not carried over" list. A new maker screen added later without a command fails that test.

## 4. Signing a computer in

### 4.1 What the maker sees (owner's decision D1)

1. In the terminal: `npx ruken sign-in`. It prints, in plain words:
   `Open ruken.io/link and press Yes. Your code is KBTR-WMPQ.` and opens that page in the browser for them, with the code already in it (`ruken.io/link?code=KBTR-WMPQ`).
2. In the browser, signed in as usual (sign in first if not): one screen, **"Let this computer use your Ruken?"**, the code in big letters, the computer's name, one big **Yes** button and a plain **No** link. The page says: "Only press Yes if you just typed `ruken sign-in` and the code matches."
3. The terminal says `Signed in as @<handle>. You can close the browser.` and stores the key.

### 4.2 Your computers (browser)

A new screen, **Your computers**, linked from the account page (`/me`): one row per computer (its name, when it was let in, when it was last used), each with **Rename** and **Remove**. Remove takes effect on the next request that computer makes. With none, it says "No computers can use your Ruken." and how to add one (`npx ruken sign-in`).

### 4.3 The key

- A random 32-byte key, written `rk_` plus base32, shown to the terminal once and stored on the server only as its SHA-256. The terminal keeps it in `~/.config/ruken/key` (Windows: `%APPDATA%\ruken\key`) with owner-only permissions; `RUKEN_KEY` in the environment wins over the file, for CI.
- A sign-in code: 8 letters from an alphabet with no look-alikes, good for 10 minutes and for one Yes. `finish` is polled by the terminal at most every 5 seconds; faster polling gets a "slow down" answer. A code that is wrong 5 times in a row from one address is refused for 10 minutes (the same counting the existing sign-in limits use, `auth-limits-plugin.ts`, or the plan names why it can't).
- **Call:** a key stops working when the maker removes it, signs out on that computer, changes their password, deletes their account, or has not used it for 90 days. A paused sign-in (`sign-in-pause-plugin.ts`) pauses keys too.
- **Call:** a key can do the maker actions in section 3 and nothing else. `/api/v1/*` is the only place a key is read; every other route ignores the `Authorization` header as it does today, so a key can never open `/me`, money or membership.

### 4.4 The data (lane 3: migration)

One new table, `ComputerKey`: `id`, `userId` (cascade on account delete), `name` (up to 60 characters), `keyHash` (unique), `createdAt`, `lastUsedAt`, plus `ComputerSignIn` for the 10-minute codes: `code` (unique), `deviceSecretHash`, `name`, `userId` (null until Yes), `expiresAt`, `tries`. Expired codes are deleted by the existing hourly job, or on read. No change to any existing table.

## 5. Rules that must hold server-side

### 5.1 Every endpoint

- Answers `401 {"problem":"Sign in again: npx ruken sign-in"}` without a working key, and `404` for a game, link or page the key's maker does not own (never `403`: it does not say the thing exists).
- Calls the same service function the browser's action calls, inside the same rules. Every problem comes back as `{"problem": "<the same words the screen shows>"}` with the same 4xx status family.
- HTTPS only, as the rest of the site (`https-only.ts`).
- At most 120 requests a minute per key, and 30 uploads an hour per key; over that, `429` with "Wait a minute and try again."

### 5.2 Uploads

- A video is the raw file as the request body, with its `Content-Type`; refused before the body is read when `Content-Length` is over the clip limit (30 MB, `CLIP_MAX_BYTES`), as the `clip` action does. `clipProblem` then checks type, size and first bytes. The photo upload does the same with `photoProblem`.
- A live game's new video is held for review (`saveHeldClip`), exactly as from the browser; players keep the old one until it is accepted.

### 5.3 Rules that live in form actions today, to move or share (the plan names each one's new home)

- Ownership (`own-game.server.ts`, `own-page.server.ts`).
- Which questions a game is asked in its state (`askedQuestion`), including that "marks" exists only for an 18+ game (`questionsFor`).
- `deleteLeft` only for a taken-off game; `newVersion`, `keepOld` only for a live one; `send` versus `sendAgain` by state.
- The body-size refusal before reading.
- Anything else the plan session finds by reading every action under `src/routes/make/` at the plan's commit.

### 5.4 What an agent may not do alone

- **Call:** an AI agent cannot accept the maker agreement. The MCP has no tool for it; when the agreement is what blocks sending, `send_for_review` answers "You need to agree to Ruken's maker agreement first. Run `npx ruken agree <game>` in your terminal, or open ruken.io/make/<game>/agreement." A person reads and agrees.
- **Call:** the MCP tools that cannot be undone (take off, delete the files left, throw away, take the page down) need `confirm` set to the game's address word (or the page's address), and the tool description says to ask the person first. The command line asks the person to type it.
- Sending for review never accepts. Review stays staff's (`/jobs/review` and later slice 4).

## 6. Words (the drunk-grandma test)

- Every command prints one or two plain sentences and, when something is next, the exact command to type: `Sent. Floor Fifty's new upright video waits for review. See it with: npx ruken game floor-fifty`.
- `npx ruken` with nothing after it prints the ten most used commands, one line each, and `npx ruken help <command>` the rest. No jargon: "video", not "clip"; "address", not "slug"; "send for review", not "submit".
- Every wait shows it (the `this-repo` rule): an upload prints a progress line that moves; `sign-in` prints "Waiting for you to press Yes..." with a spinner.
- New help guide `ruken.io/help/use-ruken-from-your-computer`, on the `/help` list: sign in, send a video, the MCP line to paste into an editor (`{"command":"npx","args":["-y","ruken","mcp"]}`), and Your computers. The AI-helper prompt in `get-your-game-on-ruken/agent-prompt.ts` gains one line: if the maker has the Ruken MCP, use it to send the game.

## 7. Acceptance criteria

Each is observed by a program unless it says otherwise. "The CLI" is `node packages/ruken/bin.js`, run by the Playwright journeys against the test server, so the journeys use it like a person does.

1. **A1 parity:** the parity test in section 3.5 passes, and fails when an action is added under `src/routes/make/` with no entry.
2. **A2 sign-in:** a journey runs `sign-in`, presses Yes in the browser as the same maker, and `whoami` prints their handle. Pressing No, a code older than 10 minutes, and a code already used each leave the CLI saying so and holding no key. The code entered 5 times wrong is refused.
3. **A3 your computers, CRUD:** the journey sees the computer on Your computers (read), renames it (update), removes it (delete), and the CLI's next command then answers "Sign in again". Sign-in is the create.
4. **A4 keys only reach section 3:** with a valid key in `Authorization`, `/me`, `/me/password`, `/me/delete`, `/join`, the Stripe webhook and every `/jobs/*` answer exactly as they do with no header. A removed key, an expired key (clock moved 91 days), and a key after a password change each get 401 from every `/api/v1` route.
5. **A5 no one else's things:** maker B's key gets 404 from every `/api/v1/games/<A's game>/*`, `/api/v1/page/links/<A's link>` route, for every method, and A's game is unchanged after.
6. **A6 games CRUD through the CLI:** a journey makes a game (`new`), answers every question including both videos and the files, agrees, sends it, staff accept it by the existing review command, and the game is then live on the feed and its page in the browser (read). It then sends a new upright video (update), which waits for review while players still see the old one; keeps the old one; takes the game off (it leaves the feed), puts it back, and throws a second game away (delete). Every step's state is read back with `game <game>` and in the browser.
7. **A7 18+:** a game whose age is set to 18+ through the CLI asks "marks"; sending without marks is refused with the browser's words; once live, a signed-out browser gets the adults-only screen for it, as for a game made in the browser.
8. **A8 page CRUD through the CLI:** a journey makes the page, sets its name, line, colours and photo, adds two links, renames one, moves it, hides it, removes one, removes the photo, and reads each change back on `ruken.io/<handle>` in the browser; then takes the page down and the address shows the missing page.
9. **A9 uploads:** a 31 MB file, a `.txt` renamed `.mp4`, and a GIF each get the browser's own refusal words, and nothing is stored (the bucket's key count is unchanged).
10. **A10 MCP:** a test drives `bin.js mcp` over stdio with `initialize`, `tools/list` and one `tools/call` per tool; each tool's result matches its command's. The tools in 5.4 refuse without `confirm`, and no tool accepts the agreement.
11. **A11 limits:** the 121st request in a minute and the 31st upload in an hour get 429 with the plain words.
12. **A12 words:** every message the CLI prints is in `packages/ruken/words.ts`, and a test fails on any of the words "slug", "clip", "submit", "token", "API", "endpoint", "auth" in it. A fresh reviewer reads `npx ruken` and `npx ruken help` output and the two new screens against the drunk-grandma test (a person's check, recorded in the audit).
13. **A13 screens:** the Yes screen and Your computers pass the visual check (`visual-check`) on the three device profiles, keyboard alone included.
14. **A14 Floor Fifty (the owner's ask, by the owner):** after pull request 1 is deployed, the owner sends the two new Floor Fifty videos with two commands, and `npx ruken game floor-fifty` says both wait for review. Run by the owner, since it uses the owner's account and files.
15. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:pg`, `pnpm test:browser` and `pnpm build` exit 0 on each pull request's head, and CI is green.

## 8. Plan: four pull requests

Each row is a unit. Units in one pull request run in this order on its branch. Pull requests 2 and 3 share no files and run side by side once pull request 1 is on `main`; pull request 4 waits on 2 and 3 because it wraps their commands.

| PR | Unit | Lane | Waits on | Owns | Output | Check |
|---|---|---|---|---|---|---|
| 1 | Keys and sign-in | 3 | spec merged | `prisma/schema/`, `prisma/migrations/`, `src/features/accounts/computer-keys.ts`, `src/routes/link/`, `src/routes/me/computers/`, `src/routes/api/v1/sign-in/`, `src/routes/api/v1/me/` | sign-in and Your computers | A2, A3, A4, A11 |
| 1 | Videos first | 3 | the unit above | `src/routes/api/v1/games/` (list, show, videos, waiting), `src/features/games/` (shared ownership), `packages/ruken/` (sign-in, whoami, sign-out, games, game, video, keep-old), `pnpm-workspace.yaml` | the owner can send Floor Fifty's videos | A5 (games read), A9, A14 |
| 2 | Games, the rest | 2 | PR 1 | the rest of `src/routes/api/v1/games/`, `src/routes/api/v1/github/`, `src/routes/api/v1/agreement/`, their commands | every row of 3.2 and 3.3 | A1 (games part), A5, A6, A7 |
| 3 | Your page | 2 | PR 1 | `src/routes/api/v1/page/`, `src/features/pages/` (shared ownership), their commands | every row of 3.4 | A1 (page part), A5, A8 |
| 4 | MCP and the guide | 2 | PRs 2, 3 | `packages/ruken/mcp.ts`, `src/routes/help/use-ruken-from-your-computer/`, the agent prompt line | `npx ruken mcp`, the help guide | A1 full, A10, A12, A13 |

The implementer ticks each step below on its branch and the coordinator copies the percentage into `progress.md`.

### Pull request 1
- [ ] Live-state file `docs/superpowers/live/<branch>.md` written.
- [ ] Failing journeys first: A2, A3, A4, A9 and the CLI part of A14 (against the test server) written and red.
- [ ] `ComputerKey` and `ComputerSignIn` in the schema; migration generated by `prisma migrate dev`, never written by hand.
- [ ] `computer-keys.ts`: make a code, say Yes or No, finish, read a key (hash, expiry, pause, last used), remove, rename; key removal on password change hooked where the password change happens.
- [ ] `/link` Yes screen and `/me/computers` (list, rename, remove), each wait showing it; link from `/me`.
- [ ] `/api/v1/sign-in/*`, `/api/v1/me`, `DELETE /api/v1/me/key`; the key read only under `/api/v1`.
- [ ] Ownership shared between `own-game.server.ts` and the API (5.3).
- [ ] `GET /api/v1/games`, `GET /api/v1/games/<game>`, `PUT .../videos/<shape>`, `DELETE .../waiting/<part>`.
- [ ] Per-key limits (A11).
- [ ] `packages/ruken/`: `bin.js`, `words.ts`, the commands in the "Owns" cell; `pnpm-workspace.yaml`.
- [ ] All A-checks for this PR green locally; visual check of the two screens; live-state file deleted; handed to the implementation audit by commit.

### Pull request 2
- [ ] Live-state file; failing journeys A6, A7 and A5 for every new route.
- [ ] Each rule in 5.3 moved into the games service or a shared helper, the form actions calling the same thing (their existing journeys stay green unchanged).
- [ ] Endpoints and commands for every row of 3.2 and 3.3; the parity test (A1) with the games part.
- [ ] Green; live-state file deleted; handed to the audit.

### Pull request 3
- [ ] Live-state file; failing journeys A8 and A5 for the page routes.
- [ ] Endpoints and commands for every row of 3.4; A1 page part.
- [ ] Green; live-state file deleted; handed to the audit.

### Pull request 4
- [ ] Live-state file; failing A10 and A12.
- [ ] `mcp.ts` over stdio; tools mapped to commands; the 5.4 refusals.
- [ ] The help guide and its line on `/help`; the agent-prompt line.
- [ ] Words review and visual check (A12, A13); green; live-state file deleted; handed to the audit.

### After pull request 1 merges (outside the repo, needs the owner)
- The owner deploys (`pnpm run deploy`, which runs the migration) and, per D2, the package is published. Until it is published, the owner runs it from a checkout: `pnpm --filter ruken exec ruken video floor-fifty upright <file>`.

## 9. Decisions for the owner

- **D1: How a computer signs in. Decided. Owner, 2026-11-22 13:55 UTC, on a card: "Press Yes on Ruken".** It was recommended: **press Yes on Ruken** (4.1): nothing to copy, and a key never passes through the maker's clipboard or chat with an agent. Other option: a **"Make a key"** button on Your computers that shows a key once to paste into the terminal (simpler to build by about a screen, but makers copy secrets into config files and agent chats).
- **D2: The package name and who publishes it.** Recommended: **`ruken` on npm** (free on 2026-11-22: `registry.npmjs.org/ruken` answers 404), published from the owner's npm account; makers type `npx ruken`. That needs the owner's npm account and, for CI publishing, an npm token saved as a GitHub secret (new access). Other option: no npm; ruken.io serves the package file and makers type `npx https://ruken.io/ruken.tgz` (no new account, longer to type, and every command a maker copies carries the long address).

## 10. Boundaries

- New: one npm package with no dependencies (pending D2), two tables, two screens, one help guide. No new paid service, no new Cloudflare product, no spend.
- Not in this: hosted MCP, OAuth for agents, staff commands, account screens, anything from slices 3 to 5 that is not built yet. When a new maker screen ships later, A1 makes it bring its command.
- Expected duration (estimate): pull request 1 about half a day including its audits; all four about two days.

## 11. Open questions for the plan audit

- Whether `auth-limits-plugin.ts`'s counting can be reused for per-key limits, or a small counter table is needed (it would join `ComputerKey` in the same migration).
- Whether the Worker can stream a 30 MB `PUT` body into the bucket without holding it twice (the browser path holds it once via `arrayBuffer()`; that is the floor).
