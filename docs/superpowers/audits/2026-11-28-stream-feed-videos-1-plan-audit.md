# Plan audit 1: stream feed videos, and fetch the next 4 ahead

- **Examined:** spec `docs/superpowers/specs/2026-11-28-stream-feed-videos-design.md` on PR #452, head `95e2ee2`
  (branch `claude/project-thread-wiegfg`), against `main` at `19045c3`.
- **Auditor:** fresh session, Opus 5.5, medium. Read-only except this file.
- **Owner's intent checked against:** "Yes, stream" (08:03 UTC), "And preload the next 4 videos too" (08:04 UTC), and
  the card pick "Our own, on Cloudflare" (option A: hls.js, Containers on Workers Paid, convert stored clips).

## Verdict: FAIL, 5 red

The direction is right and matches the owner's pick. The cost table holds up in shape. But the part the owner asked
for by name, "preload the next 4", has no mechanism on the browsers the owner and most players use, one criterion
cannot pass by design, one cannot run in this repo, and two plumbing pieces that touch privacy and approvals are
left unnamed. All five fixes are edits to the spec only.

## What was checked, and how

- Code read at `main` `19045c3`: `src/features/play/gate.ts` (`serveMedia`, `CLIP_KEY`, `commonHeaders`),
  `src/features/games/stills.ts` (`deleteClipFile`, `stillOf`), `src/features/games/service.ts` (`saveClip`,
  `saveHeldClip`, the five `deleteClipFile` callers), `src/features/accounts/deletion.ts:156-157`,
  `src/features/feed/Feed.svelte:193-198,316-324`, `wrangler.jsonc`, `cloudflare/games/wrangler.jsonc`,
  `playwright.config.ts:177-185`, `tests/fixtures/clips/`.
- Measured in this container with the repo's Playwright 1.63 Chromium (158.0.8127.36):
  `canPlayType("application/vnd.apple.mpegurl")` = `"maybe"`, H.264+AAC in MP4 = `"probably"`, Media Source
  present. Playwright's WebKit and Firefox are not installed here, so nothing was measured on them.
- The spec's section 2 claims about today's player (`near` = 1 before, 1 after; `stillNear` = 1 before, 3 after;
  `preload="metadata"`; `removeAttribute("src")` on leaving) match the code.

## Red findings

### R1. "Preload the next 4" has no mechanism on browsers that play HLS themselves

- UNIT: spec 7.3 and 7.4; criteria 3 and 11.
- VERDICT: red.
- REQUIREMENT: the owner's "And preload the next 4 videos too", light on phones (coordinator's brief).
- REASON: 7.4 says that for the 4 ahead "only the main playlist, the lightest version's playlist, its init piece and
  its first piece are fetched". That control exists only with hls.js. 7.3 sends every browser that answers
  `canPlayType(HLS)` to the native player, and a native `<video>` with an address decides for itself what to fetch
  and which version: Ruken cannot say "lightest version, first piece only".
- EVIDENCE: `canPlayType(HLS)` is `"maybe"` on the repo's own Chromium 158 (measured above), so Chrome now takes the
  native path too, not only Safari. The owner's phone is a Galaxy (Chrome) and their iPad runs DuckDuckGo (WebKit):
  both take the native path, where 7.4 does not hold. `Feed.svelte:316-324` already records that WebKit fetches
  any video that has an address. A native player picking the top version for 4 clips ahead could fetch about 1 MB
  each (2 s at 4.5 Mbit/s), not the "light" amount the spec promises.
- EXPECTED: the spec names one way to fetch the 4 ahead that works the same on every engine, and criterion 3 runs
  on WebKit and on Chromium's native path, not only on hls.js.
- FIX: in spec 7.3 and 7.4 pick and state one mechanism, for example: the 4 ahead get no address; instead the page
  fetches the lightest version's playlist, init piece and first piece with `fetch()` so they sit in the browser's
  cache (the pieces are cached a year and immutable), and the clip gets its address only when it becomes the one
  before, on screen or the one after. Or use hls.js wherever Media Source (or `ManagedMediaSource` on iPhone) exists,
  and native only as the last fallback. Say which, and make criterion 3 run on the phone (WebKit) and computer
  (Chromium) projects. Spec file only.

