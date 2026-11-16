---
name: release
description: Use when opening a pull request, waiting on checks, merging, deleting a branch, or deciding where tests run.
---

# Release

## Setup check

The first session in a repo runs this first, before it builds anything, and again when the CI, the runtime or the
superpowers version changes. It verifies each item, sets up what is missing with the owner's authorization (CI workflow
files are lane 3, except at first-time setup: see Risk in CLAUDE.md), and reports each one as present, added or missing:

- Every step only the owner can run (creating the repo, branch protection, deleting branches, credentials), listed as
  one batch of CLI commands before building, so the owner is not needed mid-run.
- The commands in Stack and checks (CLAUDE.md) run, and pass on `main`.
- The CI gate described below: the workflow triggers (with `ready_for_review` on a public repo), the job that decides
  which checks apply, and the final aggregate gate job.
- The gate is required by branch protection on `main`, which keeps every existing required check unless the owner
  authorizes its replacement.
- The session tools the staged path uses (starting, messaging, choosing a model for and archiving sessions), each found
  or missing.
- The superpowers version, recorded as a commit or release under "Setup" in `docs/superpowers/history.md`, and any place
  its skills disagree with these rules.

## Where work runs

Choose where work runs by what it needs, not by habit.

- In the cloud: anything a container can do, including a headless browser for screenshots and browser tests, logic,
  tooling, unit tests, docs, long work nobody steers minute by minute, the coordinator, plans and audits.
- On the owner's computer: only what needs real hardware or the owner's hands (a GPU, a physical device, real input
  feel), under a standing permission for that machine.
- Browser device profiles emulate a screen size, a user agent and touch. Their results are emulation evidence, not proof
  of performance on a physical device; a budget for a device is measured on that device.

## Where tests run

- Quick targeted tests run locally whenever they help, before you push: the checks for what changed. On the owner's
  computer they run one at a time, because two heavy jobs on one machine starve each other and fail on timeouts.
- CI is the merge gate, and full suites run there. Checks for independent pull requests run at once, within the capacity
  in Settings; only the final integration with `main` runs one at a time. A repo with no CI workflow uses the host's
  build check, and a cloud session passes lint, typecheck and the unit tests in its own container before it pushes.

## Fast CI (public repos on GitHub's runners)

- Open every pull request as a draft; the implementer marks it ready for review as its last step, after its final push.
  Private repos use no draft rule.
- A draft gets a quick run: lint, typecheck and build in full, but only the tests the change reaches, stopping at the
  first failure.
- Marking the PR ready starts the full run used by the merge gate, but only when the workflow lists
  `ready_for_review` in its `pull_request` types: the default types (opened, synchronize, reopened) do not include it.
  Check the workflow file before relying on it. Green on a draft is not done.
- Screenshots and playtest video are taken automatically when the diff touches screens, scenes or gameplay files (the
  workflow lists those paths), with no label needed.
- Browser tests run in the pieces set in Settings (CLAUDE.md), with browsers and installs cached. A newer push cancels
  the older run. A change to the database, fixtures, lockfile or build/test config makes even a draft run everything.
- Wait for the result instead of watching logs. Read a log only when a check fails.

## Docs only

A pull request that changes only `.md` files is lane 1, and its tests may not apply, but its required check is never
skipped: a required workflow skipped by a path filter stays pending, and a job skipped by a condition can report success
without proving anything. So the workflow always runs. Its first job decides from the diff which checks apply, and one
final aggregate gate job, required alongside any existing required checks, passes only when every applicable check
ran and passed and every other check was marked not applicable by that first job. Specs, plans, audits and progress notes are docs, so they merge on green
without the owner, and the next stage starts from `main`. Any other file in the change brings the tests back. Classify
by effect as well as extension: rules files (CLAUDE.md, the skills, and anything else that decides what needs the owner)
are `.md` files too, but a change to them requires lane 3 checks and reviews plus the owner's approval or an
applicable standing permission.

