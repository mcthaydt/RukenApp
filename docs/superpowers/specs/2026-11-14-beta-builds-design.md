# Beta builds

Date: 2026-11-14. Status: written for the Owner's approval. Builds on the design (`2026-11-13-ruken-reels-linktree-design.md`), slice 2's pull and review, and the wishlist design (`2026-11-14-wishlist-before-launch-design.md`); changes them only where this file says so.

## Why

Owner, 2026-11-14: "I'm thinking the release / beta testing can be like netlify where release is main, and beta testing is just a specific commit/release whichever makes more sense." A maker wants a few chosen players to try a new version before everyone gets it, and, before 30 November, to let their own fans in early.

## What the Owner decided (2026-11-14)

- A beta comes from a branch: "A beta branch (my pick)".
- "Nothing goes on the site without approval": a beta is reviewed like a release.
- "you have to be a subscriber to play the beta": only members play a beta.
- "game creator can select members to be a part of the beta".
- "yes, they can play early": picked members play a beta before 30 November.

## Goals

- A maker names a beta branch and pulls it, the same way they pull a release.
- The pull waits in the admin queue; the Owner (or staff who check games) accepts or sends it back, as for a release.
- The maker picks which members may play it. Only those members, while their membership is active, see "Play the beta" on the game.
- An accepted beta is playable by those members before and after launch.
- A maker turns a beta into the release by pulling their release branch as usual; nothing is copied across.

## Not in this

- Betas from a commit or a GitHub release (the Owner chose a branch).
- Testers who are not members, public beta links, or a beta anyone can join.
- Feedback tools, crash reports or a tester chat. Testers reach the maker however they already do.
- A limit on testers. Added later if it is ever needed.

## What would make it a failure even if it works

- Anyone playing files nobody at Ruken accepted.
- Someone who is not a picked, current member opening a beta.
- Beta play changing anyone's pay.

## Approaches

The Owner chose a branch (2026-11-14).

- **A beta branch (chosen).** A second branch name on the game; "Pull for testing" resolves it to one commit and pulls it, through slice 2's pull exactly. Nothing to type but a branch name once; it mirrors Netlify's branch deploys.
- A GitHub release: picked from a list read from GitHub. Fine for makers who tag releases; many small makers do not.
- A specific commit: pasted by the maker. Most exact, hardest to use.

## How it works

### The maker (on `/make/<game>`)

```
Beta
Branch: beta            [ Change ]
Waiting for review · pulled 2 hours ago
[ Pull for testing ]

Testers (3)
ana@example.com          Remove
@kofi                    Remove
[ Add a member ]
```

- "Beta" section: the beta branch name (set once, changeable), the beta's state in the same plain words as a release ("Not sent yet", "Waiting for review", "Ready for testers", "Sent back: <reason>"), and "Pull for testing".
- "Pull for testing" pulls the beta branch's latest commit and sends it for review in one press, as "Pull the latest" does for a live game.
- "Testers": the maker adds a member by their email or their handle. Someone who is not a member is refused in plain words ("Only members can test games. Ask them to join first."), and nothing is stored. Each tester can be removed.
- Drunk grandma: one button to send a beta, one to add a tester, and the state in words.

### Review

- A beta pull appears in the admin queue marked "Beta", with the same Accept and Send back. Accepting it makes it the game's beta; it does not touch the release. Sending back shows the maker the reason, as for a release.

### The tester

- On the game in the feed, on the maker's page and at `/g/<game>`, a picked member with an active membership sees a small "Play the beta" under the game's own button (Wishlist before launch, Play after).
- It opens the accepted beta's files through the game gate with a play pass for that pull, as slice 2 does for the release. Before launch, this is one of the exceptions to the wishlist design's "the play route refuses everyone before launch", alongside the maker and staff.
- Anyone else, or a tester whose membership has ended, does not see the button, and a play pass for the beta is refused.
- Drunk grandma: the tester sees one extra button, with the word "beta" on it, only on games they were picked for.

### Money and numbers

- Beta play never counts toward pay: it is recorded with its own basis, and design 6's "What never counts toward pay" gains "beta play".
- The maker's numbers (wishlist design) show beta plays and minutes as their own line: "Beta: played 40 times in the last 7 days".

### Stored

- On the game: the beta branch name, the accepted beta pull, and the beta pull waiting for review (the same pattern as slice 2's live and pending pulls).
- `BetaTester`: the game, the member, when they were added. Removing deletes the row; a deleted account's rows go with it.
- A beta's files sit beside the release's in the bucket and are deleted when a newer beta is accepted, as slice 4's old-file deletion does for releases.

## Needs, and when

- Slice 2 (the pull, review, the play pass and the gate) and the wishlist work on `main`; slice 4's admin portal is not needed (the queue is slice 2's).
- Members exist only once live payments are open. Until then Ruken is in Stripe's test mode, so before launch "members" are only test accounts. Early beta play for real fans needs live payments open before 30 November, which is the Owner's (terms, privacy and the maker agreement first). Owner, 2026-11-14: "We'll do that once we finish the app, we won't tell anyone until everything is done." So before launch, betas are tried with test accounts; real fans come once the app is finished and live payments open.
- Target: on `main` by Friday 27 November, after the wishlist work. If that date is at risk, it ships after launch rather than slowing the launch.

## Left to the plan

- The exact words of each beta state and refusal.
- Whether the beta's state lines reuse slice 2's `stateWords` or a sibling.
- The play basis name for beta play, and where the gate checks the tester list.
