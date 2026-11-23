# Landing page (/about), lane 2 code review, cycle 3

- PR: #333, branch `claude/project-thread-2vpwcj`
- Commit examined: `58480bab8c161f1b243d6898a78a1a869e5a4e12` (58480ba), main merged in at 8f0ecac
- Reviewer: fresh session, Opus 5.5, medium. Review written 2026-11-22 21:55 UTC.
- Scope: the code. The owner approved the look at 21:38 UTC, so the design is not reviewed here.

## Verdict

**FAIL: 1 red, 5 notes.** One red: the page's `@keyframes drift` replaces the maker backdrop's `drift` on other pages.

## What ran

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | ok |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors. A first run failed with 10,004 errors in `.svelte-kit/cloudflare/_worker.js`, a leftover of my own `pnpm build` in this container. The run after removing it passed. |
| `pnpm test` | 136 files, 1,985 tests passed |
| `pnpm build` | exit 0 |
| Bundle split (Vite manifest + grep of `.svelte-kit/output/client`) | `ScrollTrigger` and `lenis-smooth` appear only in `nodes/5.f_hiosR3.js`, which is `src/routes/about/+page.svelte`. That chunk is 145,992 B raw and 54,225 B gzip. No other node imports it. |
| Keyframe probe (Playwright, Chromium; the script is under "Evidence for R1") | see R1 |
| Browser journeys (`pnpm test:browser`) | not run here. CI was running them on 58480ba at review time. |

## Red

### R1. `@keyframes drift` on /about replaces the maker backdrop's drift app-wide

- UNIT: `src/lib/look.css`, the landing page block, about line 3369 (`@keyframes drift { to { transform: translateY(-10%); } }`).
- VERDICT: red.
- REQUIREMENT: the coordinator's brief for this review says the landing page's styles must not leak to other pages. The page's styles are meant to sit under `.about` / `html:has(main.about)` (PR body, "What changes").
- REASON: `look.css` already has a `@keyframes drift` at about line 2413 (`translate(12vw, -8vh)`). The maker game backdrop uses it (`[data-drifting] .drift`, `src/routes/make/parts/GameBackdrop.svelte:24-30`). In CSS, the last `@keyframes` with a given name wins for the whole document. So the /about rule changes the maker screens' drift on every page, not only on /about. The branch already had both before the main merge (`git show 8f0ecac^1:src/lib/look.css | grep -c "keyframes drift"` gives 2), so the merge did not cause this.
- EVIDENCE: a probe loads each `look.css` with `<div data-drifting><i class="drift">` and reads `getAnimations()[0].effect.getKeyframes()`:
  - `origin/main`: `drift` → `translate(153.6px, -57.6px)`, the diagonal (12vw, -8vh).
  - PR head 58480ba: `drift` → `translateY(-10%)`, the landing page's vertical drift.
- EXPECTED: the maker backdrop keeps main's diagonal drift, and the /about wall keeps its own vertical drift.
- FIX: rename the landing page's keyframes, for example `@keyframes wall-drift`, and its one use in `.about .wall .column`. Add a check to `tests/lib/look.test.ts` that fails when `look.css` declares the same `@keyframes` name twice. Files: `src/lib/look.css`, `tests/lib/look.test.ts`.

#### Evidence for R1: the probe

```js
// node p.cjs <look.css>
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.setContent(`<style>${fs.readFileSync(process.argv[2],'utf8')}</style><div data-drifting><i class="drift" style="display:block;width:10px;height:10px"></i></div>`);
console.log(JSON.stringify(await p.evaluate(()=>document.querySelector('.drift').getAnimations().map(a=>[a.animationName,a.effect.getKeyframes().map(k=>k.transform)]))));await b.close();})();
```

## The focus areas, checked

- **gsap 3.15.1 and lenis 1.3.27.**
  - Licences:
    - `lenis` is MIT.
    - `gsap` is under GSAP's "Standard 'no charge' license" (`node_modules/gsap/package.json`). It is free for commercial use but is not an OSI open-source licence; see N1.
  - Versions are pinned exactly in `package.json` and match the lockfile.
  - Both load only on /about (bundle row above). That route's chunk is 54 KB gzip, almost all of it these two libraries.
