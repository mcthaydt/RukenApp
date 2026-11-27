# Keep a review through clean merges and notes-only commits

## 1. The owner's words

- 2026-11-27 22:22 UTC: "we're going too slow".
- 2026-11-27 22:23 UTC: "yes", to the coordinator's offer: "most of today's lost time was re-reviews that the hooks
  demanded after harmless merges and notes edits. If you'd like, I can have that rule changed so a clean merge or
  notes-only change keeps its review."

Today the hooks (`rules.mjs`, the ready and merge guard) and the `pr-rules` check (`pr-rules.mjs`) count a PASS only
on the head or on a commit that reaches the head through merges of `main` that git made with no hand edits at all
(`onlyCleanMerges` in `.claude/hooks/pr-rules-lib.mjs`). A merge of `main` whose only conflict was in
`docs/superpowers/progress.md`, and a commit that only adds a line to `progress.md`, each made the PASS stale and cost
a fresh review round on #424, #425, #429 and #431.

## 2. Outcome

A PASS on commit R carries to a newer head H when every commit between them (those in `R..H` that are not on
`main`) is one of:

1. **A merge of `main`** (two parents, the second on `origin/main`) where git's own merge of the two parents
   conflicts in no file but the notes files, and the merge commit differs from git's own merge result in no file but
   the notes files. So every other file is exactly what git's merge makes: the pull request's own changes are kept
   byte for byte, and `main`'s changes come in as they are.
2. **A notes-only commit** (one parent) that changes no file but the notes files.

The notes files are a list in `rules.json` (`prFlow.notesPaths`), holding `docs/superpowers/progress.md` only.

Anything else (a code change, a conflict resolved in any other file, a hand edit to any other file in a merge, an
octopus merge, a merge of a branch that is not `main`, R not an ancestor of H) still needs a fresh review that names
the new head, as today. A program decides it; nobody judges it by hand.

## 3. Lane

Lane 3: the rule hooks (`.claude/hooks/`) and the shared `release` skill, which decide what needs a review. It gets
this plan audit, an implementation audit and green CI. The owner's word is the 22:23 UTC "yes" above, which approves
this rule change; the merges then go ahead under the 2026-11-21 standing permission (every pull request, lane 3
included, merges once its audits pass and CI is green; `progress.md`, History).

## 4. Design

1. **`onlyCleanMerges(cwd, from, head, defaultBranch, notes = [])`** in `pr-rules-lib.mjs` gains the `notes` list (glob
   strings, matched with the file's existing `matchesAny`). With `notes` empty it behaves exactly as today. For each
   commit in `git rev-list --parents from..head --not origin/<default>`:
   - one parent: `git diff --no-renames --name-only <parent> <commit>`; every name must match `notes`.
   - two parents, the second an ancestor of `origin/<default>`: `git merge-tree --write-tree --name-only p1 p2`; exit
     0 or 1 only (anything else fails); the first line is the tree, the lines after it up to the first blank line are
     the conflicted files, and each must match `notes`; then `git diff --no-renames --name-only <that tree> <commit>`, and
     every name must match `notes`.
   - anything else: false.
   Both diffs pass `--no-renames`, so a file moved onto or off a notes path lists both its old and its new path, and
   the path that is not a notes file refuses the carry (a code file renamed to `progress.md` is not a notes change).
   It keeps the existing `from` is-ancestor-of `head` check first. Any git call that fails gives false.
2. **Both callers pass the list:** `rules.mjs` `checkReviewed` and `pr-rules.mjs` pass `config.prFlow?.notesPaths ?? []`.
   No other caller exists (`grep -rn onlyCleanMerges` outside `node_modules`, `docs` and `tests`).
3. **`rules.json`:** `prFlow.notesPaths: ["docs/superpowers/progress.md"]`.
4. **Words:** `release` (Lanes and merging, the PASS line and the merge-queue line) says a PASS carries through a merge
   of `main` whose only conflict or hand edit is in `progress.md`, and through commits that touch only `progress.md`;
   any other conflict or change makes it stale. `this-repo`'s `pr-rules.yml` line says "a passing review that names the
   head commit or carries to it". `CLAUDE.md` does not change: its line "a push that changes what it covered makes it
   stale" already holds, since such a push changes nothing a review covered.
5. **When it takes effect:** the `pr-rules` check runs from `main`'s copy (`pull_request_target`), so on GitHub the new
   rule holds from the merge on; this pull request itself is judged by today's rule.

## 5. Acceptance criteria

A program checks each one (`pnpm test`, `tests/pr-rules.test.ts` and `tests/rules-merge-permission.test.ts`), with a
git fixture like the existing clean-merge one:

1. A PASS on R carries to a head that adds, after R, a merge of `main` whose only conflict is in
   `docs/superpowers/progress.md`, resolved by hand (`pr-rules` check passes).
2. A PASS on R carries to a head that adds, after R, a commit touching only `docs/superpowers/progress.md`.
3. It carries through a mix: a notes-only commit, then a clean merge of `main`, then a progress-conflict merge.
4. It does not carry when a merge of `main` conflicts in any other file, even when that file is resolved to the pull
   request's own version.
5. It does not carry when a merge of `main` is clean but the merge commit also hand-edits another file.
6. It does not carry when a later commit touches `progress.md` and any other file.
6b. It does not carry when a later commit renames a code file onto `docs/superpowers/progress.md` (or
    `progress.md` onto a code path), in a plain commit or as a merge commit's hand edit, even where git would count
    it as a rename.
7. It does not carry through a merge of a branch that is not `main`, or a code commit (the existing tests keep passing).
8. `onlyCleanMerges` with no `notes` list refuses criteria 1 and 2's heads (today's behaviour is unchanged for any
   caller that does not pass the list).
9. The client hook agrees: marking ready or merging a lane 2 pull request whose PASS names R is allowed on criterion
   1's and 2's heads and refused on criterion 4's head (`rules-merge-permission.test.ts`, or the test file that already
   covers `checkReviewed`).
10. `pnpm lint`, `pnpm typecheck` and `pnpm test` exit 0; the diff touches only `.claude/hooks/pr-rules-lib.mjs`,
    `.claude/hooks/pr-rules.mjs`, `.claude/hooks/rules.mjs`, `.claude/hooks/rules.json`, `.claude/skills/release/SKILL.md`,
    `.claude/skills/this-repo/SKILL.md`, the two test files, `docs/superpowers/progress.md` and the live-state file.

## 6. Plan

One implementation pull request, one unit, on its own branch from `main` after this spec merges.

| Step | What | Check |
|---|---|---|
| 1 | Write the tests for criteria 1 to 9 first; they fail | `pnpm vitest run tests/pr-rules.test.ts tests/rules-merge-permission.test.ts` red on the new tests only |
| 2 | `notes` in `onlyCleanMerges`; both callers; `rules.json` | the same run green |
| 3 | `release` and `this-repo` words | read against section 4 |
| 4 | Full checks | `pnpm lint && pnpm typecheck && pnpm test` exit 0 |

Expected duration: about 1 hour for the build, plus the audit. No new dependency, tool, environment or spend.

Sessions (CLAUDE.md, Settings): plan audit Opus 5.5, medium; execution against this spec Sonnet 5.5, medium;
implementation audit Opus 5.5, medium.
