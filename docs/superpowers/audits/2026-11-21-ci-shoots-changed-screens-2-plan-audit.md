# Plan audit 2: CI shoots only the screens a change touches

**cf00a52 FAIL: 4 red, 6 notes.**

- Examined: `docs/superpowers/specs/2026-11-21-ci-shoots-changed-screens-design.md` at cf00a52 (draft PR #256), against plan audit 1 (`docs/superpowers/audits/2026-11-21-ci-shoots-changed-screens-1-plan-audit.md`), `CLAUDE.md`, `.github/workflows/ci.yml`, `playwright.config.ts`, `tests/browser/support/look.ts`, and the `visual-check`, `this-repo` and `review` skills, all at cf00a52 (code identical to `main` at f7c666d).
- Audit: 2026-11-21 06:24 UTC, Opus 5.5, medium, in a fresh session. Lane 3 plan audit, round 2.
- Evidence beyond reading: five real `pnpm build` runs in a cloud container (Node 24.22.1, pnpm 10.34.6) on cf00a52, each output copied aside and compared with the base:
  1. **base**: cf00a52 as it is;
  2. **heading**: one word added to the forgot-password heading (`src/routes/forgot-password/+page.svelte:20`);
  3. **shared**: a class added to a component two pages share (`src/routes/legal/maker-agreement/Points.svelte:10`, used by the maker agreement and `make/[game]/agreement`);
  4. **server**: a `console.debug` appended to `src/routes/forgot-password/+page.server.ts`;
  5. **css**: a rule appended to the stylesheet every page loads (`src/lib/look.css`).
  
  On each pair, a throwaway script applied the spec's section 2 rules literally (leave out `*.map`, stem hashed names, blank the version, hash, then follow static and dynamic `import` edges from every node and every root the spec lists). Every source change was reverted; nothing was committed but this file. Graphify was not used: the questions here are about build output, which it does not index.

Round 1's direction still holds, and R2, R4, R5, R6 and R7 are fixed as asked. R1 and R3 are fixed in a way that, built as written, gives `all` on every pull request (R9, R10, R11 below) or misses a change in a shared client chunk entirely (R8). Each has a bounded fix inside the spec, checked below on the same builds.

## Round-1 reds

| Red | Fixed? | Evidence |
|---|---|---|
| R1 hashed names | **Partly.** The `app` entry and the manifests are unchanged once stemmed (heading build: with names stemmed, `entry/app.*.js` is byte-identical to the base's). But every shared client chunk has a hash-only name, so stemming cannot tell them apart: **R8**. | heading, shared |
| R2 `.map` files | Yes. Each changed server file's `.js.map` changed with it and is left out. | heading, server |
| R3 other roots | **Overreaches.** `manifest.js` and `manifest-full.js` dynamically import every node, so following them reaches every page's code: **R9**. | heading, server, shared |
| R4 demos on full runs | Yes. Section 3's preamble counts every demo on a run marked ready, and A3 also checks every journey ran. | spec lines 89 to 91 |
| R5 stand-ins | Yes. `SHOOT_EVERYTHING_WHEN` is new and `RUN_EVERYTHING_WHEN` is unchanged (spec line 69). | spec, `ci.yml:51` |
| R6 full resource list | Yes. Shoots at the buffer size, with A1's case. | spec lines 55, 102 |
| R7 worktree | Yes. Same checkout, same `node_modules`, lockfile and `package.json` shoot all before any build. | spec lines 76 to 80 |

## Red

**R8. Shared client chunks have no stem, so a change inside one is invisible.**
UNIT: spec section 2, "Stem every hashed name" and "Client files"; `showTheOwner`'s matching; P's picker.
VERDICT: red.
REQUIREMENT: section 1, only reached screens are shot and "a doubt shoots"; A1's "a shared client chunk changes every node that lists it".
REASON: SvelteKit names every shared client chunk by its hash alone (`chunks/BaNbYf_w.js`), so "replace the hashed name by its stem" leaves `chunks/.js` for all of them: the picker cannot compare them one to one, and `showTheOwner` cannot tell which one a page loaded.
EVIDENCE: base build: all 15 files in `client/_app/immutable/chunks/` are hash-only names (`8KMzRmif.js`, `BaNbYf_w.js`, ... `CemmcG4o.js`); stemmed, they share one key. Shared build: `Points.svelte`'s chunk became `C0eCv_wv.js` (was `CemmcG4o.js`); with the spec's stemming the client tree shows **no changed file at all**. This change was caught only because the same component also has a server chunk (`server/chunks/Points.js`); a change to code that runs only in the browser (an `onMount`, `src/lib/quiet-video.ts`) would have no server twin and shoot nothing. Also, a rule that recognises a hash by its shape (8 characters of `[A-Za-z0-9_-]`) matches real names: `server/chunks/instance.js` and `internal.js` are 8 letters, and this audit's first script stemmed them by mistake.
EXPECTED: a change inside any client file, named or hash-only, marks that file changed, and the address the page loads is matched exactly.
FIX: compare client files by content, not by stemmed name: hash each client file with every hashed file name inside its text replaced by one placeholder; a file of the change's build whose hash matches no file of the base's build is changed, and is reported by its **real** change-build address. `showTheOwner` matches the real addresses the page loaded against that list, with no stemming (the browser pieces build the same commit, and two builds of one commit give the same hashed names, plan audit 1). Add a guard: a loaded `/_app/immutable/` address that is not in the change build's file list shoots, saying why. Which files are hashed comes from the build's own `.vite/manifest.json` (`file` and `css` entries), not from a pattern. A node's `imports` (real names) are looked up in the changed list. Checked on these builds: heading gives `nodes/5.DEokk-eX.js` only; shared gives `chunks/C0eCv_wv.js` only (listed by nodes 13 and 17); server gives no client file. A1 cases: "a change inside a hash-only shared chunk marks that chunk, and every node that lists it"; "an 8-letter real name is not treated as a hash". Files: the spec (section 2, A1), then P's picker, `look.ts` and their tests.

**R9. The manifests reach every page, so every page change answers `all`.**
UNIT: spec section 2, "Other roots"; P's picker.
VERDICT: red.
REQUIREMENT: A2 (one screen changed, one screen shot) and A4 (a server-only change shoots its pages only).
REASON: `server/manifest.js` and `server/manifest-full.js` are listed as roots and the picker follows dynamic `import(...)`; both files hold `__memo(() => import('./nodes/0.js'))` for every node (42 dynamic imports each), so every file a node reaches is also reached by a root that is not a node.
EVIDENCE: with the spec's rules, the heading build's `server/entries/pages/forgot-password/_page.svelte.js` is reached by `manifest.js` and `manifest-full.js`; the server build's `_page.server.ts.js` likewise; the shared build's `server/chunks/Points.js` likewise. Each answers `all`.
EXPECTED: a page's own code marks that page's node; only code that a non-page root uses without going through a node (an endpoint, the hooks, a param matcher, the server entry) answers `all`.
FIX: when following a root that is not a node, stop at `server/nodes/*.js`: the manifests route to nodes, they do not run their code. Checked on these builds with that one change (and R10's): heading reaches no non-node root and gives node 5; server gives node 5; shared gives nodes 13 and 17. A1 case: "a page's own server file, reached by the manifests only through its node, changes that node only". Files: the spec (section 2, A1), then P's picker and its test.

**R10. A second per-build stamp makes every run answer `all`.**
UNIT: spec section 2, "Blank the version string", and the claim at line 29; P's picker.
VERDICT: red.
REQUIREMENT: section 1's outcome; A3 (nothing visual changed, nothing shot).
REASON: `server/chunks/instance.js` holds `const global = "__sveltekit_<id>"` (twice), an id that differs on every build and is not the version string, so blanking the version leaves `instance.js` changed on every build; `server/index.js`, a root, reaches it.
EVIDENCE: base build `__sveltekit_ttkt80`, heading build `__sveltekit_oyoaa`; version strings `1795241991854` and `1795242036194`. After blanking the version, `instance.js` is the only server file that differs besides the real change, in every pair (heading, shared, server), and the spec's rules answer `all` ("reached by `index.js`") on each. So section 2's "With the version string blanked out, the builds match file for file" is not true as written.
EXPECTED: two builds of one commit compare equal.
FIX: also blank `__sveltekit_[a-z0-9]+` (or leave out the three stamp files, `version.json`, `instance.js` and `internal.js`, after checking their only difference is the stamp). A1's version-only case uses both stamps, in the real shape of `instance.js`. Correct the claim at line 29. Files: the spec (section 2, A1), then P's picker and its test.

**R11. Files nothing imports change with a stylesheet and answer `all`.**
UNIT: spec section 2, "a changed file reached ... by no root at all answers `all`"; A5.
VERDICT: red.
REQUIREMENT: A5 ("the log names the changed client file, not `all`") and section 2's "a change to ... its own stylesheet ... shoots only that page".
REASON: a stylesheet change also changes the server's copy of that stylesheet and both Vite manifests, which no root imports.
EVIDENCE: css build: besides `client/_app/immutable/assets/0.*.css` (listed by node 0, which every page loads), the changed files are `server/_app/immutable/assets/_layout.DQLNiWPW.css` → `_layout.B8aih-nV.css`, `server/.vite/manifest.json` and `client/.vite/manifest.json`. None is reached by a node or a root, so the rule answers `all` ("reached by nothing"), and A5's "not `all`" fails. The base build's `server/_app/` also holds `_page.BiHmP06D.css` (node 4's own stylesheet), so a change to that page's style alone would answer `all` too.
EXPECTED: a stylesheet change marks the nodes that list it.
FIX: leave out `client/.vite/` and `server/.vite/` (no page loads them), and leave out `server/_app/` (a copy of client assets; the client copy carries the change). A1 case: "a stylesheet change marks the nodes that list it, and nothing else answers `all`". Files: the spec (section 2, A1), then P's picker and its test.

## Notes (recorded, not blocking)

- **N6. A new route still shoots every screen, and A1 says otherwise.** The client `app` entry lists every node and the route table, so adding a route changes it, and every page loads it. A1's last case ("the other nodes, renumbered, as unchanged") can pass at the node level while every screen is shot. That is safe; say so in A1 or section 6 so nobody reads a full shoot after a new route as a bug. Client node chunks are named by number (`nodes/<n>.<hash>.js`), so with R8's content compare a renumbered node whose content is unchanged is not marked, which is right.
- **N7. Test support the journeys import is not in `SHOOT_EVERYTHING_WHEN`.** Journeys import `tests/support/tar.ts` (game archives the stand-in GitHub serves) and `tests/support/look-tokens.ts`; the stand-ins in `tests/browser/support/` import `src/features/money/fee-rows.ts` (`fake-stripe-server.ts:3`), `src/features/launch/now.ts` (`launch.ts:2`) and `src/features/games/github-connect.ts` (`database.ts:2`). A change to `tar.ts` changes no build output. Adding `^tests/support/` is cheap; the `src/` files are in the build and so are compared.
- **N8. The pieces must still run when `screens` fails.** With `needs: [changes, screens]`, keep each piece's `if: ${{ !cancelled() && ... }}` so a failed `screens` job runs the journeys with an empty `LOOK_CHANGED` (shoot all), and does not skip them. Say it in W's step, as `changes` does today (`ci.yml:88` to 89).
- **N9. Matching "the journey's own file".** `testInfo.file` is an absolute path and `git diff --name-only` gives repo-relative paths; the plan should name the comparison (path relative to the repo root).
- **N10. Demo branch clean-up.** Section 3 deletes each demo branch after closing it unmerged. In this project, branch deletes by `gh api` were refused before and given to the Owner as commands; plan for that, and count the demos against the 3 open pull requests (Settings).
- **N11. A push to `main` with more than one commit.** `HEAD^1` covers a merge commit, which is the only way `main` changes under the merge rule. If that ever changes, `github.event.before` is the base that covers every pushed commit.

## What holds

- Two builds of one commit differ only in `client/_app/version.json`, `server/chunks/instance.js` and `server/chunks/internal.js` (round 1), and `server/nodes/<n>.js` lists `server_id`, `imports`, `stylesheets` and `fonts` as the spec says.
- With the version and the `__sveltekit_` id blanked, `.map`, `.vite/` and `server/_app/` left out, client files compared by content and roots stopping at nodes, the four changes give exactly: heading, node 5; server, node 5 (through its server file); shared, the `Points` chunk and nodes 13 and 17; css, the layout stylesheet, listed by node 0. That is A2, A4 and A5's expected answer, from real output.
- No route sets `csr = false` or prerenders, and nothing in `src/` reads `$env/static/*`, so the pieces' builds (with the journeys' environment) and the `screens` job's build of the same commit give the same hashed names: matching real addresses (R8's fix) is sound.
- The base choice, the two-unit split (W first), the `SHOOT_EVERYTHING_WHEN` list, the 250-entry guard, the empty-`LOOK_CHANGED` rule and A8's "no picker yet" short-cut are as round 1 asked.
