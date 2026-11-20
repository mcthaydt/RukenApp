---
name: build
description: Use when writing a brief's acceptance criteria, or writing or changing code or tests, or when a test fails, flakes or is pruned.
---

# Build

## Quality bar

The least every brief's acceptance criteria cover, where they apply:

- Every core journey works end to end, with its loading, empty, error and recovery states.
- Everything works with the keyboard alone, and focus is always visible.
- Where there are users, users cannot access data outside their permissions.
- The supported browsers named in the brief pass.
- The performance budgets in the brief (load time, delay after a tap or a key) hold, measured.
- Browser device profiles emulate a screen size, a user agent and touch: that is emulation evidence, not proof of how a physical phone performs. A budget for a device is measured on that device.

## How code is written

- Comments say why. They do not say which plan asked for the code.
- Use injected clocks and fixed seeds. Browser tests wait on readiness, never on a sleep.
- Look at the real expected, actual and diff images before accepting a visual change, and explain each change.
- Code is grouped by feature, not by kind: no top-level `components/`, `services/` or `utils/`. A feature owns its code and data and imports only from features below it. Tests never sit beside the source; `tests/` mirrors `src/`. The layer order is written in `tests/architecture.test.ts`, one list with the lowest feature first, and the test fails on an upward import or a cycle.

  ```
  src/
    index.ts                 the public surface; anything it does not export is internal
    lib/                     shared helpers with no feature logic (maths, IO, random)
    features/<feature>/      one folder per feature: <feature>.ts is its entry, one job per file, library/ its data
  scripts/                   thin command-line wrappers over src/
  tests/                     mirrors src/; architecture.test.ts holds the layer rule (imports go down, no cycles)
    golden/                  pixel or snapshot goldens
  docs/superpowers/          specs/, audits/, live/, progress.md and history.md
  ```

## Verification

Checks are what let work be handed off: what a program can judge, nobody has to read line by line. The owner says what done looks like and looks at the evidence; the checks do the rest, so they are built and kept like any other part of the product.

- **Run it like a person.** Before a change that alters what the product does is called done, its builder runs it: starts the app or game, goes through the changed journey with real taps, clicks, keys and typing, and looks at what happens. Passing tests are not this. How to start and drive this repo is in its `verify` skill, which the builder loads before every commit that changes behavior. Every session leans on it, so it stays quick and steady: a step in it that breaks or flakes is fixed first, and a change to how the product starts or what its first screen shows updates it in the same pull request. A session starts it clean once; its later runs may reuse the app or game it already has running.
- **The test that is hardest to fool comes first.** A unit test can pass while the feature is broken, because the test and the code share the same misunderstanding. So, in this order: 1. **Journeys**: a person's path through the running product, from the first screen to done; a failure names the step, with a screenshot; a changed journey gets a journey test. 2. **Property tests**, for the cases people and agents both miss: state something that must always hold and let many generated inputs, from a fixed seed, try to break it: round trips (save then load gives back the same thing), invariants (a count never goes below zero), repeats (doing it twice is the same as doing it once: migrations, retries, clean-ups) and twins (a fast version agrees with a plain, correct one). A property-test library is a new dependency and needs the owner's yes first. 3. **Old-versus-new tests**, for a rewrite or a move that should not change behavior: run the old and the new on the same inputs, set aside differences that do not matter (spacing, order), and treat every other difference as a bug unless it is on the change's written list of intended differences. Unit tests cover the small pieces underneath.
- **Test first, from the outside in.** Write the failing test first and confirm it fails for the right reason. The first one is the hardest-to-fool test the change reaches: a journey test when the change alters a journey, a property test when a rule must always hold. It stays failing while small unit tests build the pieces under it, each in a quick loop: a failing test, the least code that passes it, then a tidy-up with every test still passing.
- **Old code and today's behavior.** A test that pins what the code does today, before a refactor or a rewrite, passes at once on purpose: show that it can fail by breaking the code on purpose, then put the code back. Code written before its test is thrown away and written again from the test, except the old code in a rewrite, which stays as the yardstick until the old-versus-new test passes on the new.
- **Tests.** Quick targeted tests run locally whenever they help; CI is the merge gate. A failing test blocks only the change that touches it: report an unrelated failure, and give a failure on `main` its own thread. A merge still needs every required check green, unless the owner authorizes an exception named in the pull request. Never loosen, skip or re-record a test to hide a defect. No `--pass-with-no-tests` or similar flag that lets an empty suite pass in CI. Updating a golden for an approved behavior change is fine, with its before and after shown. A docs change or a purely visual change is verified by what fits (a link or build check, the approved look), a configuration change by lint, typecheck, the build and the CI run, and generated code (an API report, compiled messages, a database client) through its source and the tool that makes it, not by an invented unit test.
- **Quick and steady, or it gets skipped.** A slow check gets run less, and a flaky one teaches a session to rerun instead of fix. Cheap checks first (lint, typecheck, the tests the change reaches); before a push, the journeys the change reaches; the full suite in CI, where `release` sets the gate. A test that fails once and passes on retry is a defect. One rerun to find out whether a failure is flaky is allowed, and both results are reported; that rerun does not count as the clean run lane 2 needs. Report the flaky test with its text and record it under "Flaky tests" in `docs/superpowers/history.md`; its root cause is fixed in its own thread, unless it blocks this change. Never rerun it until it passes, slow it with a sleep, or skip it. If the root cause is not found within the tries in Settings, delete the test, put a steady check of the same thing in its place where one can be written, and record why, and the gap it leaves, under "Flaky tests".
- **A change does not quietly edit its own check.** If a change can edit the check that judges it, the check proves little. So CI workflow files, the repo's own root `CLAUDE.md` and the shared skills (every skill in `.claude/skills/` but `verify` and `this-repo`) change only in a pull request that changes no product code and no tests: a rule change, or the first-time setup, which may change several of them together. A code change that needs a CI workflow change lands the workflow change first, in its own pull request. A pull request that changes or deletes an existing test, golden or `verify` step names each one and why in its body. Its reviewer, where its lane has one, reads those first, and when it edits `verify` also runs `verify` from `main` (`review` says so too).
- **Lessons become tests first, and carry a trigger.** A confirmed failure gets a regression test. It becomes a lesson only when no test can catch it: one line under "Lessons" in `docs/superpowers/history.md` naming its trigger (the paths, or the kind of change, a diff shows), what to look for, and the failure behind it. Before it pushes, a session reads the lessons and acts only on those whose trigger its diff matches; a plan also carries the matching ones into its brief, as `review` says.
- **Prune.** Tests, `verify` steps, lessons and rules only grow unless someone trims them. Each retrospective removes the ones that no longer catch anything or that another check already covers, naming each one and why: rules and lessons in its rule-change pull request, tests in their own.
- **Superpowers' testing skills.** Its `test-driven-development` and `verification-before-completion` apply to every change, and where they differ these rules win: the first failing test is the hardest-to-fool one the change reaches, not only a small unit test; a test that pins today's behavior passes at once on purpose; the old code in a rewrite stays until the old-versus-new test passes; an unrelated failing test is reported and gets its own thread, not fixed in this change; an existing test that changes is named in the pull request body; the exceptions to test-first are the ones above (docs, purely visual, configuration), not a question for the owner; before a push the session runs the cheap checks and the journeys the change reaches, and the full suite runs in CI, where `release` sets the gate; and passing tests are not done until the change has been run through `verify`.
