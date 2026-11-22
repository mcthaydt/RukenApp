# Ruken's own video player, and nothing else the browser draws

Date: 2026-11-22. Status: **spec.** Lane 2 for every unit (shared look in `src/lib/`, shared components; nothing in money, membership, migrations, CI or rules). Staged because it is several pull requests that wait on two open ones (#321 frosted glass, #323 panels), not because of risk. Audits by lane: one fresh review after each build; no plan audit (lane 3 only).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-22 15:51 UTC:** "can we have a custom video player instead of the built in for whenever we have full screen videos like on the game page, audit for us using anything built in/default from browser, EVERYTHING should be custom".
- **Owner, 2026-11-22 13:46 UTC (standing):** whenever Ruken is see-through it is the Apple-like frosted glass from Automata Framework Editors (`--glass-bg`, `--glass-filter` in `src/lib/look.css`, from #321). App feel at all times: nothing breaks the illusion of a browser.
- **Owner, 2026-11-22 05:52 and 06:36 UTC (standing):** everything that loads shows a spinner.
- The audit behind this spec: `docs/superpowers/audits/2026-11-22-browser-defaults-1-audit.md` (at `b523531`). Its "kept as the system's" list (share sheet, file and photo chooser, saved passwords, keyboard, right-click menu, what a page cannot change) is **Call: kept**; the owner can overrule any of it.

## 1. The outcome

Nothing a person sees on Ruken is drawn by the browser where a web page can draw its own: videos play in Ruken's player, lists and plan choices are Ruken's cards, scrollbars and typing details are in Ruken's colours. With no script, the browser's own video and list still work, because nothing else can.

## 2. Units

Each unit is one pull request, built from `main` by a fresh execution session (Sonnet 5.5, medium), reviewed by a fresh session (Sonnet 5.5, medium, the builder's model), then fixed by the builder.

| Unit | Waits on | Owns (files) | Output | Acceptance check |
| --- | --- | --- | --- | --- |
| A. Video player | #321 merged (glass tokens) | `src/lib/video-player.svelte` (new), `src/lib/video-time.ts` (new), `src/routes/g/[game]/+page.svelte` (viewer only), `src/routes/make/parts/VideoTile.svelte` (viewer only), `src/lib/look.css` (`.viewer` rules), `tests/browser/video-player.test.ts` (new), `tests/lib/video-time.test.ts` (new), `tests/browser/game-page.test.ts:69-74` (its `controls` line) | Every full-size video plays in Ruken's player | 3.A below |
| B. Scrollbars, circles, typing | #323 merged (both edit the top of `look.css`) | `src/lib/look.css` (new rules only), `src/routes/join/+page.svelte`, `tests/browser/own-look.test.ts` (new) | Audit items 2, 4, 5 | 3.B below |
| C. Pick lists | Unit B merged (same `look.css`; reuses its choice look) | `src/lib/pick-list.svelte` (new), `src/lib/phone-fields.svelte`, `src/routes/make/parts/FilesQuestion.svelte`, `src/lib/look.css`, `tests/browser/pick-list.test.ts` (new) | Audit item 3 | 3.C below |

A and B share no file but `look.css`, and touch different rules in it, so they may run side by side once both wait-ons have merged; C waits on B.

Not here: the feed's own videos, which have no controls and are changed by the thread "Open the game page from feed video" (`src/features/feed/Feed.svelte`); the bottom bar and Share glass (frosted glass thread). This spec touches neither file.

## 3. Acceptance criteria

### 3.A Video player

Where: the full-size viewer on a game's page (`/g/<slug>`, "Watch the video full size") and on the maker's screens (`VideoTile`, "Watch the upright/wide video full size").

1. The `<video>` in an open viewer has no `controls` attribute, and `disablepictureinpicture` and `disableremoteplayback` are set, so no browser control or menu is drawn over it.
2. The player never calls the browser's full screen (`requestFullscreen`, `webkitEnterFullscreen`); it is the existing full-window `dialog.viewer`, with `playsinline`, so on an iPhone it stays in the page. A journey on phone (WebKit) checks that `document.fullscreenElement` stays `null` and the video's `webkitDisplayingFullscreen` is `false` after play.
3. The controls, all Ruken's: one big Play/Pause button in the middle (at least 64×64 px, labelled "Play" or "Pause"); along the bottom a bar with a scrub line (a slider, `role="slider"`, labelled "Where in the video", `aria-valuetext` like "0:12 of 0:30"), the time as "0:12 / 0:30", and a sound button labelled "Sound on" or "Sound off"; Close stays at the top right as today. Every target is at least 44×44 px.
4. Every see-through part (the bar, the round Play/Pause, Close's backing if it has one) uses `var(--glass-bg)` and `backdrop-filter: var(--glass-filter)`, and no other see-through colour. The existing guard `tests/lib/glass.test.ts` passes.
5. It opens playing with sound, as today (`muted` false). Tapping the video plays or pauses it. While playing, the controls fade after 3 seconds without a touch, pointer move or key (an injected clock in the unit test; the journey waits on the `data-idle` attribute, never a sleep); any touch, move or key brings them back. Paused, they stay. With reduced motion they appear and go without a fade.
6. Loading: while the video has no frame yet, or stalls while playing (`waiting`), the spinner shows (the `data-loading` look from `src/lib/loads.ts` and `look.css`), and it goes when it plays (`playing`, `canplay`). A journey on a slowed video route sees the spinner, then sees it go.
7. Error: a video that fails to load says "This video won't play right now." with Close, and no broken player.
8. Keys: Space or K plays and pauses, Left and Right go back and on 5 seconds, M turns sound on and off, Escape closes (the dialog's own). Focus starts on Play/Pause, stays inside the viewer while open, goes back to the button that opened it on close, and is always visible.
9. Dragging or tapping the scrub line moves the video there; the time follows.
10. Without script nothing changes: the game page's inline clip keeps `controls` (`controls={!enhanced}`) and `VideoTile` stays a link to the video file.
11. `src/lib/video-time.ts` turns seconds into "0:07", "1:05", "1:02:03"; unit tests cover 0, under a minute, minutes, an hour, `NaN` and `Infinity` (shown as "0:00").
12. Journeys in `tests/browser/video-player.test.ts` on phone (WebKit), tablet and computer: open from a game's page and from a maker's video tile; play, pause, scrub, sound, keys, close; the spinner; the error. `tests/browser/game-page.test.ts:71` changes from `toHaveAttribute("controls", "")` to `not.toHaveAttribute("controls")` and is named in the pull request body.

### 3.B Scrollbars, circles, typing

1. On a computer, a screen that scrolls has `scrollbar-width: thin` and a `scrollbar-color` from the look's own colours (thumb and track named as `look.css` tokens). The feed's scroller has `scrollbar-width: none`.
2. The two plan choices on `/join` draw no browser circle (`appearance: none` on the radio) and show Ruken's own circle and dot; the chosen one is still told apart by more than colour (the heavier edge it has today). Keyboard: arrows move between the plans, focus is visible.
3. `::selection` has Ruken's colours (on felt and on paper); `:autofill` fields keep the paper colour and ink words; `::placeholder` uses a look token; the websites box (`.screen textarea.answer`) has `resize: none` and grows with its lines (`field-sizing: content`), and in a browser without `field-sizing` it keeps its height and scrolls.
4. `tests/browser/own-look.test.ts` reads each of these computed values on phone (WebKit), tablet and computer; each fails on `main`'s look before the change.

### 3.C Pick lists

1. The country (sign-in, sign-up and forgot password, the three users of `phone-fields.svelte`) and the branch (`FilesQuestion.svelte`) are a field-shaped button showing the current choice, labelled as the `<select>` is today (`getByLabel("Country")`, `getByLabel("Branch")` still find it). Pressing it opens Ruken's list: paper choice cards (the `.picks` look), the current one marked, in a frosted-glass sheet from the bottom on a phone and a pop-over on a computer.
2. Picking closes the list and sets the value the form sends (a hidden input with the same `name`), so the server and its tests do not change.
3. Keys: Enter or Space opens; arrows move; typing a letter jumps to the first choice starting with it; Enter picks; Escape closes without changing. `role="listbox"` and `role="option"` with `aria-selected`.
4. Without script the native `<select>` is used. A choice made in the native list before the script starts is kept when Ruken's list takes its place.
5. Journeys: sign-up with a non-default country, sign-in, and changing a game's branch, on phone (WebKit), tablet and computer, all CRUD paths that already pick a country or branch pass unchanged.

### 3.D For every unit

- `pnpm lint`, `pnpm typecheck`, `pnpm test` exit 0; the journeys the unit reaches pass on all three devices.
- Run through `verify` like a person; screens changed are shot on phone, tablet and computer and go through the design loop (`visual-check`: round 1 Fable 5.2 medium, rounds 2 and 3 Opus 5.5 medium) before the owner's look, on one screens page.
- No new dependency. All words pass the drunk-grandma test.

## 4. Boundaries

- No new package, tool, environment or spend. Expected duration: A about 3 hours of session time with its review, B about 1 hour, C about 2 hours.
- The feed (`Feed.svelte`) and the bottom bar are not touched here.
- What a web page cannot change (audit "Kept as the system's") is not attempted.

## 5. Open decisions

None for the owner. The owner can overrule any **Call**, including the kept list.

## 6. Plan

- [ ] 1. Spec merged (this file).
- [ ] 2. Unit A built on its own branch from `main` after #321 merges; review; fixes; merge.
- [ ] 3. Unit B built after #323 merges; review; fixes; merge.
- [ ] 4. Unit C built after B merges; review; fixes; merge.
- [ ] 5. One screens page for the owner with A, B and C's screens after the design loop.
