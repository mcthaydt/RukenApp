# History

Written by the rules setup session on the coordinator's behalf, because the coordinator cannot write to the repo
(CLAUDE.md, "Writing"). Earlier records (the old progress, history, lessons and audits) were removed in #159; git
history keeps them.

## Setup

Setup check from `release`, run 2026-11-16 on `main` at `20b3a05`.

- Superpowers: version 7.0.2 (the plugin's `plugin.json`; no commit hash is available in this runtime).
- Where its skills disagree with these rules (these rules win):
  - `writing-plans` recommends subagent-driven execution, and `brainstorming`'s builder check dispatches a subagent.
    These rules allow no subagents unless the owner says so; execution uses `executing-plans` in one session.
  - `writing-plans` saves the plan as its own file under `docs/superpowers/plans/`. On the staged path the plan lives
    in the spec, one document.
  - `executing-plans` ends with its own whole-branch review and leaves Minor findings in a ledger. Here that review is
    the implementation audit by a fresh session when the lane calls for one (the implementer's own check on lane 1),
    and the fix round fixes every in-scope finding, minor ones included.

## Standing permissions

- The setup check from `release` (owner's request, 2026-11-16, that started this project). Scope: verifying the setup
  items and adding the rules files as the owner gave them. Not CI workflow changes.

## Approved screens

None recorded under these rules yet.

## Lessons

None yet.

## Standing facts

- RukenApp is public; private matters go to RukenPrivate.
- Git identity: McThayDT `107786093+mcthaydt@users.noreply.github.com`. No AI credit lines.
- CI workflow files (`.github/workflows/`) change only on the owner's quoted words. They still mention CLAUDE.md in a
  comment; that is left as is.
- Test site: https://ruken.ruken-beta.workers.dev. Games gate: ruken-games.ruken-beta.workers.dev. GitHub App:
  GH-To-RKN (App ID 5776064).
- The roadmap is `docs/superpowers/roadmap.md` (owner, 2026-11-15: "Roadmap is fine"). Slice 2 only; everything after
  it waits.
