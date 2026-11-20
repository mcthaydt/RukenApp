# Implementation audit, cycle 1: the games domain, Unit W

Commit examined: `2c77be3` (PR #217, branch `claude/project-thread-azdxd7`), the diff `c7f14bb..2c77be3` (4 files), against `docs/superpowers/specs/2026-11-20-games-domain-design.md` (Task 2, A1 to A3, section 5) and its plan audit (`2026-11-20-games-domain-1-plan-audit.md`, cycles 1 and 2). Graphify: `cloudflare/games/worker.ts` has two neighbours (`src/features/play/gate.ts`, `src/lib/files/r2-store.ts`) and no dependents, so a comment change there reaches nothing else.

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**Nothing red. 4 notes, none blocking.** W does what Task 2 asks, in the four files its row owns, and nothing else. One thing is still open and is not a finding: CI at `2c77be3` had not finished when this was read (the `CI` run was pending and `commit-authors` queued), so A3 is not yet proved by CI. The merge waits on the full run once the draft is marked ready, as `release` says.

## Task 2, step by step

- **Step 1 (A1).** The test is renamed to "has no free address and no preview addresses: it answers only on the games domain's route" and expects `workers_dev` false (`tests/cloudflare/games-worker.test.ts:43-46`). `main`'s config at `c7f14bb` has `"workers_dev": true`, so the test fails there on that line alone; the build report quotes "expected true to be false". The PR body names the changed test and why ("Changed test"), as `build` asks.
- **Step 2 (A2).** `cloudflare/games/wrangler.jsonc:9-12`: `workers_dev` false; the comment says the route is given as `--route` on every deploy and the domain is not written. Checked with the test's own expressions on the new file (schema line removed): no `https://`, and the "real address" pattern `[a-z0-9-]+\.(com|net|org|io|dev|gg|games)\b` does not match. No `vars`, `route`, `routes` or `hyperdrive` key. The other tests in the file are unchanged.
- **Step 3.** `cloudflare/games/worker.ts:16-19`: comment only; `PATH_HOST` is said to be set only on a local run. Matches `playwright.config.ts:125` (the journeys' gate sets it) and `tests/browser/game-gate.test.ts:17` (the one path-form test). No code changed, and the test that `worker.ts` reads `PATH_HOST` still holds.
- **Step 4.** The slice 2 rest plan: O-B's lead line says not to run its commands once the games domain is live and points at the spec's Task 1 undo (plan audit F2); Task 24 Step 1 and Step 4 carry section 5's lines, keeping the "before then" form for a run before the switch; "What moves to launch" marks the first item done on the test site and points the route question at A9. Section 5's "`PATH_HOST` no longer exists" shows as "Not found. … means `GAME_ADDRESS_PATTERN` is wrong".
- **Step 5.** The PR body reports `pnpm lint`, `pnpm typecheck`, `pnpm test` (104 files, 1492 tests) and `pnpm build` at `3c4d853`, plus a `wrangler deploy --dry-run` of the gate. `3c4d853..2c77be3` only adds and removes the live-state file, which is gone at the head.
- **Rules.** Every commit in `c7f14bb..2c77be3` is authored and committed by McThayDT with the noreply address. The PR body's last line is "Requested by **McThayDT**". The diff touches only the four files W's row owns. No domain or account name is in the diff.
- **Codebase.** `tests/wrangler.test.ts:69-70` pins the site's own `workers_dev` (root `wrangler.jsonc`), not the gate's, so it is untouched and still right. `wrangler dev` ignores `workers_dev`, so the journeys' gate on `localhost:8788` does not change.

## Notes

**N1. Two code comments outside W still describe the free address as the present.**
- UNIT: `src/features/play/gate.ts:13-16` (the cookie paragraph) and `:25-26` (`pathHost`: "Until the games' domain exists every game shares one free address").
- VERDICT: note.
- REQUIREMENT: section 2's table lists only `worker.ts`'s comment; `gate.ts` is not in W's files (and is lane 2).
- REASON: after O5 the deployed gate has no `pathHost`, so these read as out of date. Behaviour is unaffected.
- EVIDENCE: the lines above, at `2c77be3`.
- EXPECTED: a later change to `gate.ts` words them as "on a local run" like `worker.ts`.
- FIX: follow-up only, in whichever unit next edits `gate.ts`. Not here.

**N2. One comment in W's own test file reads as the present.**
- UNIT: `tests/cloudflare/games-worker.test.ts:72` ("On the one free address the game is in the path; the setting says which host that is.").
- VERDICT: note.
- REASON: it still describes what `PATH_HOST` does, but not that only a local run sets it now; `worker.ts`'s new comment does.
- FIX: optional, the one comment line, in the same file. Not blocking.

**N3. Owner commands elsewhere deploy the gate without `--route`.**
- UNIT: `owner-steps/2026-11-20-floor-fifty-commands.md:8` (project files), `docs/superpowers/specs/2026-11-17-game-facts-design.md:140` (K's "the Owner runs one command: `pnpm run deploy:games`"), and the slice 2 rest plan's line 91.
- VERDICT: note.
- REQUIREMENT: spec Task 3, O6: "Every later deploy of the gate passes the same `--route`."
- REASON: after W merges, the gate's config has no free address and no route. Whether a deploy without `--route` keeps the route already on the Worker is in the spec's "not checked"; if it does not, the gate answers on no address at all.
- EVIDENCE: the lines above. The games domain's own command file (lines 16 and 44) does pass `--route`.
- EXPECTED: every Owner command that deploys the gate after O6 carries `--route "*.GAMES-DOMAIN/*"`, and A4 runs after it.
- FIX: the coordinator adds `--route` to the Floor Fifty command file once O2 is done (project file, no repository change); K's build, when it writes the Owner's deploy line, uses the same form. Not in W.

**N4. Plan audit N8 still applies.** O-B's lead line now ties "the games domain is live" to O5, so a Task 24 run between O5 and W's merge still reads the old plan. Already handled by the plan audit's FIX (the coordinator records it in `progress.md`, or O5 waits for the merge); nothing more for W.

## Not checked

- A3 in CI: pending at `2c77be3` when read. The lint, typecheck, unit tests and build were not re-run here; this audit trusts CI for them, and the merge needs the full run green.
- A4 to A9: the Owner's steps and the cloud checks after them; none depends on this diff until O6.
