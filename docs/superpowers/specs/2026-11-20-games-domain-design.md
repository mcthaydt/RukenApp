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

- each game is its own origin, so one game cannot read another game's local storage or IndexedDB (the one step back taken on 2026-11-15 ends). Cookies are the exception: every game is under one registrable name, so a game can set a cookie for the whole games domain that every other game receives (section 6);
- the games and the site are different sites, so a game can no longer set a cookie the site receives (slice 2 rest, Found 1). Whether the "only games the Owner trusts" rule can then be lifted is the Owner's call at launch, not this spec's;
- a game's own server that checks where players come from must allow `https://g-<public id>.GAMES-DOMAIN` instead of the gate's free address. It can allow it before the switch, so nothing breaks.

The site's address (`SITE_ORIGIN`, `BETTER_AUTH_URL`, the GitHub App's addresses) does not change.

## 2. What changes, and where

| Where | Today | After | Who |
|---|---|---|---|
| DNS on GAMES-DOMAIN | nothing | `AAAA *` → `100::`, proxied | the Owner, a website step |
| the gate's route | none | `*.GAMES-DOMAIN/*`, given as `--route` on every deploy of the gate | the Owner, a command |
| the site's `GAME_ADDRESS_PATTERN` secret | the free host with `/{name}` | `https://{name}.GAMES-DOMAIN` | the Owner, a command |
| the gate's `PATH_HOST` secret | the gate's free host | deleted | the Owner, a command |
| `cloudflare/games/wrangler.jsonc` | `"workers_dev": true` | `false`, its comment says the route is given on the command line | the build (W) |
| `tests/cloudflare/games-worker.test.ts` | expects `workers_dev` true | expects false | the build (W) |
| `cloudflare/games/worker.ts` | `PATH_HOST` comment: "until the games' domain exists" | comment: only a local run sets it | the build (W) |
| the slice 2 rest plan | O-B and Task 24 use the free host | point at this spec once it is live | the build (W) |
| the gate's `SITE_ORIGIN` | the test site | unchanged | nobody |

