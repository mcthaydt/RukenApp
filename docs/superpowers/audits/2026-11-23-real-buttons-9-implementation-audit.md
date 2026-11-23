# Real buttons (#345), round 9 re-check

Head reviewed: 8ca99dff8d997eb256234898f4a4ce0ad12d7fb5 (diff from f08e9da: `.links` → `.sidelinks`, `.who` → `.badged`).
Reviewer: fresh lane 2 review, Opus 5.5, medium. Written 2026-11-23 22:46 UTC.

## Verdict

8ca99df FAIL: 1 red.

## What was checked

1. **Rename complete.** `src/lib/look.css` has no `.links` or `.who` rule left from this PR. The only remaining uses are main's own: `MakerPage.svelte:38` `<header class="who">`, `:88` `<nav class="links">`, `about/+page.svelte:113` `<p class="links">`, and look.css's `.about .links` / `.about .pair .links`. `/me` uses `badged` and `sidelinks apart`. Tests (look-layout, membership, rejoin, `tests/lib/look.test.ts`) follow. Pass.
2. **No other new global class collides.** Class selectors new in head versus main: `.badge .badged .go .icon .member .sidelinks`. A grep of `src/` finds no use of any of them outside this PR's own markup. The global `.ways` rule meets `/about`'s `nav.ways` and adds `align-items: center` there, with no visible change (measured below). Pass.
3. **Maker page and landing page look unchanged.** Method: build head, record the computed styles of every element in `main`, `footer` and `nav` on a maker page and on `/about` (computer and tablet projects), then rebuild with main's `look.css` swapped in and diff.
   - Maker page: 0 differences on both projects. Pass.
   - `/about`: `nav.ways` align-items normal → center (no box moved). **Every footer column link** (`.about .sitefoot li > a`) went from `font-weight: 400` to `600`, widening each by 2–5px and shifting the columns by up to 5px. Red, below.

## Red 1: the landing page footer links turned bold

- **What is wrong:** the PR's global rule `:is(p, li, small, span, dd, td, q, label) > a:not([class]) { font-weight: 600; }` (`src/lib/look.css:294`) reaches the landing page footer's plain links, which have no class. The footer was ruled to stay plain navigation, and the brief for this head says the landing page looks unchanged.
- **Evidence:** computed-style diff of `/about` on the computer project, head look.css versus main look.css: elements 150, 152, 154, 159, 161, 163, 168, 170 (the footer column links) `fw: 400 → 600`, e.g. width 125 → 129, x 376 → 371.
- **Expected:** footer links keep weight 400, as on main.
- **Bounded fix:** add `font-weight: 400;` to the existing `.about .sitefoot a` rule (`src/lib/look.css:4430`; specificity 0,2,1 beats the global rule's 0,1,2), plus one assertion in a journey that an `/about` footer link's computed `font-weight` is `400`.

## feed-controls:832 on phone

No styling change in this PR plausibly breaks it directly: the PR touches no feed file, no feed element carries any of the new classes, and the feed's links all have classes, so the `a:not([class])` rules do not reach them.

The failure (`clips.nth(before)` keeps `data-current="false"`, line 856; CI shard 3 at f08e9da, job 138058182502, and earlier at 2126888) reads as a race between the test and `Feed.svelte`'s `loadMore`: the test releases the held page as soon as the spinner is visible, but `loadMore` only scrolls to the new clip when `waiting = current >= had` is true, and `current` is only set once the IntersectionObserver sees the spinner screen at ratio ≥ 0.6. If the page lands before that observer callback, there is no scroll and the old clip stays current.

The one branch-only thing that could shift that timing in WebKit is the unscoped `:is(button, .button, .quiet, a):has(> .icon:only-child)` rule (`src/lib/look.css:746`): WebKit re-checks `:has()` on DOM changes across the page, which can delay the observer callback on a slow phone run. Confidence is low. Experiment: scope that rule (for example to the elements that carry `.icon`), rerun the phone piece; separately, the test should wait for the spinner screen to be current before `release()`, which removes the race either way. Not run here: this container has no WebKit (no docker daemon; `playwright install` not allowed).

## Not run

Phone (WebKit) journeys, for the reason above. Typecheck 0 errors after clearing stale `.svelte-kit` output.
