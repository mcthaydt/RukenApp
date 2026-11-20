# Ruken progress

Last updated: 2026-11-20 02:09 UTC. Written by the Ruken coordinator thread, which writes to the repo itself.

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
- 2026-11-17 06:47 to 06:53 UTC: an Accepted screen with the blurred background, and the acceptance rate as a label on the first maker screen; then "Slow number of seats makes the most sense, we pick one day where everyone finds out if they got accepted, it becomes a ritual, the number of acceptances per week is capped but grows every 3 months up to 500 total worldwide maximum" ("500 a week, at most"). Spec #204.
- 2026-11-17: About up to 280 characters; no AI question; 3 to 10 screenshots, required; videos 15 to 60 seconds, up to 5 of each shape; English is always one of the languages. Spec #195.
- 2026-11-19 15:11 UTC: online games ask where their servers are, and players give their birthday and place. Spec #203 (country and state; the full birthday kept; the fields built in slice 2, the ranking in slice 3).
- 2026-11-20 00:16 UTC, on cards: decision day is Friday at noon New York time; 10 seats a week to start, growing by half again every 3 months.
- 2026-11-20: connect the games domain on the test site now (spec #207).
- 2026-11-20 01:28 UTC, on a card: merge decision day storage (#208) once checks pass.
- 2026-11-20 02:03 UTC: "Finish the slice, I'm going to sleep"; 02:04 UTC: "Make sure you obey the workflow".

## Active milestone: slice 2 (phone sign-up and the rest of slice 2)

| Step | State |
|---|---|
| Setup, plans and specs (#188, #189, #192, #193, #195, #203, #204, #207) | done: merged; each lane 3 plan cleared its plan audit |
| Branch A, the Texter and the number rules (#191), lane 2 | done: merged at 98e30ed |
| S, accept and take off (#194), lane 2 | done: merged at dc96dc9 |
| D, decision days stored (#208), lane 3 | done: merged at 36e87c0 with the owner's OK; the test site's migration is still to be confirmed on Cloudflare (owner step) |
| R, every game plays on phones and computers (#206), lane 2 | review clear; full run, then merge |
| F, the game page and the play screen, lane 2 | next, after R |
| W, the games domain's workers_dev switch, lane 3 | can build beside F; merges with the owner's OK |
| H, hold and release on decision day, lane 3 | after F (not beside Q, R, F, P or K) |
| P, the maker's player count switch, lane 3 | after F; merging applies a migration, so it needs the owner's OK |
| A, the Accepted screen and the label, lane 2 | after H (not beside F, P, K or Q) |
| L, K, Q, V, game facts | L after R; K after D and P; then Q and V |
| O, U, Q+, Y, servers and a player's place | O after K and D; U after B; Y after U |
| C, CI screenshots in R2 (#211), lane 3 | spec in plan audit; builds when a writer place is free; merges with the owner's OK |
| G, a real game on the test site | not started |
| Branch B, sign-in and forgot password (#209), lane 3 | built, audit clear; held as a draft until the Twilio upgrade, Step 1a and the owner's OK |
| Owner's Twilio upgrade, Verify service, Step 1a | at the slice end, by the owner's call |
| Slice end: walk, design rounds, screens page, owner's walk, retrospective | not started |

## Follow-ups (not built yet)

- `release` says CI screenshots need no label, but `ci.yml` still reads the `screenshots` label. Unit C's Step 1b drops it (the owner may overrule).

## Material decisions (agent-selected, not owner-approved)

- Phone sign-up and the rest of slice 2 run as one milestone (owner, 05:10 UTC); B waits for the Twilio step at its end.
- `commit-authors` is its own workflow beside `gate`, not a job inside it, so editing a pull request's text reruns only that check. Both are required.
- The old auto-merge workflow is not restored: the session that merges queues each merge itself (`release`), and GitHub deletes merged branches.
- Draft runs no longer use `--passWithNoTests` (the kit's empty-suite rule): the unit step lists the reached tests first, and the draft database run is the full database suite stopping at the first failure.

## Previews

- Test site: https://ruken.ruken-beta.workers.dev (Cloudflare deploys `main` after each merge).
