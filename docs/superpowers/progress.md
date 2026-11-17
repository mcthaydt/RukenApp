# Ruken progress

Last updated: 2026-11-17 06:39 UTC. Written by the Ruken coordinator thread, which writes to the repo itself.

## Outcome

The owner, 2026-11-17: "The outcome I want: a finished app". Built slice by slice in the order of `roadmap.md`, each slice merged and green on `main` before the next starts.

## Owner instructions (this milestone)

- 2026-11-17, the start prompt: run the setup check in `release` first, list the steps only the owner can run as one batch of CLI commands, then report the outcome, assumptions, first step and first working output, and keep going; ask only for the owner's own choices, as decision cards with a recommendation.
- 2026-11-17, the handoff: commits by McThayDT with no AI credit; pull requests end with "Requested by **McThayDT**"; merge commits only; nothing runs on the owner's Mac; RukenApp is public and records only what Ruken does.
- 2026-11-17, the handoff, phone sign-up (already decided, not asked again): phone number, password and date of birth, then a code by text; email only when someone pays; sign-in by phone number and password; texts through Twilio, US and Canada first; this slice builds the plan's branches A and B only; the real texting comes last, after the owner upgrades Twilio.
- 2026-11-17 04:06 UTC: "I've already done Part 2" (the Twilio setup in the owner's commands). Real texting no longer waits on Twilio; US delivery still needs carrier registration (plan step X5).
- 2026-11-17 04:43 UTC, on a card: "Send codes through Twilio Verify". Codes go through Verify with Ruken's own custom codes; Ruken's other texts still wait for carrier registration (X5).
- 2026-11-17 04:06 UTC: "Can you connect to my computer to do 1": the owner's own exception to "nothing runs on the owner's Mac", for the branch protection and branch clean-up commands only.
- 2026-11-17 05:07 UTC: the Verify service could not be made (Twilio 20003, a trial account), so the Twilio upgrade is not done yet.
- 2026-11-17 05:08 UTC: "We'll revisit phone at the end of this slice". The Twilio upgrade, the Verify service and Step 1a move to the slice end; A and B are built on the stand-in meanwhile.
- 2026-11-17 05:10 UTC: "The phones are not the only thing we have the do for this slice, do the other stuff". The milestone also holds the rest of slice 2 (T, S, F, G and the slice audit).
- 2026-11-17 05:12 UTC: "Let's just do command then, so we stick to plan". Games are accepted or sent back by a command the owner runs; no staff review page in this slice (the admin portal is slice 4).
- 2026-11-17 05:35 to 06:13 UTC, the game page and play screen: like Steam's page and Game Pass's in-game shell in what they do, rethought to be more human; the game page is the watch page (A); the play screen has a small see-through tab that can be dragged, which opens menu A; the feed (slice 3) is Reels-like with the app bar at the bottom like YouTube, and tapping a game opens its page. Recorded in the spec of #193.
- 2026-11-17 06:25 UTC: "All games must be playable on computer and mobile" (Unit R).
- 2026-11-17 06:27 UTC: "We need to add in the bits to game submission that we don't have like languages and tags/genre, everything steam pages have, we have" (spec PR #195).
- 2026-11-17 06:28 UTC, on a card: the weekly player count starts off until the maker turns it on.

## Active milestone: slice 2 (phone sign-up and the rest of slice 2)

| Step | State |
|---|---|
| Setup check and the rules pull request (#188) | done: merged at e5a1f62 |
| Owner's batch, Part 1 (branch protection, old branches deleted) | done by the owner, checked 05:07 UTC |
| Phone sign-up plan, Verify folded in (#189) | done: merged at 2202698 |
| Rest-of-slice-2 plan brought up to date (#192) | done: merged at 78008fc |
| Branch A, the Texter, the stand-in and the number rules (#191), lane 2 | done: merged at 98e30ed, main green |
| Game page and play screen spec and plan, Units F, P, R (#193) | done: merged at cfa20b4 |
| S, accept and take off (#194), lane 2 | review clear at 33c67bb; merging main, then the full run |
| Branch B, sign-in and forgot password, lane 3 | building (Sonnet 5.5, high); held unmerged until Step 1a and the owner's OK |
| Game facts for submission: languages, tags, genre (#195), lane 3 | spec in draft; three owner questions open; plan audit next |
| R, every game plays on phones and computers, lane 2 | not started; after S |
| F, the game page and the play screen, lane 2 | not started; after S and R |
| P, the maker's player count switch, lane 3 | plan audit clear; after F; merging applies a migration, so it needs the owner's OK |
| G, a real game on the test site | not started |
| Owner's Twilio upgrade, Verify service, Step 1a | at the slice end, by the owner's call |
| Slice end: walk, design rounds, screens page, owner's walk, retrospective | not started |

## Material decisions (agent-selected, not owner-approved)

- Phone sign-up and the rest of slice 2 run as one milestone (owner, 05:10 UTC); B waits for the Twilio step at its end.
- `commit-authors` is its own workflow beside `gate`, not a job inside it, so editing a pull request's text reruns only that check. Both are required.
- The old auto-merge workflow is not restored: the session that merges queues each merge itself (`release`), and GitHub deletes merged branches.
- Draft runs no longer use `--passWithNoTests` (the kit's empty-suite rule): the unit step lists the reached tests first, and the draft database run is the full database suite stopping at the first failure.

## Previews

- Test site: https://ruken.ruken-beta.workers.dev (Cloudflare deploys `main` after each merge).
