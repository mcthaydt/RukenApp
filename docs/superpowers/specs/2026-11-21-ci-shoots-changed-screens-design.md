# CI shoots only the screens a change touches

Date: 2026-11-21. Status: **spec, revised after plan audit 1 (7 red at d075c00); waiting on plan audit 2.** Lane 3 (it changes `.github/workflows/ci.yml`).

Lines marked **Owner** are the Owner's words or choices. Lines marked **Call** are this spec's choices; the Owner can overrule any of them.

## 0. The Owner's direction

- **Owner, 2026-11-21 03:12 UTC:** "We need to clean up our tests for our new paradigm for starters", which included a ci.yml change to shoot only changed screens.
- **Owner, 2026-11-21 06:05 UTC,** on a card: "Yes, start it" to "Should CI take screenshots only of the screens a change touches?"
- **Owner, 2026-11-21:** "The documentation already said to only take screenshots of changes?" It did: `visual-check`, "Shoot what the change touches", says screenshots cover only the screens a change touches, and that where a program can tell from the changed files which screens a change reaches, it picks them. `this-repo` says no such program exists yet. This spec builds it.

## 1. The outcome

Every CI run, draft or full, on a pull request or on `main`, attaches a `look:` screenshot only for the screens its change reaches. A screen the change does not reach is still visited and checked by its journey, exactly as today; only its picture is left out. When the picker cannot tell, it shoots every screen and says why in the log ("a doubt shoots", as "a doubt never skips a test" does for the tests).

Today on `main` (f7c666d):

1. The "Decide whether to take the screenshots" step in `ci.yml` switches pictures off only on a draft (`CHANGED_ONLY`). A pull request marked ready, and every push to `main`, photograph every screen on every device.
2. On a draft, any changed `.svelte` or `.css` file, anything in `static/`, or a `tests/browser/` look file turns `LOOK_SHOTS=on`, which photographs every screen, not the ones the change touched.
3. `showTheOwner` in `tests/browser/support/look.ts` knows only on or off (`LOOK_SHOTS`).

What is not in scope: picking the sizes. Each picked screen is shot on all three devices of the device matrix (small iPhone, iPad, computer), as a shared change would be under `visual-check`. **Call:** sizes stay as they are; a builder who wants fewer says so in the pull request, as today. Nothing about the journeys' checks, the shards, the gate or the reports changes.

## 2. How it decides (the approach)

**Call: compare what the build makes, not the source.** A spike on f7c666d, and plan audit 1's three builds on d075c00, showed this works:

- `pnpm build` takes about 12 to 14 seconds on a 4-core container, and two builds of the same commit are identical except for the version stamp: `client/_app/version.json`, `server/chunks/instance.js` and `server/chunks/internal.js`, which carry it. With the version string blanked out, the builds match file for file.
- Each page part SvelteKit builds (a layout or a page, a "node") has `.svelte-kit/output/server/nodes/<n>.js`, which names its server code (`server_id`, its static `import` of `../entries/pages/...`, and its server-rendered component through a dynamic `import(...)`), every client chunk it loads (`imports`, which SvelteKit lists in full) and its stylesheets and fonts.
- A server-only change leaves the client output identical; a one-page change also renames that page's node chunk, and so changes the files that name it: the client `app` entry and the three manifests (plan audit 1, R1).

### The comparison

The picker reads both output trees (`.svelte-kit/output/`, base and change) and works on **stemmed** files:

1. **Leave out** every `*.map` file: no page loads one, and each changes with the file it maps (R2).
2. **Stem every hashed name.** In each file's path and in its text, every content-hashed output name is replaced by its stem (`nodes/5.DNfh_8yV.js` becomes `nodes/5.js`, `app.3JogzGiq.js` becomes `app.js`, the same for `chunks/`, `assets/` and stylesheets). Then the `app` entry and the manifests no longer change just because a page's chunk got a new name (R1).
3. **Blank the version string** (read from `client/_app/version.json` of each build).
4. **Hash** each stemmed file. A stemmed path whose hash differs, or that exists in only one tree, is a **changed file**.

### Which pages a changed file reaches

