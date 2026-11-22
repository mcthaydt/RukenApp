# Tap to open feed video: implementation audit 1

- Branch: `claude/project-thread-74qnu2`. Commit examined: `bde6f45` (diff against `main` at `b523531`).
- Lane 2 audit, fresh session, Opus 5.5, medium. Audited 2026-11-22 16:07 UTC (from `date`).
- Brief: the owner's ask (2026-11-22 15:50 UTC) "tapping a feed video should open the page, not mute", and the feed spec's changed D7 and design lines in `docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md`.

**Verdict: FAIL, 1 red, 5 notes.**

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings |
| `pnpm test` | 128 files, 1,886 tests, all passed |
| `pnpm test:browser tests/browser/feed-controls.test.ts tests/browser/feed.test.ts --project tablet --project computer` | 38 passed |
| WebKit (`phone` profile) | not run: no WebKit in this container; CI runs it |
| Probes (throwaway journeys, deleted, not committed) | see below |

Probes, tablet (Chromium, touch) and computer:

1. A touch swipe that starts in the middle of the clip moves to the next clip and stays on `/` (current moved from `tiny-game-9f022277` to `tiny-game-626d43c1`). A tap then opens `/g/tiny-game-626d43c1`. Swipe and tap do not fight.
2. The accessibility tree of a clip is `button "Sound"`, the game link with its `h2`, `link "Play"`, `status`, `button "Share"`. The full-clip link is not in it, and it is out of Tab (`tabindex="-1"`). The speaker is reachable and named.
3. With reduced motion (no clip moves by itself), the clip is paused; pressing the speaker starts it (`paused` false) and the page stays on `/`.
4. Two swipes that open nothing each fetched the game page's data and rewrote the arrival cookie (R1).
5. Back from a game page opened from the second clip lands on the first clip (N1).

## Red

### R1. A swipe on the feed runs the game page's server load and credits that game's maker with the visitor

- UNIT: `src/features/feed/Feed.svelte`, the full-clip link `a.open`.
- VERDICT: red.
- REQUIREMENT: the owner's ask is that a tap opens the page; a swipe must stay a swipe. Design 6 ("Bringing a member"): the arrival is "an arrival through this maker's link", set when a visitor lands on `/g/<game>` (`src/routes/g/[game]/+page.server.ts:36-37`). A visitor who did not land there did not arrive through that link.
- REASON: the link carries `data-sveltekit-preload-data="tap"`, and SvelteKit's tap preload fires on `touchstart` (`node_modules/@sveltejs/kit/src/runtime/client/client.js:2390`, `container.addEventListener('touchstart', tap, …)`). The link covers the whole clip, so every swipe through the feed starts on it and preloads that game's page data. That load runs the arrival code, so the `rk_arrival` cookie (who brought this person, used for `broughtByUserId` in `src/features/membership/service.ts:113-116`) is rewritten to the maker of whatever clip the finger last touched, and it runs the page's database queries on every swipe. Before this change the full-clip element was a button and a swipe fetched nothing.
- EVIDENCE: tablet probe at `bde6f45`, two swipes, URL still `http://localhost:4173/` after both. Responses seen: `/g/tiny-game-9f022277/__data.json` with `set-cookie=rk_arrival=…` (maker `s3rohgn2…`), then `/g/tiny-game-626d43c1/__data.json` with `set-cookie=rk_arrival=…` (maker `ijwrx7wd…`). Cookies before: none; after: `rk_arrival`.
- EXPECTED: a swipe that opens nothing asks the server for nothing about the game page and leaves `rk_arrival` as it was. A tap that opens the page sets it, as landing there always has.
- FIX: set `data-sveltekit-preload-data="off"` on `a.open` (the layout's page bar and spinner already cover the wait, as for the "Made by" link on the game page). Add a journey to `tests/browser/feed-controls.test.ts`: on a touch profile, a swipe that starts on the clip moves one clip, no request for `/g/<slug>/__data.json` is made, and there is no `rk_arrival` cookie afterwards; then a tap on the clip opens `/g/<slug>`. Files: `src/features/feed/Feed.svelte`, `tests/browser/feed-controls.test.ts`. Prove the journey fails with the attribute put back to `tap`, and name that run in the pull request.

## Notes (not fixed here)

- **N1. Back from a game page loses the person's place in the feed.** Probe: opened `/g/tiny-game-626d43c1` from the second clip, pressed Back, landed on `tiny-game-9f022277`, the first. The feed scrolls inside `main.feed`, which SvelteKit's scroll restore does not cover, and there is no snapshot. This was already so through the game's name on the band, but the whole clip is now the main way in, so it will happen far more. The owner wants it to "feel like we're using a real app". Follow-up: keep the current clip (a SvelteKit `snapshot` on the feed route) with a journey. Not in this change's brief.
- **N2. Clashes with #321 (frosted glass).** `git merge-tree` of `bde6f45` with #321's head `b4bfaea` conflicts in `Feed.svelte`: #321 puts the glass on `.sound svg`, which this change folds into `.sound`. Whoever merges second must move #321's `background: var(--glass-bg)` and both `backdrop-filter` lines onto `.sound` and drop `opacity: 0.8`. Neither #321's `tests/lib/glass.test.ts` nor any feed journey checks the speaker's glass, so a wrong resolution would pass CI silently; the second to merge should add the speaker to the glass check. Until #321 lands, the speaker is `felt-deep` at 80%, as it was on `main`.
- **N3. Browser defaults on the full-clip link wait on #323.** A long press on a link opens the phone's link menu (iOS preview, Android link menu). Nothing on `main` stops it; #323 (`39fb97e`) adds `:is(a, img, video) { -webkit-touch-callout: none }` and the transparent tap highlight, which cover `a.open`, and it merges cleanly with `bde6f45`. #323's `-webkit-user-drag: none` covers only `img` and `video`, so on a computer a press-and-drag on the clip still drags the link's address (a link is draggable by default). Follow-up for #323 or the custom-controls work: `draggable="false"` on `a.open`, or `a` in the drag rule.
- **N4. WebKit not run here.** The phone profile (WebKit) runs only in CI; the PR's CI run is the evidence for it. Nothing in the change is WebKit-specific beyond R1, which is about `touchstart` and applies to Safari too.
- **N5. The changed design line has no journey.** "Where it may not [move by itself], it shows its first frame and a press on the speaker starts it" is new wording; probe 3 shows it works in Chromium, but no journey checks it. Worth one assertion in the reduced-motion journey when R1's journey is added.

## Checked and fine

- Spec D7 and the design lines match the code: the clip opens `/g/<slug>`; the speaker is a 48px (`--size-target`) button named "Sound" with `aria-pressed`, at `z-index: 2` above the link; the band, Share and the hints sit above the link; the hints keep `pointer-events: none`.
- The journey "the press that opens the game never covers the speaker, Play, Share, the two links or the bar" now includes the speaker.
- Copy: "Tap the speaker for sound" / "Click the speaker for sound" pass the plain-words test. No other place in `src` says "Tap for sound".
- Waiting: a move to the game page shows the layout's bar and spinner (`src/lib/page-loading.svelte`, in `src/routes/+layout.svelte`).
- CRUD: the change adds nothing a person makes.
- Merges cleanly with #323.
