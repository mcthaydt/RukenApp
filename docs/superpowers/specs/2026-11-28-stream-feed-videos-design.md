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
| **Launch, a month** | **about $5** (the Workers Paid plan; $0 more if already on it) | **about $165** ($160 delivery, $5 storage) | **about $30** ($48 delivery past the free 100,000, under $1 storage, less the $20 credit) |
| **10×, a month** | **about $30 to $50** (Worker requests and R2 reads past the free amounts, about 125 GB stored, encoding past the included minutes) | **about $1,610** ($1,600 delivery, $10 storage) | **about $1,125** (tiered delivery, $5 storage, less the credit) |
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
[Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/), all read 2026-11-28.

**Recommendation: A, self-made HLS on R2.** It stays on the Cloudflare account Ruken already runs on, adds no company
and no viewer data anywhere new, and costs about $5 a month at launch and tens of dollars at 10×, where B and C cost
over $1,000. It is also the only one where the piece length (2 s, for a quicker start and a lighter fetch ahead) and
the versions are ours to choose. What it costs instead is build time (one or two sessions more than B) and an encoder
we look after. If the owner would rather not run an encoder, B is the simplest and keeps everything on Cloudflare;
C is cheaper than B but is a new company.

## 5. Lane

Lane 3: a new Cloudflare service and its binding (`wrangler.jsonc`, `cloudflare/`), a new environment, and a one-time
job that writes the streamed versions of every clip already stored (a write of real data). Lane 2 parts within it:
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
3. **A new package, `hls.js`** (Apache-2.0), loaded only on browsers that cannot play HLS themselves (Firefox, and
   Chrome on a computer where it cannot); Safari, iPhone, iPad and Chrome on Android play HLS natively. Its download
   size is measured in the build, not guessed here.
4. **Streaming the clips already stored**: a one-time job makes the versions for every clip in `ruken-games`. Originals
   are kept, so nothing is lost.

Nothing here creates an account or spends money before that pick.

## 7. Design (option A; B and C change only sections 7.1 and 7.2)

1. **Making the versions.** After a clip is saved (`saveClip`, `saveHeldClip`), the Worker queues a job. A Container
   with ffmpeg reads the original from R2 and writes, beside it under `clips/<public id>/hls/<shape>-<16 hex>/`: a main
   playlist, and for each version a playlist, an init piece and 2 s pieces (fMP4, H.264 and AAC). Versions for an
   upright clip: 1080×1920 (if the original is that big), 720×1280, 480×854 and 360×640, at about 4.5, 2.5, 1 and 0.6
   Mbit/s; the wide clip the same turned sideways. A clip shorter or smaller than a version skips it. A failure is
   tried again 3 times, then marked, and the clip keeps playing from its original.
2. **Serving.** The gate's `serveMedia` serves the playlists and pieces under the same rules as a clip (only keys of
   the exact shape, anyone, a year in the browser), and the feed's data says per clip whether its streamed version is
   ready. Removing a clip, replacing it, sending a game back or taking it off also empties its `hls/` folder (where
   `deleteClipFile` empties the stills today).
3. **Player.** One small module, `src/lib/stream-video.ts`, gives a `<video>` its source: the main playlist where the
   browser plays HLS itself (`canPlayType("application/vnd.apple.mpegurl")`), hls.js where it does not but has Media
   Source, and the original file otherwise or while the streamed version is not ready. Every place a clip plays uses it
   (feed, Your turn, game page, a maker's page, `/about`, `/join`, the maker's steps). The start-time trick
   (`#t=0.001`) and the hand-made loop keep working; WebKit's loop bug (`quietVideo`, progress.md Flaky tests) is
   checked again with streamed clips.
4. **The next 4.** `near` becomes the clip before, the clip on screen and the next 4. For those 4 only the main
   playlist, the lightest version's playlist, its init piece and its first piece are fetched; the clip on screen
   plays adaptively. A clip that falls out of the window lets go of its source as today. The stills window
   (`stillNear`) stays 1 before and 3 after unless 4 ahead needs it longer (then 1 before and 5 after).
5. **Stills.** Unchanged: the media tool still makes them from the original.
6. **Clips already stored.** A one-time job queues every stored clip (originals untouched). It reports how many were
   made, skipped and failed.

## 8. Acceptance criteria

1. On phone, tablet and computer profiles, a feed clip's network requests are HLS playlists and pieces, not the
   original file, once its streamed version is ready (journey, reading the page's requests).
2. With the network held to a slow 3G profile, the clip on screen plays a lighter version and does not stall for more
   than 1 s after its first frame (journey on Chromium with throttling; the stall count is printed).
3. After the feed settles on a clip, the next 4 clips each have their first piece fetched and nothing more, and the
   clip 5 ahead has nothing fetched (journey). The total bytes fetched for the 4 ahead are printed.
4. A swipe to any of the next 4 shows its first moving frame within 300 ms on a normal network (journey; measured and
   printed, not guessed).
5. Every clip shows its first-frame still until it plays, as today (the existing still journeys pass unchanged).
6. A maker uploads both clips exactly as today, sees no new step, and the game's clips play straight away from the
   original until the streamed version is ready (journey through the maker's steps).
7. Replacing a clip, sending a game back, taking it off and deleting an account each leave no streamed pieces behind
   (pg tests on the bucket, one per path).
8. A clip whose encoding fails plays from its original, and the failure is marked and tried again (unit test).
9. Safari's engine (WebKit) plays streamed clips natively, and Chromium and Firefox through hls.js; the loop restarts
   without jumping back over and over (journey on all three engines Playwright runs).
10. The one-time job streams the clips already stored and reports counts; run once on the live bucket after the owner's
    yes, its output kept in the pull request.
11. The build size added by hls.js is measured and printed, and it is not downloaded on WebKit.
12. Lint, typecheck, unit, pg and browser suites green.

## 9. Plan (after the owner's pick, and after playtesting)

1. Plan audit of this spec (Opus 5.5, medium), with the option picked.
2. Execution (Sonnet 5.5, medium; this spec), one branch and one pull request: the encoder Container and queue (or, for
   B or C, the upload link and the "ready" wait), serving and cleanup, `stream-video.ts`, the next-4 window, the
   journeys above, then the one-time job.
3. Implementation audit (Opus 5.5, medium) in a fresh thread; fixes by the implementer.
4. Merge on green under the standing permission; run the one-time job; check the live feed with a phone profile.

Expected duration: option A about 3 to 4 sessions; B or C about 2. Budget: the monthly cost of the picked option, as
in section 4; a material change (for example real traffic far above the assumptions) is reported to the owner.

## 10. Decisions

- 2026-11-28 08:09 UTC, the owner, on a card: "Our own, on Cloudflare" (option A), whose text read: "About $5/mo at launch, $30-50 at
  10x. Adds Cloudflare Containers (Workers Paid, $5/mo) and the hls.js package, and converts the clips already
  stored." This settles D1 (option A and its monthly cost), D2 (`hls.js` as a new package) and D3 (streaming the clips
  already stored), within the boundaries of this spec. The Workers Paid plan, if the account is not on it, and the
  deploy token's Containers permission go to the owner as CLI commands when the build needs them.
- Sections 7.1 and 7.2 stand as written for option A; the notes on B and C are kept as a record only.