- **`motion.ts`, leave and arrive.**
  - Cleanup:
    - `startMotion` returns a stop function that reverts the `gsap.context`, which kills its tweens and ScrollTriggers.
    - It removes the ticker callback and destroys Lenis, which removes the `lenis*` classes from `html`.
    - `onMount` calls the stop function together with `watcher.disconnect()`.
  - `leave` tweens only `page`, which is destroyed right after, so nothing is left behind.
  - SvelteKit 3.0.0 (`client.js` 3187-3229 and the popstate `shallow` branch) treats a hash link (`#players`, `#makers`) as a browser hash change. It runs neither `onNavigate` nor `afterNavigate`, so in-page links do not fade the page.
  - `onNavigate` skips a target of `/about`.
  - Reduced motion: every entry point returns early, and all CSS motion (`drift`, `glow-drift`, `swipe-up`, the `.tofeed` slide) sits under `prefers-reduced-motion: no-preference`.
  - Only the leak in N2 was found.
- **Cursor and scrollbar.** Every cursor and scrollbar rule starts with `html:has(main.about)`. The Lenis rules are gated by the `lenis` class, which only exists while Lenis runs. Nothing reaches other pages.
- **`playOnScreen`.**
  - Each clip has its own IntersectionObserver, disconnected in `destroy`.
  - A clip plays only while on screen and is never fetched before that (`preload="none"`).
  - Where nothing may move (`mayMove()`), it shows its first frame and has no observer.
  - A refused `play()` is caught.
  - `clipStep` has unit tests.
- **The corner button with `inert`.**
  - While the first screen is in view, the button is moved off screen (`data-away`) and is `inert`, so it gets no focus and no screen reader announcement.
  - Once the first screen has gone by, both are removed. Svelte 5 drops the `inert` attribute when its value is `false`.
  - It has `aria-label` and `title` "Back to the feed", a 3.5 rem target and the global `:focus-visible` ring.
  - One small note, N3.
- **Owner rules on /about.**
  - No `<style>` block, no "Loading…" text.
  - No underlined links: `.ways a`, `.more`, `.news a` and `.sitefoot a` all set `text-decoration: none`, and the buttons are buttons.
  - No see-through surface outside the glass tokens: the closing cards' `.glow` is a decorative picture with `filter: blur() brightness()`, not a see-through surface.
  - The underlined links on other pages are N4.
- **PR body.** It has `## Lane` (lane 2), and its last line is `Requested by **McThayDT**`.
- **CRUD.** The page makes nothing a person can save, so no create, update or delete journey is owed.

## Notes (not blocking, not fixed here)

- **N1. GSAP licence.** GSAP's Standard licence is free, including for commercial use. It forbids using GSAP in a product that competes with Webflow's visual animation tools, which Ruken is not. It is not open source, so the public repo's FSL code depends on a non-OSI package. This is recorded for the owner's awareness. The owner named GSAP, so nothing changes here.
- **N2. `gsap.ticker.lagSmoothing(0)`** in `startMotion` is global and is not put back by the stop function. Today nothing else uses GSAP, so it has no effect. If GSAP is used elsewhere later, the stop function should restore `lagSmoothing(500, 33)`.
- **N3. The corner button's observer** reads only the first entry (`([entry])`). When it gets several entries in one callback, the last one is the current state. Fast scrolling past the first screen could, rarely, leave the button in the wrong state until the next crossing. Reading `entries.at(-1)` fixes it.
- **N4. "What is Ruken?"** on `/join`, `/sign-in`, `/me` and `/help` is a plain `<a>`, underlined by the global `a { text-decoration: underline }`. That goes against the owner's 18:04 UTC rule "no underlined text links anywhere". It is not red here, because it matches the other links on those screens, and the owner's 21:42 UTC plan merges the app-wide fix (#345) last so it covers new pages. #345 must include these four links when it resumes.
- **N5. Reduced motion** is read once when the page mounts. A person who changes the setting while on /about gets the change on the next visit. This is acceptable, recorded only.
