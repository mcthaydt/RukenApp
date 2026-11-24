# Hide the scrollbar inside the app: implementation audit 1

Pull request #376, head `85cfce21c7b104439bb5d7db422258c785001434` (base `main` 9a92d0e). Lane 2 (`src/lib/look.css`).
Reviewer: fresh session, Opus 5.5, medium.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**85cfce2 PASS.** No red findings; three notes below.

## What was checked

| # | Criterion (PR body) | How | Result |
|---|---|---|---|
| 1 | No element draws a bar on any screen but `/about`; page bar takes no room | Read the rule: `:root:not(:has(main.about))` and every descendant get `scrollbar-width: none`. Only `/about` renders `main.about` (`grep`: `src/routes/about/+page.svelte:51`), and no other rule in `src/` sets `scrollbar-width` or `::-webkit-scrollbar` outside `/about`'s own block, so nothing outranks it. Probe in Chromium with the real `look.css` (below): `html` and an inner `overflow-y: auto` box both compute `none` with the change, `auto` on `main`. | PASS |
| 2 | Safari before 18.2 covered | `::-webkit-scrollbar { display: none }` on the root and every descendant, under the same `:not(:has(main.about))`. | PASS (read) |
| 3 | Screens still scroll | Probe: an inner scroll box with no bar still scrolls 300px on the wheel. Journey checks End/Home on phone and wheel on tablet/computer. Only `scrollbar-width`/`display` of the bar change; no `overflow` changed. | PASS |
| 4 | `/about` keeps its thin green bar | Probe: on a page with `main.about`, `html` computes `thin`, inner boxes `auto`. Switching `main.about` to another class live (client-side move) flips `html` to `none` at once, since `:has()` is live. | PASS |
| 5 | Phone (WebKit), tablet, computer pass the journey | CI quick run 45294396716 on `85cfce2`: the browser pieces run with `--only-changed=origin/main`, so the only journey file they ran is `scrollbar.test.ts`, once per device profile (pieces 1, 2 and 4 ran journeys; 3, 5 and 6 had none). All six pieces passed, so the phone profile (iPhone SE, WebKit) passed it. `postgres` passed; `verify` was still running at the time of this audit. | PASS |
| - | Test fails on `main` | On `main`'s `look.css` the probe gives `scrollbar-width: auto` on `html` and inner boxes, so `withABar` is non-empty and the first assertion fails (implementer measured 221 elements). | PASS |
| - | CRUD | Nothing a user makes is added or touched. | n/a |
| - | No existing test, golden or `verify` step changed | `git diff --stat main...85cfce2`: only `src/lib/look.css` and the new journey. | PASS |

Probe: a page built from the real `src/lib/look.css` (head) and from `main`'s copy, in Playwright 1.63 Chromium, 800x600:

```
PR:   app   {"html":"none","innerSW":"none","innerScrolled":300}
      about {"html":"thin","innerSW":"auto","innerScrolled":300}
      about->app live [ 'none', 0 ]
MAIN: app   {"html":"auto","innerSW":"auto","innerScrolled":300}
      about {"html":"thin","innerSW":"auto","innerScrolled":300}
```

## Red findings

None.

## Notes (not blocking, not fixed here)

- UNIT: `tests/browser/scrollbar.test.ts:32`. VERDICT: note. REASON: the "bar takes no room" check (`innerWidth - clientWidth === 0`) also holds on `main` in headless Chromium (probe: gutter 0 on `main` too, overlay bars), so it does not by itself catch a regression there. The `scrollbar-width` check above it does. EXPECTED: nothing to change unless a later run shows a classic-bar engine.
- UNIT: `src/lib/look.css` (maker agreement, ~line 1966; play menu, ~line 4235). VERDICT: note. REASON: these inner boxes scroll with no visible bar now, so on a computer with a mouse nothing shows they scroll. That is what the owner asked for ("scrollbar is for landing page only"); recorded only so a later screens look can check the agreement still reads as scrollable.
- Browsers without `:has()` (Firefox before 121) drop the whole rule and show bars as before; graceful.
