# Friend bubbles: implementation audit 1

Pull request #435, head **2df442c** (branch claude/project-thread-cu5tvs). Fresh lane 2 review, Opus 5.5, medium.
Verdict: **FAIL, 1 red.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

- At 3624269 (the non-layout code is the same at 2df442c: `git diff 3624269 2df442c` touches only Feed.svelte CSS, the journey and the live file): `pnpm lint` 0, `pnpm typecheck` 0, `pnpm test` 2414/2414, `pnpm test:pg` 831/831 on local Postgres 16.
- At 2df442c: `tests/browser/friend-likes.test.ts` on tablet and computer, 4/4 pass (local `wrangler dev --local`, globalSetup skipped). Phone (WebKit) was not run here; it is in CI.
- An uncommitted probe (a copy of the journey that also shoots and measures the band) at 320×568, 375×667 and 667×375 (Home Screen mode), after launch (Play) and before launch (`rk_test_launch=before`, Wishlist), with and without friends. Screens: https://claude.ai/artifact/3hdjyG4GLzteX23EyfMin1
- CI at 2df442c when written: verify, postgres, commit-authors and pr-rules pass; browser shards 1 to 6 still running.

## Checked and fine

- **Injection.** `friendsWhoLiked` (src/features/feed/marks.ts) is a tagged-template `$queryRaw`: `${viewerId}` and `${[...gameIds]}` are bound parameters (text[] for `ANY`). No string is built into the SQL.
- **Only mutual follows.** It joins MakerFollow viewer→liker and liker→viewer, plus MakerPage. A self-follow is refused in src/features/pages/follows.ts ("own"), so the viewer never appears. Postgres tests cover both one-way follows, the viewer, no page, saves and reposts, and a friendship ending from either side. Same friend rule as `friendPagesOf` in src/features/sends/who.ts.
- **Speed.** EXPLAIN ANALYZE on copies of the three tables with their real indexes: 200,000 likes (one game 50,000), 1,100 follows by the viewer, 100 mutual, 10 games asked. The planner starts from the viewer's followers (MakerFollow_makerId_idx), then unique-index lookups: 1.65 ms. One read per feed page (unit test "asks once").
- **Privacy wording** (/privacy): plain and true: everyone sees the count; friends (people you follow who follow you back) also see your name and picture; nobody else sees who. /about line is plain.
- **Gamepad and keyboard.** The cluster is a `div role="img"` with no link, button or tabindex, so src/lib/pad-focus.ts's focusable list skips it; `[data-pad-first] .button` still lands the first press on Play.
- **CRUD.** The journey creates a friend's like, reads the faces, updates (a like taken back brings the next friend in, +N goes), and deletes (friendships ending from each side, last like taken back, cluster gone). Signed out sees none.
- **After launch (Play), upright.** Band height is unchanged with friends: 197 px at 320×568, 141 px at 375×667. Play is 88×48 px at 320. Faces fit beside it.
- **Sideways (Home Screen).** Faces take a row above the name and Play; the band grows 72 → 104 px, as intended.
- Live-state file: deleted at 2df442c.

## Findings

1. UNIT: src/features/feed/Feed.svelte (`.band:has(.friends)` grid) and tests/browser/friend-likes.test.ts. VERDICT: red. REQUIREMENT: the owner on 2026-11-27 (friends' faces on a 320×568 phone "isn't gonna work"), which 2df442c answers with "the card grows no taller"; standing rule that copy and buttons are plain and fit (drunk-grandma test). REASON: before launch, which is what every visitor sees until 30 November, the band's last child is the Wishlist form (`opens` line + button); the new grid squeezes the whole form into the column beside the faces. EVIDENCE: probe with `rk_test_launch=before` at 2df442c: at 320×568 the Wishlist button is 88 px wide and its word runs past the button's right edge, "Opens 30 November" breaks onto two lines, and the band grows 233 → 261 px compared with the same clip with no friends (375×667: 177 → 205 px). Screens page, first section. The journey only runs after launch, so it never sees this. EXPECTED: before launch too, the band with friends is no taller than without, and the Wishlist button's text fits inside it (scrollWidth ≤ clientWidth). FIX: Feed.svelte's `.band:has(.friends)` rules only (for example, place the faces beside the "Opens …" line and keep the Wishlist button full width on its own row when the last child is `.wish`), plus a case in tests/browser/friend-likes.test.ts that sets the `rk_test_launch=before` cookie and checks at 320×568 both the band height against a no-friends band and the button's text fit. Only those two files.

## Notes (not blocking, not fixed here)

- The journey's 667×375 check runs without `asInstalled`, so the screen under it is covered by "Turn your phone upright"; the boxes still measure right. Using `asInstalled` would make its owner shot show the real layout.
- The journey covers Fresh only; Followed's faces are covered by the unit test in service.test.ts.
- An account waiting to be deleted (`pending_deletion`) still shows as a friend's face, the same as in the share sheet's friend list today (who.ts). Pre-existing rule question, not from this change.
- At 667×375 in the tablet profile the side buttons (Like, Save, Repost) sit under the sideways bar, with or without friends. Pre-existing, not from this change.
- A game liked by very many friends returns one row per friend just to count the +N. Fine at 1.65 ms above; a `COUNT` would only matter far later.
