# Frosted glass: implementation audit 5

- Pull request: #321, branch `claude/project-thread-b1h8tt`
- Commit examined: `09883b4` (diff `fd1a5c0..09883b4`: `c789f1c`, `09883b4`)
- Lane 2 (`src/lib/look.css`): re-review after the full run at `fd1a5c0` failed `tests/browser/play.test.ts:280` on all three devices (it still expected the old 72% tint). Last PASS: audit 4 at `70f7602`.
- Reviewer: fresh session, Opus 5.5, medium
- Written: 2026-11-22 15:41 UTC

**Verdict: PASS, 0 red, 2 notes.** Only the play journey's one test changed; no product code changed. The test is not tautological: its expected value comes from `look.css`'s `:root` tokens and its actual value from the tab's computed style in the browser, so it fails when the tab stops reading the glass tokens, as two mutations below show.

## What was checked

| Check | How | Result |
| --- | --- | --- |
| Only the test changed | `git diff --stat fd1a5c0 09883b4` | `tests/browser/play.test.ts` only (11 in, 3 out). No file under `src/`, no config, no other test. |
| What the test now asserts | Read the diff and `tests/support/look-tokens.ts` | At rest the tab's computed `background-color` is `--glass-bg` (channels re-joined as `rgba(17, 19, 20, 0.12)`) and its `backdrop-filter` (or `-webkit-` twin) is `--glass-filter`. `token()` reads `:root` with comments dropped and throws when a token is missing or declared twice, so it cannot fall back silently. |
| The test passes | `playwright test tests/browser/play.test.ts --project=computer --project=tablet -g "frosted glass at rest"` at `09883b4`, local Postgres 16 | 2 passed. |
| It fails on the old tint | Tab's `background` (`look.css` line 2907) set to `rgb(17 19 20 / 0.72)`, computer profile | Failed: expected `rgba(17, 19, 20, 0.12)\|blur(24px) brightness(0.29) saturate(1.3)`, received `rgba(17, 19, 20, 0.72)\|...`. File restored. |
| It fails with no frost | Tab's two `backdrop-filter` lines set to `none`, computer profile | Failed: received `rgba(17, 19, 20, 0.12)\|none`. File restored; `git status` clean. |
| Lint on the changed test | `eslint` and `prettier --check` on `tests/browser/play.test.ts` | Clean. |
| Rename | Test title "...the tab is see-through at rest" to "...frosted glass at rest" | Matches what it now checks, and the PR body's "Changed tests" names it with the reason. |

Not run here: the phone profile (WebKit; this container has none), and the full suite. CI for `09883b4` showed only `commit-authors` and `pr-rules-run` queued when this was written (draft); not judged here.

## Notes (not blocking)

1. UNIT: `tests/browser/play.test.ts`. VERDICT: note. REASON: the test now proves "the tab uses the glass tokens", not "the tab is see-through"; if `--glass-bg` itself turned solid the test would follow it. EVIDENCE: expected value read from `look.css`. EXPECTED: that property is held elsewhere, and it is: `tests/lib/glass.test.ts` checks the tokens' tint and contrast. No fix needed.
2. UNIT: PR #321 body, "Commits". VERDICT: note. REASON: it names `70f7602` as reviewed; the head is now `09883b4`. FIX: the builder updates the reviewed and integration commits to this audit's verdict commit before merging.
