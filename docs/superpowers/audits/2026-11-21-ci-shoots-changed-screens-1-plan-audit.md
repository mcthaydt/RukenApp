# Plan audit 1: CI shoots only the screens a change touches

**d075c00 FAIL: 7 red, 5 notes.**

- Examined: `docs/superpowers/specs/2026-11-21-ci-shoots-changed-screens-design.md` at d075c00 (draft PR #256), against `CLAUDE.md`, `.github/workflows/ci.yml`, `playwright.config.ts`, `tests/browser/support/look.ts`, and the `visual-check`, `this-repo` and `review` skills, all at d075c00 (the code is the same as `main` at f7c666d).
- Audit: 2026-11-21 06:15 UTC, Opus 5.5, medium, in a fresh session. Lane 3 plan audit.
- Evidence beyond reading: three real `pnpm build` runs in a cloud container (Node 24.22.1, pnpm 10.34.6) on d075c00: the base, the base with one word added to the forgot-password page's heading (`src/routes/forgot-password/+page.svelte`), and the base with a `console.debug` added to that page's `+page.server.ts`. Each output was compared with `diff -rq` against the base. Both changes were reverted; nothing was committed but this file.

The approach (compare what the build makes, map changed files to SvelteKit nodes, shoot only when the page loaded a changed file) holds up. The spike's claim that two builds of one commit differ only in the version stamp held again. The reds below are places where the plan, built as written, either shoots every screen on every change (R1, R2, R7), cannot be observed by its own criteria (R4), or silently misses a screen it should shoot (R3, R5, R6). Each has a bounded fix inside the spec.

## Red

**R1. A one-page change changes files every page loads.**
UNIT: spec section 2 (how a node is "changed", and "a changed output file that no node reaches means every screen"); the picker in P; A1's cases.
VERDICT: red.
REQUIREMENT: A2 ("one screen changed, one screen shot").
REASON: The client entry and the route tables name every node chunk by its hashed name, so any page change gives them a new name or new content. Under the spec's rules that shoots every screen.
EVIDENCE: the heading-only build differs from the base in `client/_app/immutable/entry/app.<hash>.js` (new name: `app.3JogzGiq.js` became `app.jlDy-tJs.js`; the only content change is `../nodes/5.DNfh_8yV.js` becoming `../nodes/5.BYpMczK2.js`), and in `server/manifest.js`, `server/manifest-full.js` and `client/.vite/manifest.json` (the same names), besides the expected node 5 files and the version stamp. Every page loads the `app` entry, so `showTheOwner` would see a changed client file on every screen; and the three manifests are reached by no node, so the picker would answer `all` first.
EXPECTED: a change to one page's code marks that page's node only.
FIX: before hashing, replace every content-hashed output name in every file (and in the file's own path) with its stem (`nodes/5.DNfh_8yV.js` becomes `nodes/5.js`, `app.3JogzGiq.js` becomes `app.js`), then compare. A chunk whose only change is the name of something it imports is then unchanged, and a node is changed through its own `imports` list, which SvelteKit already lists in full. `showTheOwner` matches loaded addresses by the same stem. Add A1 cases: "a one-page change leaves the `app` entry and the manifests unchanged once names are stemmed", built from the real file shapes above. Files: the spec (sections 2 and 3, A1), then P's picker and its test.

**R2. Server source maps make every server change shoot everything.**
UNIT: spec section 2 ("a changed output file that no node reaches"); the picker in P.
VERDICT: red.
REQUIREMENT: A5 (a server-only change shoots its pages only).
REASON: Every server file has a `.js.map` beside it that changes with it, and no node's imports reach a `.map` file.
EVIDENCE: the `+page.server.ts` build differs from the base in exactly `server/entries/pages/forgot-password/_page.server.ts.js`, its `.js.map`, and the version stamp files. The heading build likewise changed `_page.svelte.js.map`. By the spec's rule the `.map` file alone answers `all`.
EXPECTED: a map file counts as part of the file it maps, or is left out.
FIX: the picker ignores `*.map` files (no page loads them). A1 case: "a changed `.js.map` next to a changed node file changes that node only". Files: the spec, then P's picker and its test.

**R3. Shared server code also used by an endpoint, a job or the hooks can change a screen the picker does not shoot.**
UNIT: spec section 2 (node changedness and the "no node reaches it" rule); the picker in P.
VERDICT: red.
REQUIREMENT: section 1, "When the picker cannot tell, it shoots every screen" (a doubt shoots).
REASON: The "no node reaches it" rule fires only when a changed file is reached by no node. A changed chunk reached by one node and also by a `+server.ts` endpoint, a job or `hooks.server.ts` marks only that node, yet the endpoint's answer or the hook can change what other screens show.
EVIDENCE: `src/routes/make/[game]/[question=question]/+page.server.ts:108` hands the page `branchesAddress: "/make/github/branches"`, an endpoint (`src/routes/make/github/branches/+server.ts`) the page calls from the browser; the `jobs/*` endpoints (review, decision-day, money) change what the Owner's and makers' pages show, and journeys call them before a picture; the hooks run on every page. None of these is a node.
EXPECTED: a changed server file reached from any root that is not a page node (an endpoint entry, the hooks, the server's own entry) answers `all`, with that root named in the reason.
FIX: the picker computes, for each changed server file, every root that reaches it (nodes, `entries/endpoints/**`, the hooks chunk, `server/index.js`), and answers `all` when any root is not a node. A1 case: "a chunk shared by a page node and an endpoint gives `all`". Files: the spec, then P's picker and its test.

**R4. The demo criteria on drafts cannot see the picker.**
UNIT: spec section 3, A2, A3, A5, A6 (and A7's label run if it is a draft).
VERDICT: red.
REQUIREMENT: CLAUDE.md, "A check is a test that fails by itself".
REASON: A draft runs only the journeys `--only-changed=origin/main` selects (`ci.yml` lines 235 to 239), and no journey imports a route file, so a draft that changes only a route or a stylesheet runs no journeys and takes no pictures, whatever the picker does.
EVIDENCE: the journeys import from `src/` only in `tests/browser/maker-page.test.ts` (`src/features/pages/themes.ts`) and `tests/browser/twilio-stand-in.test.ts` (`src/lib/server/text.ts`); no journey imports `src/routes/forgot-password/` or `src/app.css`. So A2, A5 and A6 would count zero pictures and fail with any picker, and A3 (zero expected) would pass with no picker at all.
EXPECTED: each demo is counted on a run where every journey runs.
FIX: count A2, A3, A5 and A6 on the full run (the demo marked ready for review), as A4 already does; A3 then also shows that every journey ran and passed. A4 folds into A2. State in the criteria that drafts keep selecting journeys as today (A10). Files: the spec only.

**R5. The stand-in servers are not in the shoot-everything list, and must not go into `RUN_EVERYTHING_WHEN`.**
UNIT: spec section 2 ("Shoot every screen when"), section 6 (risks), unit W.
VERDICT: red.
REQUIREMENT: section 6 says "the plan adds the stand-in servers to the shoot-everything paths"; A10 says the draft's test selection is as before.
REASON: Section 2's list and unit W's steps leave the stand-ins out, so a change to the data a stand-in returns (a fake GitHub repository list, a fake Stripe page) changes screens with no build change and shoots nothing. And the list section 2 names is `RUN_EVERYTHING_WHEN`, which also decides the draft's unit tests and journeys (`ci.yml` lines 119 and 237): adding paths there changes test selection, against A10.
EVIDENCE: the six stand-ins and helpers live in `tests/browser/support/` (`playwright.config.ts` webServer entries); `RUN_EVERYTHING_WHEN` at `ci.yml` line 51 is read by the unit test step and "Pick the journeys".
EXPECTED: a change under `tests/browser/support/` (any file, not only `look.ts`) or `wrangler.jsonc` shoots every screen, and the draft's test selection is untouched.
FIX: W adds a separate pattern, for example `SHOOT_EVERYTHING_WHEN`, that the `screens` job reads: `RUN_EVERYTHING_WHEN`'s paths plus `^tests/browser/support/`, `^wrangler\.jsonc$` and `^\.github/workflows/ci\.yml$`. `RUN_EVERYTHING_WHEN` stays as it is. Files: the spec, then `ci.yml` in W.

**R6. The browser's list of loaded files can fill up and stop growing.**
UNIT: spec section 2 ("`showTheOwner` asks the page which files it loaded"); `look.ts` in P.
VERDICT: red.
REQUIREMENT: section 1, a doubt shoots.
REASON: `performance.getEntriesByType("resource")` keeps 250 entries by default in Chromium and WebKit; past that the browser drops new entries silently. A long journey that moves between screens in one document (client-side navigation) and loads clips, pictures and chunks can fill it, and a changed chunk loaded after that is never seen, so its screen is not shot.
EVIDENCE: the Resource Timing buffer default (250) and its silent drop with a `resourcetimingbufferfull` event; the spec relies on these entries for every screen reached by client-side navigation, where the `<script>` and `<link>` addresses are still the first page's.
EXPECTED: when the list may be incomplete, the picture is taken.
FIX: `showTheOwner` shoots when the number of resource entries has reached the buffer's size (250, or what the page set), and says so in the attachment's name or the log. Its unit test (A1 or its own) covers "a full buffer shoots". Files: the spec, then `look.ts` and its test in P.

**R7. The base is built in a worktree that has no packages.**
UNIT: spec section 2 ("builds the base in a `git worktree`"), unit W, unit P.
VERDICT: red.
REQUIREMENT: section 1's outcome (only reached screens shot); A9 (no more than 2 minutes slower).
REASON: A new `git worktree` has no `node_modules`, so `pnpm build` there fails; the fallback then answers `all` on every run, and every run silently shoots every screen.
EVIDENCE: `pnpm build` runs `pnpm generate` (`svelte-kit sync`, `prisma generate`, `wrangler types`) then `vite build` (`package.json`), all from `node_modules`. The plan installs once, in the change's checkout.
EXPECTED: the base builds with the same packages, quickly.
FIX: the `screens` job checks the shoot-everything paths first (the lockfile and `package.json` are in them), and only then builds; with the lockfile unchanged, the base worktree runs `pnpm install --frozen-lockfile --offline` from the store the change's install just filled (or links the change's `node_modules`). Name which in the spec, and log the base build's result so a failed base is visible. Files: the spec, then `ci.yml` (W) or the picker (P), wherever the build step lands.

## Notes (recorded, not blocking)

- **N1. Match nodes by route, not by number.** Adding a route renumbers every node after it (`server/nodes/<n>.js`, `client/.../nodes/<n>.<hash>.js`), so comparing base node 7 with change node 7 compares two different pages. That over-shoots (safe) but makes A1's "a new route's node is changed" case pass for the wrong reason. Key each node by its `server_id` or component entry path, and report the change's numbers.
- **N2. Follow dynamic imports in the server output.** `server/nodes/<n>.js` reaches its page's server-rendered component only through `await import('../entries/pages/.../_page.svelte.js')` (seen in the heading build, where `_page.svelte.js` changed). A follower that reads only static `import` lines over-shoots through the "no node reaches it" rule.
- **N3. An empty `LOOK_CHANGED` means shoot everything.** When `screens` fails or is skipped, `needs.screens.outputs.*` is an empty string, not unset. Section 2 says "no `LOOK_CHANGED` at all"; say "missing or empty", and give A7 that case.
- **N4. W should add no time.** Until P lands, the `screens` job can answer `all` ("no picker yet") before installing or building, so W's own full run shows no slowdown. A9 is measured on P. Every browser piece then waits on `screens`; the local build here took 14 s each (two builds), plus checkout and install, which A9 measures on real runners.
- **N5. Slice-end screens page.** With pictures only of what each pull request changed, a slice's screens page (`visual-check`) can no longer be built from the latest `main` run alone; it needs a run with the `screenshots` label, or the slice's own runs. A follow-up for `visual-check` or `this-repo`, not this change.

## What holds

- Two builds of one commit differ only in `client/_app/version.json`, `server/chunks/instance.js` and `server/chunks/internal.js`; confirmed in all three builds.
- `server/nodes/<n>.js` lists `server_id`, the full `imports` list of client chunks, `stylesheets` and `fonts`, as the spec says; the static folder is copied to `client/` (`client/fonts/`), so a changed font is a changed client path.
- A server-only change leaves the client output identical, so A5's match must go through the node number, which the spec already provides (`/_app/immutable/nodes/<n>.<hash>.js`).
- The journeys run against the built app (`pnpm build` then `wrangler dev`, `playwright.config.ts`), so the addresses the page loads are the hashed build names the picker compares.
- The base choice (merge base on a pull request, first parent on `main`) and the two-unit split (W, a workflow-only pull request, first, as `build` requires) match the rules.
- Picking applies only to pictures: `showTheOwner` attaches and checks nothing, so a skipped picture skips no check (A10). The fonts and animations wait it also skips is already skipped on drafts today.
