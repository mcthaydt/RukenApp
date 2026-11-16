# Settings

The operating choices behind `CLAUDE.md`: numbers and picks tuned from experience. Change a line here when experience says so; the rules in CLAUDE.md do not change with it. Each line keeps the owner's words and date where it came from them.

## Models and effort

| Work | Model, effort |
|---|---|
| Plan | Fable 5.2, medium |
| Plan audit, implementation audit, lane 2 review, screen reviews | Opus, medium |
| Build and fixes | Sonnet, high |
| Anything not named here or by the owner | Opus, medium (Owner, 2026-11-15) |

- No session runs at xhigh; high is the most any session uses (Owner, 2026-11-16).

## Limits

- Work threads at once: 5, at most 3 of them writing code (Owner, 2026-11-15). The owner board, advisor and merge threads don't count. A ceiling, not a target.
- Open pull requests per repository: 5 (Owner, 2026-11-14). Branches: main plus branches with active CI, 5 at most.
- Tries per failure or per review finding: 3. The third failed try is reported, not tried a fourth time.
- A look that has been through 2 rounds without the owner's "fine" goes back to the owner.
- A branch is small enough to review in one sitting, and merges or closes within 2 days.

## Sessions

- A session is refreshed after 90 minutes, with a handoff: the last commit, where to resume, what is left.
- The coordinator hands over to a fresh coordinator once its context passes 500k tokens, with a written handoff (Owner, 2026-11-14); `get_session` shows context usage.
- The merge thread watches open pull requests and reports one that fails a check or does not merge.
- Every session turns on the caveman:caveman skill for its working notes and its reports to the coordinator; code, docs, commits, pull requests and app wording stay plain (Owner, 2026-11-16).
- Sessions use Graphify (workspace mcthaydt-s-workspace, repository mcthaydt/RukenApp) to find code and check what a change affects: graphify_find, query_graph, graphify_callers, graphify_impact, graphify_tests_for (Owner, 2026-11-15). Compare a result's commitSha to HEAD; read the current file for anything changed since. Text search for literal strings and config.

## Where sessions run

- On the owner's computer: work judged by looking or playing (UI, layout, input, rendering) and anything that needs a real browser, a GPU or a device.
- In the cloud: work checked without a browser (logic, tooling, unit tests, docs) and long work nobody steers minute by minute. The coordinator, merge thread, plans and audits run here.
- A thread loads only the repositories it needs. Sessions wait for CI results instead of reading logs as they stream; a log is read only when a check fails.

## Reporting to the coordinator

Short and factual, with `send_message`; progress.md stays the full record.

- At once: a stop (a cap hit, a failing test caused elsewhere, an access refusal, a missing tool), with the numbers; each deviation from the brief or plan, with the reason; any question only the owner can answer, with options.
- At the end: a summary of what ran, what did not, and what is open.

## Documents

- progress.md holds only open work; finished work moves word for word to history.md. A percentage is optional, not required.
- Each brief names the exact files and sections a session must read.
- Rule edits to CLAUDE.md, this file and the project instructions are batched into one thread a day.

## Prompts

Build and fix sessions run superpowers executing-plans and start with:

```
Now implement precisely as planned, in full.

Implementation Requirements:

- Write elegant, minimal, modular code.
- Adhere strictly to existing code patterns, conventions, and best practices.
- Include thorough, clear comments/documentation within the code.
- As you implement each step:
  - Update the markdown tracking document dynamically.
```

Audits start with:

```
Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.
```

## CI

Two speeds (Owner, 2026-11-15 and 2026-11-16).

- A draft pull request gets the quick run, with checks ending in "(quick, draft)": lint, typecheck and the build in full; tests only where the change reaches them, new or changed tests always; the first failure stops the run. Screenshots only when something visual changed, or with the `screenshots` label.
- A pull request marked ready, and every push to main, gets the full run: `verify`, `postgres` and `browser`. Only the full run gates a merge.
- A change to the database, the Workers, a fixture, the lockfile or the build or test config makes even a draft run everything.
- Browser tests run in 12 pieces (Owner, 2026-11-16: "Use 12"). Drafts run Chromium only; WebKit runs in the full run. A newer push cancels the older run; installs and browsers are cached.
- A pull request that changes only `.md` files skips the tests and still merges: `verify`, `postgres` and `browser` report success without the work (Owner, 2026-11-15). One file that is not `.md` runs everything.

## Visual review

For a new set of screens (Owner, 2026-11-15 and 2026-11-16):

1. Rough look: the owner glances at rough mockups, taken from a game made through the real screens, before any polishing.
2. Automatic screen checks (overflow, clipping, touch targets under 44x44, dead-end links) run in CI and gate the rest.
3. Two reviews side by side, each in its own session, neither reading the other: words and design on every device and orientation; and an end-to-end walk on a small phone, an iPad and a computer, through every journey the screens are part of. Reviews only find problems and write a report.
4. One fix session takes both reports and fixes every finding, small ones included, each on its own, within the tries cap. A finding that needs the owner's choice is asked with options; the rest are fixed meanwhile (Owner, 2026-11-15).
5. The owner sees the finished screens, with no further review round. After the owner's notes, the changed screens get one fix and go back to the owner.

The design loop runs once per feature, after the owner has seen all of its screens (Owner, 2026-11-16).