- **Nodes are keyed by their route, not their number** (N1): each node's key is its `server_id`, or else its component's entry path (`entries/pages/<route>/_page.svelte.js` or `_layout.svelte.js`). Adding a route renumbers the nodes; keys do not move. The answer reports the change's node numbers, which are what the page loads.
- **A node is changed** when any file in its reach is changed: its own `server/nodes/<n>.js`, every client file in its `imports`, `stylesheets` and `fonts`, and every server file its node file reaches through static `import` lines and dynamic `import(...)` calls, followed through the output (N2).
- **Other roots.** The picker also follows, the same way, every server root that is not a node: every file under `server/entries/endpoints/` (each `+server.ts`, the `jobs/*` endpoints among them), `server/entries/hooks.server.js`, `server/index.js`, `server/manifest.js`, `server/manifest-full.js` and `server/remote-entry.js`. A changed file reached by any of those roots, or by no root at all, answers **`all`**, naming the root (or "reached by nothing") in the reason. An endpoint a page calls from the browser, a job that changes what a page shows next, or the hooks that run on every page can change screens no node names, so a doubt shoots (R3).
- **Client files** (under `client/`, `static/` copied in, such as `client/fonts/`) that are changed are listed by their stemmed address; a changed client file no node lists (a font a stylesheet pulls in, a picture) is still listed, so a page that loads it is shot.

In practice a change to shared server code that an endpoint also uses (the database helpers, the sign-in code) answers `all`. That is the safe side, and still a change to a page's own `.svelte` file, its own stylesheet or its own `+page.server.ts` shoots only that page.

### At the moment of a picture

`showTheOwner` collects the addresses the page loaded: the same-origin entries of `performance.getEntriesByType("resource")`, plus the document's own `<script src>`, `<link rel=modulepreload>` and `<link rel=stylesheet>` addresses. It stems them the same way, and shoots when any is a changed client file or the client chunk of a changed node (`/_app/immutable/nodes/<n>.js` once stemmed), so the screen's layout and page nodes are known with no route matching. It also shoots, saying why in the attachment's name, when:

- the resource list may be full: its length has reached the browser's buffer size (250 unless the page set another), after which the browser drops new entries silently (R6);
- `LOOK_CHANGED` is missing, empty or cannot be read (N3): a person running the journeys on their own computer gets every picture, as today;
- `LOOK_CHANGED` says `all`;
- the journey's own file is in the answer's changed journeys.

Otherwise it attaches nothing, and skips the fonts-and-animations wait that only serves the picture. Every check the journey makes still runs.

### The base

A pull request compares with its merge base with `main` (`git merge-base origin/main HEAD`). A push to `main` compares with the commit's first parent (`HEAD^1`), so the merge commit of a pull request shoots what that pull request changed. The `screens` job prints "Comparing <head> with <base>".

### Shoot every screen when

- the pull request carries the `screenshots` label, on every run, not only on drafts: a person asks for all of them, with a reason in the pull request, as `visual-check` says;
- a changed file matches **`SHOOT_EVERYTHING_WHEN`**, a new pattern the `screens` job alone reads: everything in `RUN_EVERYTHING_WHEN` (`prisma/`, `cloudflare/`, `tests/fixtures/`, the lockfile, `package.json`, `vite.config.ts`, `playwright.config.ts`) plus `^tests/browser/support/` (the stand-in servers and their data, `look.ts` and the picker), `^wrangler\.jsonc$` and `^\.github/workflows/ci\.yml$`. **`RUN_EVERYTHING_WHEN` stays exactly as it is,** so the draft's choice of tests does not change (R5);
- the change's build, the base's build or the picker fails, or the answer is missing or cannot be read.

**Call: a changed journey shoots its own screens.** When a `tests/browser/*.test.ts` file changed, every `showTheOwner` in that file shoots, because a new or moved picture in a journey is one someone wants to see. Other journeys are not affected.

### Where it runs

**Call: one small `screens` job does the comparing, once per run.** It checks out the change with full history and installs with `pnpm install --frozen-lockfile` (the pnpm cache as the other jobs). Then, in order:

1. It works out the base and the changed files (`git diff --name-only <base> HEAD`), and answers `all` at once, with no build, for the label or a `SHOOT_EVERYTHING_WHEN` path. Because the lockfile and `package.json` are in that list, any build that follows uses the same packages for both commits.
2. It builds the change (`pnpm build`) and copies `.svelte-kit/output/` aside.
3. It moves the same checkout to the base (`git checkout --detach <base>`), builds again with the same `node_modules` (no second install and no worktree, R7), copies that output aside, and moves back to the change.
4. It runs the picker on the two copies and writes the answer, one JSON line: `all` (true or false) with its reason, the changed node numbers and keys, the changed client addresses (stemmed) and the changed journey files.

