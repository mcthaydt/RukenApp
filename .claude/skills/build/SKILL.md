---
name: build
description: Use when writing a brief's acceptance criteria, or writing or changing code or tests.
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
