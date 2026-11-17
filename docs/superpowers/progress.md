# Ruken progress

Last updated: 2026-11-17 04:02 UTC. Written by the Ruken coordinator thread, which writes to the repo itself.

## Outcome

The owner, 2026-11-17: "The outcome I want: a finished app". Built slice by slice in the order of `roadmap.md`, each slice merged and green on `main` before the next starts.

## Owner instructions (this milestone)

- 2026-11-17, the start prompt: run the setup check in `release` first, list the steps only the owner can run as one batch of CLI commands, then report the outcome, assumptions, first step and first working output, and keep going; ask only for the owner's own choices, as decision cards with a recommendation.
- 2026-11-17, the handoff: commits by McThayDT with no AI credit; pull requests end with "Requested by **McThayDT**"; merge commits only; nothing runs on the owner's Mac; RukenApp is public and records only what Ruken does.
- 2026-11-17, the handoff, phone sign-up (already decided, not asked again): phone number, password and date of birth, then a code by text; email only when someone pays; sign-in by phone number and password; texts through Twilio, US and Canada first; this slice builds the plan's branches A and B only; the real texting comes last, after the owner upgrades Twilio.
- 2026-11-17 04:06 UTC: "I've already done Part 2" (the Twilio setup in the owner's commands). Real texting no longer waits on Twilio; US delivery still needs carrier registration (plan step X5).
- 2026-11-17 04:06 UTC: "Can you connect to my computer to do 1": the owner's own exception to "nothing runs on the owner's Mac", for the branch protection and branch clean-up commands only.

## Active milestone: setup, then phone sign-up

| Step | State |
|---|---|
| Setup check (`release`) and the rules pull request | on a branch |
| Owner's batch of commands (branch protection, stale branches) | running on the owner's Mac at the owner's request |
| Phone sign-up plan brought up to date with `main` and re-audited | not started |
| Branch A, `texts/port` (the Texter, the stand-in, the number rules) | not started |
| Branch B, `texts/sign-in` (sign-up, sign-in, forgot password; email sign-up removed) | not started |
| Real texts through Twilio (the owner's Twilio steps are done) | not started |
| Slice end: walk, design rounds, screens page, owner's walk, retrospective | not started |

## Material decisions (agent-selected, not owner-approved)

- The phone sign-up slice runs before the rest of slice 2 (game page and play, accept and send back, the GitHub App hookup), because the handoff names it as this slice.
- `commit-authors` is its own workflow beside `gate`, not a job inside it, so editing a pull request's text reruns only that check. Both are required.
- The old auto-merge workflow is not restored: the session that merges queues each merge itself (`release`), and GitHub deletes merged branches.
- Draft runs no longer use `--passWithNoTests` (the kit's empty-suite rule): the unit step lists the reached tests first, and the draft database run is the full database suite stopping at the first failure.

## Previews

- Test site: https://ruken.ruken-beta.workers.dev (Cloudflare deploys `main` after each merge).
