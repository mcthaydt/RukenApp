# Ruken roadmap

The order we build Ruken in. One page, read top to bottom.

Approved by the owner, 2026-11-15: "Roadmap is fine".

## The rules

**We build every slice up to Launch, in order.** The owner, 2026-11-20 22:27 UTC, on a card: "Ready to launch". That is the owner's go for the slices below that were marked Later: slice 2's rest, then slice 3, slice 4, slice 5 and the before-launch list. (Before that, 2026-11-15: "We finish Slice 2: Games and play, everything after that is tagged for later work".)

1. **One slice at a time.** The owner, 2026-11-15: "One slice at a time is more what I meant by that". Work inside the slice being built may run side by side; nothing from a later slice starts. **Now** marks what is being built.
2. **Slices go in order.** A slice starts only when the one before it is merged and green.
3. **New ideas wait.** A new idea goes in "Not yet placed" at the bottom. It moves up only when the owner says where it goes.
4. **Designs can wait in line.** An approved design sits under its slice until that slice comes up. Approved is not the same as building.
5. "Done" means merged to main and green there. Nothing else counts as done.

How to read each list: **Done** is merged and green. **Now** is what is being built. **Next** is in line, in order. **Waiting** is approved, but its turn has not come. **Later** is after slice 2: not worked on now.

## Slice 0: Start

1. Done: the design, the workflow, the app skeleton, the tests that run on every change.

## Slice 1: Accounts

1. Done: sign up, sign in, forgot password, your account page, delete my account.
2. Done: membership: join, pay, cancel, join again.
3. Done: the look, the colours and the buttons.
4. Done: the site runs on its Cloudflare test address.
5. Done: the audit and its fixes.
6. Waiting: the check on the real site with real payments. It needs the real domain, so it happens at launch.

## Slice 2: Games and play

1. Done: games, their files, the play gate, connecting GitHub, the play rules (branches A to E and P).
2. Done: the clip and frame look (branch S, part 1).
3. Done: the maker's submission screens, rebuilt to the approved design (branch M, pull request #63).
4. Done: games on one free test address until launch (branch T, pull request #125). Plan for this and the steps below: `plans/2026-11-15-slice-2-rest.md`.
5. Done: the Owner accepts a game or sends it back by a command, and a maker takes their own game off Ruken and puts it back (unit S). The staff screens wait for slice 4.
6. Done: every game plays on phones and computers (unit R), a game's page, playing it and play time (unit F), and the maker's player count switch (unit P).
7. Done: the GitHub App is set up on ruken.io, and the games run on ruken.dev.
8. Done: a real game (Floor Fifty) sent, accepted and played on ruken.io (unit G, plan Task 24), 2026-11-21.
9. Done: the slice 2 audit (`audits/2026-11-20-slice-2-1-implementation-audit.md`) and its code fix (#243). Its other red, unit G, is closed.
10. Done: the slice end (the walk, three design rounds, and the Owner's notes, merged by 2026-11-21 14:26 UTC in #250, #253, #255, #260, #265 and #266).

---

# Later: after slice 2

## Slice 3: The feed and the maker's page

Now: resuming. Parked 2026-11-21 03:12 UTC, on the Owner's word: "Let's park slice 3 until we confirm slice 2 is perfect". The Owner's 14:32 UTC word is that it unparks once the editing work lands; that work has merged (#274, #276, #282), so slice 3 is being built again.

1. Done: the colour themes, the page rules, the maker's photo (branches A, B and G).
2. Later: the feed order, the feed, its controls, the paywall over a clip (branches C to F).
3. Later: the maker's page and editing it (branches H and I).
4. Later: the check on the test site (branch J).
5. Later: the feed algorithm (approved): a learned feed, play time first.
6. Later: "Your page", one page builder for players, makers and studios. Waiting for the owner's "fine" on the board.

## Slice 4: Submitting and the admin

1. Done: the plan.
2. Later: staff sign-in with an authenticator, staff roles, the admin portal.
3. Later: changing a live game's clips, telling makers when a game is live or sent back, taking a game down, reports, suspended accounts, a new maker's first steps, editing a game.
4. Later: AI reviews submissions (approved). The AI plays each game and accepts or sends it back. The owner sees only appeals.
5. Later: the admin screens. Keep what exists; look again after submissions, pages and reels.

## Slice 5: Money

1. Done: the money rules, the ledger, the facts, the monthly statements, and their audit fixes (branches A to D).
2. Later: makers' own sales: DLC and battle passes, members only, and revenue splits (approved; plan written).
3. Later: connect your bank, what you're owed, payouts, the staff money screens, the public split page, questions about a line (branches E to K).

## Before launch

Later. These are approved. Each is built after the slices above, in this order.

1. The wishlist and a maker's numbers. Part 1 is done.
2. Texts instead of email: sign up with a phone number, every notice by text (approved; plan written and audited). Launch waits for the phone carriers to approve Ruken.
3. The help chat by text: Claude Haiku writes, Jev checks (approved). Needs texts and the slice 4 admin first.
4. Beta builds.
5. The apps: iPhone, Android, Windows, Mac and Linux, on Ruken's own download, the App Store and Google Play. Includes age ratings (3+, 7+, 12+, 16+, 18+) and the mature content rules. The test copy (part 1) was closed on 2026-11-15 (pull request #111, last commit `17e4c3f`); it is rebuilt from its plan, `plans/2026-11-14-apps-a-test-copy.md`, when its turn comes.
6. The legal pages. Pull request #104 was closed on 2026-11-15 (last commit `bd3ac86`); its drafts are kept in the owner's Ruken page in Notion (Library, the "Legal draft" pages) and the pages are rebuilt from them when their turn comes.
7. The real domain, connected.

## Launch

The date is not set. Launch waits for the phone carriers and the app stores to say yes.

## After launch

Later.

1. Sign in with Google.
2. The Mac App Store, the Microsoft Store and the Linux stores.
3. Leaderboards.
4. A/B experiments.

## Not yet placed: needs the owner

Later. New wants with no design yet. Nothing here is built until the owner says where it goes.

1. Six must-have languages: English, Spanish, Korean, Japanese, Chinese and Portuguese.
2. Jev everywhere Ruken uses AI. The help chat and AI review already have it. Anything new with AI needs it too.

## Not yet placed: found while building

- WebKit: the new picture of a named view transition group other than root and the clip never draws (on phone the bar of places shows at about half strength for most of a move between the feed and a game page, in both directions, then pops in at the end). Confirm on a real iPhone first, since it may be an artifact of Playwright's WebKit. Findings: `progress.md`, Known issues (#399).
