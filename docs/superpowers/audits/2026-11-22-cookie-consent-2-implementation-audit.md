# Cookie consent: implementation audit, round 2

- Reviewed: PR #344 head `9dc2b5025d61fd938fc81cbd50059d4b209d1f40` (9dc2b50), which has main `cc4e4db` merged in (Wishlist #338, test-play #340, flaky-test fix #351, progress #352).
- Reviewer: fresh session, Opus 5.5, medium. Lane 3 (touches `src/features/membership/`, `src/lib/server/db.ts`, `src/hooks.server.ts`, `wrangler.jsonc`).
- Verdict: **PASS**. 0 red, 4 notes. CI on this head is red on one phone journey that this change does not touch (note 1); merge still needs green CI.

## What ran

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | 0 errors, 0 warnings, 2156 files |
| `pnpm test` | 141 files, 2074 tests passed |
| `pnpm test:pg` (local Postgres 16) | 51 files, 770 tests passed |
| `test:browser` cookie-consent + cli-games, computer | 13 passed |
| `test:browser` cli-games:71, wishlist, test-play, feed; tablet + computer | 30 passed |
| Phone (WebKit) journeys | not run here: no WebKit in this container. CI ran them. |
| CI on 9dc2b50 | browser shard 6 failed (phone, `cli-games.test.ts:159`), so the gate failed and shards 1 to 5 were cancelled; postgres and verify passed. |

## Round 1 reds (5c065fd), each checked

1. `/privacy` and `/terms` open: both are in `OPEN` (`src/features/consent/routes.ts`); `tests/features/consent/route-ids.ts` now finds routes that have only `+page.svelte`. Closed.
2. Privacy page: says logs are off, nothing written before "I agree", lists `rk_consent` and `rk_wish_pressed`; both `wrangler.jsonc` files have observability off. Closed.
3. One route per gated pattern: `gate.test.ts:100` (each pattern has a real route) and `:108` (each gated route shut). Closed.
4. `/api/v1` cases: `cookie-consent.test.ts:260` (good key writes with no cookie, made-up key writes nothing). Passed here. Closed.
5. PR body footer: body ends `Requested by **McThayDT**`, has `## Lane`, no "Generated" line. Closed.
6. Not now before hydration: every Not now press in the journey follows `pageHasSettled`. Passed here. Closed.

## Strict consent: every write on the merged code

Cookies (`grep cookies.set|setCookie|document.cookie` over `src/`):
- `membership/services.ts:158` `rk_arrival`: returns early without `hasConsent`. The agree action sets it after `rk_consent` (`gate.ts` keeps an answer that gives the yes).
- `accounts/auth.ts:311` `rk_welcome_back`, `accounts/forms.ts:285` `ruken_sign_up`, `:384` sign-out, better-auth session cookies: only on `/sign-in`, `/sign-up`, `/sign-out`, `/api/auth`, all gated. `accounts/handle.ts` returns signed-out without a yes, so no session is read, renewed or re-sent.
- `make/page/page-words.server.ts:10`, `make/+page.server.ts:42`: under `/make`, gated.
- `g/[game]/wishlist/+server.ts:42` `rk_wish_pressed` (new from #338): route gated; a script call gets `{go: "/cookies?for=save&next=…"}` (`gate.ts`, `gate.test.ts:125`), a plain form a 303. In `RUKEN_COOKIES`, so Take it back deletes it (journey `:303` checks).
- `launch/now.ts` `rk_test_launch`: read only, set by the journeys, never by the app.
- Safety net: `stripCookies` drops any other Set-Cookie on an answer to a browser with no yes.

Browser storage:
- `localStorage`/`sessionStorage` appear in `src/` only in `consent/device-store.ts`; `device.test.ts:52` fails otherwise.
- `Feed.svelte` (hints) and `play/PlayScreen.svelte` (tab place, moved into the play feature by #340) go through `deviceStore`: memory only until a yes.
- SvelteKit's own `sessionStorage` keys (snapshots, scroll): `app.html` stand-in before any module, swapped back only when the server marks the page "yes". No IndexedDB, Cache API or service worker in `src/` or `static/`.

Database:
- `db.ts` refuses every write and `$executeRaw*` while `writesAllowed` is false; the gate sets it from consent, open to `MACHINE` routes only. Open routes that used to write now skip: `countView` and `tapLink` (`counted` flag) only with a yes. `/api/feed` and `/` only read.

## Merge kept the new work

- Wishlist: `WishlistButton.svelte` handles `{go}` with `goto`; wishlist journeys passed (tablet, computer).
- Test-play: `/make/[game]/play` is under gated `/make`; test-play journeys passed.
- Endless feed: `feed.test.ts` passed; `/api/feed` is open and read only.

## Owner rules

- No "Loading..." text in the new screens (grep). "I agree" shows the busy state with `aria-busy`.
- Frosted glass: `.consent` uses `--glass-bg` and `--glass-filter`.
- Underlined links: see note 2.

## Notes (not blocking)

1. **CI red on a race this change does not touch.** UNIT: `tests/browser/cli-games.test.ts:159`. REASON: it expects the new game once on `/`, but `Feed.svelte:128` asks for the next page as soon as the feed is warm when it holds fewer than `ASK_AHEAD` clips, and later pages go round again, so with few live games the slug soon shows several times. EVIDENCE: CI shard 6 on 9dc2b50, phone: "Expected: 1, Received: 6"; the same test passed on main `cc4e4db` (phone, shard order 11) and here on tablet and computer. This PR changes neither file. EXPECTED: the check reads the first clip's slug, or waits for the feed's first page only. FIX: separate follow-up in `tests/browser/cli-games.test.ts`. For this PR: re-run CI to green before merge, and record the flake under "Flaky tests" in `progress.md`.
2. **New underlined text link.** UNIT: `src/features/consent/Notice.svelte:87` and `:104`, "What we keep" (global `a { text-decoration: underline }`); the privacy page also links "cookies page". REQUIREMENT: owner rule 2026-11-22 18:04 UTC, no underlined text links. The owner put the app-wide fix in the "Replace underlined text buttons app-wide" work (#345), as with #333's links. FIX: add these links to #345's list when it resumes.
3. **Wishlist takes two presses before a yes.** Pressing Wishlist opens the notice; "I agree" lands back on the game page (`next` is the wishlist GET, which has no `rk_wish_pressed` yet and redirects back), and the person presses Wishlist again. Works; a smoother way would carry the press through the yes. Owner's call, not this PR.
4. Known flake "consent Not-now race" did not show in these runs.
