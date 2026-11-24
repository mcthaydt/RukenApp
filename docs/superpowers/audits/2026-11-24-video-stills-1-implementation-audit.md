# Video stills, implementation audit 1

- Pull request: #380, "Show every video's first frame until the video plays"
- Commit examined: `c427ae065ef01dbbbe563ce0e36bde3504aa5e3b` (base `e2a9d8f`)
- Lane: 2. Reviewer: a fresh session, Opus 5.5, medium.
- Written: 2026-11-24 02:35 UTC

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 3 red.** The design is sound and most of the brief holds, but CI's phone run fails on an existing journey because of this change, and a still that cannot be made is tried again on every view, which works against the owner's free-tier budget.

## What ran

- `pnpm typecheck`: 0 errors. `pnpm lint`: clean.
- `vitest run tests/lib/look.test.ts tests/lib/still-poster.test.ts tests/features/games/stills.test.ts tests/loading-states.test.ts`: 156 passed.
- CI on `c427ae0`, run 45312755758: browser shard 6 (phone, WebKit) **failed** at `tests/browser/feed-controls.test.ts:108`; the other shards were cancelled by the fail-fast, so the rest of the journeys did not run on this commit. Verify and postgres passed.
- Not run by me: the browser journeys locally (CI's run is the evidence).
- Cloudflare's own docs, read 2026-11-24 (developers.cloudflare.com/stream/transform-videos/ and its bindings page): input "should be an MP4 with H.264 … Other formats may work but are untested"; binding calls are free in the beta, then "billed on a per-operation basis, not based on request uniqueness"; binding answers are "not automatically cached"; "If `remote = true` is not specified, the binding will produce an error during local development."

## The changed checks (asked first)

- `tests/lib/look.test.ts`: the rule "no other rule on a picture or a video sets its background picture" now exempts exactly `video[data-still]` and `video[data-still][data-loading]` (anchored regex), and a new test pins the spinner layer on top of the still in both motion modes. Narrow; does not weaken the rule for any other selector. OK.
- `playwright.config.ts` and the `verify` skill: `wrangler dev … --local`. It skips no test; the journeys and verify run the same specs. But the stated reason is wrong (red 3).
- `tests/loading-states.test.ts`: a new guard that every `<video>` carries `use:stillPoster`. Adds coverage.
- `tests/browser/feed-controls.test.ts:108` was **not** changed, and it now fails (red 1).

## Brief points

| Point | Result | Evidence |
| --- | --- | --- |
| Old and new videos both get stills | PASS | The page finds the still from the clip's own address (`src/lib/stills.ts` `stillOfClip`); the server makes it on first ask (`stillOf`). No backfill needed. |
| Stills kept, not made again | PASS for a made still; **red 2** for a failed one | `stillOf` reads the kept R2 copy first; unit test "made … once, and kept". A failure keeps nothing. |
| No jump when the video starts | PASS | The still is the video's own CSS background, size from `object-fit`, place from `object-position` (`still-poster.ts`); the element's box never changes. Journey checks `backgroundPosition == objectPosition` and `cover`. |
| Safari loop-by-hand (#374) untouched | PASS | `Feed.svelte` keeps `use:loopByHand`; the diff adds no `.loop` write (only pre-existing `quiet-video.ts:73`, unchanged). |
| No private bucket key leak | PASS | The route takes only keys matching `isClipKey`; the still folder is not clip-shaped, so the media host never serves stills. The still exposes no more than the media host already serves for the same key (`gate.ts serveMedia`, no state check, before and after). Path traversal refused (unit test). |
| Failure falls back | PASS for the page (404 `no-store`, the spinner on the green panel as before); **red 2** for cost | |
| Everything custom, spinners only | PASS | No native `poster`; the spinner stays on top of the still while loading; no "Loading…" text. |
| Stills go with their clip | PASS | Every clip delete in `service.ts` goes through `deleteClipFile`; account deletion and game delete empty `clips/<id>/`, which holds the stills. |

## Red findings

### Red 1

- UNIT: `tests/browser/feed-controls.test.ts:108` "only the clip on screen and the next are fetched before a person scrolls".
- VERDICT: red.
- REQUIREMENT: CI green on the reviewed head; "a change does not quietly edit its own check", and every existing journey still passes.
- REASON: the test counts every request whose address contains `/clips/`; the still address is `/api/still/clips/…`, so the feed's still requests (one back to three ahead) are counted as clip fetches.
- EVIDENCE: run 45312755758, shard 6 [phone]: `expect(asked.size).toBeLessThanOrEqual(2)`, received 6 (2 clips + 4 stills, matching `stillNear`: current −1 to +3).
- EXPECTED: the test still proves only two clips are fetched, and separately bounds the stills (no more than the four near clips, never the whole feed).
- FIX: in that test only, leave addresses under `/api/still/` out of the clip count and add a bound for them (at most 4 distinct still addresses). Name the edit and why in the PR body under "Changed checks". Files: `tests/browser/feed-controls.test.ts`, the PR body.

### Red 2

- UNIT: `src/features/games/stills.ts` `stillOf`.
- VERDICT: red.
- REQUIREMENT: the owner's 01:58 UTC choice: each still "made once and kept", inside the free 5,000 a month.
- REASON: when making a still fails, nothing is kept, and the answer is a `no-store` 404, so every later view of that clip reads the whole clip (up to 30 MB, `VIDEO_MAX_BYTES`) from R2 and calls the media tool again.
- EVIDENCE: `stillOf` returns `{ kind: "none" }` from the `catch` with no write; the route sends `cache-control: no-store`. Failures are likely, not rare: clips may be `.webm` or `.mov` (`CLIP_AT_END`), which Cloudflare calls "untested"; the landing wall asks for second 2, 6, 10… which a short clip may not reach. After the beta, binding calls are "billed on a per-operation basis, not based on request uniqueness". CI shows the repeat already: shard 6 logged "A still could not be made" on every still request.
- EXPECTED: a still that fails is tried once (per clip, second and width) and then answered 404 at once, without reading the clip or calling the tool, until the clip is replaced.
- FIX: on failure, keep a small marker beside where the still would be (for example `<s>s-<w>.none` in the still folder) and check for it before reading the clip; `deleteClipFile` already empties the folder, so a new clip starts clean. A unit test: a failing maker is called once across two asks. Do not keep a marker when there is no frame maker at all (a copy of the app). Files: `src/features/games/stills.ts`, `tests/features/games/stills.test.ts`.

### Red 3

- UNIT: `playwright.config.ts` comment, `.claude/skills/verify/SKILL.md`, `wrangler.jsonc` comment, `src/lib/server/cloudflare.ts` comment, PR body "Changed checks".
- VERDICT: red.
- REQUIREMENT: "Report honestly"; the PR body's stated reason for a changed check must be true.
- REASON: the PR says that with `--local` "the binding is absent and the site runs without stills". It is not absent: `env.MEDIA` exists and throws on use.
- EVIDENCE: CI shard 6 web server log: `[ERROR] A still could not be made: Binding MEDIA needs to be run remotely`, repeated for each still request; Cloudflare's bindings page says the same.
- EXPECTED: the comments and the PR body say what happens: under `wrangler dev` the binding is there but refuses, the still address answers 404, and the page shows no still.
- FIX: correct those comments and the PR body's sentence. No behaviour change needed (red 2's marker then also stops the repeats in the journeys). Files: the four named above and the PR body.

## Notes (not blocking, follow-ups)

- Note 1: anyone may ask for any whole second 0–60 at any of 5 widths, so one person can make up to 305 stills per clip (each once, then kept). With 100 clips that is up to 30,500 operations, past the free 5,000 once the beta ends (about $13 one time). The site only ever asks for second 0 and the landing wall's start seconds. A tighter allow-list of seconds would close it. Product cost is small; recorded for the owner's budget.
- Note 2: two first asks for the same still at the same moment both make it (no lock). Small, bounded by the number of people opening a brand-new clip at once.
- Note 3: whether the deploy token can deploy a Worker with a `media` binding is unverified until the first deploy (the PR already names this). If the deploy fails, the site does not update; the PR says the site "keeps working" without stills, which holds only if the deploy itself succeeds.
