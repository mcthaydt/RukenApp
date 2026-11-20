# Plan audit, cycle 1: the games domain on the test site

Commit examined: `f72a559` (PR #207, `docs/superpowers/specs/2026-11-20-games-domain-design.md`), against `main` at `949ffb5`, PR #206 (Unit R) at its head on 2026-11-20, decision day's Unit H (`docs/superpowers/specs/2026-11-20-decision-day-design.md`, the unit table), Units F and G and Task 24 in `docs/superpowers/plans/2026-11-15-slice-2-rest.md`, and the Owner's command file in the project's files (`owner-steps/2026-11-20-games-domain-commands.md`). Graphify index at `0053810` (`cloudflare/games/worker.ts` has two neighbours, `src/features/play/gate.ts` and `src/lib/files/r2-store.ts`, and no dependents).

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**3 red, 6 notes.** The approach holds: the gate already serves `media.` and `g-` names when `PATH_HOST` is unset, the site derives every game and clip address from `GAME_ADDRESS_PATTERN`, nothing stored needs a migration, and the domain stays out of the repository. The reds are about the plan's own files and checks, not the design. Fix them and run cycle 2.

## Red

**F1. W edits a file R edits, while the spec says they share none.**
- UNIT: spec section 4, unit table and "Other open work"; Task 1 Step 5.
- VERDICT: red.
- REQUIREMENT: `staged-path`, Splitting: each unit lists the files it owns, and no two running units own the same file.
- REASON: Task 1 Step 5 edits `docs/superpowers/plans/2026-11-15-slice-2-rest.md`, but W's "Files it owns" leaves it out, and the spec says R touches "the slice 2 rest plan … none of W's files. So W runs beside R".
- EVIDENCE: PR #206's file list includes `docs/superpowers/plans/2026-11-15-slice-2-rest.md`; spec Task 1 Step 5 edits the same file.
- EXPECTED: W's row names the plan file, and W (or at least Step 5) waits on R's merge, starting from a `main` that holds #206.
- FIX: in the spec only: add the plan file to W's "Files it owns"; set "Waits on" to R (#206) on `main` for that file; correct the "Other open work" sentence.

**F2. After the switch, the plan the G session runs from still sends the Owner back to the free address.**
- UNIT: spec Task 1 Step 5 and section 5.
- VERDICT: red.
- REQUIREMENT: the spec's outcome (section 1: the free address stops answering) and section 5 (Task 24 changes once this is live).
- REASON: section 5 lives only in this spec. Task 24 is run from the slice 2 rest plan, which says it wins over older documents, and Step 5 only edits "What moves to launch". If Task 24 Step 1 fails after the switch, the plan's O-B says "these are the commands again": they put `PATH_HOST` back on the gate, point `GAME_ADDRESS_PATTERN` at the free host, and deploy the gate without `--route`. That undoes the switch, and with `workers_dev` false the gate may answer on no address at all.
- EVIDENCE: `2026-11-15-slice-2-rest.md` lines 713 to 719 (O-B, steps 1, 4, 5) and 734 and 737 (Task 24 Steps 1 and 4, `GAMES-HOST` shapes, "Not found." blamed on `PATH_HOST`); spec Task 1 Step 5 names only "What moves to launch".
- EXPECTED: once W merges, the plan itself tells the G session and the Owner the new shapes and says not to re-run O-B.
- FIX: Task 1 Step 5 also edits, in the plan: O-B's lead line (after the games domain is live, do not run these; the undo is in the games domain spec), and Task 24 Steps 1 and 4 (section 5's lines, or one line pointing at it). Files: the spec's Step 5 text; at build time, the plan file (with F1).

**F3. A7 checks a line the site does not have.**
- UNIT: spec section 3, A7.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, "Acceptance criteria come first": criteria a program or a person can observe.
- REASON: A7's second half is "the 'Your game runs at' line on a maker's page". No such line exists on `main` or in R.
- EVIDENCE: `git grep "runs at"` finds nothing in `src/` on `origin/main` or on PR #206's head; the line is only in the superseded `2026-11-13-slice-2-games-play.md:988`.
- EXPECTED: A7 names only what exists: the `look` link the review command prints (`src/routes/jobs/review/+server.ts:73-86`).
- FIX: in the spec only: drop the maker's-page half of A7. O5's "the Floor Fifty thread gives the exact id" stays, read from the `look` link.

## Notes

