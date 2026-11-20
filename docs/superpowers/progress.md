# Progress

Last updated: 2026-11-20 22:05 UTC (from `date`).

## The owner's instructions

- 2026-11-20: "The outcome I want: Finish Ruken." Run the work by the CLAUDE.md and skills the owner gave in the project's files (now in this repo); run the setup check in `release` first; then keep going within the brief, asking only the owner's own choices as decision cards with a recommendation.
- 2026-11-20, the restart handoff: open items are deploying #238, phone sign-in (#209), Twilio's HELP reply, redoing the workflow, CI and CLAUDE.md, the slice units never built, a feed or some link to games on the site, and the leftover branch `claude/project-thread-2fgp7u`.

## Active milestone: setup and "Finish Ruken"

Current work: the setup check (first-time setup, lane 2): CLAUDE.md, the skills, the rule hooks and CI restored from the owner's copies.

Completed:

- None merged yet.

Remaining:

- Merge the setup pull request; the owner runs the branch protection command.
- Agree what "finished" means for Ruken, then build it slice by slice (roadmap).

Blockers: none.

Preview: https://ruken.io (deployed by the owner; `main` is not deployed on merge).

## Decisions

- Agent-selected: CI is the workflow kept from before the cleanup (`2f1bde5^`), restored as the restart handoff says, with `commit-authors` still its own workflow so a pull request text edit does not rerun every test. Easy to change.