### R2. Criterion 2 cannot pass with the versions in 7.1

- UNIT: spec 7.1 and criterion 2.
- VERDICT: red.
- REQUIREMENT: a check must be able to pass (CLAUDE.md, "A check is a test that fails by itself").
- REASON: criterion 2 holds the network to "slow 3G" and asks for no stall over 1 s; the lightest version in 7.1 is
  360×640 at about 0.6 Mbit/s plus sound. Chrome's Slow 3G profile is about 0.4 Mbit/s down, so even the lightest
  version is half again faster than the line and will stall.
- EVIDENCE: spec 7.1 ("360×640, ... 0.6 Mbit/s") against criterion 2 ("slow 3G profile").
- EXPECTED: the lightest version fits the throttle the journey uses, with headroom.
- FIX: either add a lighter rung (for example 240×426 at about 0.25 Mbit/s with mono sound) or state the throttle as
  a named rate the lightest version fits (for example about 1.5 Mbit/s, Chrome's "3G" or "Fast 3G" profile), and say which in 7.1 and
  criterion 2. Spec file only.

### R3. Criterion 9 names an engine the repo does not run, and an hls.js path Chromium will not take

- UNIT: criteria 9 and 11.
- VERDICT: red.
- REQUIREMENT: device matrix in CLAUDE.md Settings ("small phone, tablet, computer"; a brief may change it) and
  `playwright.config.ts:177-185`.
- REASON: criterion 9 says "Chromium and Firefox through hls.js ... all three engines Playwright runs". The repo runs
  two engines: WebKit (phone, iPhone SE) and Chromium (tablet and computer). There is no Firefox project. And with
  7.3's rule, Chromium 158 answers `"maybe"` to HLS and plays natively, so no journey in the repo would exercise
  hls.js at all; criterion 11 ("not downloaded on WebKit") would pass because it is downloaded nowhere.
- EVIDENCE: `playwright.config.ts:177-185`; the `canPlayType` measurement above.
- EXPECTED: the criterion names engines the repo runs, and at least one journey proves the hls.js path.
- FIX: in criterion 9, either add a Firefox project as an explicit brief change to the device matrix (it is the
  only common engine left that needs hls.js), or keep two engines and force the hls.js path in one Chromium journey
  (for example a test switch that skips the native check), and reword criterion 11 to "hls.js is downloaded only on
  the hls.js path, measured on both paths". Also state that WebKit's native HLS playback was checked to work in
  Playwright's Linux WebKit before the build leans on it (not measured here: not installed). Spec file only.

### R4. Pieces of a deleted clip can outlive it and stay public

- UNIT: spec 7.1, 7.2; criterion 7.
- VERDICT: red.
- REQUIREMENT: deleted makers' videos removed (coordinator's brief); the account deletion promise
  (`src/features/accounts/deletion.ts:156-157` empties `clips/<public id>/`).
- REASON: encoding runs in the background, after the save. If the clip is replaced, sent back, taken off or the
  account is deleted while a job is running or waiting to retry, the job writes `hls/` pieces after the cleanup has
  run. `serveMedia` serves any key whose shape matches, to anyone, cached a year, and does not ask whether the
  original still exists (unlike `stillOf`, which heads the clip first, `stills.ts`). Those pieces are then a public
  copy of a video the maker removed.
- EVIDENCE: `gate.ts:122-130` (shape check only); `stills.ts` `stillOf` ("The clip is looked for first, every time");
  spec 7.1 retries "3 times" with no check that the clip still exists.
- EXPECTED: no streamed piece is ever served, or left in the bucket, for a clip that no longer exists.
- FIX: in 7.1 and 7.2 state both: (a) the job checks the original still exists before it starts and again after it
  writes, and deletes its own output if the original is gone; (b) `serveMedia` serves an `hls/` key only while its
  original exists (or while the "ready" mark from R5 says so). Add to criterion 7 a pg test where the clip is
  deleted while its job is mid-way. Spec file only.

### R5. The job queue and the "ready" mark are unnamed, and one may need a service the owner has not approved

- UNIT: spec 6, 7.1, 7.2, 5 (lane), 9.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "The owner approves ... a new package, app, tool, dependency, environment or spend that the
  approved brief does not already cover"; plans name every lane 3 unit up front.
