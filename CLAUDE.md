Owner, 2026-11-13: "This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it."

This file holds Ruken's lasting rules. Numbers that are tuned from experience (models, effort, thread and pull request limits, retry caps, CI pieces, timeouts) live in `docs/superpowers/settings.md`, not here. The design is in `docs/superpowers/specs/`, open work in `docs/superpowers/progress.md`, and the order of work in `docs/superpowers/roadmap.md`.

# How work gets done

The default is to keep working until there is something finished to approve.

## The short path (the default)

1. Understand the request. Read the spec section and the files it touches; ask only when a missing decision blocks progress.
2. Implement it, test first, on one branch.
3. Verify it: run the tests the change touches locally, push, and read CI yourself (`gh run watch` or poll the run). Fix every failure the change caused.
4. Present it: one pull request with the result, the evidence (what ran and what it showed), and what is still open.
5. It merges by the rules under "Merging".

## The full staged path (the exception)

Use it only for big or risky work: a new slice or feature that spans many files, money, payouts, security, a data migration, or anything in lane 3. The coordinator says which path a piece of work takes in its brief.

Stages: spec (the coordinator with the owner) → plan → plan audit → build → implementation audit → fixes → the owner sees the finished result. An audit is added by risk and size, not by a task count. The model and effort of each stage are in `settings.md`.

- The spec, plan, audits and code of one piece of work may share one branch and one pull request. A docs-only stage that does land on its own is lane 1 and merges on green. Nothing waits for an owner merge before the next stage starts; the owner approves the finished result.
- Each stage reads the spec, the plan, the audits so far and progress.md, updates progress.md as it works, and ends by committing and pushing.
- Build and fix sessions start with the implementation prompt, audits with the audit prompt (both in `settings.md`).

## Ordering (Owner, 2026-11-16)

- Two steps wait for each other only if the second reads the first one's output. If you can't name what passes between them, run them side by side.
- A step with one right answer (merge, rank, dedupe, compare before and after) is a script or a test, not a model asked to judge.
- Before building any repeated job, write the one check that can fail it.

## Sessions and subagents

- A session is a separate thread the coordinator starts for a stage, a review or a fix. Following this file is permission to start them, within the limits in `settings.md`.
- A subagent is a helper spawned inside one session. Subagents run only when the owner says so.

# Reporting honestly

- Never round up. "Done" means merged to main and green there. Otherwise say where it is: "on a branch", "in CI", "not started".
- Report what you ran, what you did not run and why, and what is still open.
- Every finding has evidence (a file and line, a test, a screenshot), the expected behaviour, and a fix bounded to named files.
- A fix is checked independently: by a test that failed before it and passes after, or by a session that did not write it.
- Speak plainly to the owner: the conclusion first, short, no jargon they did not use.

# Limits

- Retries and parallel work stay within the caps in `settings.md`. When a cap is hit, or the same failure survives its tries, stop and report it with the numbers; do not loop.
- Stop and tell the owner when a task has taken twice what was expected.

# Tests and failures

- Write the failing test first and confirm it fails for the right reason, locally or in CI. Start with the smallest test, then widen.
- Run quick targeted tests locally when useful. GitHub's full run is the merge gate; a local pass is not "done".
- A failure blocks only the work that touches it. A failure the change caused is fixed in the change. An unrelated failure, on main or elsewhere, is reported to the coordinator, who gives it its own thread; it is not fixed in scope.
- A test that fails once and passes on retry is a defect: report it the same day with its text, and fix it on its second sighting.
- Never loosen, skip or re-record a test or an expected image to hide a defect. Updating an expectation for an approved behaviour change is fine: the pull request names the change and shows the expected, actual and diff images or values.
- Use injected clocks and fixed seeds. Browser tests wait on readiness, never on a sleep.
- Facts come from artifacts: hashes, sizes and timings are measured, never written by hand.

# Lessons

A lesson from a fix becomes a test, a screen check or a code fix first. Only a lesson no test or code can hold becomes one line in `docs/superpowers/lessons.md`, with its date and pull request. The coordinator reads lessons.md before writing a brief and removes lines that a test now covers.

# Scope and decisions

- Keep the change to what was asked. A second problem found on the way is reported, not fixed in the same change, unless it blocks the task.
- Build nothing ahead of its user. Code stays only if something in the repository uses it.
- These go to the owner as a question with options and a recommendation (a decision card): product choices, anything not in the approved design, a new dependency, package, tool or app, and releases. Keep working on the recommended option meanwhile, unless the step cannot be undone.
- A decision the owner has made is not reopened. If new facts make it look wrong, say so once, with the facts.

