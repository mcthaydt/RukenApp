# The games domain, connected on the test site

Date: 2026-11-20. Status: spec and plan in one, for the plan audit (lane 3). Nothing here is built.

This takes the first item of "What moves to launch" in `docs/superpowers/plans/2026-11-15-slice-2-rest.md` and does it now, on the test site. Everything else on that list (the GitHub App's addresses, the site's own domain, the rule that only games the Owner trusts are accepted) stays where it is.

Lines marked **Owner** are the Owner's words or choices. Lines marked **Call** are this spec's choices; the Owner can overrule any of them.

## 0. The Owner's direction

- **Owner, 2026-11-13** (relayed, `2026-11-13-slice-2-games-play.md`): games live on a separate domain used only for games, each game on its own name under it (`g-<id>.<games domain>`), clips at `media.<games domain>`. The domain is written `GAMES-DOMAIN` and never in the repository.
- **Owner, 2026-11-20:** the games domain is bought and on this Cloudflare account. It is a different registrable name from the site's.
- **Owner, 2026-11-20, on a card:** "Connect it now", for the test site.

## 1. The outcome

Each game on the test site runs at `https://g-<public id>.GAMES-DOMAIN`, and clips at `https://media.GAMES-DOMAIN`. The gate's free `workers.dev` address stops answering. From then:

- each game is its own origin, so one game cannot read another game's saves (the one step back taken on 2026-11-15 ends);
- the games and the site are different sites, so a game can no longer set a cookie the site receives (slice 2 rest, Found 1). Whether the "only games the Owner trusts" rule can then be lifted is the Owner's call at launch, not this spec's;
- a game's own server that checks where players come from must allow `https://g-<public id>.GAMES-DOMAIN` instead of the gate's free address. Floor Fifty's server needs that change at the moment of the switch, or it stops connecting.

The site's address (`SITE_ORIGIN`, `BETTER_AUTH_URL`, the GitHub App's addresses) does not change.

## 2. What changes, and where

| Where | Today | After | Who |
|---|---|---|---|
| `cloudflare/games/wrangler.jsonc` | `"workers_dev": true` | `false`, its comment says the route is given on the command line | the build |
| `tests/cloudflare/games-worker.test.ts` | expects `workers_dev` true | expects false | the build |
| `cloudflare/games/worker.ts` | `PATH_HOST` comment: "until the games' domain exists" | comment: only a local run (the journeys and `verify`) sets it | the build |
| DNS on GAMES-DOMAIN | nothing | `AAAA *` → `100::`, proxied | the Owner, a website step |
| the gate's route | none | `*.GAMES-DOMAIN/*`, given as `--route` on the gate's deploy | the Owner, a command |
| the gate's `PATH_HOST` secret | the gate's free host | deleted | the Owner, a command |
| the site's `GAME_ADDRESS_PATTERN` secret | the free host with `/{name}` | `https://{name}.GAMES-DOMAIN` | the Owner, a command |
| the gate's `SITE_ORIGIN` | the test site | unchanged | nobody |

