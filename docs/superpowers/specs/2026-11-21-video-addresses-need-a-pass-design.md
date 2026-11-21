# A video's address needs a pass

- Status: plan audit 1 at a83679f PASS (five notes, taken in below and in the build); building. Lane 3 (the coordinator's call, 2026-11-21 21:08 UTC: it changes the game gate, which decides who may load a file).
- Brief: review note N2 of the 18+ gate's audit (`docs/superpowers/audits/2026-11-21-adults-only-gate-1-implementation-audit.md`), sent to a fix thread under the owner's words of 2026-11-21 19:16 UTC ("these are things that I should not need to intervene for"). The 18+ gate (#277) hides an 18+ game's pages from anyone not known to be 18 or over, but the game's video file still plays for anyone who has its address.
- Where: one implementation pull request from `claude/project-thread-8400fx`, opened after this spec merges.
- Open product decisions: none.

## The gap

A game's videos are served by the game gate (`src/features/play/gate.ts`) from `/media/<key>` or `media.<games domain>/<key>`, to anyone, with `cache-control: public, max-age=31536000, immutable`. The gate has no database and reads no cookie, on purpose, so it cannot ask who is watching or what the game is rated. An address copied from an 18+ game's page plays for a child, signed out, for as long as the file exists.

## What changes

**Every video address carries a pass, and the gate refuses a video without a good one.** Photos are unchanged.

- The site signs the pass when it builds a video's address. It already decides who gets an address at all: an 18+ game's video address is built only after `adultsOnlyRefusal` says yes (the game's page, the price card's backdrop, "More from"), for the game's own maker, and for staff's review. Everyone else never receives one, so never receives a pass.
- The pass is for one video (its key) and runs out. Time is cut into 12-hour windows (UTC); a pass signed now runs out at the end of the next window, so it lasts between 12 and 24 hours. Everyone who is handed the same video in the same window gets the same address, so a browser that already has the video does not fetch it again.
- The gate checks the pass on every video request, with the secret it already has for play passes. No pass, a changed pass, a pass for another video or one that has run out: 403, `cache-control: no-store`.
- A video is answered with `cache-control: private, max-age=<seconds the pass has left>`, as a game's files are, so a browser never keeps it past its address.

### Why every video, not only 18+ ones

The gate cannot tell an 18+ video from its key, and a game's rating changes after its videos are uploaded (a live game's new rating waits for staff). Telling the gate would take either a mark in the bucket kept in step with the database from seven places that write a rating (answer, accept, send back, keep the old one, take off, throw away, account deletion), where one missed place leaves a video open, plus a backfill of real data; or moving 30 MB files to new keys on every rating change. A pass on every video needs neither: nothing is stored, nothing is kept in step, and no real data is written. The site signs one more HMAC per address.

What it costs: a browser keeps a video for up to a day, not a year. A returning visitor loads a video again the next day. Cloudflare's own cache is not involved either way (below).

### Addresses already handed out (the coordinator's question)

They stop working the moment the new gate is deployed, for every video, 18+ or not, because none of them carries a pass. **No video is moved to a new key.**

- Cloudflare's edge holds no copies. A Worker's own answer is stored by Cloudflare's cache only when the Worker's code puts it there (the Cache API, or a fetch through the cache), and the gate does neither: it reads the bucket through its binding and answers. So there is nothing to purge. Evidence: `gate.ts` and `cloudflare/games/worker.ts` contain no `caches` and no `fetch`; criterion 9 keeps it so.
- A browser that already downloaded a video under the old headers may keep its copy for up to a year and replay it from that browser's own disk without asking the gate. Moving the file to a new key would not change that: the copy is already on that machine, as a download would be. Nothing Ruken can do pulls it back, and that person has already seen it.
- So the old addresses are closed for everyone who does not already hold the bytes, which is all that can be closed.

### What a pass does not do

An adult who is handed a pass can pass the address on, and it plays for anyone until it runs out (at most 24 hours). They could as easily save the file. The play pass has the same limit and the same day.

When a live game's rating rises to 18+, an address handed out under the old rating keeps playing until its pass runs out, at most 24 hours: the pass names the video and a time, not a rating. (Plan audit 1, N2.)

## How

1. **`src/lib/files/media-pass.ts`** (new; plain helper, imports only `node:crypto`, so the gate can bundle it and the games feature, which sits below play, can use it).
   - `MEDIA_PASS_WINDOW_MS = 12 * 60 * 60 * 1000`.
   - `mediaPassExpiry(nowMs)`: the end of the next window, `(Math.floor(nowMs / W) + 2) * W`.
   - `makeMediaPass(key, expiresAtMs, secret)`: `v1.<expiry in whole seconds>.<mac>`, the mac HMAC-SHA256 over `ruken-media-pass-v1:<key>\n<expiry>` in base64url. Its own prefix, so a play pass's mac is never a media pass's and the other way round. Throws on an empty secret, as `makePass` does.
   - `checkMediaPass(value, key, secret, nowMs)`: the expiry in ms, or null. Constant-time compare. Never throws on what anyone typed.
2. **`src/features/play/gate.ts`**, `serveMedia`: a photo key is served as today. A clip key is served only when `checkMediaPass(url.searchParams.get("pass"), key, …)` is not null; otherwise `plain(403, …)` with the words "This video's link has run out. Go back and open the page again." The headers become `private, max-age=<seconds left>`. `serveMedia` is handed the `URL` (both callers have it). The comment at the top of the file and on `serveMedia` is brought up to date.
3. **`src/features/games/services.ts`**, `media(key)`: for a clip key (`isClipKey`), `<address>/<key>?pass=<pass>`, signed with `PLAY_PASS_SECRET` (read with `requireEnv`, as the play feature reads it) and the injected clock. Any other key: as today. No call site changes: every one already goes through `media`.
4. **Comments** that say a clip is served "to anyone" (`clips.ts`, `gate.ts`, `cloudflare/games/worker.ts`, the `GameHeldClip` doc comment in `prisma/schema/games.prisma` if it says so) are corrected. A comment-only edit to the schema file makes no migration.
5. **The `verify` skill and `this-repo`**: updated only if a step in them fetches a video address by hand.

No new dependency, secret, setting, table or migration. `cloudflare/games/worker.ts` changes only in a comment: the gate already receives the secret.

## Deploying it (the owner's step, after the merge)

A merge to `main` does not deploy. The site must go first, then the gate:

```
pnpm run deploy && pnpm run deploy:games
```

(with the `--route` the owner always gives the gate). Site first is safe: the old gate ignores the pass. Gate first would stop every video on the site until the site follows. Until the gate is deployed, the gap is still open on the live site; the report says so.

Changing `PLAY_PASS_SECRET` now ends every video address as well as every play pass. Between the two `wrangler secret put` calls (site, then gate) videos are refused; the next page load after both heals them. (Plan audit 1, N4.)

## Acceptance criteria

1. Unit (`tests/lib/files/media-pass.test.ts`): a pass made for a key checks for that key before its expiry; it is null at and after the expiry, for another key, with another secret, with any one character of the expiry or the mac changed, for a play pass, for `""`, and for 1,000 strings from a fixed seed (it never throws). Two times in one window give the same pass; times in two windows do not. A pass signed at any moment lasts at least 12 hours and at most 24.
2. Unit (`tests/features/play/gate.test.ts`), on both forms of address (`/media/<key>` on the path host, and the `media.` name): a video with a good pass is 200 with `cache-control: private, max-age=<seconds left>` and a range request is 206; with no pass, a changed pass, a run-out pass and a pass for another video it is 403, `no-store`, with the words above, and the bucket is not read. A photo with no pass is still 200, `public, max-age=31536000, immutable`. The existing media tests that fetched a video with no pass change to carry one: each is named in the pull request body.
3. Unit (`tests/features/games/services.test.ts`): `media` of a clip key ends `?pass=` with a pass the gate's check accepts at the injected time; `media` of a photo key has no query; a missing `PLAY_PASS_SECRET` throws "Missing setting PLAY_PASS_SECRET". The clip case uses a key of the real shape and the other case a photo key (plan audit 1, N5).
4. Journey (`tests/browser/adults-only.test.ts`, against the real gate the journeys already start): someone known to be 18 or over opens the 18+ game's page; the video element's address is fetched and answers 200 or 206 with a video type; the same address with the pass taken off answers 403; with one character of the pass changed, 403. The first of these fails on the code before the change (it answers 200 with no pass).
5. Journey, same file: for someone signed out and someone under 18, the refusal page's HTML contains no `/clips/` address and no `pass=` (the existing "nothing names the game" checks stay).
6. Journey (`tests/browser/game-gate.test.ts` or `game-page.test.ts`): a game for everyone's video plays on its page for someone signed out (the video element reaches `readyState >= 2`), and its bare address answers 403.
7. CRUD stays whole: the journeys that create, read, replace and remove a video (`make-game-crud`, `make-live-changes`, `make-questions`, `maker-page`, `join`, `review-job`) pass unchanged in what they assert, with the maker's own screens and staff's review link playing the video through a pass. Any assertion that compared a video address to an exact string is named in the pull request body with its change, and compares the address without its `?pass=`, so a window that turns over between two reads cannot fail it (plan audit 1, N3: `make-questions.test.ts:598,603`).
8. The page that plays a video does so with the keyboard alone as before; no screen's words or layout change (no `look:` picture differs except through the address). The 403 line is plain words with one thing to do.
9. A unit test reads `src/features/play/gate.ts` and `cloudflare/games/worker.ts` and fails if either contains `caches.` or a call to `fetch(`, so the gate's answers stay out of Cloudflare's cache. The Worker's own handler, `fetch(request: Request, env: Env)`, is not an outgoing call and is allowed; the test says so. (Plan audit 1, N1.)
10. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:pg`, `pnpm test:browser` and `pnpm build` pass; `tests/architecture.test.ts` passes (the helper is in `src/lib/`, which imports no feature).
11. Run like a person (`verify`): an adult opens an 18+ game and sees its video play; the copied video address, opened in a private window with the pass removed, shows the 403 line.

## Plan

One unit, one pull request, lane 3. Expected: 2 hours of building, then the implementation audit. Budget: none (no spend, no new access).

| Unit | Waits on | Owns | Output | Check |
|---|---|---|---|---|
| Video pass | this spec on `main` | `src/lib/files/media-pass.ts`, `src/features/play/gate.ts`, `src/features/games/services.ts`, comments in `src/features/games/clips.ts`, `cloudflare/games/worker.ts`, `prisma/schema/games.prisma`; `tests/lib/files/media-pass.test.ts`, `tests/features/play/gate.test.ts`, `tests/features/games/services.test.ts`, `tests/browser/adults-only.test.ts`, `tests/browser/game-gate.test.ts` | the gate refuses a video with no good pass | criteria 1 to 11 |

Steps, in order (test first, from the outside in):

- [ ] 1. Journey for criterion 4 written and seen to fail on the bare-address step.
- [ ] 2. `media-pass.ts` from its unit tests (criterion 1).
- [ ] 3. Gate: tests for criterion 2 and 9, then `serveMedia`.
- [ ] 4. `media()` signs clip keys: tests for criterion 3, then the code.
- [ ] 5. Journeys for criteria 5 and 6; run the journeys criterion 7 names and fix what an exact address broke.
- [ ] 6. Comments corrected; `verify` run (criterion 11); cheap checks and the reached journeys pass locally.
- [ ] 7. Pull request opened as a draft with the lane, these criteria, every changed existing test named, the deploy order and the three commits; implementation audit asked for.

## Out of scope

- Photos: a maker's photo is for everyone.
- A game's own files: already behind the play pass.
- Sending someone back to the game after they sign in from the refusal page (follow-up 1 in the handoff; its own thread).
- Showing 18+ games in the feed or on a maker's page to adults: both leave 18+ games out today, and that is a product choice for its own brief.
- Moving or re-encoding any stored video.
