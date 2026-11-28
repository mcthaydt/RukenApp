# Branch picker jump, implementation audit 2

Pull request #470 (`claude/project-thread-2yivgp`), head `c10e21d31c993fe7190a7dee1d7975f2c3012a4c`. Lane 2. Fresh review, Opus 5.5, medium. Written 2026-11-28 15:12 UTC (time from `date`).

Audit 1 passed `db01ce8`; that PASS went stale when the full run failed `tests/lib/look.test.ts` (a `<style>` block and a `lookup` class in `FilesQuestion.svelte`, which the look rules forbid). `147b3c3` moved the rules to `src/lib/look.css` as `.note[aria-busy="true"]`, and `c10e21d` merged `main` (#451).

Verdict: **PASS**. No red findings.

## What was checked

| Check | Result | Evidence |
| --- | --- | --- |
| `FilesQuestion.svelte` differs from `main` only by a comment | PASS | `git diff origin/main...c10e21d -- src/`: two comment lines added, no markup or style. |
| The new rule reaches only the branches wait | PASS | `grep -rn aria-busy src`: the one `.note` with `aria-busy` is `FilesQuestion.svelte:190`. Every other `aria-busy` is on a button, form, `main`, `section` or `div`, none with class `note`. No other `.note` rule changed in `look.css` (the diff adds only the two new rules). |
| Unit tests, `look.test.ts` included | PASS | `pnpm test` at `c10e21d`: 170 files, 2456 tests passed (Node 22 in this container; CI's `verify` on Node 24 also green). |
| New journey `loading.test.ts:171` fails on `main`, passes now | PASS | With `main`'s `look.css` and `FilesQuestion.svelte`: 3 of 3 failed (phone 480.45 vs 454.16, tablet 528.05 vs 501.75, computer 540.05 vs 513.75: 26.3 px each). At `c10e21d`: passes on all three. |
| `loading.test.ts`, `make-walk.test.ts`, `make-questions.test.ts` at `c10e21d` | PASS | 234 of 234 passed, `--retries 0`, phone, tablet, computer. |
| Spinner overlaps nothing at 320×568, 375×667, 667×375 | PASS | Probe (not committed) on phone and tablet, sideways as installed: spinner box against every text run and every control on the page, crossing over 0.5 px counted. 0 hits at every size; spinner fully in view; no sideways scroll. At 320×568 phone it sits at x 282–302, y 258–278, at the end of the hint line "Pick the one that is your game.", clear of the hint words and of "Don't see your game?" below. |
| Spinner alone, no words | PASS | The note holds only `<span class="spinner" role="progressbar" aria-label="Looking up branches">`. |
| CI on `c10e21d` | PASS | Run 46156538277: `verify`, `postgres`, browser shards 1–6 and `gate` all success (full run, no retries on a PR). `commit-authors` success (run 46156538245). |
| CRUD | n/a | The change adds nothing a person makes. |

## Notes (not from this change, not fixed here)

- The branches spinner shows at once, not after 2 s (same as `main`; the 2 s rule is for pages).
- At 667×375 "Change the branch or folder" and "Throw this game away" sit about 1 px apart. They do not cross (no hit in the probe), and it is the same on `main`.
