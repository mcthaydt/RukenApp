**4b03559 FAIL: 1 red**

# Real buttons, not underlined words: lane 2 re-check, round 2

- Commit examined: `4b03559` on `claude/project-thread-p6zxug`. It is a fast-forward from the round 1 audit `b6c28a3`, which failed `8e0d129` with R1.
- Reviewer: the round 1 session, Opus 5.5, medium.
- Scope: R1 and its new check. The round 1 audit's other results stand for the files this commit does not touch.

## What ran, at 4b03559

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 1929 passed |
| `pnpm test:browser --project=tablet --project=computer real-buttons.test.ts edit-page.test.ts` on a fresh database | 54 passed, 0 failed |
| Phone (WebKit) | Not run here. WebKit runs in CI only. |

## R1, the Show and Hide eye icons

**Fixed in the code.** `src/routes/make/page/links/+page.svelte` lines 35 and 37 are plain `Show` and `Hide` words again. The eye drawings are gone from `src/lib/icon.svelte`, and its name type no longer allows `show` or `hide`, so the type checker refuses an eye.

The new check is at `real-buttons.test.ts:164`. For each of Show and Hide it wants the visible text to be the word and no `svg` inside. Against `8e0d129` it would fail: those buttons had only an `svg` and an `aria-label`, so their text was empty. It passed on both devices.

**Not done:** the repo's own rule still names the eyes. The round 1 FIX said "if the rule's list changes, also the 'An icon where people understand it' line in `.claude/skills/this-repo/SKILL.md`". The list did change.

### R2

- **UNIT:** `.claude/skills/this-repo/SKILL.md`, line 57.
- **VERDICT:** red.
- **REQUIREMENT:** R1's fix (round 1 audit), and the round 1 audit prompt: consistency within the change and with the codebase.
- **REASON:** the rule says "Back, Change, Up, Down, Show, Hide, Remove and Close are icons from `src/lib/icon.svelte`". That no longer matches the code. A later session following the rule would put the eyes back, and R1 would return.
- **EVIDENCE:** `git show 4b03559:.claude/skills/this-repo/SKILL.md` line 57 still lists Show and Hide. `src/lib/icon.svelte` at 4b03559 has no `show` or `hide`.
- **EXPECTED:** the rule lists only the icons the code draws, and says that Show and Hide stay words because an eye reads as the link's state.
- **FIX:**
  - Edit that one line: drop Show and Hide from the list and add the reason.
  - The same line says a button holding only an icon "stays a 48px square". On Your links they are 48px tall and as wide as their share of the row (round 1 note N1). The builder may make that part true at the same time.
  - Name the edit in the pull request body. A `this-repo` edit takes the lane of the code it describes (lane 2).
  - Only that file.

## Verdict

**4b03559 FAIL: 1 red** (R2, the repo rule still lists Show and Hide as icons). The product fix for R1 is correct and checked. A re-check needs only the rule line.