- REASON: 7.1 says "the Worker queues a job" and 7.2 says "the feed's data says per clip whether its streamed version
  is ready", but neither says with what. If it is Cloudflare Queues, that is a new Cloudflare product the card did not
  name (the card named Containers and hls.js). If "ready" and "failed" live in Postgres, that is a schema change and a
  migration (`prisma/schema/`, `prisma/migrations/`, lane 3), which section 5 and the plan in section 9 do not list.
  Where retries are kept and who wakes them is also unsaid.
- EVIDENCE: spec 7.1 "queues a job", 7.2 "the feed's data says", 8.8 "the failure is marked"; section 5 lists
  `wrangler.jsonc` and `cloudflare/` but no migration; the card text quoted in section 10.
- EXPECTED: the spec names the queue, where "ready" and "failed" are kept, what wakes a retry, and every lane 3 path
  that follows; and it uses only what the owner approved, or lists the extra piece for approval.
- FIX: in 7.1, 7.2 and section 5 pick one, for example: no Queues; the Container is called through its own Durable
  Object, a small marker file beside the pieces (`hls/<...>/ready`, `.../failed-<n>`) holds the state, and the
  existing hourly cron (`cloudflare/crons.js`) retries failures. Or, if Queues or a new column is wanted, list it in
  section 5 and as a line for the owner in section 6. Spec file only.

## Notes (not blocking)

1. **Workers Paid is already on.** The 2026-11-13 design records "It needs Cloudflare's Workers Paid plan (Owner,
   2026-11-13: $5 a month is OK)". So option A's launch cost is about $0 extra, not "about $5". Worth saying so in
   section 4 and 10.
2. **Cost at 10× is driven by requests, not encoding.** With 2 s pieces each watched minute is about 30 piece
   requests to the gate Worker plus R2 reads. A rough count at 10× gives tens of millions of each past the free 10
   million, which lands near the top of "$30 to $50". 4 s pieces for the on-screen clip (keeping a 2 s first piece)
   or the Cache API in front of R2 would halve it. Encoding stays inside or near the included Container minutes.
   The spec should say the cost is re-checked after the first month, which section 9 already does.
3. **The gate needs CORS for hls.js.** hls.js fetches playlists and pieces with `fetch`/XHR from the site to the
   media host. `commonHeaders` sends no `access-control-allow-origin` today (`gate.ts:54-60`); a native `<video>` does
   not need it, hls.js does. Also `CLIP_KEY` and the content type table need `.m3u8` and `.m4s`. These are build
   details the implementation audit will check; listing them in 7.2 saves a round.
4. **Container deploy.** A Container's image is built with Docker at `wrangler deploy`; the deploy runner must have
   it. The Container's Durable Object class has to be exported from `cloudflare/worker.js`, not the adapter's file.
5. **Held clips.** A live game's new clip waits for staff review (`saveHeldClip`). Say whether it is encoded while
   held (fine, its key is unguessable) or only once accepted, and that a refused held clip's pieces go with it.
6. **One-time job.** Section 10 says the card settles D3, but criterion 10 says "after the owner's yes". That yes is
   the card; say so, so the build does not stop to ask again. Also say how the job is started (a CLI command the
   build session runs, not the owner).
7. **Several players at once on phones.** With R1 fixed, no more than 3 clips hold a player; say that limit, since
   iPhones cap how many videos can decode at once.
8. **Overlap and gamepad rules.** The change adds no control, so the standing overlap journey and the gamepad
   journeys are not touched; criterion 12 (all suites green) covers them. Fine as written.
9. **Private/public split.** Nothing here is private: encoding, serving and the 4-ahead window are player plumbing,
   not feed order. The private Worker is not touched. Fine as written.
10. **Stills and the maker's upload** are unchanged, as the owner expects (7.5, criteria 5 and 6). Fine as written.
11. **Cloudflare's video terms.** Serving video from R2 through a Worker is allowed under the developer platform
    terms; worth one line of source in section 4, read on the day.

## What a re-audit checks

Each red's FIX is present in the spec at a new head; criteria 2, 3, 9 and 11 can be run as written in this repo's
two-engine matrix; and nothing in sections 5 and 6 needs an approval the card did not give.
