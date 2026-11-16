This is the Owner's workflow as pasted on 2026-11-13, with the changes the Owner has made since, each marked with its date. On 2026-11-16 the Owner turned local tests back on (card "Let sessions run tests on their own machine before pushing?": "Yes, and skip review rounds"): sessions run the tests their change touches before pushing, and GitHub's full run still alone gates a merge.

Owner, 2026-11-13: "This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it."

# The workflow

Work runs in stages. Each stage runs in its own fresh session, on its own branch, and is handed off only through committed documents.

## Stages

| # | Stage | Who | Writes |
|---|---|---|---|
| 1 | Spec | The coordinator, with the owner (superpowers brainstorming) | docs/superpowers/specs/&lt;date&gt;-&lt;topic&gt;-design.md |
| 2 | Plan | A plan session: Fable 5.2, medium (superpowers writing-plans) | docs/superpowers/plans/&lt;date&gt;-&lt;topic&gt;.md |
| 3 | Plan audit | Opus, medium, with the audit prompt; skipped for plans under 5 tasks | docs/superpowers/audits/&lt;date&gt;-&lt;cycle&gt;-plan-audit.md |
| 4 | Execution | Sonnet, high (superpowers executing-plans), with the implementation prompt | the code |
| 5 | Implementation audit | Opus, medium, with the audit prompt | docs/superpowers/audits/&lt;date&gt;-&lt;cycle&gt;-implementation-audit.md |
| 6 | Fixes | Sonnet, high (superpowers executing-plans), with the implementation prompt | the code |
| 7 | Review | The owner | notes for the next spec |

Every stage reads the spec, the plan, the audits so far and the progress tracker (docs/superpowers/progress.md). It updates the tracker, with its progress percentage, as it works. Its last step is to commit and push.

Default model (Owner, 2026-11-15): "If you ever don't know which model to use because I didn't explicitly say go with opus medium." Any session whose model and effort aren't named here or by the owner runs on Opus at medium effort.

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
- The coordinator hands over to a fresh coordinator once its context exceeds 500k tokens, with a written handoff; get_session shows context_usage (Owner, 2026-11-14: "I like it to do that when context exceeds 500k").
- The merge session is one long-lived session started by the coordinator. It merges each finished stage branch into main by pull request once the branch's checks pass, then deletes the branch. A passing pull request is never left open.
- Pull requests merge themselves (Owner, 2026-11-13: "Yes, add it"). A session opens its pull request as a draft and marks it ready for review only when its stage is done and no more pushes are coming; `.github/workflows/auto-merge.yml` then turns on GitHub's auto-merge, and GitHub merges with a merge commit once `verify` and `browser` pass on a branch up to date with main. A branch behind main is brought up to date by merging main into it. The merge session watches, and reports a failing check or a pull request that does not merge.
- Stage sessions (plan, plan audit, execution, implementation audit, fixes) start as they come up, each on its own branch, and are archived when done.

## Where sessions run

- On the owner's computer (a local session): work that is judged by looking or playing, such as UI, layout, input and rendering, and anything that needs a real browser, a GPU or a device. The owner is steering, and the dev server answers in seconds.
- In the cloud: work that is specified and checked without a browser, such as logic, tooling, unit tests and docs, and long work nobody is steering minute by minute. Cloud sessions run side by side. The coordinator, the merge session, plans and audits run here.
- Sessions run the relevant tests themselves before pushing: the unit tests, plus the browser tests their change touches (Owner, 2026-11-16: "Yes, and skip review rounds"). GitHub's full run through the pull request still alone gates every merge; a local pass is not "done".

## Risk lanes

Every pull request is in one lane, set by how hard a mistake would be to undo, not by how sure the session is (Owner, 2026-11-16: "A"). The stage session names its lane in the pull request description, and a change in two lanes takes the higher one.

- Lane 1, easy to undo and contained (wording, tests, docs, one function its tests cover): marked ready when done, and merges by itself once the full run is green.
- Lane 2, easy to undo but wide (shared helpers, added tables or columns, anything many callers use): stays a draft until an Opus medium review of it passes, then is marked ready.
- Lane 3, hard to undo (a migration that drops or changes data, deletes, money, payouts, secrets, production data, domains, releases): stays a draft until the owner's written OK is in the thread, whatever the checks or reviews say.

## Lessons

When a fix is accepted, the fix session adds the lesson as one line to docs/superpowers/lessons.md, written as a rule for how later work is split or briefed. The coordinator reads lessons.md before writing a brief. A lesson that keeps coming back moves into this file in the daily rules batch, and leaves lessons.md.

## Ordering and gates

Owner, 2026-11-16, picked these three:

