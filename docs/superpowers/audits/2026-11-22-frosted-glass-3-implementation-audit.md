# Frosted glass: implementation audit 3

- Pull request: #321, branch `claude/project-thread-b1h8tt`
- Commit examined: `9b17a3c` (fix `4fd0d29`, then a merge of `main` at `bb33e0b`)
- Lane 2 (`src/lib/look.css`): re-review after audit 2 (`4661808`, at `be5b179`, FAIL 1 red)
- Reviewer: fresh session, Opus 5.5, medium
- Written: 2026-11-22 15:00 UTC

**Verdict: FAIL, 1 red, 3 notes.** Audit 2's red is fixed: `.n03` to `.n07` and audit 1's six rules each fail the guard alone, the real `src/` passes, the 10 "leaves alone" cases still pass, and the merge brings only `main`'s changes. The loading spinner and shimmer are not flagged. One red remains, in the same family as audit 2's: a gradient that fades to `transparent`, which is the usual way a scrim over a clip is written, still passes the guard.

## What was checked

| Check | How | Result |
| --- | --- | --- |
| The fix touches only the test | `git show --stat 4fd0d29` | Only `tests/lib/glass.test.ts` (8 in, 3 out): the regex widening, `background-image`, five new cases. Matches audit 2's FIX. |
| Unit tests | `pnpm exec vitest run tests/lib/glass.test.ts tests/lib/look.test.ts` at `9b17a3c` | 2 files, 170 passed. |
| Lint on the changed test | `eslint` and `prettier --check` on `tests/lib/glass.test.ts` | Clean. |
| The merge brings only `main` | `git diff <merge-base> 4fd0d29` against `git diff bb33e0b 9b17a3c`, without `progress.md` | Identical apart from hunk line numbers and blob ids. |
| The `progress.md` conflict | `git show --cc 9b17a3c` | Both owner lines kept, in time order (13:46 frosted glass, then 13:50 CLI). Nothing else in the file changed. |
| Audit 1's six rules and `.n03` to `.n07` | Each appended alone to `src/lib/look.css`, `glass.test.ts` run | All 11 fail the test (caught). |
| Fresh variants | 21 more rules, each appended alone the same way | Table below: 4 see-through rules missed, 1 solid rule wrongly flagged. |
| No false positives on loading | Read `look.css` 3122-3235 (`.page-loading`, `.page-loading-spinner`, `.spinner`, busy button, `img/video[data-loading]` shimmer and its reduced-motion `background-image: var(--spinner-still)`); ran the suite; appended their exact background forms alone (`.l05`, `.l06`) | Not flagged. The shimmer's `background: var(--spinner-turning) center / min(40px, 50%) …` has a slash but no colour function; the newly read `background-image` is a token. |

`look.css` was restored after every try (`git status` clean). CI for `9b17a3c` was still running when this was written (commit-authors, pr-rules, postgres and two browser shards green); not judged here.

Fresh variants, each appended alone (C = should be caught, L = should be left alone):

