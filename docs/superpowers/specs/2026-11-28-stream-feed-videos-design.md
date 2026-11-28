# Stream feed videos, and fetch the next 4 ahead

## 1. The owner's words

- 2026-11-28 08:02 UTC, the coordinator, answering "are videos streamed?": no. Each clip is the maker's whole file (up
  to 30 MB), only the current clip and its neighbours load, and everyone gets the same quality, so slow phones can
  pause to buffer.
- 2026-11-28 08:03 UTC, the owner: "Yes, stream".
- 2026-11-28 08:04 UTC, the owner: "And preload the next 4 videos too".

Building waits for the owner's pick of an option and its monthly cost (section 6), and goes after the playtesting work
(the owner's 07:48 UTC order).

## 2. How videos work today (read at `6192c84`, main)

- **Upload.** A maker records 10 to 30 seconds of play (`VideoQuestion.svelte`), twice: upright and wide. The file
  (MP4, WebM or MOV, up to 30 MB, `src/lib/video-choice.ts`) goes through the Worker, is checked by its first bytes
  (`clipProblem`, `src/features/games/clips.ts`) and stored as is in R2 (`GAME_FILES`, bucket `ruken-games`) under
  `clips/<public id>/<shape>-<16 hex>.<ext>`. A live game's new clip is held for staff review (`saveHeldClip`).
- **Serving.** The gate Worker (`src/features/play/gate.ts`, `serveMedia`) serves the key to anyone, cached a year.
- **Stills.** `src/features/games/stills.ts` makes a JPEG of a frame with Cloudflare's media tool (`MEDIA` binding,
  free while in beta) the first time it is asked, and keeps it beside the clip.
- **Feed player.** `src/features/feed/Feed.svelte`: one plain `<video>` per clip. Only the clip on screen, the one
  before and the one after get an address (`near`, `preload="metadata"`); stills are fetched for 3 ahead
  (`stillNear`). A clip that leaves that window is emptied (`removeAttribute("src")` and `load()`), because WebKit
  fetches any video with an address. Clips also play on the game page, a maker's page, `/about`, `/join` and the
  maker's own steps.
- **What that means.** The whole file is the only quality. A phone on a slow network that swipes to a 25 MB clip waits
  for it; a QuickTime file whose index sits at its end (common for a Mac screen recording) cannot start until most of
  it has arrived. Fetching 4 whole clips ahead, as asked, could pull 120 MB on a phone.

## 3. Outcome

Every feed clip streams: the player starts on a small first piece and picks a sharper or lighter version as the
network allows (HLS, adaptive bitrate). The clip on screen, the one before and **the next 4** are ready to start the
moment a person swipes; for the 4 ahead only their first piece is fetched, so it stays light. The first-frame still
shows until the clip plays, as today. A maker's upload steps look and work as they do now. Clips already stored are
streamed too.

## 4. The options compared

