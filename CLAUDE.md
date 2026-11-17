# Ruken

Ruken is a website, and later an app, where members pay one membership to play every game on it, and makers send in
their games from GitHub.

This codebase is yours to keep building on. How it is built is your call, inside the rules below. What it is for, and
anything new, is the owner's call.

## Stack and checks

- Stack: SvelteKit 3 and Svelte 5 in TypeScript on Cloudflare Workers (adapter-cloudflare, Wrangler); Postgres through
  Prisma 7; better-auth; Stripe; Vitest for unit and database tests; Playwright for browser tests; pnpm 10 on Node 24.
- Install: `pnpm install --frozen-lockfile`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test` (unit); `pnpm test:pg` (needs `TEST_DATABASE_URL`); `pnpm test:browser`
- Build: `pnpm build`
- The first session in a repo runs the setup check in `release` first, before it builds anything.
- Skills, saved in `.claude/skills/`: `review` for audits and fixes, `release` for pull requests and merging,
  `visual-check` for screens. Load the one that fits before starting that kind of work. Where work runs and where
  tests run are in `release`.

## How work goes

- **These rules govern the coordinator and every session from the first message, before the repo exists.** They say
  how to run the work, not only what to commit.
- **Risk, uncertainty and dependencies decide the process,** never the number of tasks or files.
- **The brief** is what the work is judged against and what authorizes it: on the short path, the owner's request plus
  the acceptance criteria written in the pull request, with no separate document to create or approve; on the staged
  path, the spec. Its boundaries, budgets and expected duration live there.
- **The short path is the default.** Work whose outcome is clear, that is easy to undo and that needs nothing it does
  not have yet takes one session, even a whole feature across many files: understand the request, write its acceptance
  criteria, build it, verify it with the checks that touch it, and merge on green. No planning document: the brief is
  the request and the pull request. Keep working until there is something to approve; ask only when a decision that is
  the owner's blocks you. A small app with no users or real data takes the short path, its first-time setup
  included.
- **The path and the reviews are separate decisions.** The path follows how uncertain the work is; the reviews follow
  its lane (Settings). When the lane calls for a review, a fresh session reviews the change and the original implementer
  fixes the reviewer's findings, whichever path the work is on.
- **Uncertain, dependent or hard-to-undo work takes the staged path** below: when the outcome or the approach is
  unclear, when it waits on an open decision or on other work, or when it is lane 3.
- **Acceptance criteria come first.** Before building, write what done looks like in the brief, as criteria a program or
  a person can observe, covering at least the quality bar below. A gap against a criterion is a blocking defect; an idea
  that would make it better is a note, kept apart.
- **A check is a test that fails by itself.** Write the check first, so a program can judge it: the suite exits 0, every
  claim has a source line, the diff touches only files in the plan. The loop lives inside one piece of work: produce,
  check, correct, repeat until green.
- **The owner approves the finished result and product choices,** never the steps between. Product choices are
  direction, anything that changes what the product is for, and a new package, app, tool, dependency, environment or
  spend that the approved brief does not already cover. An approved brief authorizes everything inside its stated
  boundaries: the dependencies, tools, environments and budget it names. Ask again only when scope, exposure, cost or
  direction changes materially. Ask each choice as a decision card: the options, and a recommendation. Everything else,
  decide and go.
- **Three different yeses.** **Product approval** settles a choice, such as a direction or a dependency. **Merge
  permission** follows the lane: green and its required reviews, plus the owner's approval or a recorded standing
  permission for lane 3. **Permission to act outside the repo** (a release or tag, a credential, money, a real device) is asked for by name. Once given, it is a standing permission with its scope (a
  named environment, device or budget), recorded under "Standing permissions" in `docs/superpowers/history.md`, and
  asked for again only when that scope, the exposure or the cost changes. A merged spec records a decision; it does not
  make one: the spec lists any open product decisions, and the build waits for those only. Each approval is recorded
  with its scope: what it covers, and the document or commit.

## Owner visibility and early steering

The owner stays informed throughout the work. Updates do not require acknowledgement: continue within the approved
brief and permissions. Silence never creates a new approval. When a coordinator is active, it consolidates worker
reports into one owner-facing update. Otherwise the implementer handles these duties; no extra session is needed.

- **At the start:** state the outcome being built, the important assumptions, the first step and the first point at
  which the owner will see working output.
- **During the work:** send a concise update at meaningful milestones and at the owner update interval in Settings.
  Report material changes, risks, setbacks and consequential decisions promptly. Routine debugging stays internal
  unless it changes the expected outcome, timing or confidence. If waiting on CI or another dependency, say what is
  waiting, what can proceed and what will unblock it; do not imply progress that has not happened.
- **Each update covers:** what is happening now; what changed since the last update; what remains and comes next;
  material decisions made; the latest preview and verification status; and anything the owner needs to decide. Omit
  unchanged details. Say "No action needed" when work can continue. Prefer completed outcomes and remaining work over
  an unsupported percentage. Label timing estimates and revise them when the evidence changes.
- **Show work early:** share the first working screen or playable core loop before extending it across the product.
  Show meaningful visual and interaction changes as they become available, using an available live preview, screenshot
  or short recording. Label mockups, incomplete work and known defects clearly. Identify the version shown. Reuse
  current previews until the output changes. Creating a public preview still requires the appropriate permission.
- **Expose decisions:** disclose material choices that affect user experience, appearance, architecture, dependencies,
  compatibility, cost, delivery order or accepted tradeoffs. State the choice, why it was made, its consequence and how
  easily it can be changed. Announce consequential choices within the approved scope before substantial dependent work
  accumulates, and continue. Choices outside that scope require approval before dependent work proceeds. Routine naming
  and implementation details need no separate notification.
- **Keep a visible record:** maintain `docs/superpowers/progress.md` with a last-updated time, current work, completed
  outcomes within the active milestone, remaining work, blockers, preview links and material decisions. Share its
  accessible link or location at the start and keep it current with each substantive update. Distinguish owner
  instructions, agent-selected choices and unresolved assumptions. A reported choice is not automatically
  owner-approved. Archive completed milestones and their decision records in `history.md`.
- **Accept steering immediately:** check for available owner feedback before starting dependent work or merging. When
  the owner redirects or says "hold" on an item, acknowledge it, pause the affected work at the next safe boundary,
  update the brief and inform affected workers. Continue unrelated authorized work. State rework or consequences
  plainly. Keep choices reversible where practical; an update alone does not guarantee the owner has reviewed it.
- **At completion:** show the finished result, verification evidence, remaining limitations and material decisions made
  during the work. Do not defer significant surprises until this report. Final acceptance remains one finished-result
  review; progress updates and interim previews do not introduce approval gates.
- **If live updates are unavailable:** say so before long-running work, provide the timestamped progress record and use
  the runtime's available communication channel. Do not claim that the owner has received an update that could not be
  delivered.

## Rules that never bend

- **Identity.** Every commit is authored by McThayDT `107786093+mcthaydt@users.noreply.github.com`. No Claude
  co-author, no "Claude-Session" trailer and no "Generated with Claude Code" line in commits, pull request bodies or
  docs. Pull requests end with "Requested by **McThayDT**": check the body's last line after every create or edit,
  since tools such as `gh pr create` can add a footer. Never force-push. Merge with a merge commit, never a squash.
- **The drunk-grandma test.** All copy and UX must be something a drunk grandma could understand and use: plain words,
  one main action per screen, big obvious buttons, no jargon, and nothing that needs explaining.
- **CLI first.** If something can be done with a CLI (gh, npm, wrangler and so on), do it with the CLI, and give the
  owner CLI commands rather than click-through steps.
- **Keep to the request.** Build nothing ahead of its user; "it would be useful later" is not a reason. A second
  problem found on the way is reported, not fixed, unless it blocks the task. A decision the owner has made is not
  reopened; if new facts make it look wrong, say so once, with the facts.
- **Report honestly.** Say what ran, what did not run and why, and what is still open. "Done" means merged to `main` and
  green there; otherwise say where it is: "on a branch", "in CI", "not started". Never round up. Hashes, sizes, timings
  and timestamps are measured, never written by hand (timestamps come from `date`), and a tool or asset is checked to
  exist before anything is built on it. Speak plainly: the conclusion first, short.
- **Findings carry evidence.** Every finding says what is wrong, the evidence, the expected result and a bounded fix,
  and a fix is checked by a program or a second session, never by the fixer's own say-so. A check proves one property;
  a review (model or human) finds what no check encodes: missing requirements, confusing screens, wrong assumptions.
  Both count as evidence. Every review, check and approval names the commit it examined; a push that changes what it
  covered makes it stale.
- **Tests.** Write the failing test first and confirm it fails for the right reason. Quick targeted tests run locally
  whenever they help; CI is the merge gate. A failing test blocks only the change that touches it: report an unrelated
  failure, and give a failure on `main` its own thread. A merge still needs every required check green, unless the owner
  authorizes an exception named in the pull request. A test that fails once and passes on retry is a defect: report it
  with its text. Never loosen, skip or re-record a test to hide a defect. No `--pass-with-no-tests` or similar flag that
  lets an empty suite pass in CI. Updating a golden for an approved behavior change is fine, with its before and after
  shown. A docs change or a purely visual change is verified by what fits (a link or build check, the approved look),
  not by an invented unit test.
- **Lessons become tests first.** A confirmed failure gets a regression test. It becomes a rule only when no test can
  catch it, as one line under "Lessons" in `docs/superpowers/history.md`.
- **Limits.** When an approach has taken the tries in Settings, or a task has run past the overrun in Settings, stop
  that approach and reassess; never repeat a failed approach without new evidence. Keep on with independent work
  meanwhile. Report material setbacks under "Owner visibility and early steering". Pause and request an owner decision
  only when their decision, access or a change to an agreed budget is needed. Never bypass an access restriction or
  weaken an acceptance criterion to get past a problem. No subagents unless the owner says so. Sessions the coordinator starts are
  threads, not subagents. If this repo is indexed in Graphify, use its tools to find code and check what a change
  affects before changing it.

## Risk

Every unit of work carries a lane, set by what a mistake costs, never by anyone's confidence. Classify it from the paths
its diff touches and what the change does, using the lists below; use a classifier the repo already has, and never build
tooling for this. The plan names any other lane 2 or 3 unit up front. The highest lane wins.

- **Lane 1**, small and easy to undo: a copy change, a test, a doc (specs, plans, audits and progress notes included),
  deleting a merged branch, an isolated change with coverage. Merges on green.
- **Lane 2**, wide: `src/lib/`, `src/hooks.server.ts`, `src/app.html`, `src/app.d.ts`, `src/params/`,
  `src/routes/+layout.*`, `src/routes/+error.svelte`, `prisma/schema/`, `tests/support/`, `tests/browser/support/`,
  `tests/fixtures/`, `static/`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `vite.config.ts`,
  `playwright.config.ts`, `prisma.config.ts`, `tsconfig.json`, `eslint.config.js`, `prettier.config.js`,
  `.prettierignore`, `.nvmrc`, `.env.example`, shared code many callers use, a schema, or config. Merges after
  `release`'s extra checks.
- **Lane 3**, hard to undo: `tests/golden/` moves that no approved change explains, `prisma/migrations/`,
  `.github/workflows/`, `wrangler.jsonc`, `cloudflare/` (the deployed Workers and their bindings),
  `src/features/money/`, `src/features/membership/`, `src/features/accounts/`, `src/routes/api/auth/`,
  `src/routes/webhooks/`, `.claude/settings.json`, credentials, money, device actions with consequential side
  effects, release approvals and tags, CI workflow files, deleting anything git cannot restore, any migration, any
  write of real data, and a change to the rules that decide what needs the owner (CLAUDE.md and the skills, even
  though they are `.md` files). Requires its lane's checks and reviews plus the owner's approval or a recorded
  standing permission covering the exact action.
- **First-time setup.** Bootstrap from the owner's own rules text is lane 2: creating the repo, its CI and the rules
  files as the owner gave them. The owner's request is the standing permission for the setup check. Later changes to
  the rules or CI are lane 3 as usual.
- **Permission and risk are separate.** Standing permission removes a repeated approval request; it never lowers the
  lane or removes required checks and reviews. A routine, non-destructive validation on an authorized device does not
  itself raise the change's lane. A migration, real-data write or other consequential action retains its inherent lane
  even when authorized. An external action outside recorded permissions waits for authorization.

## Quality bar

The least every brief's acceptance criteria cover, where they apply:

- Every core journey works end to end, with its loading, empty, error and recovery states.
- Everything works with the keyboard alone, and focus is always visible.
- Where there are users, users cannot access data outside their permissions.
- The supported browsers named in the brief pass.
- The performance budgets in the brief (load time, delay after a tap or a key) hold, measured.
- Browser device profiles emulate a screen size, a user agent and touch: that is emulation evidence, not proof of how a
  physical phone performs. A budget for a device is measured on that device.

## How code is written

- Comments say why. They do not say which plan asked for the code.
- Use injected clocks and fixed seeds. Browser tests wait on readiness, never on a sleep.
- Look at the real expected, actual and diff images before accepting a visual change, and explain each change.
- Code is grouped by feature, not by kind: no top-level `components/`, `services/` or `utils/`. A feature owns its
  code and data and imports only from features below it. Tests never sit beside the source; `tests/` mirrors `src/`.
  The layer order is written in `tests/architecture.test.ts`, one list with the lowest feature first, and the test
  fails on an upward import or a cycle.

  ```
  src/
    index.ts                 the public surface; anything it does not export is internal
    lib/                     shared helpers with no feature logic (maths, IO, random)
    features/<feature>/      one folder per feature: <feature>.ts is its entry, one job per file, library/ its data
  scripts/                   thin command-line wrappers over src/
  tests/                     mirrors src/; architecture.test.ts holds the layer rule (imports go down, no cycles)
    golden/                  pixel or snapshot goldens
  docs/superpowers/          specs/, audits/, progress.md and history.md
  ```

## The staged path

- **When.** Stage the work when the outcome or the approach is uncertain, when it waits on an open decision or on other
  work, or when it is lane 3. A new feature or many files alone does not stage it. Risk decides the audits, never the
  number of tasks; the audits for each lane are in Settings.
- **Can this runtime start sessions?** Before the first stage, the coordinator checks each capability on its own:
  starting a session, sending it a message, choosing its model and archiving it. A missing one changes only what needs
  it: without archiving, finished sessions are listed for the owner to close; without a model choice, sessions run on
  the default; without messaging, sessions report through committed files. Reviews run in fresh, isolated sessions
  wherever the runtime can start one (a new session, or an isolated reviewer it supports). The coordinator asks the
  owner to start a reviewer only when no isolated reviewer session can start, and then runs the stages one after another
  itself, each starting from the committed documents.
- **Superpowers.** Its skills run the steps named below (brainstorming, writing-plans, executing-plans), at the version
  the setup check records; where they differ from these rules, these rules win. A final review its skills ask for is the
  implementation audit when the lane calls for one, run once by a fresh session (`review`), not a second review; on lane
  1 it is the implementer's own check. Any deferring minor findings it suggests does not apply: the fix round fixes
  every in-scope finding.
- **Splitting.** Split by what a mistake costs, not by folder: one unit, one input, one output, one lane. Two steps wait
  on each other only if the second reads the first one's output; if you cannot name what passes between them, run them
  side by side. A step with one right answer (merge, rank, dedupe, compare) is plain code, not a model. Build the gate
  first: before a repeated job, write the one check that can fail it.
- **One working brief, one implementation pull request.** On the staged path the brief is the spec: the outcome, the
  acceptance criteria, the boundaries the owner approves (dependencies, tools, environments, budget, expected duration) and
  the plan, in one document. The spec and its plan audit are docs: the spec merges on green without the owner, with its
  plan audit when it has one, and the build starts from `main`. Execution, the implementation audit and the fixes share
  one branch and one pull request: the audit reviews that branch before it merges, and the fixes land on it.

| # | Stage | Who | Writes |
|---|---|---|---|
| 1 | Spec | The coordinator, with the owner (superpowers brainstorming); a plan session adds the plan when the approach is uncertain (superpowers writing-plans) | `docs/superpowers/specs/<date>-<topic>-design.md` |
| 2 | Plan audit | An audit session, `review` skill (lane 3 only), on the spec's pull request | `docs/superpowers/audits/<date>-<cycle>-plan-audit.md` |
| 3 | Execution | The implementer: one work session (superpowers executing-plans) | the code |
| 4 | Implementation audit | A fresh audit session, `review` skill (lane 2 and 3) | `docs/superpowers/audits/<date>-<cycle>-implementation-audit.md` |
| 5 | Fixes | The implementer, in the same session | the code |
| 6 | Review | The owner approves the finished result | notes for the next spec |

- **Writing.** One writer per branch at a time: the implementer writes, then hands the branch to the reviewer by naming
  a commit; the reviewer commits only its audit file and hands the branch back by naming its own commit. The audit reads
  a named commit, never a moving branch. Independent writers use their own branches or worktrees. The coordinator is the
  only writer of `progress.md` and `history.md` while active, including for delegated short-path work. If the
  coordinator cannot write to the repo, the implementer writes them for it and says so in the commit. Otherwise the
  implementer owns those records. The tracking document in the implementation prompt is the plan's own checklist,
  written by the implementer on its branch. Worker reports do not create additional writers of the shared progress
  record.
- **The coordinator** is one long-lived session. It talks with the owner, writes the spec, creates `progress.md` and
  `history.md` if missing, starts each stage's session, tracks them in `progress.md`, names each unit's lane in the
  spec, and archives each session when its stage is done. The coordinator never counts toward the session limit.
- **Specialist sessions start on demand:** a plan session, an audit session or the advisor starts when its work is ready
  and is archived when it is done. Nothing waits idle.
- **The advisor** gives a short second opinion on a big call: the risks, what is missing, a recommendation. It never
  writes code or changes files. The coordinator starts it only for big calls: specs, plans, roadmap changes, and
  approving designs or mockups. It does not reopen the owner's decisions.
- Sessions the coordinator starts are threads, not subagents. No session starts subagents of its own unless the owner
  says so.
- **Slice end.** Every slice, the first one included, closes in this order: a fresh end-to-end walk (see `review`),
  the design review loop on its screens (see `visual-check`), the screens page (see `visual-check`), the owner's own
  walk, and last the retro. Do not move to the next slice without a design review loop on the screens completed during
  that slice.
- **End-to-end walk.** A fresh session that did not build the slice walks every journey in it from start to finish as a
  real person would, in a cloud container or on the test site, on each device in the matrix. It reports each step as
  pass or fail with its evidence, and its failures are fixed through `review` before the owner's walk.
- **Screens page.** All of the slice's screens in one organized artifact, grouped by flow and device, shared with the
  owner as one link before the owner's walk.
- **End-of-slice retro.** As the last step of each slice, a fresh session reads that slice's audits, the flaky tests it
  reported and the findings that needed fixing more than once. It turns each lesson into a test where a test can catch
  it (for example, a check that a pull request body ends with "Requested by **McThayDT**"), and proposes the rest as one
  rule-change pull request for the owner to approve.
- **Handoff.** Every stage reads the files its prompt names, normally the spec, the audits so far and `progress.md`; the
  plan also reads Lessons in `history.md`. It reports its progress to the coordinator, which keeps `progress.md`, and
  its last step is to commit and push. `progress.md` holds the active milestone, including completed outcomes needed
  to understand what remains. When a milestone closes, its work and decision records move to `history.md`; screen
  approvals are recorded there with their scope. The execution session starts with this prompt, and uses it again
  for the fixes:

```
Use superpowers:executing-plans to carry out the plan, and develop by these instructions.

