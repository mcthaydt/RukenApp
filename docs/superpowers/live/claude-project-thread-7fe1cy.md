# Live state: claude/project-thread-7fe1cy

- Current task: make the feed infinite (owner, 2026-11-22 16:00 UTC: "the feed should be infinite").
- Last commit: 74bd185 (main), at 2026-11-22 16:02 UTC.
- Next step: tests first (service pages, journey), then the service, the /api/feed route and the feed screen.
- Open decisions: none. Chosen: when the catalogue runs out, loop it in a fresh shuffle (few games are live).

## Acceptance criteria (short path; lane 1/2 by paths, given one fresh review)

1. The feed's first page is the feed order as today (up to 50). When a person is within 3 clips of the end, the next page loads; the screen holds a spinner at the end while it loads.
2. When every live game has been shown, the next page is the same games again in a fresh shuffle, and the first of the new round is never the last of the round before (two or more games). The feed never ends while one game is live.
3. Swiping, the wheel and the keys keep going past the 50th clip and past the end of a round.
4. A page that fails to load shows "Couldn't load more games." and a "Try again" button that loads it.
5. No games live: "No games here yet." as today, and nothing loads.
6. 18+ games stay out of every page.
7. A bad address for the next page answers 400, not a crash.
8. Journeys pass on phone (WebKit), tablet and computer; lint, typecheck, unit tests green.
