---
name: review
description: Use when a plan or a finished change needs auditing, when more than one review is due, or when review findings need fixing.
---

# Review

Reviews find problems and change nothing but their own audit file. The implementer fixes them; a program or the reviewer
checks each fix.

## Checks and reviews

- A check is a test that fails by itself. Before the work starts, write down every check a program can judge, from the
  brief's acceptance criteria.
- A review (a model or a person reading the work) is real evidence of a different kind: it finds what no check encodes,
  such as missing requirements, confusing screens and wrong assumptions. Use both.
- Review against the acceptance criteria in the brief, plus exploratory checks for what the criteria missed. A gap
  against a criterion is red; an improvement is a note, kept apart from the blocking defects.

## Audits

- Which audits a change gets depends on its lane (Settings in CLAUDE.md), not on its task count. A fresh session runs
  each audit, so the work is read by eyes that did not write it.
- Files: `docs/superpowers/audits/<date>-<cycle>-plan-audit.md` and `...-implementation-audit.md`; `<cycle>` counts
  rounds.
- Both audits start with this prompt:

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Side by side

- Reviews that do not need each other's output run at the same time, each in its own session with its own context and
  one lens (for example correctness, completeness, the codebase). Four reviewers sharing one window are one opinion,
  paid for four times. A review that needs another's output waits for it.

## One finding is one unit

Write each finding so the implementer can act on it alone:

UNIT: the file or piece the finding is in.
VERDICT: red (violates a requirement, blocks acceptance) or note (optional, recorded, not fixed here).
REQUIREMENT: the requirement it violates: the brief, the plan, a standing rule or a check.
REASON: what is wrong, in one line.
EVIDENCE: the failing check or the line, and what it shows.
EXPECTED: what should happen instead.
FIX: the bounded change, and the only files it may touch.

## The fix round

- The implementer fixes every in-scope finding, low ones included, each in its own files. A finding is in scope when it
  violates a requirement of this change; notes and findings outside the change are recorded in the audit file as
  follow-ups, not fixed here. The only exception to fixing is a fix that needs the owner's choice: name it, ask it as a
  decision card with options and a recommendation, and fix the rest.
- Each finding gets the tries in Settings. Only a finding that still fails goes back, alone, with its evidence and
  scope; after the last try, stop that approach and reassess. Report material setbacks through the owner updates,
  with what was tried and what it showed. Pause for an owner decision only when their decision, access or budget is
  needed. A fix never grows past its scope: a second problem seen on
  the way is reported, not fixed.
- A fix is done when its check passes, run by a program or the audit session, never on the implementer's own say-so.

## Lessons

A confirmed failure gets a regression test first. A lesson is written down only when no test can catch it: one line
under "Lessons" in `docs/superpowers/history.md`, which the coordinator (or short-path implementer) adds when the
work is archived. A merge with nothing to learn leaves none.

ACCEPTED: utils slice merged, green on the first try.
DERIVED: adapters keep keyword arguments exactly.
LANDS IN: the plan's brief for every later slice.

A lesson lands in the plan's brief, not in a worker's instructions. The next rule-edit session moves each into
CLAUDE.md.