Each build's result is printed; a failed build answers `all` with "the base did not build" or "the change did not build". The six browser pieces `needs: [changes, screens]` and set `LOOK_CHANGED` from the job's output. A docs-only pull request skips `screens` as it skips the pieces. The plan may move the comparing into the pieces instead if A9's timings say so; the answer and the checks do not change.

**No new dependency, tool, environment or spend.** The picker is a plain Node script in TypeScript, run with `node` as the stand-in servers already are. Extra runner time is one job of a few minutes per run, on GitHub's free public-repo runners.

## 3. Acceptance criteria

Each is observable by a program or a person, and names who checks it. "Counted" means the `look:` attachments in a run's `playwright-report-<n>` artifacts, counted by a script the build keeps in its own report (not the repo): `gh run download <run> -p 'playwright-report-*'` and a count of the attachments named `look: ...` with an image, per screen and device.

**Drafts keep choosing journeys as today** (`--only-changed`), and no journey imports a route file, so a draft that changes only a page runs none of its journeys. Every demo below is therefore counted on a **full run**: the demo pull request marked ready for review, where every journey runs (R4). Each demo pull request is closed unmerged and its branch deleted, one at a time within the limit of 3 open pull requests.

1. **A1, the picker's tests fail first.** Unit tests in the `unit` project (`tests/browser/support/changed-screens.test.ts`, or where the plan puts them) fail on `main` because the picker does not exist, and pass once it does. Their cases use small output trees in the real file shapes (a `server/nodes/<n>.js` with `server_id`, `imports`, a dynamic `import(...)`; an `app` entry naming node chunks; the three manifests; `.js.map` files):
   - a version-only difference changes nothing;
   - a one-page change renames its node chunk, and the `app` entry and the manifests are unchanged once stemmed: that node only;
   - a changed `.js.map` next to a changed node file: that node only;
   - a shared client chunk changes every node that lists it;
   - a page's server file, reached through the node's static import, changes that node only; its server component, reached only through the dynamic import, likewise;
   - a server chunk shared by a page node and an endpoint gives `all`, naming the endpoint; one reached by the hooks gives `all`; one reached by nothing gives `all`;
   - a changed font gives that client address;
   - a new route gives its node as changed, and the other nodes, renumbered, as unchanged.
   And `showTheOwner`'s choice, as a pure function of the loaded addresses, the answer and the journey's file: shoots on a changed node chunk, on a changed client file, on `all`, on a missing or empty answer, on a full resource list (250 entries), and on its own changed journey; skips otherwise. (The build session, shown in its report; then CI.)