- **Call: `PATH_HOST` stays in the code.** `src/features/play/gate.ts` keeps its one-host mode and `worker.ts` keeps reading the setting: the journeys (`playwright.config.ts`) and the `verify` skill run the gate on `localhost:8788` with it, and its tests cover it. Only the deployed gate loses the setting. Removing the code too would change the journeys, for no gain on the test site.
- **Call: the domain stays out of the repository, and the route with it** (the Owner's 2026-11-13 rule). The gate's config keeps its tests that it holds no `routes` and names no real address. The route is given with `--route` each time the gate is deployed. Only the Owner deploys the gate (`pnpm run deploy:games`); Workers Builds deploys only the site, under the name `ruken` (design, "One build, one Worker"), so a site deploy never touches the gate's route.
- **Call: the DNS record is one website step.** Wrangler has no DNS command, and Cloudflare's DNS API needs a token that is itself made on the website. The record is safe to add before anything else: with no route on it, it serves nothing of Ruken's.
- **No new dependency, tool, environment or spend.** The domain is already bought.

## 3. Acceptance criteria

Each is observable by a program or a person, and names who checks it.

1. **A1, the config test fails first.** On `main`'s config, `pnpm exec vitest run tests/cloudflare/games-worker.test.ts` fails on the changed `workers_dev` expectation alone; with the change it passes. (The build session, shown in its report.)
2. **A2, the gate's config still holds no route, variable or domain.** The existing tests in that file pass unchanged: no `vars`, `route`, `routes` or `hyperdrive`; no `https://` and no real domain outside the `$schema` line. (CI.)
3. **A3, nothing local changes.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and the CI `gate` pass; the journeys, which run the gate in its one-host mode on `localhost:8788`, pass unchanged. (CI.)
4. **A4, the games domain answers.** After the Owner's steps: `curl -s https://media.GAMES-DOMAIN/__ruken/health` prints `ok`. (A cloud session; no secret needed.)
5. **A5, a game's name answers as a game.** `curl -s https://g-aaaaaaaaaa.GAMES-DOMAIN/x/` prints "This game's link has run out. Go back and press Play again." (A cloud session.)
6. **A6, the free address is gone.** `curl -s -o /dev/null -w "%{http_code}" https://ruken-games.<account>.workers.dev/__ruken/health` is not `200`. (A cloud session.)
7. **A7, the site points at the new names.** The `look` link the review command prints, and the "Your game runs at" line on a maker's page, start `https://g-` and contain `.GAMES-DOMAIN/`. (The Owner, or a cloud session with the jobs' secret if one is given.)
8. **A8, a game plays from its own name, like a person.** On the test site, a member presses Play on a live game; the frame's address is `https://g-<public id>.GAMES-DOMAIN/<pass>/…`; the game runs; ← goes back. (The Owner, as Task 24 Step 3 of slice 2 rest; a cloud session cannot be a paying member on the real test site.)
9. **A9, the route outlives the site's deploy.** After the next merge to `main` deploys the site, A4 still prints `ok`. (A cloud session.)

## 4. The plan

One unit. Lane 3: it touches `cloudflare/`.

| Unit | Waits on | Files it owns | Output | Check |
|---|---|---|---|---|
| N, the gate leaves its free address ("names") | nothing in the repo; reads `main` | `cloudflare/games/wrangler.jsonc`, `cloudflare/games/worker.ts` (comments only), `tests/cloudflare/games-worker.test.ts` | one pull request | A1 to A3 |