- Real dependency: two steps wait for each other only if the second reads the first one's output. If you can't name what passes between them, run them side by side. The coordinator applies this when ordering threads.
- Plain code for fixed steps: a step with one right answer (merge, rank, dedupe, compare before and after) is a script or a test, not a model asked to judge.
- Gate first: before building any repeated job, write the one check that can fail it. A job with no gate is a faster way to make unchecked work.

## Graphify

Graphify (Owner 2026-11-15): RukenApp is indexed in Graphify (workspace mcthaydt-s-workspace, repository mcthaydt/RukenApp). Every build, audit and fix session uses the Graphify tools to find code and check what a change affects: graphify_find for where something is defined, query_graph for how something works, graphify_callers for who calls it, graphify_impact before changing it, graphify_tests_for for its tests. Compare a result's commitSha to the checkout's HEAD; read the current file for anything changed since. Use text search for literal strings, config and unindexed files.

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

## Fast CI

Checks run at two speeds (Owner, 2026-11-15: "Yes" to running only the affected tests while a branch is being worked on, the full suite before merge, and six browser pieces; then "Cache installs and browsers", "Skip the slow picture checks on drafts", "Cancel stale runs" and "Stop at the first failure while working").

- A draft pull request gets the quick run. Its checks end in "(quick, draft)". Lint, typecheck and the build run in full; tests run only where the change reaches them, a new or changed test always runs, and the first failure stops the run. Screenshots are taken only when something visual changed, or when the pull request has the `screenshots` label (add it, then push).
- A pull request marked ready for review, and every push to main, gets the full run, under the names `verify`, `postgres` and `browser`. Only the full run gates a merge. Green on a draft is not "done"; marking ready is what starts the check that counts.
- A change to the database, the Workers, a fixture, the lockfile or the build or test config makes even a draft run everything.
- The browser tests run in twelve pieces (Owner, 2026-11-16: "All three" on "Make CI faster by changing the CI files?", then "Use 12" on "Use 12 test pieces instead of 18?"). A draft runs them in Chromium only; Safari's engine (WebKit) runs only in the full run. A newer push cancels the older run, and the browsers are cached between runs.
- A pull request that changes only `.md` files skips the tests and still merges (Owner, 2026-11-15: "when a PR only touches .md files, skip the tests and allow the merge, in all repos."). `verify`, `postgres` and `browser` still run and report success without doing the work, so auto-merge is not left waiting. One file that is not `.md` runs everything, and a push to main always does.
- Red-then-green still works: push the failing test as a draft, read the quick run, then push the fix.

## Visual review

Every time screens are about to be shown to the owner for a "how does this look?", whatever the screens are, they first go through these steps (Owner, 2026-11-15: "Our new visual review process"; trimmed, "1-3 yes"; reshaped, Owner, 2026-11-16: "A" to "Turn the screen rules into automatic tests, run the reviews side by side with one fix after, and show you only the finished screens"):

0. Rough look first: before any polishing, the owner glances at rough mockups for five minutes, so new direction lands before the reviews, not after.
1. Automatic screen checks are the gate. Rules that a program can judge, such as overflow, clipping, touch targets under 44x44 and dead-end links, are tests that run in CI and fail by themselves. Screens go on only when they pass.
2. Two reviews run side by side, each in its own session and its own context, neither reading the other's report:
   - Words and design check (Opus, medium), on every device and orientation: could a drunk grandma understand every word, and is every screen right for layout and polish?
   - End-to-end walk (Opus, medium), on three views (a small phone, an iPad and a computer): walk every journey these screens are part of, from first open to its main task, so nothing is missing or leads to a dead end, and run the drunk-grandma test on the UX (Owner, 2026-11-15): could a tired, distracted person get through each journey on the first try, always seeing the next step and a plain way back?
3. One fix session (Sonnet, high) takes both reports. Each finding is fixed on its own: that finding only, its files only, at most three tries. A finding still failing after three tries is reported to the coordinator, not tried again.
4. The screens then go straight to the owner's board, with no further review round (Owner, 2026-11-16: "Yes, and skip review rounds"). The owner approves only these finished screens; the steps before this do not ask the owner.

Review steps only find problems (Owner, 2026-11-15: "review steps only FIND problems"). Each writes a report, commits and pushes it, and changes nothing else. A review session that has started fixing stops, pushes its report and hands the fixes off. The reports and fixes all go in one pull request.

Only new work is reviewed (Owner, 2026-11-15: "we should only do the passes on the new stuff too, if it's been checked off/approved, we can skip it for the visual review and only do the stuff that has not been checked off/approved"). Every step skips screens the owner already approved. The full review runs once per set of screens; after the owner's notes, the changed screens get one fix and go back to the board, with no new review round.

Every fix round fixes every finding, the small ones included (Owner, 2026-11-15: "From now on every fix round fixes every finding, low ones included. The only exception is a fix that needs your choice, and I'll say which one."). A finding is left only when its fix needs the Owner's choice; the fixing session names that one, with options, and asks, and fixes all the rest meanwhile.