**N1. The switch can be done with no gap.** The Owner can give the route on today's `main` (`workers_dev` still true, so both addresses answer), then set `GAME_ADDRESS_PATTERN`, then delete `PATH_HOST`; W then merges and the next gate deploy with `--route` closes the free address. Floor Fifty's server can allow the new origin before the switch, and the "games don't load between O2 and O3" window and Floor Fifty's outage go away. Evidence: `gate.ts:199` uses path mode only on the exact `PATH_HOST` host; any other host goes by its first label (`gate.ts:201-205`), so both shapes work at once. Fix if taken: reorder Task 2 and the command file; W's merge becomes the last step instead of the first.

**N2. The reason given for not building W beside H is not accurate.** The spec says W and H share "the same Owner deploy step". H is deployed by Workers Builds on merge (`pnpm run deploy`, which `tests/wrangler.test.ts:137-142` pins to the site only), not by `deploy:games`, and H's files (decision day spec, H's row) share none with W. The hold is harmless; reword its reason (one lane 3 change in `cloudflare/` at a time, so a broken deploy has one cause) or drop it.

**N3. "One-host mode" overstates what the journeys use.** The app in the journeys uses the name form, `GAME_ADDRESS_PATTERN: "http://{name}.localhost:8788"` (`playwright.config.ts:105`); `PATH_HOST: "localhost:8788"` (line 125) serves only the path-form test in `tests/browser/game-gate.test.ts:17`. The Call to keep `PATH_HOST` in the code still holds (that test and `gate.test.ts` use it). Wording in section 2's Call and A3.

**N4. A2 can trip on the new comment.** The test drops comment lines before parsing, but its "no real address" check reads the whole file and matches `[a-z0-9-]+\.(…|dev|…)\b` (`tests/cloudflare/games-worker.test.ts:55-60`). A comment in Step 2 that says "workers.dev" fails A2. Today's comment says "free Cloudflare address". Add to Step 2: write neither `workers.dev` nor the domain in the comment.

**N5. Games share cookies with each other.** Every `g-…` name is under one registrable name, so a game's script can set a cookie with `Domain=` the games domain, and every other game and `media.` receive it. Section 1's "one game cannot read another game's saves" holds for local storage and IndexedDB (per origin), not for cookies. Record it in section 6 as a known limit; listing the games domain on the Public Suffix List is a launch question for the Owner, not this unit.

**N6. The Owner's command file has no undo, and one step asks a question.** The spec's "Undoing it" commands are not in `owner-steps/2026-11-20-games-domain-commands.md`, so the Owner would have to come back for them. `wrangler secret delete` asks "Are you sure…? (Y/n)": say so beside that command. Project file only.

## Checked and found right

- The domain stays out of the repository: the route goes in as `pnpm run deploy:games --route "*.GAMES-DOMAIN/*"`; pnpm passes the flag to the script, and the script itself stays `wrangler deploy --config cloudflare/games/wrangler.jsonc` (`tests/wrangler.test.ts:148-149`, unchanged). The gate's tests forbid `routes` and a real name in its config (`games-worker.test.ts:51-60`).
- The gate needs no code change: with `PATH_HOST` unset, `media.` serves clips and photos and `g-<id>.` serves a game (`gate.ts:199-207`). A4 (`ok` on any host, `gate.ts:196`) and A5 (`/x/` is a bad pass, 403 with the run-out line, `gate.ts:152`) expect what the code answers.
- The site follows the setting: `services.ts:100-101` (games feature) builds the game and `media` addresses from `GAME_ADDRESS_PATTERN`, `checkAddressPattern` accepts `https://{name}.<domain>` (`addresses.ts:18`), and no game address is stored. The site sets no content security policy that would need the new names (`grep` of `src/hooks.server.ts`, `src/lib`, `svelte.config.js`).
- O3 without `--name` lands on the site's Worker: the root `wrangler.jsonc:4` names it `ruken`. O4 names the gate's config.
- `wrangler dev` ignores `workers_dev`, so the journeys' gate on `localhost:8788` does not change (A3).
- R (#206) touches no code file of W's; F (Tasks 20 to 23) reads addresses through `gameAddress`; H shares no file with W.
- Section 4's account of a game already on the site (no migration, a new pass works, old frames and `look` links stop, saves start fresh, the server must allow the new origin) matches the code.
- The owner command file matches O1 to O5 in order and content, with the real domain where the spec writes `GAMES-DOMAIN`.

Not checked, as the spec says: whether Universal SSL already covers one level of names on the new zone, and whether a gate deploy without `--route` keeps the route. A4, run again, catches both.
