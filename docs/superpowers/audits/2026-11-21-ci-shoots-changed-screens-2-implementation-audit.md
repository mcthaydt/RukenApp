# Implementation audit 2 (unit P): CI shoots only the screens a change touches

**7534f9e FAIL: 1 red, 5 notes.**

- Examined: draft PR #262, branch `claude/project-thread-sws92y` at 7534f9e (the diff `c421b3e..7534f9e`: `tests/browser/support/changed-screens.ts`, `tests/browser/support/look.ts`, `tests/changed-screens.test.ts`, `.claude/skills/this-repo/SKILL.md`), against the spec `docs/superpowers/specs/2026-11-21-ci-shoots-changed-screens-design.md`, plan audits 1 to 4, W's implementation audit (`-1-implementation-audit.md`) and `.github/workflows/ci.yml` as W merged it (#259).
- Audit: 2026-11-21 10:38 UTC, Opus 5.5, medium, in a fresh session. Lane 3 implementation audit. This is the topic's second implementation audit (the first was W's), hence cycle 2.
- Graphify was not used: the questions are about build output and one new script, which it does not index.

## What ran

- `pnpm exec vitest run tests/changed-screens.test.ts`: 24 passed. `pnpm lint`: exit 0. `pnpm typecheck`: exit 0 (on a tree without leftover build output; with the audit's own builds lying in `.svelte-kit/output/` it reports errors in those generated files only, which CI never has at that step).
- Ten real `pnpm build` runs at 7534f9e in a cloud container (pnpm 10.34.6, Node 22.23.5: the container has no Node 24), each output copied aside and given to the picker as `node tests/browser/support/changed-screens.ts <change> <base> <empty paths file>`. Every source edit was reverted; nothing was committed but this file.

| Build | Change | Picker's answer |
|---|---|---|
| base2 | none, built again | nothing changed (0 nodes, 0 client files) |
| heading | forgot-password heading words | node 5 only; client `nodes/5.BmbR0VXG.js` |
| server | `console.debug` in `forgot-password/+page.server.ts` | node 5 only; no client file |
| quiet | `LEAST_MEMORY_GB` 4 to 3 in `src/lib/quiet-video.ts` (browser only) | chunk `Hww_D4Ur.js`; nodes 4, 6, 11, 14, 15, 16, 18, 21 |
| shared | a class on `<ol>` in `legal/maker-agreement/Points.svelte` | chunk `Dblkbutu.js`; nodes 13 and 17 |
| css | a rule appended to `src/lib/look.css` | `assets/0.CYeNJbYn.css`; node 0; not `all` |
| newroute | new page `src/routes/about-audit/+page.svelte` | `all`: `server/manifest-full.js` changed |
| endpoint | `console.debug` in `src/routes/healthz/+server.ts` | `all`: the endpoint changed |
| hooks | `console.debug` in `src/hooks.server.ts` | `all`: `hooks.server.js` changed |

  These are the same answers plan audit 3 got from the rules on its eight builds (shared and quiet name the same nodes), so the code does what the spec says.
- Real journey runs (`tests/browser/look.test.ts`, Postgres 16 local, `--trace off`), the build in each run made from the source as edited, `LOOK_CHANGED` set to the picker's answer for that edit:
  - identical source, base2's answer, computer: 24 passed, **0** `look:` pictures (the hashed names of the journeys' own build matched the `screens`-style build: the R8 guard did not fire);
  - forgot-password paragraph words changed, its answer, computer: 24 passed, exactly `look: forgot password` and `look: check your email`;
  - the same, tablet (Chromium): the same two pictures;
  - `+page.server.ts` change only, its answer, computer: 24 passed, exactly the same two pictures (node 5's chunk address, unchanged in the client, is found in the page's `modulepreload` links: A4's case works end to end).
  - Not run: the phone project (WebKit is not installed in this container). CI runs it.
  - A first try with the heading words changed failed one check, because the journey looks for the heading "Forgot your password?" by name; that is the journey doing its job, not the picker. The paragraph edit was used instead.

## Plan-audit rules

| Rule | In the code? | Evidence |
|---|---|---|
| R8 client by content, real addresses, hashed names from the build's manifest, guard | Yes | `hashedBasenames` reads `file`/`css`/`assets` from `client/.vite/manifest.json`; client compare by normalised hash (`compare`, `baseClient`); `immutableFiles` and the guard in `shouldShoot`. quiet and shared builds above; A1 tests "shared chunk named by its hash alone", "an 8-letter real name". |
| R9 roots stop at nodes | Yes | `reachFrom` skips `server/nodes/`; heading and server builds give node 5, not `all`. |
| R10 both stamps blanked | Yes | version string and `__sveltekit_<id>` in `readBuild`; base2 gives nothing changed. |
| R11 mirrors left out | Yes | `isLeftOut` drops `*.map`, `client/.vite/`, `server/.vite/`, `server/_app/`; css build gives the stylesheet and node 0, not `all`. |
| R12 new route answers `all` | Yes | newroute build; A1 test "a new route ... answers all, naming the manifest". |
| N16 missing roots | Yes | roots are taken from the files both builds hold, so a root in neither is not followed; one in only one build is in `changedServer` or `removedServer` and answers `all`. A1 tests "missing from both builds" and "present in only one build". |
| N13 equal base texts logged | Yes | `notes` names them; A1 test. |
| R6 full resource list | **No**, see R1 below. | |

## Red

**R1. The full-resource-list guard counts the wrong list, so it never fires when the browser's buffer is full.**
UNIT: `tests/browser/support/look.ts` (`filesTheScreenLoaded`, `showTheOwner`) and `shouldShoot` in `tests/browser/support/changed-screens.ts`.
VERDICT: red.
REQUIREMENT: spec section 2, "At the moment of a picture": it shoots when "the resource list may be full: its length has reached the browser's buffer size (250 ...), after which the browser drops new entries silently" (plan audit 1, R6); and the rule that a screen a change touches is never skipped.
REASON: `shouldShoot` compares `input.loaded.length` with 250, but `loaded` is what `filesTheScreenLoaded` returns: the resource entries plus the document's tags, filtered to the same origin and **deduplicated by path**. A page that polls one address (as `src/routes/join/done/+page.svelte` does every 2 seconds, and the play page's beats) or loads cross-origin files fills the browser's buffer while the deduplicated list stays short, so the guard says nothing and a changed file loaded after the buffer filled (for example a node chunk fetched on a client-side move to the next screen) is missed.
EVIDENCE: a page in Chromium (Playwright from this repo) that fetches `/poll` 300 times: `performance.getEntriesByType("resource").length` is **250** (full), and the same collection `filesTheScreenLoaded` makes has **1** entry. The A1 test "shoots when the resource list may be full (250 entries)" passes only because it feeds 250 different addresses.
EXPECTED: the guard fires whenever the browser's resource list holds 250 entries (or the buffer size the page set), whatever their addresses.
FIX: have `filesTheScreenLoaded` also return the raw `performance.getEntriesByType("resource").length`, pass it to `shouldShoot` as its own field (for example `resourceCount`), and test that field against `RESOURCE_BUFFER_SIZE` instead of `loaded.length`; change the A1 test to 250 raw entries with a short deduplicated list. Files: `tests/browser/support/look.ts`, `tests/browser/support/changed-screens.ts`, `tests/changed-screens.test.ts`.

