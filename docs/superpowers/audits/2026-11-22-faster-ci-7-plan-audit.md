# Faster CI spec, section 3.5 (unit P, ten browser pieces): plan audit 7

- Examined: 8283b0e (draft PR #316 head). The change against `main` (16dee78) is spec section 3.5, one line of 3.3, the P row of the plan table and its audit line, all in `docs/superpowers/specs/2026-11-22-faster-ci-design.md`.
- Lane 3 plan audit. Reviewer: Opus 5.5, medium. Written 2026-11-22 13:44 UTC.
- Verdict: **FAIL, 5 red.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

The direction is sound: the planner works, the pairs leave room to split further (largest pair 174 s), and the owner allowed more free runners. What fails is how the section is placed, how the build would be pushed, and the numbers the call rests on.

## Red findings

### R1. Section 3.5 is inserted inside section 3.4

- UNIT: spec, section 3.4 / 3.5.
- REQUIREMENT: the brief must say one thing per unit (CLAUDE.md, The brief; `build`, acceptance criteria).
- REASON: 3.5 was put between 3.4 item 2's last bullets and 3.4's own acceptance list, so F's text now sits under P's heading.
- EVIDENCE: at 8283b0e, after P's acceptance ("A7 and A8 are measured again over the first 10 full runs after P…") come 3.4's bullet "Each piece adds its chosen key to its `ran-*` artifact as `ran/times-key.txt`… all six keys are equal…" and a second "Acceptance:" with F1 ("joined 6 of 6 pieces, 159 file and device pairs") and F2. Under 3.5, F1 contradicts P2 ("joined 10 of 10 pieces").
- EXPECTED: 3.4 is whole (item 2's last bullet and F1, F2 under it), and 3.5 starts after it.
- FIX: move the whole of 3.5 to just before "## 4. Acceptance criteria". Spec only.

### R2. Unit P as one pull request is refused by the `ruleMix` hook

- UNIT: spec 3.5 "Also changed" and the P row of section 5.
- REQUIREMENT: Hooks (CLAUDE.md, Rules that never bend); `.claude/hooks/rules.json` `ruleMix`.
- REASON: P owns `.github/workflows/ci.yml` and `CLAUDE.md` (rule paths) and `.github/scripts/ci-times.js` (neither a rule path nor a doc path) in one pull request.
- EVIDENCE: `rules.json` `ruleMix.rulePaths` lists `CLAUDE.md` and `.github/workflows/**`; `docPaths` are `docs/**`, `*.md`, `**/*.md`, `.claude/**`. `checkRuleMix` (`.claude/hooks/rules.mjs:851`) refuses a push whose diff has a rule file and any other file: "rules files and CI change in their own pull request, with no product code or tests". `.github/scripts/ci-times.js` falls in neither list. This is also why `ci-times.js` landed in its own PR (#299) apart from unit W.
- EXPECTED: the plan names a split that the hooks accept.
- FIX: in 3.5 and the section 5 table, split P into two pull requests: P-a, `.github/scripts/ci-times.js` alone (the grouping regex `shard \d+ of \d+` also matches today's "shard n of 6", so it can merge first, lane 3 by `.github/**`); then P-b, `ci.yml`, `CLAUDE.md` Settings, the `this-repo` skill and the spec's 3.3 line. P3 is then checked on P-b's first ready run with P-a's script. Spec only.

### R3. The 7-minute estimate leaves out two measured things

- UNIT: spec 3.5, the "So a full run…" paragraph and the **Call**.
- REQUIREMENT: Report honestly ("Hashes, sizes, timings … are measured"); the spec's own measuring basis.
- REASON: the estimate divides the whole Playwright time by N and uses 1.15 for the slowest piece, but (a) part of each piece's Playwright time does not shrink with N, and (b) on the cited run the slowest piece was 1.22 times the mean, not 1.15.
- EVIDENCE: run 45011227560, "Run the journeys" step per piece from the jobs API: 341, 468, 459, 321, 341, 369 s (pieces 1 to 6), 2,299 s in all, mean 383 s, slowest 468 s = 1.22 × mean. (The spec's list, 5.6, 6.1, 7.7, 7.5, 5.3, 5.6 min, does not match these step times; it should say how it was measured.) The spec's 3,870 test-seconds at 2 workers is 1,935 s of perfectly packed work, so about 364 s, about 60 s per piece, is per-piece cost that does not shrink: starting the fake servers and `wrangler dev`, and the two workers not ending together. The run's own fixed cost was 2.8 min, not 2.5: created 10:11:44, slowest piece's step ended 10:21:34, last job ended 10:22:20 (10.6 min) against 7.8 min of slowest step; it includes 62 s that piece 2 waited for a runner inside one run.
- Recomputed for 10 pieces, no other run in flight: (1,935 s + 10 × 60 s) / 10 = 254 s mean; × 1.15 = 4.9 min, × 1.22 = 5.2 min; plus 2.8 min fixed = 7.7 to 8.0 min. That meets the 8-minute p50 only at the edge, not "near 7 min".
- EXPECTED: the spec states the estimate with both terms and its range, so the owner is not told 7 minutes when the numbers say 7.7 to 8.
- FIX: rewrite the paragraph and the **Call** with the per-piece constant and the measured ratio range, from step times named by run and job. If the range does not clear 8 min with margin, either keep 10 and say plainly the p50 is at the edge, or pick 12 (about 7.0 to 7.3 min by the same sum, 14 jobs at once) and carry its job count into R4. Spec only.

### R4. Running two or more full runs at once is not measured, and the limit is the account's, not the repository's

- UNIT: spec 3.5, "The cost is runners…" paragraph.
- REQUIREMENT: CLAUDE.md Settings, Pull requests open: "Checks run at once, as many as the CI capacity takes without queueing (measured, not guessed)"; the A8 claim.
- REASON: the paragraph says "against the free plan's 20 at once for the repository" and that a second run waits "about one piece's length", with no count of how often runs overlap.
- EVIDENCE:
  - GitHub's limit for standard hosted runners is per account ([Actions limits](https://docs.github.com/en/actions/reference/limits)), so it is shared with any run in `mcthaydt/RukenPrivate` and the owner's other repositories.
  - A ready PR push also starts `commit-authors` and `pr-rules` (each one job), so a full run holds about 14 runners at its peak with 10 pieces (12 CI jobs + 2), against about 10 today.
  - Overlap is common, from the last 40 CI runs (jobs API): 07:31 to 07:45 UTC had three full runs in flight at once (44997563759 attempt 2, 44998685507, 44998791098, with 44997719031 until 07:34). Today two such runs need about 20 runners and fit; with 10 pieces they need about 28, so about 8 jobs of the later run wait. With pieces near 5 min, that run lands near 2.8 + 5 + 5 ≈ 12.8 min, past the 8-minute line, while the first run gains.
  - The six runs the spec measured were the quiet ones (one at a time, 07:57 to 10:22), so they do not show this.
- EXPECTED: the spec counts how many of the last N full runs had another full run (or more) in flight, says what p50 that gives at 10 pieces, and names what the merging session does about it, or says plainly that A8 may be missed under load.
- FIX: in 3.5, (1) replace "for the repository" with the account-wide limit and its source; (2) add the overlap count from the last 40 or more full runs, measured by the jobs API (created and completed times), with run ids; (3) add the expected p50 with that share of overlapped runs; (4) state the response, for example that the merging session already runs one integration at a time and starts a lane-3 measuring run only when no other full run is in flight, or that 10 is kept and the A8 gap will be reported. Spec only.

### R5. Unit P's plan is not a checklist the implementer ticks

- UNIT: spec 3.5, "The change" list, "Also changed", and Acceptance.
- REQUIREMENT: kit practice item 3, recorded for every thread: "every plan is a checklist the implementer ticks; coordinator copies % into progress.md row" (`/mnt/project-files/audits/2026-11-22-apps-kit-practice-1-audit.md`); CLAUDE.md Settings, Progress: "a percentage from the plan's ticked steps".
- EVIDENCE: 3.5 has a numbered list (1 to 4), a prose paragraph of other files, and P1 to P3 as bullets; there is no `- [ ]` line in the whole spec at 8283b0e.
- EXPECTED: each step the build does is one `- [ ]` line, so progress is a count of ticks.
- FIX: write unit P's steps as a checklist, for example: `- [ ]` P-a: `ci-times.js` regex and label; `- [ ]` P-b matrix, job name and the three `/6` in "Pick the journeys"; `- [ ]` ten restore steps and "Join the ten"; `- [ ]` comments that say six; `- [ ]` CLAUDE.md Settings; `- [ ]` `this-repo` line 33; `- [ ]` spec 3.3; `- [ ]` P1; `- [ ]` P2; `- [ ]` P3; `- [ ]` the 10 measuring runs (A7, A8). Spec only.

## Notes (recorded, not blocking)

- N1. `ci-times.js` line 62 also writes the label `"shard n of 6"`; change it with the regex, or 10-piece rows are labelled "of 6".
- N2. Drafts get ten pieces too (the matrix has no draft case). Each draft piece pays about 60 s of setup before it finds it has nothing to run (container 32 to 41 s, Node and pnpm 12 s, "Pick the journeys" 6 to 9 s on 45011227560), and a draft run holds 12 jobs as well. The spec should say whether A10 (draft p50 ≤ 3.1 min) is expected to hold and re-measure it, since drafts are 44% of runs (66 of 150 in section 1).
- N3. `this-repo` line 33 is already stale apart from the count ("summed up by `browser`", "`gate`, which passes only when all three passed"; there is no `browser` job since W). P edits this line, so it should say what is true.
- N4. Section 4 A7 says "the six pieces' test times"; with P it should say "the pieces'". `tests/browser/support/shard-plan.ts` line 1 also says "six browser pieces"; the spec says that file does not change, and `ruleMix` keeps it out of a CI pull request anyway, so it is a follow-up, not part of P.
- N5. `pull_requests: [316]` is attached by GitHub to older runs of the same branch name (`claude/project-thread-g0gcfn`, used by #311 and #312). Whoever measures A8 by PR number should go by run time, as `ci-times.js` does, not by that field.

## Checked and fine

- The planner takes the piece count from `RUKEN_SHARD` (`parseShard`, "3/6" as `{ piece, of }`, `shard-plan.ts:81` and `:99`), so it needs no change for 10.
- In `ci.yml` the count appears in the matrix (line 258), the job name (241), and three places in "Pick the journeys" (380, 382, 387); item 1 names all three uses. `test-times` has six literal restore steps (547 to 575) and "joined 6 of 6" (581); item 2 covers them.
- The gate needs no change: it downloads every `ran-*` artifact, checks that all `times-key.txt` agree whatever their number, and the union check counts `ranFiles.length`.
- The times file is per file and device, not per piece, so ten pieces can read times saved by a six-piece `main` run.
- Arithmetic in the spec: 165 pairs, largest 174 s, is well under a tenth of the work (about 254 s per piece by R3's sum).
- Budget and scope: free hosted runners only, no new action, tool or secret; the owner's 13:39 UTC words cover more runners.