| Rule | Expected | Got |
| --- | --- | --- |
| `.f01 { background: oklab(0 0 0 / .5); }` | C | C |
| `.f02 { background: lch(0 0 0 / 0.5); }` | C | C |
| `.f03 { background-color: color(display-p3 0 0 0 / 50%); }` | C | C |
| `.f04 { background: OKLCH(0 0 0 / 0.5); }` | C | C |
| `.f05 { background-image: radial-gradient(circle, oklch(0 0 0 / 0.6), oklch(0 0 0 / 0)); }` | C | C |
| `.f06 { background: var(--felt-deep); background-image: linear-gradient(lab(0 0 0 / .4), lab(0 0 0 / .4)); }` | C | C |
| `.f07 { background: linear-gradient(to top, var(--felt-deep), transparent); }` | C | **L (missed)** |
| `.f08 { background-image: linear-gradient(transparent, var(--felt-deep)); }` | C | **L (missed)** |
| `.f09 { background-color: oklch(from var(--felt-deep) l c h / 0.5); }` | C | **L (missed)** |
| `.f10 { background: rgb(from var(--felt-deep) r g b / 50%); }` | C | **L (missed)** |
| `.f11 { background-image: linear-gradient(#0000, #000); }` | C | C |
| `.f12 { background: hsl(0 0% 0% / calc(0.5)); }` | C | C |
| `.l01 { background: oklch(0.2 0.01 200); }` | L | L |
| `.l02 { background: lab(10 0 0); }` | L | L |
| `.l03 { background: color(srgb 0 0 0); }` | L | L |
| `.l04 { background-image: url(/images/felt.png); }` | L | L |
| `.l05 { background-image: var(--spinner-still); }` | L | L |
| `.l06 { background: var(--spinner-turning) center / min(40px, 50%) no-repeat var(--felt-raised); }` | L | L |
| `.l07 { background: rgb(calc(255 / 2) 0 0); }` | L | **C (false positive)** |
| `.l08 { background-image: linear-gradient(var(--felt), var(--felt-deep)); }` | L | L |
| `.l09 { background: url("/a/b.png") center / cover; }` | L | L |

## Red

### 1. A gradient that fades to `transparent`, and a relative colour with an alpha, pass the guard

- UNIT: `tests/lib/glass.test.ts`, `SEE_THROUGH_COLOUR`.
- VERDICT: red.
- REQUIREMENT: the PR's acceptance criterion 1 ("no CSS rule in `src/` mixes a see-through colour of its own"), with this test as its evidence; audit 2's red, whose stated reason was that a scrim over a clip is the likeliest future see-through surface; the owner's standing rule (2026-11-22 13:46 UTC, "whenever we use transparency").
- REASON: `transparent` is only recognised inside `color-mix(`, so `linear-gradient(…, transparent)` (the common scrim) is not seen; and the slash form's `[^)]*` stops at the first `)`, so a relative colour (`oklch(from var(--x) l c h / 0.5)`) never reaches its slash.
- EVIDENCE: `.f07`, `.f08`, `.f09`, `.f10` above, each appended alone to `src/lib/look.css` at `9b17a3c`, leave `glass.test.ts` green.
- EXPECTED: each of `.f07` to `.f10` fails the test; the real `src/` still passes (no `transparent` gradient or `from` colour in `src/` today); the 10 "leaves alone" cases stay null, and `background: transparent;` alone stays null.
- FIX (both regexes checked in node by this audit against `.f07` to `.f10` and the leave-alone values, including the shimmer's): in `tests/lib/glass.test.ts` only: in `SEE_THROUGH_COLOUR`, widen `color-mix\([^;]*\btransparent\b` to any colour-taking function, for example `(?:color-mix|-gradient)\([^;]*\btransparent\b`; and let the slash form step over one level of nested brackets, for example `(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\/`. Add `.f07` to `.f10`'s bodies to the "catches" table.

## Notes (not blocking, not fixed here)

1. **`calc()` with a division** inside a colour (`.l07`, `rgb(calc(255 / 2) 0 0)`) is wrongly flagged. It fails loud, never silent, and nothing in `src/` writes it; leave it unless the fix above changes it.
2. Audit 2's notes 1 to 3 (`80% !important`, a second `opacity`/`filter` declaration, upper-case property names and `OPACITY(`) are still open, as recorded there.
3. Audit 2's note 4 (`calc()` and `var()` opacity) still stands as reasonable to leave.

## Re-check

After the fix, at the new head: `pnpm exec vitest run tests/lib/glass.test.ts` passes, and with each of `.f07` to `.f10` appended alone to `src/lib/look.css` it fails. Audit 1's six rules, `.n03` to `.n07`, and `.l01` to `.l06`, `.l08`, `.l09` must keep their results above.