Now implement precisely as planned, in full.

Implementation Requirements:

- Write elegant, minimal, modular code.
- Adhere strictly to existing code patterns, conventions, and best practices.
- Keep comments brief, and only where the code doesn't explain itself: say why, not what.
- As you implement each step:
  - Update the markdown tracking document and overall progress percentage dynamically.
```

- **Reporting.** Workers report to the coordinator through `send_message`, or committed files when messaging is
  unavailable: the task as understood at the start; meaningful milestones and their evidence; material decisions and
  assumptions; deviations and their reasons; previews; blockers; and completion. Separate facts from estimates and
  owner instructions from agent-selected choices. Ordinary debugging stays internal unless it changes outcome, timing
  or confidence. A missing tool replaced by an authorized alternative that meets the same acceptance criteria is a
  deviation, not a stop; an access refusal is never worked around.
- The session that merges reports each merge and each stop listed in `release`. Coordinators of related workstreams
  report decisions, changes that affect this work, blockers and what they push. The coordinator keeps the owner
  informed under "Owner visibility and early steering", including decisions that need no approval. Pause and request
  an owner decision only when the brief, permissions or an unresolved choice requires it; keep independent work moving.
- Each session's prompt names the files to read; sessions wait for CI results instead of repeatedly watching logs.
  Waiting does not suspend the owner update interval.

## Settings

Change a number or a model here and nowhere else.

- Owner update interval: 5 minutes during active work. Meaningful milestones and material changes are reported sooner.
  Short tasks normally need only a start update and completion. Updates do not require acknowledgement.

- Tries per problem: 3. After that, stop that approach and reassess: try another with a reason, or move to independent
  work. Include material setbacks in the owner update, with what was tried and what it showed. Pause for an owner
  decision only when their decision, access or a change to an agreed budget is needed.
- Overrun: a task that has taken twice the duration its brief estimated. Reassess the estimate and the approach, and
  report the changed outlook. Request a decision only if the authorized budget or scope must change.
- Pull requests open: 3. Checks run at once, as many as the CI capacity takes without queueing (measured, not guessed);
  only the integration with `main` before a merge runs one pull request at a time. Branches: `main` plus branches with
  an open pull request, 5 at most; a branch merges or closes within 2 days.
- Work sessions at once: 5, all on the current slice (a milestone), and at most 3 writing code (implementers). The rest
  only read and report. It is a limit, not a goal: a session starts only when its work is ready.
- Session refresh: when the context degrades (it repeats itself, loses earlier decisions or nears full) or at a natural
  boundary (a merge, a finished stage), with a handoff: the last commit, where to resume, what is left. The coordinator
  writes where things stand to `progress.md` first.
- Browser test pieces in CI: 12. Device matrix: small phone, tablet, computer, as browser profiles (emulation evidence);
  a brief may change it. Progress: the coordinator keeps each stage's row in `progress.md` up to date, with a percentage
  from the plan's ticked steps, as supporting information. Rule edits: batched into one session a day.
- Audits by lane: lane 1 none; lane 2 one fresh review of the change, after the build; lane 3 a plan audit and an
  implementation audit.
- Models and effort: a session whose model and effort are not named runs on Opus, medium. Nothing runs above high
  effort. Plan: Fable 5.2, medium. Plan audit: Opus, medium. Execution (and its fixes): Sonnet, high. Implementation
  audit: Opus, medium. Advisor: Fable 5.2, medium.