Assumptions, stated because nothing is measured yet: clips are 30 s at most (the maker's step says 10 to 30), two per
game; a person watches a clip about 10 s before swiping, which bills about 15 s once rounding to whole pieces and the
piece fetched ahead are counted; a visit ends with 4 clips fetched ahead and never reached (4 pieces of 4 s = 16 s
each visit). **Launch scale**: 100 live games, 2,000 players a month, 300 clips each, 20 visits each. **10×**: 1,000
games, 20,000 players. These are guesses to show the shape; the real numbers come from the first month.

That gives about 150,000 minutes watched plus about 10,700 minutes fetched ahead and not reached (the cost of "next 4")
at launch: **about 160,000 delivered minutes a month**, and about 1.6 million at 10×. Looping a clip replays it from
the browser's copy, which no option bills.

| | A. Self-made HLS on R2 | B. Cloudflare Stream | C. Mux |
| --- | --- | --- | --- |
| Who holds the videos | R2, as today | Cloudflare Stream | Mux (a new company) |
| Making the versions | ffmpeg in a Cloudflare Container, on upload | Stream, free | Mux, free ("basic" quality) |
| Price basis | R2 storage $0.015/GB-month, reads $0.36/million after 10 million free, no bandwidth charge; Workers requests $0.30/million after 10 million; Container 375 vCPU-minutes a month included, then $0.00002/vCPU-second; all on Workers Paid, $5 a month | $5 per 1,000 minutes stored (prepaid blocks); $1 per 1,000 minutes delivered, pieces fetched ahead included, rounded to 4 s pieces | storage $0.0024/min-month at 720p; first 100,000 delivered minutes free each month, then $0.0008/min at 720p (cheaper in tiers); $20 credit a month |
| **Launch, a month** | **about $0 extra**: the account is already on Workers Paid ($5 a month, owner 2026-11-13), and launch use stays inside its included amounts | **about $165** ($160 delivery, $5 storage) | **about $30** ($48 delivery past the free 100,000, under $1 storage, less the $20 credit) |
| **10×, a month** | **about $20 to $50** (Worker requests and R2 reads past the free amounts, driven by piece requests: a 2 s first piece, then 4 s pieces, about 15 a watched minute, plus one ready-mark check each; about 125 GB stored; encoding near the included minutes) | **about $1,610** ($1,600 delivery, $10 storage) | **about $1,125** (tiered delivery, $5 storage, less the credit) |
| Cost of "next 4" (launch) | nothing extra worth counting | about $11 a month | about $9 a month (once past the free minutes) |
| Start time | first piece can be 2 s (we choose), so a fetched-ahead clip starts at once, and a cold one fetches about 150 KB at the lightest version before it plays | fixed 4 s pieces: a cold start fetches about twice as much | similar to Stream |
| First-frame still | kept as today (media tool), or written by ffmpeg in the same pass for free | Stream's thumbnail address (free) | Mux's thumbnail address (free) |
| Maker's upload | as today; versions are made in the background, and the feed plays the original until they are ready | the browser sends the file straight to Stream with a one-time link from Ruken, then waits for "ready" (a minute or so for 30 s); the steps need a "getting your video ready" wait | as Stream, with a webhook to say "ready" |
| What we have to run | the encoder: a job queue, retries, failures, and cleaning up a game's pieces | nothing | nothing |
| New account or credential | none (a Container in the same Cloudflare account) | a Stream subscription and a Stream API token | a Mux account with a card, an API token and a webhook secret |
| Where viewer data goes | Cloudflare only, as today | Cloudflare only | Mux too (each request's address and device); Mux's own viewer tracking stays off because we use our own player |
| Build size | largest: about 3 to 4 sessions | about 2 sessions | about 2 sessions |

Sources: [Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing/),
[Mux pricing](https://www.mux.com/docs/pricing/overview), [R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/), all read 2026-11-28. Serving
video from R2 through a Worker is allowed under Cloudflare's developer platform terms (the CDN's old limit on video
covers content not served from R2, Stream or Images); the build re-reads the
[service terms](https://www.cloudflare.com/service-specific-terms-application-services/) on the day and quotes the line.

**Recommendation: A, self-made HLS on R2.** It stays on the Cloudflare account Ruken already runs on, adds no company
and no viewer data anywhere new, and costs nothing extra at launch and tens of dollars at 10×, where B and C cost
over $1,000. It is also the only one where the piece length (2 s, for a quicker start and a lighter fetch ahead) and
the versions are ours to choose. What it costs instead is build time (one or two sessions more than B) and an encoder
we look after. If the owner would rather not run an encoder, B is the simplest and keeps everything on Cloudflare;
C is cheaper than B but is a new company.

## 5. Lane

Lane 3: Cloudflare Containers (a Container image, its Durable Object class exported from `cloudflare/worker.js`, and
its binding in `wrangler.jsonc`), the deploy job building the image (`.github/workflows/deploy.yml`, if the runner
needs a step), the gate's new keys (`cloudflare/games/`, `src/features/play/gate.ts`), and the hourly job that streams
every clip already stored (a write of real data, `cloudflare/crons.js`). **No Cloudflare Queues, no new table, no
column and no migration**: the state lives in marker files in the bucket (7.2). Lane 2 parts within it:
`src/lib/`, `package.json` and `pnpm-lock.yaml` (a new package). It takes a plan audit, an implementation audit and
green CI, and merges under the 2026-11-21 standing permission once those pass. The owner's pick on the card (section
6) is the product approval that the spend, the new tool and the new package need.

## 6. What the owner must approve (one card)

1. **The option and its monthly cost**: A (about $5 at launch, $30 to $50 at 10×), B (about $165, about $1,610) or
   C (about $30, about $1,125).
2. **With A:** Cloudflare Containers, on the Workers Paid plan ($5 a month) if the account is not on it yet. The deploy
   token gains the Containers permission. **With B:** a Stream subscription and a Stream API token. **With C:** a Mux
   account with a card, and its token and webhook secret as Worker secrets. Each comes to the owner as CLI commands
   where a CLI exists.
3. **A new package, `hls.js`** (Apache-2.0), the player wherever Media Source exists, so Ruken chooses what is fetched
   ahead and at which quality (7.5). Its download size is measured in the build, not guessed here.
4. **Streaming the clips already stored**: the hourly job makes the versions for every clip in `ruken-games` (7.2).
   Originals are kept, so nothing is lost.

This section is kept as it was asked. After plan audit 1: option A costs about $0 extra at launch, because the account
is already on Workers Paid (owner, 2026-11-13: "$5 a month is OK"); and the deploy token gains the Containers
permission through a CLI command given to the owner when the build needs it.

Nothing here creates an account or spends money before that pick.

## 7. Design (option A, the owner's pick)

1. **Making the versions.** A Cloudflare Container with ffmpeg, called through its own Durable Object (part of
   Containers, which the card named; no Cloudflare Queues). After a clip is saved (`saveClip`, and `saveHeldClip` for
   a live game's held clip, which is encoded while held: its key is unguessable and nothing points players at it), the
   Worker asks the Container to stream it, in `waitUntil`, so the maker's save never waits. The Container:
   1. checks the original still exists (an R2 head), and stops if not;
   2. reads it and writes, under `clips/<public id>/hls/<shape>-<16 hex>/`: a main playlist, and for each version a
      playlist, an init piece and its pieces (fMP4, H.264 and AAC). The first piece is 2 s and the rest 4 s
      (`-hls_init_time 2 -hls_time 4`), so a clip starts on a small piece and a watched minute is about 15 requests.
      Versions for an upright clip, each only when the original is at least that big: 1080×1920 at about 4.5 Mbit/s,
      720×1280 at 2.5, 480×854 at 1.0, 360×640 at 0.6, and 240×426 at about 0.25 Mbit/s with mono sound at 48 kbit/s
      (the lightest, which every clip has). The wide clip the same, turned sideways;
   3. checks the original still exists again; if it is gone, deletes everything it wrote and stops;
   4. writes the ready mark last (7.2), then heads the original once more and deletes `ready` and its output if the
      original is gone (plan audit 2, note 1).
2. **Where the state lives: marker files, no database change.** Beside the pieces: `ready` (written last, when every
   piece is in) and `failed` (the number of tries and the time of the last). No table, no column, no migration. The
   **existing hourly cron** (`cloudflare/crons.js`, "0 * * * *") lists `clips/` (a few list calls an hour, even at 10×)
   and asks the Container to stream every stored clip that has no `ready` and fewer than 3 failed tries, the last one
   over an hour ago. That one rule covers a `waitUntil` that died, retries, and the clips already stored (D3): they
   are streamed by the first hourly runs after the deploy, with no command for anyone to run. After 3 failures the clip
   keeps playing from its original for good, and the log line says which.
3. **Serving.** The gate's `serveMedia` (`src/features/play/gate.ts`) learns the new keys: `CLIP_KEY` gains the exact
   `hls/` shapes (`.m3u8` playlists, `.mp4` init pieces, `.m4s` pieces), with their content types. It serves an `hls/`
   key **only while that clip's `ready` mark exists** (one R2 head per request; counted in the 10× cost), so nothing is
   served for a clip that is gone or half made. Pieces are cached a year and never change (their folder is per upload);
   playlists the same. hls.js fetches with CORS, so `hls/` answers carry `access-control-allow-origin` for Ruken's own
   site addresses only (today's `commonHeaders` sends none). They also carry `timing-allow-origin` for the same addresses, since
   the media address is another origin and without it Resource Timing reports `transferSize` 0 for every piece, which
   would leave the kept bandwidth (7.5) empty. A main playlist that is not ready answers 404, which is
   how a player learns to play the original instead: the feed's data does not change.
4. **Cleanup.** `deleteClipFile` (`stills.ts`), which every removal path uses today (replace, send back, take off, a
   refused held clip) and account deletion's emptying of `clips/<public id>/` (`deletion.ts:156-157`), delete the
   `ready` mark **first**, then the clip's `hls/` folder. With 7.1's second check and 7.3's ready rule, a job that is
   running while its clip is removed can neither be served nor leave pieces behind.
5. **Player: hls.js wherever Media Source exists.** One module, `src/lib/stream-video.ts`, gives a `<video>` its source,
   in this order: hls.js where `MediaSource` or `ManagedMediaSource` (iPhone, iOS 17.1 and later) exists, which is
   Chrome (computer and Android), Safari on a Mac, iPad and iPhone, DuckDuckGo, and Playwright's WebKit and Chromium;
   the browser's own HLS only where neither exists; and the original file when the streamed version is not ready (404)
   or neither works. **The starting version is the one the network can carry, not always the lightest**, so a clip
   is never blurry for its first 2 s on fast Wi-Fi (plan audit 2, note 2). One rule decides it, used by the player and
   the warm fetch alike (7.6): **a clip starts on the version it was last warmed at.**
   - **The kept bandwidth** is the page's own estimate for the visit (in memory only, nothing stored), taken **only from
     pieces that crossed the network**: Resource Timing entries for `hls/` pieces with `transferSize > 0`, bytes over
     `responseEnd - requestStart`, averaged over the last few. A read the browser answers from its cache
     (`transferSize` 0), such as a warmed first piece, never counts, so it cannot make a slow line look fast (plan
     audit 3, red 2).
   - **The warm version** is the highest version that fits under the kept bandwidth with room (its rate at most two
     thirds of it), or the 240 one before anything is measured or when the line is slow.
   - When a clip gets its player, it gets its warmed version as `startLevel` and the kept bandwidth as hls.js's
     `abrEwmaDefaultEstimate`; hls.js then steps up or down as the network allows. If the criterion 13 probe shows
     hls.js samples loads it gets from the cache, `stream-video.ts` gives hls.js a loader that leaves those loads out
     of its estimate.
   The `<video>` has `disableRemotePlayback` set, which Safari needs before it opens `ManagedMediaSource` on an iPhone
   (plan audit 2, note 3). hls.js is loaded with a dynamic import, only
   when the first clip plays through it. Every place a clip plays uses the module (feed, Your turn, game page, a maker's
   page, `/about`, `/join`, the maker's steps). The start-time trick (`#t=0.001`) and the hand-made loop keep working;
   WebKit's loop bug (`quietVideo`, progress.md Flaky tests) is checked again with streamed clips.
6. **The next 4: one warm fetch on every engine.** At most 3 clips hold a player: the one before, the one on screen and
   the one after, as today (iPhones cap how many videos decode at once). Clips 2, 3 and 4 ahead hold no player and no
   address, and a player that is not on screen loads nothing itself (hls.js `autoStartLoad: false`, `startLoad()` when
   its clip comes on screen). For each of the 4 ahead (clips 1 to 4 after the one on screen), the page itself
   `fetch`es the main playlist, the warm version's playlist (7.5), its init piece and its first 2 s piece, with the
   same CORS mode and credentials hls.js uses, so they land in the browser's cache under the same key and hls.js reads
   them from there when the clip gets its player and starts on that same version. **Re-warming:** when the kept
   bandwidth rises to a higher warm version, each of the 4 ahead that was warmed lower is warmed again at the new
   version, **at most once per clip** (plan audit 3, red 1). A fall never re-warms: the clip starts from its cached
   piece at once and hls.js steps down from there. So on the first settle of a visit the 4 ahead are warmed at 240, and
   once the clip on screen has measured a fast line they are warmed once more at the version it carries. A warm is
   about 60 to 80 KB a clip at 240 and about 0.6 MB at 720 (about 2.4 MB for the 4 ahead on a fast line), the same on
   WebKit and Chromium, whatever player the clip later gets; on a slow line it stays at the light end. A clip that leaves the window lets go of its player as today; the warm fetches are aborted if still running.
   The stills window (`stillNear`) becomes 1 before and 5 after, so a still is always there before its clip.
7. **Stills.** Unchanged: the media tool still makes them from the original.

## 8. Acceptance criteria

Every journey runs on the repo's matrix: phone (WebKit), tablet and computer (Chromium), `playwright.config.ts`.

1. Once a clip's streamed version is ready, its requests are HLS playlists and pieces, not the original file (journey,
   reading the page's requests).
2. With Chromium's network held to a named rate, 0.8 Mbit/s down and 150 ms latency (CDP
   `Network.emulateNetworkConditions`), a person swipes through at least 3 clips from the first of a visit, each
   played a few seconds; every one of them plays the 240 or 360 version and stalls for no more than 1 s in total after
   its first frame (journey on the computer project; the version and stall time are printed per clip). The 240 version
   (about 0.3 Mbit/s with sound) fits that rate with more than twice the room. This also proves cached warm pieces do
   not lift the kept bandwidth.
3. After the feed settles on a clip, each of the next 4 has its main playlist, warm version's playlist, init piece
   and first piece transferred over the network, at most twice (the second only when the kept bandwidth rose to a
   higher warm version, 7.6), and nothing more. Transfers are counted over the network, not reads the browser answers
   from its cache (the one after's player reads its main playlist again from the cache). The clip 5 ahead has nothing
   fetched; no more than 3 `<video>` elements have a source (journey on phone and computer, unthrottled and at the
   criterion 2 rate). The bytes fetched for the 4 ahead are printed.
4. Every clip starts on the version it was last warmed at (journey on phone and computer; the versions are printed).
   On an unthrottled network, from the second clip of a visit on, that is the version the clips before it measured,
   not the 240 one unless the line measured slow.
4b. A swipe to the next clip shows its first moving frame within 300 ms on an unthrottled network (journey; measured and
   printed, not guessed).
5. Every clip shows its first-frame still until it plays, as today (the existing still journeys pass unchanged).
6. A maker uploads both clips exactly as today, sees no new step, and the game's clips play straight away from the
   original until the streamed version is ready (journey through the maker's steps).
7. Replacing a clip, sending a game back, taking it off, refusing a held clip and deleting an account each leave no
   `ready` mark and no `hls/` piece behind (pg tests on the bucket, one per path). A clip removed while its job is
   mid-way (between steps 2 and 3, and between steps 3 and 4, of 7.1) leaves nothing behind and nothing is served for it (pg test with a stand-in
   Container that pauses).
8. The gate serves an `hls/` key only while its `ready` mark exists, and answers 404 otherwise (unit test on
   `serveMedia`).
9. A clip whose encoding fails plays from its original; the hourly job tries it again after an hour, up to 3 tries
   (unit test on the cron's pick).
10. The hls.js path plays and loops on phone (WebKit) and computer (Chromium) without jumping back over and over
    (journey). The browser's own HLS path, forced by a test switch that hides Media Source, plays on phone (WebKit)
    (journey). The original-file path, forced by a 404, plays on all three projects (journey).
11. hls.js's download size is measured and printed; it is downloaded only on the hls.js path (journey on both paths).
12. After the deploy, the hourly job streams the clips already stored; the build session reports the counts made,
    skipped and failed from the first runs, and checks the live feed with a phone profile.
13. **Before anything is built on it**, a probe in the build's first step shows, in Playwright's Linux WebKit and
    Chromium, that `MediaSource` (or `ManagedMediaSource`) exists and hls.js plays a fixture stream, and that WebKit's
    own HLS plays it too; and whether hls.js counts a load it gets from the browser's cache in its bandwidth estimate
    (7.5). Its output goes in the pull request. If WebKit's own HLS does not play there, criterion 10's
    native journey is dropped to a unit test of the choice and the reason is written down.
14. Lint, typecheck, unit, pg and browser suites green; the standing overlap and gamepad journeys are untouched (no
    control is added).

## 9. Plan (after the owner's pick, and after playtesting)

1. Plan audit of this spec (Opus 5.5, medium), with the option picked.
2. Execution (Opus 5.5, medium; this spec; the owner dropped Sonnet, 2026-11-28), one branch and one pull request. First step, before anything leans on
   it: the probe in criterion 13. Then the Container and its marks, serving and cleanup, `stream-video.ts`, the warm
   fetch for the next 4, the journeys above, then the hourly job.
3. Implementation audit (Opus 5.5, medium) in a fresh thread; fixes by the implementer.
4. Merge on green under the standing permission. The hourly job then streams the stored clips on its own (no command
   for anyone to run; the owner's card covers it, section 10); the build session watches the first runs and checks the
   live feed with a phone profile.

Expected duration: about 3 to 4 sessions. Budget: the monthly cost of the picked option, as
in section 4; a material change (for example real traffic far above the assumptions) is reported to the owner.

## 10. Decisions

- 2026-11-28 08:09 UTC, the owner, on a card: "Our own, on Cloudflare" (option A), whose text read: "About $5/mo at launch, $30-50 at
  10x. Adds Cloudflare Containers (Workers Paid, $5/mo) and the hls.js package, and converts the clips already
  stored." This settles D1 (option A and its monthly cost), D2 (`hls.js` as a new package) and D3 (streaming the clips
  already stored), within the boundaries of this spec. The Workers Paid plan, if the account is not on it, and the
  deploy token's Containers permission go to the owner as CLI commands when the build needs them.
- Section 7 is written for option A; the notes on B and C are kept as a record only.
- Plan audit 1 (FAIL, 5 red, at `95e2ee2`): fixed in section 7 and 8 as R1 one way to fetch ahead on every engine
  (warm fetch, hls.js wherever Media Source exists), R2 a lighter version and a named throttle, R3 the repo's two
  engines and a journey per player path, R4 no piece outlives its clip, R5 marker files and the hourly job, no Queues
  and no migration. The launch cost is about $0 extra, since Workers Paid is already on.
