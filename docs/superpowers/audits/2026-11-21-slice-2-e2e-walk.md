# Slice 2 end-to-end walk

- Commit walked: `main` at `c094e27`, built fresh in a cloud container (Node 24, Postgres 16, the four stand-ins and the game gate, started as `verify` says). Walked 2026-11-21 (about 03:20 to 03:45 UTC) by a session that did not build slice 2.
- How: a Playwright script drove the real screens with real taps, typing and file choices, at three sizes: phone (Pixel 7, 412 by 915), tablet (1024 by 768, touch) and computer (1280 by 720). The script is not kept; the browser journeys in `tests/browser/` stay the repeatable checks. Test accounts, the stand-in GitHub, the stand-in Stripe: nothing real was touched.
- Result: **126 of 126 steps pass** (42 steps at each of the 3 sizes). No red findings.
- The screenshots were looked at one by one on the phone and in contact sheets on tablet and computer. Nothing was found that breaks a criterion. They are not kept.

## Journeys and steps (each PASS at all three sizes)

| Journey | Steps |
|---|---|
| J1 A maker sends a game | home signed out; sign up; Your games (empty); question 1 name; question 2 line; question 3 files before and after Connect GitHub, pick the repo; questions 4 and 5 add the upright and wide video; question 6 age; maker agreement, I agree; Check it, then send; Send for review; Waiting for review; the game's public page is not there yet (404) |
| J2 Sent back and fixed | Owner's list command; Owner sends the line back with words; the maker sees Sent back with those words; Fix the line; saves a new line; Send it again; Waiting for review; Owner accepts |
| J3 Live, found and played | maker sees Live and Send a new version; Your games lists it as Live; the visitor's game page; a signed-out Play goes to Join; a new member pays (stand-in); the member's game page shows Play; Play loads the game in its frame on its own address; the Menu tab opens (Keep playing, Full screen, Start again, Leave game) |
| J4 Take off and put back | the take-off question (Keep it on Ruken is the first, safe button); Taken off; the public page is gone (404); Put it back on Ruken, which goes to Waiting for review |
| J5 Help and plain pages | /help/github, /help/record-screen, /legal/maker-agreement, /me, /join |

## Not walked here (stated, not hidden)

- The maker's player-count switch was only seen on screen (Off). It was not flipped, and the effect on the public page was not read. The browser journey `player-count.test.ts` covers it.
- 18+ marks, a refused file, a failed GitHub copy, a wrong-size or too-big video, throw-away, and the decision-day wait have no step here. They have browser journeys in `tests/browser/`; they were not re-walked by hand.
- The real site: Floor Fifty on ruken.io was played by the Owner (unit G); this walk is on the test stand-ins only.
- Fixed bars (the bottom button bar, Send it again) appear in the middle of full-page pictures. That is how a full-page picture draws a fixed bar, not a defect.

## Notes (not defects, kept apart)

1. Carried from the slice 2 audit, still open on `main`: a comment in `src/routes/make/[game]/+page.server.ts:149` says the throw-away "cannot be undone" (it is about the throw-away screen, so it may be right); `src/routes/g/[game]/play/beat/+server.ts` reads the whole body before its 1,000-byte check. Neither changes what a person sees.
2. The home page still says "Coming soon." with one Sign in button, and a signed-out visitor has nowhere to find games. That is the feed, slice 3, now parked.
