# Live state: claude/project-thread-6s28wv (make the frosted glass visible)

- Current task: BUILT on the branch (slot given by the coordinator 2026-11-23 15:32 UTC). Glass on every floating piece, much clearer (about 9.5% darker), lens edge with colour fringes, soft shadow on words and icons.
- Last commit: see git log (the commit that wrote this line); written 2026-11-23 15:51 UTC.
- Next step: share before/after with the owner, fresh lane 2 review naming the head, then ask the coordinator before opening the PR.
- Open decisions: none for the owner.
- Checks run here: lint, typecheck (0 errors once the local build output is moved out of .svelte-kit), unit tests (glass and look tests pass; whole suite had only look.test's no-shadow rule failing before it was changed), journeys bar/play/feed-controls/look/game-page on computer and tablet: 354 passed, 88 skipped, 0 failed. Phone (WebKit) not run: WebKit is not installed in this container.
- Tests changed on purpose: tests/lib/glass.test.ts (4.5:1 over white replaced by "darkens by 5-12%" and "every glass surface has the lens edge"; fallback also turns edge/ink/icon off); tests/lib/look.test.ts (no box-shadow/text-shadow, except the glass tokens).

## Scope (owner, 2026-11-22 21:43 to 21:45 UTC)
1. Every HUD-like element floating over content is frosted, not only the name, line and Play band.
2. The glass is "a lot more transparent": today you can barely see behind it.
3. The glass has chromatic aberration.
4. Owner, 2026-11-22 21:47 UTC: "Just darken it by like 5%", then "maybe 10". The glass darkens what is behind by about 10% (brightness about 0.90), no more. Legibility over bright clips comes from the soft text and icon shadow, not from darkening.

## Findings on main 85916ae
- Only these read the glass tokens: feed words band (`.band::before`), feed sound button (`.sound`), game page name (`.gamepage .heroname`), play-screen tab (`.playing .menu > summary`). That matches what the owner sees.
- Solid `var(--felt-deep)`, floating over content, to switch to glass:
  - bottom bar `.bar` (src/features/feed/Bar.svelte); its marked tab (felt-raised) and Add (pay blue) stay solid chips
  - Share `.share` and its note `.sharenote` (src/features/feed/Feed.svelte)
  - first-time hints `.hints` over the clip (Feed.svelte)
  - welcome-back line over the feed `.panel.over` (src/lib/look.css near line 199)
  - game page Back `.gamepage .back` over the hero clip (look.css near line 2635)
  - phone bottom action row `.screen .acts` (fixed, look.css near line 1207)
  - page-loading spinner chip `.page-loading-spinner` (look.css near line 3209)
- Why it looks solid: `--glass-filter: blur(24px) brightness(0.29) saturate(1.3)` crushes what is behind to 29% brightness, so over the dark felt or a dark clip it reads as near-black. Plan (per item 4): brightness about 0.90, a light tint, saturate about 1.6 to 1.8, blur about 16 to 20px, plus a soft text and icon shadow for legibility over bright clips.
- `tests/lib/glass.test.ts` "keeps chalk at 4.5 to 1 or more over a white clip" cannot hold with much clearer glass. The owner's ask changes that criterion: change the test openly in the PR (say so in the body and to the owner) with the new rule, never quietly.
- Chromatic aberration: WebKit does not take SVG `url()` in backdrop-filter, so the portable route is an edge fringe (thin red and cyan inset box-shadows on the glass edge) on every engine; a real backdrop colour split by SVG filter is Chromium-only and optional. Never a see-through `background` colour (glass.test guard).
- Conflict risk: Bar.svelte is being changed by the sideways-phone / bottom-bar thread; build after it merges.
- Screens: only Chromium is installed in this container (no WebKit), so phone shots are Chromium emulation; label them so. Fixture clips are small and smooth; for before/after make a busy clip with ffmpeg (testsrc2) and post it through `/make/<slug>/<shape>?/clip` as `giveRealClips` does.

- Updated 2026-11-22 21:47 UTC: owner's 5% darkening added to scope.
- Updated 2026-11-22 21:48 UTC: owner changed 5% to about 10%.
