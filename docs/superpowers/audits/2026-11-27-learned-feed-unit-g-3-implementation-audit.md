# Learned feed, unit G (Like, Save, Repost): implementation audit, round 3

- PR: #404. Commit examined: `b4e09e41d65a2fffc1ef904c6e483add816ea482` (merge base with `main` 67ba234; merges cleanly with `main` at c7d3ad6).
- Lane 3 (a migration). Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-27 03:39 UTC (from `date`).
- Round 2: `2026-11-27-learned-feed-unit-g-2-implementation-audit.md` (FAIL at 11ffbe3, 1 red), on `claude/project-thread-jjwyr0`.

**Verdict: PASS, 0 red.** Round 2's R1 is fixed: no address, link or other site can make a person like, save or repost, and nothing is kept before "I agree".

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | pass |
| `pnpm typecheck` | pass, 0 errors |
| `pnpm test` (unit) | 157 files, 2254 tests, pass |
| `pnpm test:pg` (local Postgres 16) | 53 files, 797 tests, pass |
| Merged with `main` c7d3ad6 (local merge, not pushed): lint, typecheck, unit | all pass (2254 tests) |
| `feed-marks.test.ts` + audit probe, phone (WebKit) and computer, in `mcr.microsoft.com/playwright:v1.63.0-noble` | 30 of 30 pass, first try, no retries |
| CI on this head (quick, draft): verify, postgres, 6 browser pieces, gate, commit-authors, pr-rules | all pass |
| Tablet, and the full journey suite | not run here; the full run starts when the PR is marked ready |

## Round-2 finding

- **R1 (a sent link makes a press after "I agree" and sign-in): fixed.** A press with no yes now calls `askForYes` (`src/features/consent/ask.svelte.ts`), which keeps the waiting press only in the page's own script; the layout's card shows what it is for, focuses "I agree", and runs the press after the yes is kept (`+layout.svelte` `onAgreed`). "Not now" drops it. The agree action (`src/routes/cookies/+page.server.ts`) no longer reads `next` to note a press, so `rk_mark_pressed` is set in one place only: the 401 answer of `POST /api/feed/marks` (`grep rememberPress src` finds only that call). Journey `a link someone sends, through the notice and sign-in, presses nothing` passes on phone and computer.

## Tries to break it (audit probe, `2026-11-27-learned-feed-unit-g-3-probe.test.ts.txt`)

All pass on phone (WebKit) and computer:

1. **Another site, signed in with the yes.** A page on `http://elsewhere.test` sends a press every way a page can: `fetch` no-cors with a JSON Blob, `fetch` no-cors with a JSON header, `fetch` cors with a JSON header, `sendBeacon` with a JSON Blob, a `text/plain` form shaped as JSON, and a plain form. Nothing shows on the feed, Saved or Your reposts. Why it holds: the route takes only `application/json` (415 otherwise; SvelteKit refuses cross-site forms with 403), a cross-site JSON call needs a preflight Ruken never answers, and the `rk_consent` and sign-in cookies are SameSite=Lax, so a cross-site call reaches the gate without the yes and gets 403.
2. **Another site, signed out with the yes, then a sign-in link to the way back.** The same page plants no `rk_mark_pressed` (checked in the browser's cookies), and `/sign-in?next=/me/press?…kind=repost` followed by signing in lands on the feed with nothing marked.
3. **Nothing kept before "I agree".** With no yes, pressing Like, Save and Repost (each answered "Not now") sends no request to `/api/feed/marks` or `/cookies`, leaves the browser with no cookies at all and nothing in local or session storage. Then a link straight to `/me/press?…kind=repost`, "I agree" and sign-in mark nothing.
4. **Only the press that waited is made.** Like, "Not now", then Repost, "I agree", sign in: the way back names `kind=repost`, Repost is on and Like is off.

Other routes looked at by reading the code:

- **Top-level GET or POST.** `/api/feed/marks` has no GET (405). `/me/press` is a GET that changes data, but only when the note matches, and the note now comes only from the feed's own JSON call; it is HttpOnly, SameSite=Lax, 30 minutes, and goes after one use whether it matches or not (`takePress`).
- **The cookie set by other routes.** Nothing else sets `rk_mark_pressed`; `rk_wish_pressed` (wishlist) is a different name that `takePress` never reads. Games run on ruken.dev, another site, so a game cannot set or send ruken.io cookies.
- **The sign-in return path.** `next=/me/press…` only ever reaches `/me/press`, which needs the note.
- A failed "I agree" (the action errors) still runs the waiting press, but the site's gate then refuses it with 403 and the button goes back, so nothing is kept.

## Re-check of the whole PR (no new red)

- The fix touches only the consent card, the feed's press, the agree action, comments and the privacy line; the rest is as round 2 found it, and its checks still pass: the migration only adds a table, an enum, two indexes and two cascading keys; own game shows no buttons and is refused; adults-only refusal on both routes; CRUD for each mark (feed, reload, lists, Remove) in `feed-marks.test.ts`; purge removes a person's marks and the marks on their games.
- `/privacy` now says `rk_mark_pressed` is kept only for a press made while signed out, which matches the code. It stays in `RUKEN_COOKIES`, so taking back the yes deletes it.
- Copy: the card says "To like this game…" (and save, repost) above the usual words; plain, one main button, which takes the focus.
- `consentAsk` is module state, but only a browser click writes it, so server renders never share a waiting press.

## Notes (not blocking, follow-ups)

- N1: the site sends no `frame-ancestors` or `X-Frame-Options`, so another site can frame ruken.io. SameSite=Lax keeps the yes and sign-in out of a cross-site frame, so a framed feed cannot press for a signed-in person today; a `frame-ancestors 'self'` header would close it outright. Older than this PR, so not fixed here.
- N2: a press waiting for the yes survives moving to another Ruken screen (the card still says "To like this game"); "I agree" there makes the press the person did make. Fine, but worth knowing.
- N3: the probe's cross-site tries are not each checked to have reached the server; the probe checks only that no mark exists after them.