- **Call: switch first, then close the free address.** The gate already answers a game's own name whenever the host is not `PATH_HOST` (`src/features/play/gate.ts`, `handleGameRequest`), so the Owner can add the route on today's `main`, while `workers_dev` is still true: for a while both addresses answer, and nothing stops loading. W's merge, and the gate's next deploy with it, is the last step and only closes the free address.
- **Call: `PATH_HOST` stays in the code.** The journeys run the site with name-form addresses (`playwright.config.ts`, `GAME_ADDRESS_PATTERN: "http://{name}.localhost:8788"`), but one browser test (`tests/browser/game-gate.test.ts`) and the gate's unit tests cover the path form on `localhost:8788` with `PATH_HOST`. Only the deployed gate loses the setting.
- **Call: the domain stays out of the repository, and the route with it** (the Owner's 2026-11-13 rule). The gate's config keeps its tests that it holds no `routes` and names no real address. Only the Owner deploys the gate (`pnpm run deploy:games`); Workers Builds deploys only the site, under the name `ruken` (design, "One build, one Worker"), so a site deploy never touches the gate's route.
- **Call: the DNS record is one website step.** Wrangler has no DNS command, and Cloudflare's DNS API needs a token that is itself made on the website. The record is safe to add before anything else: with no route on it, it serves nothing of Ruken's.
- **No new dependency, tool, environment or spend.** The domain is already bought.

## 3. Acceptance criteria

Each is observable by a program or a person, and names who checks it.

1. **A1, the config test fails first.** On `main`'s config, `pnpm exec vitest run tests/cloudflare/games-worker.test.ts` fails on the changed `workers_dev` expectation alone; with the change it passes. (The build session, shown in its report.)
2. **A2, the gate's config still holds no route, variable or domain.** The existing tests in that file pass unchanged: no `vars`, `route`, `routes` or `hyperdrive`; no `https://` and no real domain outside the `$schema` line. (CI.)
3. **A3, nothing local changes.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and the CI `gate` pass; the journeys, including the path-form test in `tests/browser/game-gate.test.ts`, pass unchanged. (CI.)
4. **A4, the games domain answers.** After O2: `curl -s https://media.GAMES-DOMAIN/__ruken/health` prints `ok`. (A cloud session; no secret needed.)
5. **A5, a game's name answers as a game.** After O2: `curl -s https://g-aaaaaaaaaa.GAMES-DOMAIN/x/` prints "This game's link has run out. Go back and press Play again." (A cloud session.)
6. **A6, the free address is gone.** After O6: `curl -s -o /dev/null -w "%{http_code}" https://ruken-games.<account>.workers.dev/__ruken/health` is not `200`, and A4 still prints `ok`. (A cloud session.)
7. **A7, the site points at the new names.** After O4: the `look` link the review command prints (`src/routes/jobs/review/+server.ts`) starts `https://g-` and contains `.GAMES-DOMAIN/`. (The Owner, who holds the jobs' secret.)
8. **A8, a game plays from its own name, like a person.** After O4: on the test site, a member presses Play on a live game; the frame's address is `https://g-<public id>.GAMES-DOMAIN/<pass>/…`; the game runs; ← goes back. (The Owner, as Task 24 Step 3 of slice 2 rest; a cloud session cannot be a paying member on the real test site.)
9. **A9, the route outlives the site's deploy.** After the next merge to `main` that deploys the site, A4 still prints `ok`. (A cloud session.)

## 4. The plan

One unit in the repository, and the Owner's steps around it. Lane 3: it touches `cloudflare/`.

| Unit | Waits on | Files it owns | Output | Check |
|---|---|---|---|---|
| W, the gate leaves its free address (`workers_dev`) | R (#206) merged, since both edit the slice 2 rest plan; starts from a `main` that holds it | `cloudflare/games/wrangler.jsonc`, `cloudflare/games/worker.ts` (comments only), `tests/cloudflare/games-worker.test.ts`, `docs/superpowers/plans/2026-11-15-slice-2-rest.md` (O-B and Task 24 lines, "What moves to launch") | one pull request | A1 to A3 |

**Other open work, checked for shared files (2026-11-20, `main` at `949ffb5`):** Unit R (PR #206) edits `docs/superpowers/plans/2026-11-15-slice-2-rest.md`, which W edits too, so W waits on R; R shares no other file. F (the game page and play screen) builds the frame from `GAME_ADDRESS_PATTERN` through `gameAddress`, which W does not change. Decision day's Unit H changes `cloudflare/worker.js` and is deployed by Workers Builds; it shares no file and no deploy with W. W and H still do not build at the same time, so that one lane 3 change in `cloudflare/` is in flight at once and a broken deploy has one cause. G (Task 24) reads the deployed addresses: its Steps 1 and 4 change as section 5 says.

The Owner's steps O1 to O5 need nothing from W and can run now; O6 follows W's merge.

### Task 1: the Owner's switch (any time, on today's `main`)

The commands, with the real domain in them, are in the project's files for the Owner, not in this repository. In order, each in the Owner's clone of RukenApp:

- [ ] **O1:** the website step, GAMES-DOMAIN → DNS → Records → Add record: `AAAA`, name `*`, address `100::`, Proxied.
- [ ] **O2:** `git switch main && git pull && pnpm install --frozen-lockfile && pnpm run deploy:games --route "*.GAMES-DOMAIN/*"`. The gate now answers on both its free address and the games domain. A cloud session runs A4 and A5.
- [ ] **O3:** a game's own server that checks where players come from (Floor Fifty's) allows `https://g-<its public id>.GAMES-DOMAIN` as well as the free address (the public id is the `g-…` part of its `look` link).
- [ ] **O4:** `printf %s 'https://{name}.GAMES-DOMAIN' | pnpm exec wrangler secret put GAME_ADDRESS_PATTERN` (the site's Worker, `ruken`; `{name}` typed as it is). The site now hands out the new names. A7 and A8.
- [ ] **O5:** `pnpm exec wrangler secret delete PATH_HOST --config cloudflare/games/wrangler.jsonc` (it asks "Are you sure…?"; answer `y`). The free address no longer serves games.

**Undoing O2 to O5** (if A4, A5, A7 or A8 fail and the cause is not found in the tries in Settings): `printf %s 'https://ruken-games.<account>.workers.dev/{name}' | pnpm exec wrangler secret put GAME_ADDRESS_PATTERN` and `printf %s 'ruken-games.<account>.workers.dev' | pnpm exec wrangler secret put PATH_HOST --config cloudflare/games/wrangler.jsonc`. With `workers_dev` still true the free address works again at once. The route and the DNS record can stay.

### Task 2: the gate's config (the build session, after R merges)

- [ ] **Step 1:** in `tests/cloudflare/games-worker.test.ts`, the test "runs on its workers.dev address until the games domain exists, and has no preview addresses" becomes "has no free address and no preview addresses: it answers only on the games domain's route", expecting `workers_dev` to be `false`. Run it; it fails on that line only (A1).
- [ ] **Step 2:** `cloudflare/games/wrangler.jsonc`: `"workers_dev": false`, and the comment above it says the gate answers only on its route, which the Owner gives as `--route` on every deploy of the gate because the games domain is not written in this repository. The comment names neither `workers.dev` nor any domain: the test's "names no real address" check reads comments too. Run the test; it passes.
- [ ] **Step 3:** `cloudflare/games/worker.ts`: `PATH_HOST`'s comment says it is set only on a local run (the path-form browser test), where the game is in the path; the deployed gate has none. No code changes.
- [ ] **Step 4:** `docs/superpowers/plans/2026-11-15-slice-2-rest.md`: O-B's lead line says not to run its commands once the games domain is live, and points at this spec's undo; Task 24 Steps 1 and 4 get section 5's lines; in "What moves to launch", the first item is marked done on the test site by this spec, and "Whether the gate's route outlives a deploy of the site" points at A9.
- [ ] **Step 5:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Push; the pull request body names the changed test and why (`build`, "A change does not quietly edit its own check").

### Task 3: closing the free address (after W merges)

- [ ] **O6:** the Owner: `git switch main && git pull && pnpm run deploy:games --route "*.GAMES-DOMAIN/*"`. Every later deploy of the gate passes the same `--route`.
- [ ] A cloud session runs A6, then A9 after the next merge to `main`, each its one line with what it printed.
- [ ] The coordinator records in `progress.md` what was checked, by whom and when (no address, no secret), and tells the Floor Fifty thread.

**Undoing O6:** revert W's pull request and run `pnpm run deploy:games --route "*.GAMES-DOMAIN/*"` from `main`, then the undo under Task 1 if the free address must serve games again.

## 5. What it changes in slice 2's Task 24 (G)

Once O5 is done, Task 24's checks use a game's own name instead of the gate's free host:

- Step 1: `curl -s https://media.GAMES-DOMAIN/__ruken/health` answers `ok`, and `curl -s https://g-aaaaaaaaaa.GAMES-DOMAIN/x/` answers the run-out line. "Not found." from a game under a fresh pass now means `GAME_ADDRESS_PATTERN` is wrong (`PATH_HOST` no longer exists on the gate). O-B is not run again.
- Step 4: the game's folder without a pass is `curl -s https://g-PUBLIC-ID.GAMES-DOMAIN/index.html`, and it answers the run-out line. The other two checks are unchanged.

If Task 24 runs before O5, it runs as written.

### What changes for a game that is already on the test site

- Its public id (`g-…`) and its `/g/<address>` page on the site do not change. Only where its files are served from changes: from `https://ruken-games.<account>.workers.dev/g-<id>/…` to `https://g-<id>.GAMES-DOMAIN/…`. The site works the address out from `GAME_ADDRESS_PATTERN` each time a page is drawn, so nothing stored in the database changes and nothing needs a migration.
- A play pass is in the path, not tied to the host, so a pass handed out after O4 works on the new name. A frame opened on the free address stops loading files at O5; pressing Play again fixes it.
- Anything a game saved in the browser (its local storage) was under the shared old origin and is not carried over: on the test site, players start that game fresh.
- `look` links printed before O5 stop working; `look` again prints a new one.
- The game's own server must allow the new origin (O3).

## 6. Risks, and what is not checked

- **Games share cookies with each other.** Every `g-…` name is under one registrable name, so a game's script can set a cookie with `Domain=` the games domain that every other game and `media.` receive. Local storage and IndexedDB stay per game. Listing the games domain on the Public Suffix List would end it; that is a launch question for the Owner, not this unit.
- **Not checked, and said so:** that the zone's Universal SSL certificate already covers `*.GAMES-DOMAIN` (it covers the apex and one level of names by default; A4 proves it); that a later deploy of the gate that forgets `--route` keeps the route (the Owner's command file always passes it; A4 run again catches a lost one); whether `GAME_ADDRESS_PATTERN` on the site is a secret or a plain variable today (the 2026-11-13 plan set it as a secret; if O4 refuses because a variable of that name exists, the Owner removes the variable and runs O4 again).
- **Duration:** the Owner's switch about ten minutes; W under an hour including CI; the checks a few minutes each.
