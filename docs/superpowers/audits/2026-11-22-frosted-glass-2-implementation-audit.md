# Frosted glass: implementation audit 2

- Pull request: #321, branch `claude/project-thread-b1h8tt`
- Commit examined: `be5b179`
- Lane 2 (`src/lib/look.css`): re-review after audit 1 (`5078375`, at `77c71cd`, FAIL 1 red)
- Reviewer: fresh session, Opus 5.5, medium
- Written: 2026-11-22 14:38 UTC

**Verdict: FAIL, 1 red, 4 notes.** Audit 1's red is fixed: all six of its rules now fail the guard, the real `src/` passes, and nothing but `tests/lib/glass.test.ts` changed. New variants show the guard still lets two common ways of writing see-through through: the newer colour functions with an alpha, and `background-image`, which is how a dark gradient over a video is usually written.

## What was checked

| Check | How | Result |
| --- | --- | --- |
| Nothing else changed | `git diff --name-only 5078375 be5b179` | Only `tests/lib/glass.test.ts`. |
| Unit tests | `npx vitest run tests/lib/glass.test.ts tests/lib/look.test.ts` at `be5b179` | 2 files, 161 passed. |
| The guard's own cases | Read the two `it.each` tables | 13 "catches" and 10 "leaves alone", as the builder said. |
| Audit 1's six rules | Each appended alone to `src/lib/look.css`, `glass.test.ts` run | All six fail the test (caught). |
| New variants | 23 more rules, each appended alone the same way | 10 caught, 13 missed (table below). |
| No false positives on loading | Read `look.css` 3105-3225 (`.page-loading`, `.spinner`, busy button, `media-loading`) and ran the suite | None flagged: their backgrounds are solid tokens, and the spinner's `border-right-color: transparent` is not a background. |
| Anything else that would stop these | `package.json` lint is ESLint + Prettier only; no Stylelint | Nothing else catches the missed forms. No `oklch`/`lab`/`hwb`/`color(` or `background-image` in `src/` today. |

New variants, each appended alone:

| Rule | Result |
| --- | --- |
| `.n01 { background: #00000080 !important; }` | caught |
| `.n02 { BACKGROUND: RGBA(0,0,0,.5); }` | missed |
| `.n03 { background: oklch(0 0 0 / 0.5); }` | missed |
| `.n04 { background: lab(0 0 0 / 50%); }` | missed |
| `.n05 { background: hwb(0 0% 100% / 0.5); }` | missed |
| `.n06 { background: color(srgb 0 0 0 / 0.5); }` | missed |
| `.n07 { background-image: linear-gradient(rgb(0 0 0 / 0.5), rgb(0 0 0 / 0.5)); }` | missed |
| `.n08 { background: linear-gradient(#0008, #0008); }` | caught |
| `.n09 { background: var(--felt-deep); opacity: 80% !important; }` | missed |
| `.n10 { background: var(--felt-deep); opacity: 0.8 !important; }` | caught |
| `.n11 { background: var(--felt-deep); opacity: 1; opacity: 0.5; }` | missed |
| `.n12 { background: var(--felt-deep); opacity: calc(0.5); }` | missed |
| `.n13 { background: var(--felt-deep); opacity: var(--half); }` | missed |
| `.n14 { background: var(--felt-deep); filter: opacity(.6); }` | caught |
| `.n15 { background: var(--felt-deep); filter: none; filter: opacity(0.6); }` | missed |
| `.n16 { background:var(--felt-deep);opacity:.5 }` | caught |
| `.n17 { background: color-mix(in oklab, var(--ink) 40%, rgb(0 0 0 / 0)); }` | caught |
| `.n18 { background: rgb(0 0 0 / .5) }` | caught |
| `.n19 { background: hsl(0deg 0% 0% / 0.5); }` | caught |
| `.n20 { background: var(--felt-deep) url(x.png); opacity: 0.7; }` | caught |
| `.n21 { background-color: transparent; background: rgb(17 19 20 / 0.5); }` | caught |
| `.n22 { background: #FFFFFF80; }` | caught |
| `.n23 { background: var(--felt-deep); filter: OPACITY(0.5); }` | missed |

Not run here: the browser journeys and WebKit; CI runs them. `look.css` was restored after each try (`git status` clean).

## Red

### 1. The guard misses newer colour functions with an alpha, and `background-image`

- UNIT: `tests/lib/glass.test.ts`, `SEE_THROUGH_COLOUR` and the `backgrounds` match in `seeThrough`.
- VERDICT: red.
- REQUIREMENT: the PR's acceptance criterion 1 ("no CSS rule in `src/` mixes a see-through colour of its own"), with this test as its evidence; audit 1's red ("misses other see-through notations"); the owner's standing rule (2026-11-22, "whenever we use transparency"), which this test keeps true for future screens.
- REASON: `SEE_THROUGH_COLOUR` knows only `rgb`/`hsl` with a slash, and the declaration match reads only `background` and `background-color`.
- EVIDENCE: `.n03` to `.n07` above, each appended alone to `src/lib/look.css` at `be5b179`, leave `glass.test.ts` green. A dark gradient over a clip (`.n07`) is the likeliest way a future feed screen writes a scrim.
- EXPECTED: each of `.n03`, `.n04`, `.n05`, `.n06` and `.n07` fails the test; the real `src/` still passes; the 10 "leaves alone" cases stay null.
- FIX: in `tests/lib/glass.test.ts` only: widen the slash form to every colour function that takes one (`(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\([^)]*\/`) and read `background-image` too (`background(?:-color|-image)?`). Add `.n03` to `.n07`'s bodies to the "catches" table.

## Notes (not blocking, not fixed here)

1. **`!important` on a percentage.** `opacity: 80% !important` (`.n09`) is missed because `isPartial` checks `endsWith("%")` before stripping `!important`; `0.8 !important` is caught. Dropping `!important` from the value first would close it.
2. **A second `opacity` or `filter` declaration** (`.n11`, `.n15`) is missed, since both are read with `exec` (first only). Audit 1 asked for every `background` declaration; the same `matchAll` would cover these.
3. **Upper case** (`.n02`, `.n23`) is missed: property names and `opacity(` are matched in lower case only. Prettier does not lower-case these, so a case-insensitive flag on those matches would close it.
4. **`calc()` and `var()` opacity** (`.n12`, `.n13`) cannot be judged as text; reasonable to leave.

## Re-check

After the fix, at the new head: `npx vitest run tests/lib/glass.test.ts` passes, and with each of `.n03` to `.n07` appended alone to `src/lib/look.css` it fails. Audit 1's six rules must still fail it.
