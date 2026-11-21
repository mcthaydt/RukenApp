# CI shoots only the screens a change touches

Date: 2026-11-21. Status: **spec, waiting on its plan audit.** Lane 3 (it changes `.github/workflows/ci.yml`).

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

**Call: compare what the build makes, not the source.** A spike on f7c666d showed this works:

- `pnpm build` takes about 12 seconds on a 4-core container, and two builds of the same commit are identical except for the version stamp: `client/_app/version.json` and `server/chunks/instance.js` and `server/chunks/internal.js`, which carry it. With the version string blanked out before hashing, the builds match file for file (55 client files, 261 server files).
- Each page part SvelteKit builds (a layout or a page, a "node") has `.svelte-kit/output/server/nodes/<n>.js`, which names its server code (`server_id`, plus its imports of `../entries/...`), every client chunk it loads (`imports`, which SvelteKit lists in full) and its stylesheets and fonts.
- The client's chunk names carry a content hash, so a changed chunk has a new name, and so does every chunk that imports it.

So the picker builds the base and the change, hashes every output file (version blanked), and calls a node **changed** when anything it reaches differs from the base: one of its client files, stylesheets or fonts is new or different, or a file in its server code's import closure (followed through the output's own `import` lines) is new or different. A changed output file that no node reaches (the server's entry, the HTML template, the hooks) means every screen: **a doubt shoots.**

At the moment of a picture, `showTheOwner` asks the page which files it loaded (the same-origin entries in `performance.getEntriesByType("resource")`, plus the page's own `<script>`, `<link rel=modulepreload>` and `<link rel=stylesheet>` addresses). It shoots when any of them is a changed client file (a changed font in `static/` counts), or is the client chunk of a changed node (`/_app/immutable/nodes/<n>.<hash>.js`, so the screen's layout and page nodes are known with no route matching). Otherwise it attaches nothing.

**The base.** A pull request compares with its merge base with `main` (`git merge-base origin/main HEAD`). A push to `main` compares with the commit's first parent (`HEAD^1`), so the merge commit of a pull request shoots what that pull request changed.

**Shoot every screen when:**

- the pull request carries the `screenshots` label (as today, but on every run, not only on drafts): a person asks for all of them, with a reason in the pull request, as `visual-check` says;
- a file matching `RUN_EVERYTHING_WHEN` changed (the lockfile, `package.json`, the build and test config, `prisma/`, `cloudflare/`, `tests/fixtures/`), or `wrangler.jsonc`: these change what is served or stored outside the build's output;
- the picker itself, `showTheOwner` or the workflow changed (`tests/browser/support/look.ts`, the picker's own file, `.github/workflows/ci.yml`);
- the base's build or the picker fails, or its answer is missing or cannot be read.

**Call: a changed journey shoots its own screens.** When a `tests/browser/*.test.ts` file changed, every `showTheOwner` in that file shoots, because a new or moved picture in a journey is a picture someone wants to see. Other journeys are not affected.

**Call: one small `screens` job does the comparing, once per run.** It checks out the change with history, installs once, builds the base in a `git worktree` and the change in place, and writes one answer: a JSON line with `all` (with the reason), the changed node numbers, the changed client paths and the changed journey files. The six browser pieces read it as a job output (`needs: screens`) into `LOOK_CHANGED`, which `showTheOwner` reads. A run with no `LOOK_CHANGED` at all (a person running the journeys on their own computer) shoots everything, as today. The plan may move the comparing into the pieces instead if the timings in A9 say so; the answer and the checks do not change.

**No new dependency, tool, environment or spend.** The picker is a plain Node script in TypeScript, run with `node` as the stand-in servers already are. Extra runner time is one job of a few minutes per run, on GitHub's free public-repo runners.

## 3. Acceptance criteria

Each is observable by a program or a person, and names who checks it. "Counted" means the `look:` attachments in a run's `playwright-report-<n>` artifacts, counted by a script the build commits to its own report (not to the repo): `gh run download <run> -p 'playwright-report-*'` and a count of the attachments named `look: ...` with an image, per screen and device.

1. **A1, the picker's test fails first.** A unit test (`tests/browser/support/changed-screens.test.ts` or where the plan puts it, in the `unit` project) fails on `main` because the picker does not exist, and passes once it does. Its cases, each with small made-up output trees: a version-only difference changes nothing; one page's client chunk changes that node only; a shared client chunk changes every node that imports it; a page's server file changes that node only; a changed file no node reaches gives `all`; a changed font gives that client path; a new route's node is changed. (The build session, shown in its report; then CI.)
2. **A2, one screen changed, one screen shot.** On a demo draft pull request that changes only the words of the forgot-password page heading, the counted pictures are the forgot-password screens only ("forgot password" and "check your email", which share the route), on each device whose journeys reach them, and no other screen. The run's `screens` job log names the changed node. (The build session, with the counts and the run link in its report. The demo pull request is closed unmerged and its branch deleted.)
3. **A3, nothing visual changed, nothing shot.** On a demo draft pull request that changes only a unit test, the counted pictures are zero and every journey that ran passed. (The build session, as A2.)
4. **A4, full runs pick too.** The A2 demo marked ready gets the full run, and its counted pictures are the same set as A2's, not every screen. (The build session, as A2.)
5. **A5, a server-only change shoots its pages.** On a demo draft that changes only a page's `+page.server.ts` in a way that does not change the page (a comment is blanked by the build, so the plan picks a real but harmless change, such as a string constant the page does not show), the counted pictures are that page's screens only. (The build session, as A2.)
6. **A6, a shared change shoots what it reaches.** On a demo draft that changes a shared style in `src/app.css` (or the nearest shared stylesheet), every screen that loads it is shot. (The build session, as A2.)
7. **A7, a doubt shoots.** With the base build made to fail (one run of the picker in a cloud container, base set to a commit that does not build, or a unit test of the job's fallback), the answer is `all` with the reason, and the log line says it. With `LOOK_CHANGED` unset, `showTheOwner` shoots (a unit test or one local run of a journey). With the `screenshots` label, every screen is shot (one demo run, counted). (The build session.)
8. **A8, a push to `main` compares with its first parent.** The `screens` job's log prints "Comparing <head> with <base>", and on the first `main` run after the merge `<base>` is that merge commit's first parent. (The build session reads it after the merge, or the audit from the step's code.)
9. **A9, the run does not get slower by more than 2 minutes.** On the A4 full run, the time from the run's start to the last browser piece's end is no more than 2 minutes longer than the median of the last 3 full runs on `main` before the change (from `gh run view --json jobs`). (The build session, with the numbers.)
10. **A10, nothing else changes.** `gate` passes on the build's own full run. The check names (`verify`, `postgres`, `browser`, `gate` and the draft names), the draft's test selection, the `.md`-only skip and the report upload are as before. A journey whose picture is skipped still runs every check it ran before. (CI, and the audit from the diff.)
11. **A11, the rules match the code.** The `this-repo` skill's CI line says what the picker does and when it shoots every screen; the old "No program picks the screens" line is gone. The comments at the top of `ci.yml` and in `showTheOwner` say the same, with no mention of nine devices. (The audit.)

## 4. The plan

Two units, each its own pull request, because `build` says a code change that needs a CI workflow change lands the workflow change first, in a pull request with no product code and no tests.

| Unit | Waits on | Files it owns | Output | Check |
|---|---|---|---|---|
| W, the workflow asks the picker | this spec merged | `.github/workflows/ci.yml` | one pull request, lane 3 | A8, A10; until P lands the `screens` job finds no picker, answers `all` ("no picker yet") and every run shoots as a full run does today |
| P, the picker and `showTheOwner` | W merged | the picker script under `tests/browser/support/`, its unit test, `tests/browser/support/look.ts`, `.claude/skills/this-repo/SKILL.md` | one pull request, lane 2 by its files (lane 3 with W as one change) | A1 to A7, A9, A11 |

- **W.** Add the `screens` job: checkout with history, pnpm and Node from `.nvmrc` with the pnpm cache, `pnpm install --frozen-lockfile`, work out the base (merge base on a pull request, `HEAD^1` on `main`), the `screenshots` label and the shoot-everything paths, and run the picker when it exists, writing its one-line answer as the job's output. Each browser piece `needs: [changes, screens]` and sets `LOOK_CHANGED` from it. The old "Decide whether to take the screenshots" step and `LOOK_SHOTS` go. A docs-only pull request skips `screens` as it skips the pieces. Update the comments at the top of the file.
- **P.** Write A1's test first and see it fail. Write the picker: hash both builds (version blanked), read the nodes, follow server imports, compare, print the answer. Change `showTheOwner` to read `LOOK_CHANGED` and decide per picture from the page's loaded files and the journey's file. Run A2 to A7 and A9 as demo draft pull requests, one at a time within the limit of 3 open pull requests, each closed unmerged with its branch deleted. Update `this-repo`.
- **Duration.** W about 1 hour, P about 3 hours including the demo runs. Overrun (CLAUDE.md Settings) is twice that.
- **Sessions.** Per Settings: this spec's plan audit, Opus 5.5 medium, in a fresh thread; W and P built by one implementer on Sonnet 5.5 medium (execution against a spec), W first; the implementation audit of each, Opus 5.5 medium, fresh; the Owner approves W and P before each merges (lane 3).

## 5. Open decisions for the Owner

None. The calls above are this spec's; the Owner can overrule any of them.

## 6. Risks

- **Over-shooting.** A change to one component that Vite bundles into a chunk many pages share shoots all of them. That is safe (more pictures than needed), and still far fewer than today.
- **A screen whose look comes from outside the build.** Data from the database and the stand-in services is not compared. A change that alters what a page shows only through test data lives in `tests/fixtures/` or `tests/browser/support/` stand-ins: `tests/fixtures/` shoots everything, and the plan adds the stand-in servers to the shoot-everything paths.
- **Version stamp moves.** If a SvelteKit update writes the version somewhere new, every run shoots everything (the lockfile change already does). A1's version-only case catches it in the picker's own test only for the files it knows; the `screens` log line naming why it shot everything is the signal.