## Notes (recorded, not blocking)

- **N17. A2, A3, A4, A5, A6's demo and label runs, A7 and A9 are not yet shown.** The builder's reason holds: this pull request touches `tests/browser/support/`, which is in `SHOOT_EVERYTHING_WHEN`, so its own runs shoot everything, and a demo needs P on `main` first. This audit's real builds and journey runs cover A2's and A4's answer and pictures and A5's answer locally, and the code of A6 and A7 was read in W's audit. The CI demos and A9's timing remain the build session's after the merge, and the owner should know "done" waits for them.
- **N18. `ci.yml`'s top comment goes stale on merge.** Lines 19 to 21 say the picker is "built in the next pull request" and list "no picker yet" as a doubt. A11 asks the `ci.yml` comments to say what the code does. `ci.yml` is not in P's file list, so this is a follow-up for the next change to that file (lane 3), not a fix here.
- **N19. No A1 case changes only the server component.** The spec's case "its server component, reached only through the node's dynamic import, likewise" is covered only together with the client change (the heading test changes both). The dynamic-import path is followed (`importsOf` matches `import(`), and the real heading build marks node 5 through both, so this is a missing test, not a missing behaviour.
- **N20. On a person's own computer every picture's name carries "(there is no answer to read)".** That is what the spec asks ("saying why in the attachment's name"); a person reading a local report may find it noisy.
- **N21. The branch is behind `main`** (based on c421b3e; `main` is at f8f568d). The merge integration (`release`) will run it against the newer `main`.

## What holds

- The four files are the ones the plan gives P; no other file, check name, `RUN_EVERYTHING_WHEN` or report upload changed (A10 from the diff).
- The `this-repo` line says what the picker does and when every screen is shot, and the old "No program picks" line is gone; `showTheOwner`'s comment no longer mentions nine devices or `LOOK_SHOTS`, and nothing else in the repo reads `LOOK_SHOTS` (A11, apart from N18).
- The picker never throws: an unreadable tree answers `all` (A1 test), and the `screens` job adds its own `all` for a failed or empty answer.

## Verdict

FAIL on one red, R1, with a bounded fix in three files. After the fix, a recheck needs only the changed A1 test and a rerun of the 300-fetch check against the new count; the rest of this audit stands unless other files change.
