# Frosted glass: implementation audit 1

- Pull request: #321, branch `claude/project-thread-b1h8tt`
- Commit examined: `77c71cd`
- Lane 2 (`src/lib/look.css`): one fresh review after the build
- Reviewer: fresh session, Opus 5.5, medium
- Written: 2026-11-22 14:15 UTC

**Verdict: FAIL, 1 red, 4 notes.** The glass itself is right and renders; the guard test that is meant to keep the owner's standing rule true lets six kinds of see-through colour through.

## What was checked

| Check | How | Result |
| --- | --- | --- |
| Fidelity to the source | Read `mcthaydt/AutomataFrameworkEditors` `src/features/ui/ui.css` at `f7f68f7` lines 104-243 | `--glass-filter` is the source's `--glass-2-filter` exactly (`blur(24px) brightness(0.29) saturate(1.3)`); `--glass-bg` keeps its 0.12 alpha with Ruken's darkest felt (17 19 20) in place of the source's 30 30 30. The three fallbacks (no backdrop blur, reduced transparency, more contrast) match the source's, minus its `data-glass` switch, which Ruken has no use for. Edge and shine left out on purpose (design 5.8 bans `box-shadow`), said in the body. |
| Blur really draws | Harness page in Chromium with the PR's `look.css` and `Feed.svelte` styles over 4px black/white stripes | Under `.band::before` and `.sound svg` the stripes become a flat `rgb(32 32 32)`, so the blur draws on the pseudo-element inside `isolation: isolate` and on the outer `<svg>`. |
| Contrast over a white clip | Same harness over white | Glass pixel is `rgb(67 67 67)`; chalk `#ffffff` on it is 9.89:1 (needs 4.5). |
| Fallback | Harness with `emulateMedia({ contrast: "more" })` | `.band::before` is `backdrop-filter: none`, `background-color: rgb(17, 19, 20)`. |
| No see-through surface missed | `grep` of `src/**/*.{css,svelte,ts}` for `opacity`, `rgba(`, `hsla(`, `/ 0`, `transparent`, `style="` | Only left: hidden inputs (`opacity: 0`), animations, faded words (`.handle`, `a.foot[data-off]`), Live's drift circles and `.backdrop::after`, and a 14% ink hairline under menu rows. None is a see-through surface over content except `.backdrop::after` (note 3). |
| Unit tests | `npx vitest run tests/lib/glass.test.ts tests/lib/look.test.ts` | 138 passed at `77c71cd`. With `main`'s `src/`, 5 of the 6 glass tests fail, so the test fails by itself. |
| Guard strength | Appended one rule at a time to `look.css`, ran `glass.test.ts` | See red 1. |

Not run here: the full browser journeys and WebKit (this container has no WebKit build); CI runs them.

## Red

### 1. The see-through guard misses six ways of writing see-through

- UNIT: `tests/lib/glass.test.ts`, "gives no surface a see-through colour of its own".
- VERDICT: red.
- REQUIREMENT: the PR's acceptance criterion 1 ("no CSS rule in `src/` mixes a see-through colour of its own or fades a surface with `opacity`", with this test as its evidence), and the owner's standing rule (2026-11-22 13:46 UTC, "whenever we use transparency"), which this test is the only thing keeping true for future screens.
- REASON: the test only knows `rgba(`, `hsla(`, `rgb(… / …)`, `hsl(… / …)`, `color-mix(… transparent`, `opacity: 0.x`, and it reads only the first `background` declaration in a rule.
- EVIDENCE: each rule below, appended alone to `src/lib/look.css` at `77c71cd`, leaves the test green (6 passed):
  - `.m2 { background: #00000080; }`
  - `.m3 { background-color: #0008; }`
  - `.m4 { background: var(--felt-deep); opacity: 80%; }`
  - `.m5 { background: color-mix(in srgb, var(--ink) 50%, #0000); }`
  - `.m6 { background: var(--felt-deep); filter: opacity(0.6); }`
  - `.m7 { color: red; background: var(--felt-deep); background-color: rgb(0 0 0 / 0.4); }` (second background declaration)
  The same check catches `rgb(0 0 0 / 0.5)`, `rgb(0 0 0 / 50%)`, `hsl(0 0% 0% / .5)` and `opacity: 0.5`, so the gap is the forms above, not the idea.
- EXPECTED: each of the six rules above makes the test fail, naming the rule; the real `src/` still passes.
- FIX: in `tests/lib/glass.test.ts` only: check every `background`/`background-color` declaration in a rule (a global match, not `exec`); also count 4- and 8-digit hex colours, `#0000`/any colour with alpha inside `color-mix`, `opacity` written as a percentage below 100%, and `filter: opacity(` below 1, keeping the `NOT_SURFACES` exemption as it is. Add the six rules above as cases the check is shown to reject (for example by running the same matcher over a fixed string), so the guard's strength is itself tested.

## Notes (not blocking, not fixed here)

1. **Layer choice.** The source's own words put bars, panels and cards that stay on screen in its layer 1 (`rgb(30 30 30 / 0.72)`, `blur(16px) brightness(0.45) saturate(1.4)`) and pop-ups in layer 2. Every Ruken surface (feed band, sound mark, game-page name, play tab) gets layer 2. The body says layer 1 was tried and read as a solid dark panel on Ruken's clips, which is a fair reason; worth showing the owner on the screens page so they choose knowingly.
2. **Dims are a blend, not the source's.** The source dims are `rgb(0 0 0 / 0.2)` + `blur(2px)` (layer 2) and `rgb(0 0 0 / 0.4)` + `blur(6px)` (layer 3). Ruken's `--dim-bg` keeps its old 62% darkest felt and borrows the layer-3 blur. Said in the comment in `look.css`; noted so it is a known difference.
3. **Live's backdrop layer.** `.backdrop::after` (darkest felt, `opacity: 0.5`) over Live's already blurred video is exempted as "not a surface". It does what a dim does, and the PR turned the price card's equal dim into `--dim-bg`. Leaving it alone is defensible (the video under it is blurred already); recorded so the rule's owner sees the one exemption.
4. **No-script game page.** With no script, `.heroname` sits under the clip (`position: static`), so the glass is over the page's own felt and `brightness(0.29)` makes a near-black strip there, where before it was 82% felt over felt (almost no change). Small; a `background: var(--felt-deep)` with no filter on that one rule would keep the old look. Also, the "tints with the darkest felt" test carries a copy of the next test's comment ("The worst case is a white clip behind").

## Re-check

After the fix, run `npx vitest run tests/lib/glass.test.ts` at the new head with each of the six rules appended in turn; each must fail, and the plain file must pass.
