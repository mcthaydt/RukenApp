# Maker credit and follow

The owner's queue for slice 3 (`/mnt/project-files/roadmap.md`, from 2026-11-22): "Maker credit on each feed card: picture with the name under it, on the right, with a TikTok-style plus to follow", and "Follow a maker (needed for the plus and for Following)". This is the brief for both. The Following feed itself (the top bar's For you | Following) is the top bar thread's work; it reads what this one keeps. A list of who a person follows on their page is slice 4 Pages ("What a page shows for a player"), not here.

## Lane

Lane 3: it adds a table, so it adds a migration (`prisma/migrations/`). It also touches lane 2 paths (`prisma/schema/`). Lane 3 takes a plan audit on this brief and an implementation audit on the build. Merge permission: the owner's standing permission of 2026-11-21 19:16 UTC (every pull request, lane 3 included, merges once its audits pass and CI is green). No new dependency, tool, service or spend. The brief and the build share one pull request: the plan audit reads the brief, the implementation audit the build.

**The migration only adds.** It creates the `MakerFollow` table, its unique key `(followerId, makerId)` (which serves every lookup by follower, newest first included, at today's sizes), an index on `makerId` (for the purge's "follows made of them"), its two foreign keys and a `CHECK` that nobody follows themselves (`MakerFollow_not_self`); it alters and drops no other table (the back-relations on `User` are Prisma-only and write no SQL to it). Its keys are `onDelete: Restrict`, like `Wishlist` and `GameReport`: a purged person's follows, both the ones they made and the ones made of them, are deleted first, in `deletion.ts`. Old code runs on the new schema, so the way back from a bad deploy is `pnpm exec wrangler rollback` with the table left in place. A unit test reads the migration's SQL and fails on anything but `CREATE TABLE "MakerFollow"`, `CREATE [UNIQUE] INDEX "MakerFollow_…"` and `ALTER TABLE "MakerFollow" ADD CONSTRAINT`.

Expected duration: about 3 hours of building, plus the audits.

## What a person sees

- **Where the credit goes.** On every clip whose maker has a page, the maker moves from the band at the bottom left to the top of the column of round buttons on the right, above Share: their round picture (their page photo, or the first letter of their name on paper, as today), 48px, with their name under it in small bold words (two lines at most, then cut with "…"). The picture and the name are one link to the maker's page, as today (no preload). A clip whose maker has no page shows no credit, as today.
- **The plus.** A round blue coloured-glass badge (`--glass-pay`, with `--glass-edge`) with a white "+" sits over the bottom edge of the picture, the TikTok way. It is its own button, at least 44 by 44px to press (the drawn badge is smaller, its pressable area is not), named "Follow <maker's name>" by its `aria-label`, with `aria-pressed="false"`.
- **Following.** One press follows the maker: the badge turns green coloured glass (`--glass-safe`) with a check, `aria-pressed="true"`, and every other clip in the feed by the same maker changes with it. Pressing the check unfollows: it goes back to the blue plus. While it sends, the badge shows the spinner alone and takes no second press (the shared busy button rule). If it fails, the badge goes back to how it was and a short "That didn't work. Try again." shows under the name for a few seconds (a `role="alert"`). Reloading the feed shows the same state (it is read from the table).
- **Your own clip.** No badge on a clip of your own game: you can't follow yourself. The credit stays.
- **Signed out.** Pressing the plus goes to the short sign-up (which links to sign-in), and coming back lands on the feed with the maker followed, the same way Wishlist works for a signed-out press (a 30-minute `rk_follow_pressed` cookie naming the maker, so only a real press follows on the way back).
- **No script.** The badge is a plain form, so it works with no script: the site follows or unfollows and sends the person back to the page it was on.
- **Sideways phone.** The column already stands under the bar on the right; the credit sits at its top, above Share, and the column still fits a 667 by 375 window with nothing cut off.

## Rules

