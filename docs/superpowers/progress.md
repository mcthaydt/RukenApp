# Progress

Last updated: 2026-11-20 22:05 UTC (from `date`).

## The owner's instructions

- 2026-11-20: "The outcome I want: Finish Ruken." Run the work by the CLAUDE.md and skills the owner gave in the project's files (now in this repo); run the setup check in `release` first; then keep going within the brief, asking only the owner's own choices as decision cards with a recommendation.
- 2026-11-20 22:27 UTC, on a card: "Ready to launch". Finishing Ruken means every roadmap slice up to Launch, in order: slice 2, the feed, submitting and admin, money, then the before-launch list. This is the owner's go for the slices the roadmap marks Later.
- 2026-11-20, the restart handoff: open items are deploying #238, phone sign-in (#209), Twilio's HELP reply, redoing the workflow, CI and CLAUDE.md, the slice units never built, a feed or some link to games on the site, and the leftover branch `claude/project-thread-2fgp7u`.
- 2026-11-21 14:41 UTC, the Owner: "add to the claude.md the patch for the not following hooks, that is a negotiable" (read as non-negotiable). Sessions never route around a hook; every pull request create and edit goes through a checked route. Spec `2026-11-21-hooks-cover-every-pr-route-design.md`, section 3.7.
- 2026-11-21 14:41 UTC, the Owner: "ALL SESSIONS NEED TO FOLLOW THE HOOKS". The hooks rule is the first of the rules that never bend and names every session.

## Active milestone: setup and "Finish Ruken"

Current work: the setup check (first-time setup, lane 2): CLAUDE.md, the skills, the rule hooks and CI restored from the owner's copies.

Completed:

- None merged yet.

Remaining:

- Merge the setup pull request; the owner runs the branch protection command.
- Right after that merge: a one-line pull request that turns `ruleMix.firstTimeSetup` off in `.claude/hooks/rules.json` (it cannot share a branch with other rule files; the hook refuses the mixed push).
- Build Ruken to launch, slice by slice in roadmap order, starting with phone sign-in (#209).

Blockers: none.

Preview: https://ruken.io (deployed by the owner; `main` is not deployed on merge).

## Slice 2

- **Unit G (Task 24), a real game sent, accepted and played on the test site: done, 2026-11-21 03:10 UTC.** Game used: Floor Fifty (ruken.io). The Owner played it and tried all three play checks. Step 1 passed (media.ruken.dev health ok; a game with no pass is refused). Step 4 passed on Floor Fifty: its folder without a pass gives the run-out line, both clips are served as video/mp4, and ruken.io/g-<id>/index.html returns 404. The review job showed nothing waiting, which is expected because no new version was queued. Step 5 (the GitHub repo-change return) was not checked by us; the Owner said "I did all of those, move on", so it is done on their word, not seen by a program. This closes red 1 in the slice 2 implementation audit.
- Slice end (walk, design rounds, screens page, Owner's walk, retrospective): in progress, branch `claude/project-thread-7wmhqn`.

## Slice 3 parked

- 2026-11-21 03:12 UTC, the Owner: "Let's park slice 3 until we confirm slice 2 is perfect". Units D and I are paused on their branches; K and the learned-feed spec have not started. Slice 2's slice end is the top priority.

## Decisions

- Agent-selected: CI is the workflow kept from before the cleanup (`2f1bde5^`), restored as the restart handoff says, with `commit-authors` still its own workflow so a pull request text edit does not rerun every test. Easy to change.
- 2026-11-21 01:16 UTC, the owner's answers on three cards for the feed and the maker's page (spec `2026-11-21-feed-and-makers-page-design.md`, section 8): Open 1, leave the red mark off the price card (unit F task 4 struck); Open 2, simple page editing now (unit I as planned); Open 3, the simple feed order first, with the learned feed to follow (unit C tasks 2, 3 and 5 and unit D go ahead on the interim order).
