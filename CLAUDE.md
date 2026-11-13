This is the Owner's workflow as pasted on 2026-11-13, with the one change the Owner asked for: "Only change below is we don't run local tests, we do it all in gh cloud runners." That change touches three places, each marked "(Owner, 2026-11-13)": the last bullet of "Where sessions run", which replaces three bullets about tests on other machines and in a session's own container; the "one in CI at a time" limit under Pace, which was for the Owner's own machines and is dropped; and the first rule about failing tests, which now says where the failure is seen.

Owner, 2026-11-13: "This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it."

# The workflow

Work runs in stages. Each stage runs in its own fresh session, on its own branch, and is handed off only through committed documents.

## Stages

| # | Stage | Who | Writes |
|---|---|---|---|
| 1 | Spec | The coordinator, with the owner (superpowers brainstorming) | docs/superpowers/specs/&lt;date&gt;-&lt;topic&gt;-design.md |
| 2 | Plan | A plan session: Fable 5.2, medium (superpowers writing-plans) | docs/superpowers/plans/&lt;date&gt;-&lt;topic&gt;.md |
| 3 | Plan audit | Opus, medium, with the audit prompt | docs/superpowers/audits/&lt;date&gt;-&lt;cycle&gt;-plan-audit.md |
| 4 | Execution | Sonnet, high (superpowers executing-plans), with the implementation prompt | the code |
| 5 | Implementation audit | Opus, medium, with the audit prompt | docs/superpowers/audits/&lt;date&gt;-&lt;cycle&gt;-implementation-audit.md |
| 6 | Fixes | Sonnet, high (superpowers executing-plans), with the implementation prompt | the code |
| 7 | Review | The owner | notes for the next spec |

Every stage reads the spec, the plan, the audits so far and the progress tracker (docs/superpowers/progress.md). It updates the tracker, with its progress percentage, as it works. Its last step is to commit and push.

## Stage prompts

Execution and fixes run superpowers executing-plans and start with the implementation prompt, which sets how to develop:

```
Now implement precisely as planned, in full.

Implementation Requirements:

- Write elegant, minimal, modular code.
- Adhere strictly to existing code patterns, conventions, and best practices.
- Include thorough, clear comments/documentation within the code.
- As you implement each step:
  - Update the markdown tracking document and overall progress percentage dynamically.
```

Both audits start with the audit prompt:

```
Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.
```

## Sessions

- The coordinator is one long-lived session. It holds the conversation with the owner, writes the spec, starts each stage's session when that stage comes up, tracks them in progress.md, and archives each one when its stage is done.
- The merge session is one long-lived session started by the coordinator. It merges each finished stage branch into main by pull request once the branch's checks pass, then deletes the branch. A passing pull request is never left open.
- Pull requests merge themselves (Owner, 2026-11-13: "Yes, add it"). A session opens its pull request as a draft and marks it ready for review only when its stage is done and no more pushes are coming; `.github/workflows/auto-merge.yml` then turns on GitHub's auto-merge, and GitHub merges with a merge commit once `verify` and `browser` pass on a branch up to date with main. A branch behind main is brought up to date by merging main into it. The merge session watches, and reports a failing check or a pull request that does not merge.
- Stage sessions (plan, plan audit, execution, implementation audit, fixes) start as they come up, each on its own branch, and are archived when done.

## Where sessions run

- On the owner's computer (a local session): work that is judged by looking or playing, such as UI, layout, input and rendering, and anything that needs a real browser, a GPU or a device. The owner is steering, and the dev server answers in seconds.
- In the cloud: work that is specified and checked without a browser, such as logic, tooling, unit tests and docs, and long work nobody is steering minute by minute. Cloud sessions run side by side. The coordinator, the merge session, plans and audits run here.
- No session runs tests itself (Owner, 2026-11-13: "we don't run local tests, we do it all in gh cloud runners"). Lint, typecheck and every test run on GitHub's hosted runners, through the pull request. A session pushes and reads the result.

