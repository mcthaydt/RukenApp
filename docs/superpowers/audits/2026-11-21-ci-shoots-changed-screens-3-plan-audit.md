# Plan audit 3: CI shoots only the screens a change touches

**14e2d08 FAIL: 1 red, 4 notes.**

- Examined: `docs/superpowers/specs/2026-11-21-ci-shoots-changed-screens-design.md` at 14e2d08 (draft PR #256), against plan audits 1 and 2 (`docs/superpowers/audits/2026-11-21-ci-shoots-changed-screens-1-plan-audit.md`, `-2-plan-audit.md`), `CLAUDE.md`, `.github/workflows/ci.yml`, `playwright.config.ts`, `vite.config.ts`, `tests/browser/support/look.ts`, and the `review`, `visual-check` and `this-repo` skills, all at 14e2d08.
- Audit: 2026-11-21 06:33 UTC, Opus 5.5, medium, in a fresh session. Lane 3 plan audit, round 3.
- Evidence beyond reading: eight real `pnpm build` runs on 14e2d08 in a cloud container (pnpm 10.34.6; Node 22.23.5, as the container has no Node 24: the output shapes match the ones rounds 1 and 2 recorded on Node 24.22.1), each output copied aside and compared with the base by a throwaway script that applies section 2 as now written, literally: leave out `*.map`, `client/.vite/`, `server/.vite/`, `server/_app/`; take hashed names from each build's `client/.vite/manifest.json` (`file`, `css`, `assets`); replace each by one placeholder; blank the version string and `__sveltekit_<id>`; compare client files by content and server files by path; follow static and dynamic imports from each node, and from each non-node root stopping at `server/nodes/`. The builds:
  1. **base2**: the same commit built again;
  2. **heading**: forgot-password heading words changed (`src/routes/forgot-password/+page.svelte:20`);
  3. **shared**: a class on `<ol>` in `src/routes/legal/maker-agreement/Points.svelte`;
  4. **server**: a `console.debug` appended to `src/routes/forgot-password/+page.server.ts`;
  5. **css**: a rule appended to `src/lib/look.css` (every page's stylesheet);
  6. **quiet**: a browser-only constant changed in `src/lib/quiet-video.ts` (`LEAST_MEMORY_GB` 4 to 3), the kind of change round 2 said stemming would miss;
  7. **env**: the same commit built with the journeys' settings from `playwright.config.ts` in the environment;
  8. **newroute**: a new page `src/routes/about-audit/+page.svelte`.
  
  Every source change was reverted; nothing was committed but this file. Graphify was not used: the questions are about build output, which it does not index.

Round 2's four reds are fixed, and the rules now give the right answer on every real build tried except one: the new-route case that A1 asks for cannot pass as written (R12). Everything else holds.

## Round-2 reds

| Red | Fixed? | Evidence |
|---|---|---|
| R8 shared chunks by content | **Yes.** Every file in `client/_app/immutable/` (47 in base) is named in the build's own `client/.vite/manifest.json` (none missing, in all eight builds), and no two base client files share a normalised hash, so the content compare is one to one. | shared: only `/_app/immutable/chunks/BxHIYTaB.js`, listed by nodes 13 and 17. quiet: only `/_app/immutable/chunks/Hww_D4Ur.js`, with **no** server file changed, listed by nodes 4, 6, 11, 14, 15, 16, 18, 21: caught by the client compare alone, which stemming would have missed. |
| R9 roots stop at nodes | **Yes.** | heading: node 5 only, no `all`. server: node 5 only (through `_page.server.ts.js`), no `all`. shared: nodes 13 and 17, no `all`. |
| R10 second stamp | **Yes.** | base2 and env against base: zero changed client files, zero changed server files. |
| R11 mirrors left out | **Yes.** | css: only `/_app/immutable/assets/0.BtEcG_29.css`, listed by node 0; no `all`. That is A5's expected answer. |

The R8 guard is sound: the env build (the journeys' settings) gives the same client file names as the base build, so a page in the browser pieces loads addresses the `screens` job's list carries. `server/nodes/5.js` lists its own client chunk in `imports`, and SvelteKit adds every `imports` entry as a `<link rel="modulepreload">` (`server/chunks/instance.js:1381`, `1445`), so the node chunk address is in the page for `showTheOwner` to find, even on a node changed only through its server file (A4). No node uses inline styles (`inline_styles` appears in no `server/nodes/*.js`).

## Red

**R12. A1's new-route case cannot pass under section 2's rules.**
UNIT: spec section 3, A1's case "a new route marks its own node, and leaves a renumbered node whose content is the same unmarked"; section 6, "A new route shoots every screen".
VERDICT: red.
REQUIREMENT: A1 (the picker's tests, written first, pass once the picker exists) and section 2 (the rules the picker follows). A criterion that contradicts the rules leaves the builder to bend one of them, and CLAUDE.md says a change does not quietly edit its own check.
REASON: adding a route changes the route table in `server/manifest.js` and `server/manifest-full.js` (roots, compared by path) and renumbers every later `server/nodes/<n>.js` (compared by path: `export const index = <n>` and the `../entries/pages/...` path change), so the rules answer `all`, not "its own node, renumbered nodes unmarked".
EVIDENCE: newroute build against base: changed server files are `server/manifest.js`, `server/manifest-full.js`, `server/nodes/5.js` to `28.js` and `server/entries/pages/about-audit/_page.svelte.js`; changed client files are the `app` entry, the new node chunk and two shared chunks (`B5xPqD63.js`, `DMzk_aLI.js`). The rules answer `all` ("`server/manifest.js` reached by root `server/manifest.js`"); every renumbered node is also marked, through its own changed node file. Whatever reading of "a server file it reaches" the builder takes, the answer is `all`. The screens shot are the same as the spec expects (every one), so the outcome is safe; only the test case and section 6's reason are wrong.
EXPECTED: A1's case says what the rules give, and section 6 says why.
FIX: in A1, replace the case with "a new route (its manifests' route table changes, later nodes renumber) answers `all`, naming the changed manifest: safe, and expected (N6)". In section 6, say a new route shoots every screen because the route table in the server manifests changes (and the client `app` entry with it). Files: the spec only. Nothing in section 2 changes.

## Notes (recorded, not blocking)

- **N12. Name the matcher root as the build writes it.** Section 2 lists `server/entries/matchers/` and `server/params.js` "where they exist"; neither exists. The build writes the `handle` matcher to `server/entries/params.js`, which both manifests import dynamically (`server/manifest.js:317`). Because the manifests are roots, the rules already reach it and a change there answers `all`, which is right; naming the real path saves the builder a search.
- **N13. Content matching is one to one today, not by construction.** A changed client file whose normalised text happens to equal a different base file's (two files that differ only in which hashed chunk they import) would count as unchanged. None of the 47 base files collide, and a page's own component always has a server twin compared by path, so this needs a browser-only file swapping one import for another of the same shape. If P wants it closed, replace each hashed name by the normalised hash of the file it names instead of one placeholder; otherwise an A1 case that two base files with equal normalised text are reported in the log is enough.
- **N14. A9 is on the critical path.** With `needs: [changes, screens]`, the pieces start only after `screens` has installed and built twice (about 14 seconds a build in this 4-core container, plus install and runner start). A9's 2-minute budget is tight; the spec's fallback (move the comparing into the pieces) is the right answer if it fails. Measure on W's run, which already shows the job's start-up cost.
- **N15. A3's demo must avoid `tests/support/`.** `^tests/support/` is now in `SHOOT_EVERYTHING_WHEN` (N7), so a "unit test only" demo that touches a helper there shoots every screen and fails A3. The plan should pick a test file outside `tests/support/` and `tests/fixtures/`.

## What holds

- Two builds of one commit, with or without the journeys' settings, compare equal under the rules (base2, env).
- The four changes rounds 1 and 2 used give exactly what A2, A4 and A5 expect (heading and server: node 5; shared: the `Points` chunk and nodes 13 and 17; css: the layout stylesheet, node 0), and a browser-only change is caught by the content compare alone (quiet).
- Section 2's base choice, the W-then-P split, `SHOOT_EVERYTHING_WHEN` beside an unchanged `RUN_EVERYTHING_WHEN`, `!cancelled()` on the pieces with an empty `LOOK_CHANGED` shooting every screen, the 250-entry guard, the relative journey path (N9), the demo branch clean-up (N10) and the `github.event.before` note (N11) are as rounds 1 and 2 asked.
- Plan audit round 4 needs only to check R12's text against this file's newroute evidence; no new build is needed.