2. **A2, one screen changed, one screen shot.** A demo pull request that changes only the words of the forgot-password page heading (`src/routes/forgot-password/+page.svelte`), marked ready: the counted pictures are the forgot-password screens only ("forgot password", and "check your email", which shares the route), on each device, and no other screen; the run is a full run, not every screen. The `screens` job log names the node. (The build session, with the counts and the run link in its report.)
3. **A3, nothing visual changed, nothing shot.** A demo pull request that changes only a unit test, marked ready: the counted pictures are zero, and every journey ran and passed. (The build session, as A2.)
4. **A4, a server-only change shoots its pages.** A demo pull request that changes only `src/routes/forgot-password/+page.server.ts`, in a way the build keeps and the page does not show (the plan picks it, for example a log line), marked ready: the counted pictures are the forgot-password screens only. (The build session, as A2.)
5. **A5, a shared style shoots what it reaches.** A demo pull request that changes a stylesheet every page loads (the root layout's), marked ready: every screen is shot, and the log names the changed client file, not `all`. (The build session, as A2.)
6. **A6, a doubt shoots.** Each of these gives `all` with its reason in the log: the base does not build (one run of the job's script in a cloud container, base set to a commit made not to build); a change under `tests/browser/support/` (the A1 tests of the pattern, or a demo); the `screenshots` label (one demo run, counted: every screen). With `LOOK_CHANGED` empty, `showTheOwner` shoots (A1). (The build session.)
7. **A7, a push to `main` compares with its first parent.** The `screens` job's log prints "Comparing <head> with <base>", and on the first `main` run after P merges, `<base>` is that merge commit's first parent (from `git rev-parse <merge>^1`). (The build session reads it after the merge; the audit reads the step's code.)
8. **A8, W adds no time.** On W's own full run the `screens` job answers `all` ("no picker yet") before installing or building, and the browser pieces start within a minute of where they start on `main` today. (The build session, from `gh run view --json jobs`.)
9. **A9, P does not slow the run by more than 2 minutes.** On A2's full run, the time from the run's start to the last browser piece's end is no more than 2 minutes longer than the median of the last 3 full runs on `main` before W merged (from `gh run view --json jobs`). (The build session, with the numbers.)
10. **A10, nothing else changes.** `gate` passes on each unit's own full run. The check names (`verify`, `postgres`, `browser`, `gate` and the draft names), `RUN_EVERYTHING_WHEN` and the draft's choice of tests, the `.md`-only skip and the report upload are as before. A journey whose picture is skipped still runs every check it ran before. (CI, and the audit from the diff.)
11. **A11, the rules match the code.** The `this-repo` skill's CI line says what the picker does and when it shoots every screen; the old "No program picks the screens" line is gone. The comments at the top of `ci.yml` and in `showTheOwner` say the same, with no mention of nine devices. (The audit.)

## 4. The plan

Two units, each its own pull request, because `build` says a code change that needs a CI workflow change lands the workflow change first, in a pull request with no product code and no tests.

| Unit | Waits on | Files it owns | Output | Check |
|---|---|---|---|---|
| W, the workflow asks the picker | this spec merged | `.github/workflows/ci.yml` | one pull request, lane 3 | A8, A10 |
| P, the picker and `showTheOwner` | W merged | the picker script under `tests/browser/support/`, its unit tests, `tests/browser/support/look.ts`, `.claude/skills/this-repo/SKILL.md` | one pull request, lane 3 (it completes W's change, and the picker decides what CI shoots) | A1 to A7, A9 to A11 |

- **W.** Add `SHOOT_EVERYTHING_WHEN` beside `RUN_EVERYTHING_WHEN` (which does not change). Add the `screens` job as section 2 "Where it runs" says: when the picker file does not exist yet it answers `all` ("no picker yet") straight after the checkout, before installing or building (N4). Each browser piece `needs: [changes, screens]` and sets `LOOK_CHANGED` from the job's output. The old "Decide whether to take the screenshots" step and `LOOK_SHOTS` go. A docs-only pull request skips `screens`. Update the comments at the top of the file. Until P lands, every run shoots every screen, as a full run does today.
- **P.** Write A1's tests first and see them fail. Write the picker (stem, blank, hash, follow imports, key nodes by route, check roots) and the pure choice `showTheOwner` makes, then wire `showTheOwner` to `LOOK_CHANGED`. Run A2 to A6 and A9 as demo pull requests marked ready. Update `this-repo`.
- **Duration.** W about 1 hour, P about 4 hours including the demo runs (each full run is about 15 minutes). Overrun (CLAUDE.md Settings) is twice that.
- **Sessions.** Per Settings: this spec's plan audit round 2, Opus 5.5 medium, in a fresh thread; W and P built by one implementer on Sonnet 5.5 medium (execution against a spec), W first; the implementation audit of each, Opus 5.5 medium, fresh; the Owner approves W and P before each merges (lane 3).

## 5. Open decisions for the Owner

None. The calls above are this spec's; the Owner can overrule any of them.

## 6. Risks and follow-ups

- **Over-shooting.** A change to shared server code that an endpoint or the hooks also use shoots every screen, and a component Vite bundles into a chunk many pages share shoots all of them. That is safe, and still far fewer pictures than today for a change to one page.
- **A screen whose look comes from outside the build.** Data from the database and the stand-in services is not compared. `tests/fixtures/` and `tests/browser/support/` (the stand-ins) are in `SHOOT_EVERYTHING_WHEN`, so a change there shoots everything.
- **Version stamp moves.** If a SvelteKit update writes the version somewhere new, the lockfile changes in the same pull request, which shoots everything; after that, A1's version-only case and the log line naming why every screen was shot are the signal.
- **Follow-up, not built here (plan audit 1, N5).** A slice's screens page can no longer be made from the latest `main` run alone, since each run now holds only what its change touched; it needs a run with the `screenshots` label, or the slice's own runs. That is a note for `visual-check` or `this-repo` at the next retrospective.
