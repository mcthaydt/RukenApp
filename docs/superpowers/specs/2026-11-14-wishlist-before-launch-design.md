# Games before launch: the wishlist and a maker's numbers

Date: 2026-11-14. Status: written for the Owner's approval. Builds on the design (`2026-11-13-ruken-reels-linktree-design.md`) and changes it only where this file says so.

## Why

Owner, 2026-11-14: "Developers can upload now, players can't play until 30th, they all get in at once (after I approve them in admin), wishlist is for when a dev uploads a game and the launch hasn't arrived yet, it's so the feed has games to show." Owner: "Do Light Analytics for Now, Deep Later."

Makers send games in during the sixteen days before launch. Without this, the feed would be empty until 30 November and approved games would have nowhere to show. With it, every game the Owner approves is in the feed at once, and players can mark the ones they want.

## Goals

- A game the Owner accepts before launch is in the feed, on its maker's page and at `/g/<game>` straight away, with its clip, and with "Wishlist" where Play would be.
- At 11:00 CT on Monday 30 November 2026, every accepted game opens at once.
- Everyone who wishlisted a game gets one email at launch saying it is out.
- A maker sees, for each game, how many people wishlisted it, and after launch how many times it was played and for how long.

## Not in this

- A release date per game, or a wishlist after launch. After 11:00 on the 30th, a newly accepted game goes live as the design already says, and no Wishlist button is shown anywhere.
- Deep analytics (where players came from, retention, money per game). Owner: "Deep Later".
- Beta builds. Their own short design comes next.
- Any other notice than the one email: no push, no reminders, no countdown.

## What would make it a failure even if it works

- A game that does not open at 11:00, or a player who can play before it.
- A wishlist email sent twice, or sent to someone who removed the game.
- A number on the maker's screen that a person typed or that is not counted from stored rows.

## Approaches

The Owner chose A (2026-11-14: "A").

- **A. One launch switch (chosen).** One moment, 11:00 America/Chicago on 30 November 2026, read from the injected clock. Before it, accepted games show "Wishlist"; from it, they show Play. Nothing is stored or flipped at launch, so nothing can fail to flip.
- B. A release date per game. More general (wishlists after launch too), but a date to set, check and sort by that the 30th does not need.
- C. A new "waiting for launch" state that a job turns into live at 11:00. The same result as A, with launch hanging on a job running on time.

## How it works

### The switch

- One constant, the launch moment, 2026-11-30 11:00 America/Chicago, and one pure function, `isOpen(now)`, true from that minute on. Every screen and route below asks it, with the injected clock. Tested at 10:59:59 and 11:00:00.
- The state of a game does not change. "Accepted" is still the design's `live` state; before launch, `live` means "shown, with Wishlist".

### What a player sees before launch

```
┌─────────────────────┐
│                     │
│   (the game's clip) │
│                     │
│ FloorFifty          │
│ Up to 4 friends...  │
│ Opens 30 November   │
│ [ ♡ Wishlist ]      │
└─────────────────────┘
```

- In the feed, on the maker's page and at `/g/<game>`, an accepted game shows its clip, name and line as it will at launch. Where Play goes: "Opens 30 November" and a "Wishlist" button.
- Signed out, Wishlist goes to the short sign-up (email, password, date of birth), then straight back to the same game, now wishlisted. Signed in, one press adds it.
- Once added, the button reads "On your wishlist". Pressing it again removes it.
- The play route (the play pass) refuses everyone before launch, except the game's own maker and staff, so makers and the Owner can still test. That play never counts (design 6 already excludes both).
- FloorFifty is shown the same way before launch; from 11:00 it is free to play as design 5.2 says.
- Drunk grandma: one button, a word everyone knows, and the date it opens right beside it.

### At launch

- At 11:00, every Wishlist button becomes Play, by the clock.
- A job sends one email per person with at least one wishlisted game, listing all of them: subject "Your games are out on Ruken", body "[Game] is out. Play it now: [link]", one line per game. Only to people whose email is confirmed. The job is started by a Cloudflare cron at 17:00 UTC on 30 November (11:00 CST), and can be started again by hand.
- Each email sent is recorded, so a second run sends nothing new. A game removed from someone's wishlist before the job runs is not in their email.
- The email reaches strangers only once Resend has Ruken's own domain (the domains step, 18 November). Until then it reaches only the Owner's own address. That is the Owner's domain task, not this work's.

### What a maker sees

On `/make/<game>`, under the game's state line, a few plain numbers, counted from stored rows each time the page opens:

- Before launch: "Wishlisted by 12 people".
- After launch: "Played 340 times in the last 7 days" and "1,200 minutes played in the last 7 days". Plays and minutes come from `PlaySession` and `PlayBeat` (slice 2). They leave out the maker's own play and staff play; free play counts, since this is how much the game was played, not pay.
- Wishlists stay counted after launch, as "Wishlisted by 12 people before launch".
- No charts. Deep analytics come later.

### Stored

- `Wishlist`: the person, the game, when it was added. One row per person and game. Removing it deletes the row. A deleted account's rows go with it, as its other personal rows do.
- `WishlistMail`: the person and when their launch email was sent, one row per person. Only ever added.

## Needs, and when

- Slice 2's uploading and review (branches M and S) and slice 3's feed and maker page (branches C, D and H) on `main`. This is built as a small add-on right after slice 3's branch D, and on `main` by Wednesday 25 November, so the Owner can try it before launch.
- The launch email needs Resend's verified domain (the Owner's, 18 November).

## Left to the plan

- Where the switch lives (a small `launch` feature low in the layers, imported by the feed, the maker's page, play and `/make`).
- The exact words of the email body and of an empty wishlist count ("No wishlists yet").
- The cron entry and the job's address, following the daily job's pattern (`/jobs/...` with `JOBS_SECRET`).