## Reporting

Every session reports to the coordinator with send_message, short and factual; progress.md stays the full record.

- Stage sessions:
  - one line after each task: its commit, the test count and anything surprising;
  - at once, at any stop: a stop rule hit, a cap exceeded, a failing test, an access refusal or a missing tool, with the numbers. They stop that task rather than work around it;
  - each deviation from the plan, when it is made, with the reason;
  - any question only the owner can answer, with options, before picking a default;
  - a handoff at 90 minutes (the last commit, where to resume, what is left), and a summary at the end.
- The merge session: each merge; and at once, waiting for the coordinator's answer rather than resolving it, a failing check, a merge conflict, a golden that moved without a commit naming it, more than five branches, a pushed branch nobody asked it to merge, or anything it would merge or decline on its own judgement.
- Coordinators of related workstreams: the owner's decisions, changes that touch this work, blockers, and what they push.
- The coordinator relays to the owner what needs them, and tells the merge session the final commit to merge.

## Staying on the rails

### Scope

- Nothing new starts without the owner's words: no new package, app, tool or dependency. "It would be useful later" is not a reason. Say what you found and ask.
- Build nothing ahead of its user. Code stays only if something in the repository uses it.
- Keep the change to what was asked. A second problem found on the way is reported, not fixed in the same change, unless it blocks the task.
- A decision the owner has made is not reopened. If new facts make it look wrong, say so once, with the facts.

### Pace

- A branch is small enough to review in one sitting, and merges or closes within two days. Never build on a branch that is not in main.
- At most three pull requests open. (Owner, 2026-11-13: checks run on GitHub's runners, so the old "one in CI at a time" limit, which was for the owner's own machines, is dropped.)
- Stop and tell the owner when a task has taken twice what was expected, when the third fix for the same failure has not worked, or when a look has been through two rounds without their "fine". Do not start a fourth attempt.

### Truth

- main is green. A test that fails on main is fixed, or its cause removed, before any other work. There is no list of known failures to merge past, and no step may hide behind a failing one.
- A test that fails once and passes on retry is a defect to find, not a flake to note. It does not block that merge, but it is reported the same day with its text, and a second sighting is fixed before other work.
- "Done" means merged to main and green there. Otherwise say where it is: "on a branch", "in CI", "not started".
- Report what you ran, what you did not run and why, and what is still open. Never round up.
- Speak plainly to the owner: the conclusion first, short, no jargon they did not use.

## Rules

Our copy and UX always pass the drunk-grandma test: a drunk grandma can understand and use what we make (Owner, 2026-11-13).

No subagents unless the owner says so.

Refresh a session after 90 minutes.

Branches: main plus branches with active CI only, five at most.

Write the failing test first; confirm it fails for the right reason, in CI on the branch (Owner, 2026-11-13: no local tests). Start with the smallest test, then widen.

Use injected clocks and fixed seeds. Browser tests wait on readiness, never on a sleep.

Look at the real expected, actual and diff images before accepting a visual change, and explain each change.

Facts come from artifacts: hashes, sizes and timings are measured, never written by hand.

Comments say why. They do not say which plan asked for the code.

Merge with a merge commit, never a squash, so ancestry shows what is in main.

Commits and pull requests carry no Claude attribution: no Co-Authored-By or Claude-Session lines, and no "Generated with Claude Code" footer (Owner, 2026-11-13).

Never force-push. Never loosen, skip or re-record a test to get green; a golden moves only with the owner seeing before and after.

CI workflow files change only on the owner's words, quoted in the commit.

Credentials, money, real-device tests, release approvals and tags are the owner's.

Feature folders, and tests only in tests/. Code is grouped by feature, not by kind: no top-level components/, services/ or utils/ that mix every feature's pieces. A feature owns its code and its data, and only imports from features below it. Tests never sit beside the source; tests/ mirrors src/.

The desired structure:

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
  superpowers/             specs/, plans/, audits/ and progress.md
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
