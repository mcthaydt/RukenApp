# Followed feed, audit 1 (lane 2 implementation review)

- Pull request: #410, branch `claude/project-thread-8e2bwm`
- Commit examined: `90c40a5378e52877fc42a8426a3f7bc9bf2b9493` (diff against `main` at `e586224`)
- Written: 2026-11-27 04:23 UTC (from `date`)
- Verdict: **FAIL, 2 red**

## What ran

- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0 (0 errors). `pnpm test`: 157 files, 2263 tests passed.
- `tests/browser/feed-top.test.ts` and `tests/browser/follow-a-maker.test.ts` on phone, tablet and computer: 48 of 48 passed. The browsers came from the Playwright 1.63.0 docker image (`mcr.microsoft.com/playwright:v1.63.0-noble`, `run-server`, `PW_TEST_CONNECT_WS_ENDPOINT`), so the phone ran in real WebKit. The new journey "Followed plays the live games…" passed on all three.
- A reviewer's probe (`2026-11-27-followed-feed-1-probe.test.ts.txt`, beside this file, not in the PR) on all three sizes: 9 of 9 ran. Its readings are quoted in the findings below.
- Not run: the whole browser suite (the PR's CI does that), `pnpm test:pg` (the PR changes no database code; `followedMakerIds` came in with #400 and has its tests there).

## Red

### R1. The game page's back arrow from Followed lands on Fresh

UNIT: `src/lib/page-moves.ts`, `src/routes/+layout.svelte` (how a move between a feed and a game's page is recognised).
VERDICT: red.
REQUIREMENT: criterion 1, "`/followed` plays those games just like the feed"; the drunk-grandma rule, "a plain way back"; the owner's feed→game glide with Back animating too (#396, #399).
REASON: every check of "is this the feed" is `=== "/"`, so a game opened from Followed is never noted as opened from a feed, and the game page's back arrow stays the plain link to `/`.
EVIDENCE: probe "the game page's back arrow from Followed": follow a maker, open `/followed`, press the game's name, press "Back to the feed". It landed on `/` on phone (WebKit), tablet and computer (`PROBE back arrow landed on /` three times). The same steps from `/` use the browser's Back and come back on the clip (`backToFeed`, `page-moves.ts:99`). The code: `page-moves.ts:48-49` (`from === "/"` / `to === "/"` in the grow check), `:88` and `:91` (`noteMove`), `+layout.svelte:141` and `:157` (`to === "/"`). The clip's grow into the game also never runs from Followed for the same reason.
EXPECTED: from a game opened on Followed, the back arrow is the browser's Back and brings the person to Followed on the clip they left, with the clip shrinking into it as it does on Fresh.
FIX: treat `/followed` as a feed wherever these checks ask for `/` (one small "is a feed" helper in `page-moves.ts` used by `grownGame`/`clipMoves`/`noteMove` and the two layout checks), plus a journey step in `tests/browser/feed-top.test.ts` that opens the game from Followed, presses the back arrow and expects `/followed`. Files: `src/lib/page-moves.ts`, `src/routes/+layout.svelte`, `tests/browser/feed-top.test.ts` (and `tests/lib/page-moves.test.ts` if the helper is tested there).

### R2. Follow and Wishlist on Followed send a plain form back to Fresh

UNIT: `src/features/feed/Feed.svelte` lines 483 and 508.
VERDICT: red.
REQUIREMENT: the `back` prop's own contract in `FollowBadge.svelte:15` and `WishlistButton.svelte:17`, "The page to come back to: the one this badge/button is on"; both are plain forms that must work without script (`WishlistButton.svelte:4`). Before launch (now, until 30 Nov) every clip on Followed shows Wishlist.
REASON: `Feed.svelte` passes `back="/"` to both, and the PR now renders `Feed.svelte` on `/followed` too.
EVIDENCE: probe "unfollow on Followed without script": a signed-in browser with script off opens `/followed` and presses the check; it landed on `/` on all three sizes (`PROBE no-script unfollow landed on /`).
EXPECTED: a press on Followed comes back to `/followed`.
FIX: in `Feed.svelte`, pass `back={tab === "followed" ? "/followed" : "/"}` to `WishlistButton` and `FollowBadge` (the follow route's `backOf` already accepts any of our own paths). Files: `src/features/feed/Feed.svelte`; a check in `tests/browser/feed-top.test.ts` (or a unit check) that the form's `back` on Followed is `/followed`.

## Checked and passing

- Right makers only: `followedPage` keeps only games whose maker is in `followedMakerIds`; unit test "holds only the followed makers' live games" covers a non-followed game; the journey shows exactly one section, the followed maker's.
- Ordering: maker followed last first (`followedMakerIds` orders `followedAt desc, id desc`), then `liveSince` newest first, then slug: matches criterion 2 and its unit test.
- Ends: `next: null`, so `Feed.svelte` never asks `/api/feed` and draws no spinner past the last clip (`{#if next !== null && ready}`); probe pressed ArrowDown twice on a one-game tab: still one section, no progress bar, still `/followed`. Keys are `followed-<publicId>`, so no clash with feed keys.
- 18+ left out (unit test, and the journey's 18+ step shows "No games here yet.").
- Signed out, following nobody, nothing live: the three states read as criteria 3 and 4; the journey covers all three wordings.
- Private ordering stays private: Followed uses its own plain, stated order and never calls the private ranker; no private value or rule enters the public repo.
- Strict cookie consent: `/followed` is in the consent `OPEN` list with the write guard on (from #402); the load only reads (`followedPage`, `launchServices().screenFor`, the same call `/` makes). No new cookie or device value; the hints note goes through the same consent-gated `deviceStore` as the feed.
- No page scroll: probe read `scrollHeight == innerHeight` and `scrollWidth == innerWidth` on `/followed` with games and empty, at 375×667, 810×1080 and 1280×720.
- 48px: every control reached on Followed measured at least 48 tall and wide (Fresh 76×48, Followed 106×48, Search 48×48, Sound 48×48, Play 227–456×48, Follow 48×48, Share 48×48, See every game ~186×48).
- Keyboard: Tab reaches the bar, Fresh, Followed, Search, Sound, the game's name, Play, the maker, Follow and Share in order on all three sizes. Gamepad: no gamepad layer exists anywhere on the site yet (queued as its own thread); Followed reuses the feed's keys, so it inherits whatever that work adds.
- CRUD: a follow is made and removed by #400's journeys; this journey reads it on Followed and removes it from the tab (criterion 5).
- Lane 2 is right: `Feed.svelte` and the feed service are shared code; no migration, money or CI change.

## Notes (not blocking)

- N1. Followed loads every followed maker's live games on one page with no cap. Fine for a few makers; a person following many busy makers gets one big first page. Only the clips near the screen fetch video, so it stays light on the phone.
- N2. `following` counts follows of makers with no live game, which is what lets the screen say "The makers you follow have nothing to play right now." Correct as built.