## Saving usage

Sessions read less (Owner, 2026-11-15: "1-3 yes" and "A").

- docs/superpowers/progress.md holds only open work. Finished work moves, word for word, to docs/superpowers/history.md.
- Each brief names the exact files and sections a session must read, and a session reads those, not every document.
- A thread loads only the repositories it needs.
- Rule edits to CLAUDE.md and the project instructions are batched into one thread a day, not one thread each.
- Sessions wait for CI results (`gh run watch`, or polling the run's status) instead of reading logs as they stream. A log is read only when a check fails.

## Staying on the rails

### Scope

- Nothing new starts without the owner's words: no new package, app, tool or dependency. "It would be useful later" is not a reason. Say what you found and ask.
- Build nothing ahead of its user. Code stays only if something in the repository uses it.
- Keep the change to what was asked. A second problem found on the way is reported, not fixed in the same change, unless it blocks the task.
- A decision the owner has made is not reopened. If new facts make it look wrong, say so once, with the facts.

### Pace

- A branch is small enough to review in one sitting, and merges or closes within two days. Never build on a branch that is not in main.
- At most five pull requests open (Owner, 2026-11-14: "Yes" to raising the limit from three to five). (Owner, 2026-11-13: checks run on GitHub's runners, so the old "one in CI at a time" limit, which was for the owner's own machines, is dropped.)
- At most five work threads at once, all in the current slice, and at most three of them writing code; the others only read and report (reviews, audits, plans) (Owner, 2026-11-15). It is a ceiling, not a target: a thread starts only when its work is ready. The owner board, advisor and merge threads don't count.
- Stop and tell the owner when a task has taken twice what was expected, when the third fix for the same failure has not worked, or when a look has been through two rounds without their "fine". Do not start a fourth attempt.

### Truth

- main is green. A test that fails on main is fixed, or its cause removed, before any other work. There is no list of known failures to merge past, and no step may hide behind a failing one.
- A test that fails once and passes on retry is a defect to find, not a flake to note. It does not block that merge, but it is reported the same day with its text, and a second sighting is fixed before other work.
- "Done" means merged to main and green there. Otherwise say where it is: "on a branch", "in CI", "not started".
- Report what you ran, what you did not run and why, and what is still open. Never round up.
- Speak plainly to the owner: the conclusion first, short, no jargon they did not use.

## Rules

Our copy and UX always pass the drunk-grandma test: a drunk grandma can understand and use what we make (Owner, 2026-11-13).

Every form uses the maker screens' one-question-at-a-time pattern and shared components (Owner, 2026-11-16: "model our staff review after our typeform inspired maker screens; do this for all forms").

No subagents unless the owner says so.

Refresh a session after 90 minutes.

No session runs at xhigh effort (Owner, 2026-11-16: "lets drop sonnet xhigh and drop to high, this is all taking far too long"). High is the most any session uses.

Caveman (Owner, 2026-11-16: "enable caveman"): every session turns on the caveman:caveman skill when it starts. Only its working notes and its reports to the coordinator are caveman. Code, docs, commit and pull request text, and all app and game wording stay in plain sentences.

Branches: main plus branches with active CI only, five at most.

Write the failing test first; confirm it fails for the right reason, locally or in CI on the branch. Start with the smallest test, then widen.

Use injected clocks and fixed seeds. Browser tests wait on readiness, never on a sleep.

Look at the real expected, actual and diff images before accepting a visual change, and explain each change.

Facts come from artifacts: hashes, sizes and timings are measured, never written by hand.

Comments say why. They do not say which plan asked for the code.

Merge with a merge commit, never a squash, so ancestry shows what is in main.

Commits and pull requests carry no Claude attribution: no Co-Authored-By or Claude-Session lines, and no "Generated with Claude Code" footer (Owner, 2026-11-13).

Never force-push. Never loosen, skip or re-record a test to get green; a golden moves only with the owner seeing before and after.

CI workflow files change only on the owner's words, quoted in the commit.

Credentials, money, real-device tests, release approvals and tags are the owner's.

Private things go to the private repository, mcthaydt/RukenPrivate, never to this public one (Owner, 2026-11-14: "We have a ruken private repo for things that shouldn't be public"; "when we discuss private things that they go to our ruken private repo"). That covers strategy, research, legal working notes, the Owner's personal and company details, and the reasons behind business decisions. The public repository records only what Ruken does.

If something can be done with a command line, it is done with one (Owner, 2026-11-13: "if something can be done with cli, we do it with cli"). Steps for the owner are commands they paste, one line each for Windows PowerShell (join with `;`, no heredocs), not clicks; a step goes to a website only when no command can do it (billing, a registrar, a first sign-up), and says so.

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