**Other open work, checked for shared files (2026-11-20, `main` at `949ffb5`):** Unit R (PR #206) touches `src/features/games/`, `src/routes/make/`, `src/routes/jobs/review/`, the slice 2 rest plan and browser tests; none of N's files. F (the game page and play screen) builds the frame that shows the game's address but reads it from `GAME_ADDRESS_PATTERN` through `gameAddress`, which N does not change. So N runs beside R and F. Decision day's Unit H changes `cloudflare/worker.js` (the site's wrapper, for its cron): a different file from N's, but the same lane 3 folder and the same Owner deploy step, so N and H do not build at the same time; whichever is second starts from a `main` that holds the first. G (Task 24) reads the deployed addresses: its Steps 1 and 4 use the gate's one-host shapes and change as section 5 says once this is live.

### Task 1: the gate's config (the build session)

- [ ] **Step 1:** in `tests/cloudflare/games-worker.test.ts`, the test "runs on its workers.dev address until the games domain exists, and has no preview addresses" becomes "has no workers.dev address and no preview addresses: it answers only on the games domain's route", expecting `workers_dev` to be `false`. Run it; it fails on that line only (A1).
- [ ] **Step 2:** `cloudflare/games/wrangler.jsonc`: `"workers_dev": false`, and the comment above it says the gate answers only on its route, `*.GAMES-DOMAIN/*`, which the Owner gives as `--route` on every deploy of the gate because the domain is not written in this repository. Run the test; it passes.
- [ ] **Step 3:** `cloudflare/games/worker.ts`: `PATH_HOST`'s comment says it is set only on a local run (the journeys and `verify`), where the game is in the path; the deployed gate has none. No code changes.
- [ ] **Step 4:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Push; the pull request body names the changed test and why (`build`, "A change does not quietly edit its own check").
- [ ] **Step 5:** in `docs/superpowers/plans/2026-11-15-slice-2-rest.md`, "What moves to launch", the first item is marked done on the test site by this spec, and "Whether the gate's route outlives a deploy of the site" points at A9.

### Task 2: the Owner's steps (after Task 1 merges)

The commands, with the real domain in them, are in the project's files for the Owner, not in this repository. In order, each in the Owner's clone of RukenApp:

- [ ] **O1** (any time, even before the merge): the website step, GAMES-DOMAIN → DNS → Records → Add record: `AAAA`, name `*`, address `100::`, Proxied.
- [ ] **O2:** `git switch main && git pull && pnpm install --frozen-lockfile && pnpm run deploy:games --route "*.GAMES-DOMAIN/*"`. From here the gate answers on the games domain only.
- [ ] **O3:** `printf %s 'https://{name}.GAMES-DOMAIN' | pnpm exec wrangler secret put GAME_ADDRESS_PATTERN` (the site's Worker, `ruken`; `{name}` typed as it is).
- [ ] **O4:** `pnpm exec wrangler secret delete PATH_HOST --config cloudflare/games/wrangler.jsonc`.
- [ ] **O5:** Floor Fifty's server allows `https://g-<its public id>.GAMES-DOMAIN` (the Floor Fifty thread gives the exact id).

O2 to O4 run back to back: between O2 and O3 the site still hands out the old addresses, which no longer answer, so a game started then fails to load until O3 lands.

**Undoing it** (if A4 to A8 fail and the cause is not found in the tries in Settings): `printf %s 'https://ruken-games.<account>.workers.dev/{name}' | pnpm exec wrangler secret put GAME_ADDRESS_PATTERN`, `printf %s 'ruken-games.<account>.workers.dev' | pnpm exec wrangler secret put PATH_HOST --config cloudflare/games/wrangler.jsonc`, and a revert of Task 1's pull request, then `pnpm run deploy:games` from `main`. The DNS record can stay.

### Task 3: the checks (a cloud session, after the Owner says O2 to O4 are done)

- [ ] A4, A5 and A6, each its one line, with what it printed.
- [ ] A7 and A8 with the Owner.
- [ ] A9 after the next merge to `main`.
- [ ] The coordinator records in `progress.md` what was checked, by whom and when (no address, no secret), and tells the Floor Fifty thread the switch is live.

## 5. What it changes in slice 2's Task 24 (G)

Once this is live, Task 24's checks use a game's own name instead of the gate's free host:

- Step 1: `curl -s https://media.GAMES-DOMAIN/__ruken/health` answers `ok`, and `curl -s https://g-aaaaaaaaaa.GAMES-DOMAIN/x/` answers the run-out line. "Not found." from a game under a fresh pass now means `GAME_ADDRESS_PATTERN` is wrong (`PATH_HOST` no longer exists on the gate).
- Step 4: the game's folder without a pass is `curl -s https://g-PUBLIC-ID.GAMES-DOMAIN/index.html`, and it answers the run-out line. The other two checks are unchanged.

If Task 24 runs before this is live, it runs as written.

### What changes for a game that is already on the test site

- Its public id (`g-…`) and its `/g/<address>` page on the site do not change. Only where its files are served from changes: from `https://ruken-games.<account>.workers.dev/g-<id>/…` to `https://g-<id>.GAMES-DOMAIN/…`. The site works the address out from `GAME_ADDRESS_PATTERN` each time a page is drawn, so nothing stored in the database changes and nothing needs a migration.
- A play pass is in the path, not tied to the host, so a pass handed out after O3 works on the new name. A frame opened before O2 stops loading files; pressing Play again fixes it.
- Anything a game saved in the browser (its local storage) was under the shared old origin and is not carried over: on the test site, players start that game fresh.
- `look` links printed before the switch stop working; `look` again prints a new one.
- The game's own server must allow the new origin (O5).

## 6. Risks, and what is not checked

- **Not checked, and said so:** that the zone's Universal SSL certificate already covers `*.GAMES-DOMAIN` (it covers the apex and one level of names by default; A4 proves it); that `wrangler deploy` with `--route` and no `routes` in the config keeps the route on a later deploy of the gate that forgets `--route` (the Owner's command file always passes it; a forgotten one is caught by A4 run again); whether `GAME_ADDRESS_PATTERN` on the site is a secret or a plain variable today (the 2026-11-13 plan set it as a secret; if O3 refuses because a variable of that name exists, the Owner removes the variable and runs O3 again).
- **Floor Fifty stops connecting to its server** between O2 and O5. On the test site, with one trusted game, that is accepted; the Floor Fifty thread is told before O2.
- **Duration:** Task 1 under an hour including CI; the Owner's steps about ten minutes; the checks a few minutes.