## Lanes and merging

Every unit carries a lane, classified from its diff and what the change does (see Risk in CLAUDE.md). The highest lane
wins, and confidence never lowers it.

| Lane | What it is | It merges when |
|---|---|---|
| Lane 1 | Small and easy to undo | Green |
| Lane 2 | Wide: shared code, a schema, config | Green, plus the extra checks below |
| Lane 3 | Hard to undo | The owner's word, or a recorded standing permission that covers it |

- Lane 3 never opens by itself.
- A golden that moves for an approved behavior change updates with the change, inside the scope of that approval (the
  spec or milestone that names it); one that moves only in a test or sample game merges on green. Each carries a before
  and after note in the pull request. Any other move of a golden in the shipped product waits for the owner. A golden is
  never re-recorded to hide a defect.
- A deletion the plan called for that git can restore merges on green, with a before and after note. Deleting anything
  git cannot restore is lane 3.
- Green means every required check is successful on the pull request's current head commit. The required checks are
  known in advance (the repo lists them): a missing, pending or unreadable check blocks the merge, and a new push makes
  earlier results stale. On a public repo the full run after ready for review is the one that counts. An audit or a
  visual review names the commit it examined and counts only for that code. A pull request that touches what people see
  is not green until its visual check is done and any fix it found is made (see `visual-check`).
- Before merging, integrate with current `main` and rerun the checks on the result. The pull request records three
  commits: the one reviewed, the integration commit tested (its head merged with current `main`), and the `main` commit
  it was tested with. The session that merges watches `main` after the merge. If a post-merge check fails, it reports at
  once and owns the failure, with a revert if the merge caused it, until `main` is green or the owner takes it over.
- A required check that is red on `main` as well is an existing failure, not this pull request's: report it and give it
  its own thread. The pull request keeps going and merges once that thread fixes `main`, unless the owner authorizes an
  exception for that check, named in the pull request. A check that is not required never blocks a merge.
- Extra checks for lane 2: the full run, not the quick one; a fresh review session on what the change touches (see
  `review`); and a clean run: unchanged code is never retried into green (a rerun that validates an actual fix is fine).
- The session that made the change opens the pull request and merges it once its lane allows: lane 1 on green, lane 2
  after its review, lane 3 on the owner's word or a standing permission that covers it. It is a merge commit, never a
  squash, then the branch is deleted, and a pull request whose lane has opened and whose checks pass is never left open.
- The implementer owns a required check that fails because of the change: that failure is the implementer's to diagnose,
  fix and rerun. Report a material effect on outcome, timing or confidence through the owner updates. Pause for an
  owner decision only when blocked by a decision, access or budget.
- The session that merges reports each merge. It stops and reports to the coordinator, instead of resolving it, on: a
  merge conflict it cannot resolve cleanly, a golden that moved without a commit naming it, more branches than the
  limit, a pushed branch nobody asked it to merge, or a lane 3 item no standing permission covers.
- When a pull request merges, mark its outcome complete in the active milestone in `progress.md`. When that
  milestone closes, archive its record in `history.md`. Add a lesson line only if the work taught a lesson no test can
  catch (see `review`). The active coordinator owns this; otherwise the implementer does.

## The finished result

The owner approves this once, when the whole piece of work is done (a finished spec, or a game milestone), not at each
merge. Report how it went, measured: elapsed delivery time (from the brief's approval, which on the short path is the
request, to the last merge), time spent waiting (on CI, on the owner), owner interventions, rework (fix rounds and
reverts) and escaped defects (failures found after a merge). Line counts, test counts, sizes and ticked percentages are
supporting information only. Say what ran, what did not run and why, and give a preview link when the repo has one.
Summarize material decisions made during the work, their reasons and remaining limitations. Interim updates and previews
follow "Owner visibility and early steering"; significant surprises must not first appear in this final report.