# Merging

Every pull request opens as a draft and names its lane, set by how hard a mistake would be to undo. A change in two lanes takes the higher one.

- Lane 1, easy to undo and contained (wording, tests, docs, one function its tests cover): marked ready when done, merges by itself on a green full run.
- Lane 2, easy to undo but wide (shared helpers, added tables or columns, anything many callers use): marked ready once a review by a session that did not write it passes.
- Lane 3, hard to undo (a migration that drops or changes data, deletes, money, payouts, secrets, production data, domains, releases): stays a draft until the owner's written OK is in the thread.

Auto-merge (`.github/workflows/auto-merge.yml`) merges a ready pull request with a merge commit, never a squash, once the full run passes on a branch up to date with main. A branch behind main is brought up to date by merging main into it. The session that opened the pull request watches it to the merge.

# Boundaries that never bend

- Git identity: author and committer are always McThayDT <107786093+mcthaydt@users.noreply.github.com>. Never the owner's real name. Before the first commit in any clone, install this hook as `.git/hooks/pre-commit` (chmod +x), and set `user.name` and `user.email` again before committing:

  ```sh
  #!/bin/sh
  want='McThayDT <107786093+mcthaydt@users.noreply.github.com>'
  a=$(git var GIT_AUTHOR_IDENT | sed 's/>.*/>/'); c=$(git var GIT_COMMITTER_IDENT | sed 's/>.*/>/')
  [ "$a" = "$want" ] && [ "$c" = "$want" ] || { echo "refused: author and committer must be $want"; exit 1; }
  ```

- No AI credit lines anywhere: no Co-Authored-By or Claude-Session lines, and no "Generated with Claude Code" footer, in commits, pull requests or docs (Owner, 2026-11-13).
- Never force-push. If a wrong-author commit is pushed, open a replacement branch and pull request.
- This repository is public. Strategy, research, legal working notes, pricing reasoning, the owner's personal and company details and the reasons behind business decisions go only to mcthaydt/RukenPrivate (Owner, 2026-11-14). This repository records only what Ruken does.
- Secrets are typed by the owner into Cloudflare or saved as network secrets, never in a repository or chat. Credentials, money, real-device tests, releases, tags and domains are the owner's.
- CI workflow files change only on the owner's words, quoted in the commit.

# How Ruken is built

- The drunk-grandma test (Owner, 2026-11-13): someone tired and distracted understands every word and gets through every journey on the first try, always seeing the next step and a plain way back.
- Every form uses the maker screens' one-question-at-a-time pattern and shared components (Owner, 2026-11-16).
- A new set of screens gets a rough look from the owner first, passes the automatic screen checks in CI, gets one review (words and design, plus an end-to-end walk) and one fix, and then the owner sees the finished screens. Screens the owner already approved are skipped. Details are in `settings.md`.
- Look at the real expected, actual and diff images before accepting a visual change, and explain each change.
- Comments say why. They do not say which plan asked for the code.
- If something can be done with a command line, it is done with one (Owner, 2026-11-13). Steps for the owner are commands they paste, one line each; a step goes to a website only when no command can do it, and says so.

## Feature folders, and tests only in tests/

Code is grouped by feature, not by kind: no top-level components/, services/ or utils/ that mix every feature's pieces. A feature owns its code and its data, and only imports from features below it. Tests never sit beside the source; tests/ mirrors src/.

```
src/
  index.ts                 the public surface; anything it doesn't export is internal
  lib/                     shared helpers with no feature logic (maths, IO, random)
  features/
    <feature>/             one folder per feature, in layers, lowest first
      <feature>.ts         its entry: what other features may import
      <part>.ts            one job per file
      library/             its data (JSON), imported only by this feature
scripts/                   thin command-line wrappers over src/
tests/
  architecture.test.ts     the layer rule: imports go down, no cycles, no tests in src/
  features/<feature>/      mirrors src/features/<feature>/
  golden/                  pixel or snapshot goldens
docs/
  superpowers/             specs/, plans/, audits/, progress.md and settings.md
```

An example feature, a photo pipeline:

```
src/features/photo/
  photo.ts                 entry: tileOf(name) and the Photo type
  pipeline.ts              flatten, facet, resample, index, clean
  textures.ts              a photo's tile at a given scale
  library/photos.json      each photo's source, licence and knobs
tests/features/photo/
  pipeline.test.ts
  textures.test.ts
```
