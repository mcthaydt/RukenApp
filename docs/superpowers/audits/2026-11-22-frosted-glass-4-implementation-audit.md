# Frosted glass: implementation audit 4

- Pull request: #321, branch `claude/project-thread-b1h8tt`
- Commit examined: `70f7602` (fix for audit 3's red, on `5e0d2b1`)
- Lane 2 (`src/lib/look.css`): re-review after audit 3 (`5e0d2b1`, at `9b17a3c`, FAIL 1 red)
- Reviewer: fresh session, Opus 5.5, medium
- Written: 2026-11-22 15:09 UTC

**Verdict: PASS, 0 red, 2 notes.** Audit 3's red is fixed with the audit's two regexes as written. `.f07` to `.f10` each fail the guard alone, all earlier problem rules still fail alone, the real `src/` passes, and every "leaves alone" case stays clean. Audit 3's note 1 (`.l07`, `calc()` with a division) is fixed too, as a side effect of the nested-bracket step. What is left is edge syntax nothing in `src/` writes.

## What was checked

| Check | How | Result |
| --- | --- | --- |
| The fix touches only the test | `git show --stat 70f7602` | Only `tests/lib/glass.test.ts` (10 in, 1 out): the two regex changes audit 3 named, 4 more "catches" cases (`.f07` to `.f10`), 5 more "leaves alone" cases (`.l01`, `.l04`, `.l06`, `.l08`, `.l09`). |
| Unit tests | `pnpm exec vitest run tests/lib/glass.test.ts tests/lib/look.test.ts` at `70f7602` | 2 files, 179 passed. |
| Lint on the changed test | `eslint` and `prettier --check` on `tests/lib/glass.test.ts` | Clean. |
| 45 rules, each appended alone | Each rule appended to `src/lib/look.css`, `vitest run tests/lib/glass.test.ts -t "gives no surface"`, file restored (`git status` clean after) | Every result as expected; table below. |
| Regex cost | Read the new slash form `\((?:[^()]\|\([^()]*\))*\/` | The two alternatives start on different characters, so no runaway backtracking; it cannot step past the colour's own closing bracket, so `rgb(0 0 0) center / cover` is not read as an alpha (`.k06`). |

CI for `70f7602` was queued or running when this was written (verify in progress; postgres, browser shards, commit-authors, pr-rules queued); not judged here.

Each rule appended alone (C = should be caught, L = should be left alone; every "Got" matched):

| Rules | Expected | Got |
| --- | --- | --- |
| Audit 1's six (`.m2` to `.m7`) | C | C |
| Audit 2's `.n03` to `.n07` | C | C |
| Audit 3's `.f01` to `.f12`, including the four it missed (`.f07` to `.f10`) | C | C |
| `.g01 { background: linear-gradient(to bottom, transparent 60%, var(--felt-deep)); }` | C | C |
| `.g02 { background: repeating-linear-gradient(45deg, transparent, var(--felt-deep) 4px); }` | C | C |
| `.g03 { background: conic-gradient(from 0deg, transparent, var(--ink)); }` | C | C |
| `.g04 { background: radial-gradient(circle at 50% 50%, transparent, var(--felt-deep) 70%); }` | C | C |
| `.g05 { background: linear-gradient(to top, var(--felt-deep) 0%, rgb(from var(--felt-deep) r g b / 0) 100%); }` | C | C |
| `.g06 { background-color: color-mix(in oklab, var(--felt-deep), transparent 30%); }` | C | C |
| `.g07 { background: linear-gradient(to top, var(--felt-deep), oklch(from var(--felt-deep) l c h / 0)); }` | C | C |
| Audit 3's `.l01` to `.l09`, `.l07` included | L | L (`.l07` no longer a false positive) |
| `.k01 { background: transparent; }` | L | L |
| `.k02 { background-color: transparent; border-color: transparent; }` | L | L |
| `.k03 { background: oklch(from var(--felt-deep) calc(l + 0.1) c h); }` | L | L |
| `.k04 { background: var(--felt-deep) url(x.png) center / 40px 40px no-repeat; }` | L | L |
| `.k05 { background: linear-gradient(var(--felt), var(--felt-deep)) center / cover, var(--felt-deep); }` | L | L |
| `.k06 { background: url(a.png) 0 0 / 10px, linear-gradient(rgb(0 0 0), rgb(10 10 10)); }` | L | L |

## Red

None.

## Notes (not blocking, not fixed here)

1. **Inline styles are not read.** The guard reads only `{ … }` rule bodies, so a `style="background: rgba(…)"` attribute or a `style:background-color={…}` directive in a `.svelte` file is not checked. Today `src/` has no inline see-through background: the only inline background is `MakerPage.svelte:52`'s colour dot, set from a maker's chosen colour. Worth adding only if inline styles become a habit.
2. Audit 2's notes 1 to 4 (`!important` on a percentage opacity, a second `opacity`/`filter` declaration, upper-case property names and `OPACITY(`, `calc()`/`var()` opacity) are still open as recorded there. None appears in `src/`; each is an unusual way of writing CSS that this codebase does not use.

## Re-check

None needed for a PASS. A later push that changes `tests/lib/glass.test.ts` or the glass rules in `src/lib/look.css` makes this audit stale.