- **The site believes nothing the form sends.** `POST /<handle>/follow` with `want=on` or `want=off` and `back`. A handle with no page is 404 and saves nothing. `back` passes through `safeNextPath`. Following your own page answers 400 and saves nothing. Anything but `want=off` is read as `on`. A request whose `Accept` asks for JSON (the badge's script) gets `{ "following": true | false }`, or `{ "go": "<address>" }` when the person must sign up first; a plain form gets a 303 to `back`, or, signed out, a 303 to `/sign-up?next=…`, as Wishlist does.
- **The way back is checked too.** `GET /<handle>/follow?back=…` (the return from sign-up or sign-in) follows only when the caller is signed in, the `rk_follow_pressed` cookie names this handle, the handle has a page, and the page is not the caller's own. The cookie is deleted on the way back whatever happens, so a second visit within the 30 minutes (after unfollowing, say) follows nobody. A handle with no page answers 404. Your own page, or no cookie, saves nothing and goes on to `back`. The table's `CHECK` refuses a self-follow whatever the code does.
- **One follow per person and maker.** `@@unique([followerId, makerId])`. Following twice is one row (`createMany` with `skipDuplicates`), and two presses at once make one row and no error. Unfollowing someone you don't follow is not an error.
- **Who is asking for follows is not who the ranker is told.** The feed service takes the signed-in person's id on its own, `page(after, asking, viewerId: string | null)`, read from the caller by `feedServices().viewerOf(caller)`; `following` and `mine` come from `viewerId` and `game.makerUserId`. `Asking` and the ranker's `Viewer` stay exactly as today, so the ranker is still told the crowd without the cookie yes. The `followedAmong` neighbour is optional (left out, nobody follows anyone), so test worlds that build the service need no change.
- **Nobody sees another person's follows.** A feed page only carries whether the person asking follows each clip's maker. Nothing else reads the table in this change.
- **What is kept.** Who follows whom and when (`followedAt`, from the injected clock). Unfollowing deletes the row. Deleting either account deletes the rows it is in (`deletion.ts`).
- **No rate limit on purpose.** A follow is a person's own choice about their own feed, nobody is told when it happens, and a follow sends no mail or text, so pressing it many times costs nothing but database rows the unique key already caps at one per pair. If follower counts are ever shown or paid on, that brief adds a limit.
- **What the Following feed reads.** `pagesServices().follows.followedMakerIds(followerId): Promise<string[]>` answers, newest follow first, for the top bar thread. Nothing in this change calls it except its own test.
- **Pages that keep up.** `/privacy` (`src/routes/privacy/+page.svelte`) says what a follow keeps and when it goes, and lists `rk_follow_pressed` (with its "Last updated" date; `tests/routes/privacy/cookies.test.ts` checks the name). The cookie also goes on `RUKEN_COOKIES` in `src/features/consent/cookies.ts`, so taking back consent clears it (`tests/features/consent/cookies.test.ts` gains `rk_follow_pressed` in its hand-written list, so leaving it off fails). `/about` (`sections.ts`) gets one line for players: follow a maker with the plus on their game.

## Acceptance criteria

1. A signed-in player presses the plus on a clip: the badge turns to the check with `aria-pressed="true"`, and the database holds one `MakerFollow` row for that person and maker (create). (journey)
2. Reloading the feed shows the check on that maker's clips, and the plus on another maker's (read). (journey)
3. Pressing the check unfollows: the badge is the plus again, the row is gone, and a reload shows the plus (delete). A follow has nothing to change, so there is no update: following again after unfollowing makes a fresh row. (journey)
4. Two clips by the same maker change together after one press. (journey, or a unit test of the state if the seed has no maker with two live games)
5. On the player's own game's clip there is no badge; a POST to follow their own page answers 400 and saves nothing; a GET of the way back with the cookie naming their own page saves nothing; the table refuses a self-follow. (journey and database or route tests)
6. Signed out, pressing the plus leads to sign-up, and after signing up the person is back on the feed with that maker followed. A GET of the way back without the cookie follows nobody. (journey)
7. With script off, pressing the plus follows and returns to the feed showing the check. (journey)
8. The badge works with the keyboard alone: Tab reaches the maker link, then the badge, then Share, each with a visible focus ring; Enter and Space follow and unfollow. (journey)
9. The badge's pressable area is at least 44 by 44px, the credit sits above Share on the right on a 375 by 667 phone, a tablet, a computer and a 667 by 375 sideways phone, and nothing in the column is cut off or overlaps the bar. (journey) The Like, Save and Repost thread adds buttons to the same column: whichever of the two merges second merges `main` and runs this criterion again with every button in the column.
10. The badge reads the glass tokens (`--glass-pay`, `--glass-safe`, `--glass-edge`); `tests/lib/glass.test.ts` passes with it. (unit)
11. Two follows at once for one person and maker make one row; unfollowing someone not followed is not an error; following a handle with no page answers 404. (database tests)
12. Deleting an account deletes the follows it made and the follows made of it. (database test)
13. A feed page for one person never says another person follows a maker: person B's feed shows the plus on a maker person A follows; and a signed-in person's page sets `following` and `mine` while the ranker is still handed `{ kind: "crowd" }`. (unit tests of the feed service, and a journey)
14. `followedMakerIds` answers the followed makers' user ids, newest first, and nothing for a person who follows nobody. (database test)
15. The migration's SQL holds only `CREATE TABLE`, `CREATE [UNIQUE] INDEX` and `ALTER TABLE "MakerFollow" ADD CONSTRAINT` for `MakerFollow`. (unit test)
16. When a follow fails, the badge goes back to how it was and says "That didn't work. Try again." (journey, with the answer held by the test)
17. Lint, typecheck, unit, database and browser suites pass in CI; the layer test passes.

## Plan

| # | Unit | Files it owns | Check |
|---|---|---|---|
| 1 | Table | `prisma/schema/pages.prisma` (`MakerFollow`), `prisma/migrations/<stamp>_maker_follows/`, `User` back-relations in `accounts.prisma` | `prisma migrate diff` empty; the additive-only unit test (criterion 15) |
| 2 | Service | `src/features/pages/follows.ts`, wired in `src/features/pages/services.ts` and exported from `pages.ts`; `src/features/accounts/deletion.ts` line | `tests/features/pages/follows.pg.test.ts`, `tests/features/accounts/purge.pg.test.ts`, criteria 5, 11, 12, 14 |
| 3 | Address | `src/routes/[handle=handle]/follow/+server.ts` (POST, and GET for the way back from sign-up); `rk_follow_pressed` on `RUKEN_COOKIES` in `src/features/consent/cookies.ts` and in `tests/features/consent/cookies.test.ts` | route, consent cookie and journey tests |
| 4 | Feed carries it | `FeedClip.maker` gains `following` and `mine`, and `FeedServiceDeps` a `followedAmong` neighbour, in `src/features/feed/service.ts`; wired in `src/features/feed/services.ts`, used by `src/routes/+page.server.ts` and `src/routes/api/feed/+server.ts`; the existing clip expectations in `tests/features/feed/service.test.ts` and `ranker.test.ts` gain the two fields | criterion 13 |
| 5 | Credit and badge | `src/features/feed/Feed.svelte` (the credit moves to `.side`; a `FollowBadge.svelte` in `feed`) | journeys, criteria 1 to 10, 16 |
| 6 | Words | `src/routes/privacy/+page.svelte`, `src/routes/about/sections.ts` | their existing tests |

Test files named in a unit's Check column belong to that unit, as does `tests/features/pages/migration.test.ts` to unit 1. Units run in this order on one branch; each waits on the one before it. The live-state file is deleted in the last commit before each hand-off to an audit.

Left for later, on purpose: a Follow button on the maker's own page and a count of followers (slice 4 Pages); the list of who you follow (slice 4, "What a page shows for a player"); the Following feed (the top bar thread); telling a maker they have a new follower (not asked for).
