# Glass on every floating piece: implementation audit 1

- Pull request: #370, head `1a61f0c792c7c83eab8fb472e5da241801f2585e` (branch `claude/project-thread-6s28wv`), base `main` at `509aa6e`.
- Lane 2 (`src/lib/look.css`, `.claude/skills/this-repo/SKILL.md`). One fresh review. Reviewer: Opus 5.5, medium.
- Written 2026-11-23 16:03 UTC.
- Verdict: **FAIL: 2 red.** Both are small and touch only CSS tokens and two comments.

## Is it exciting?

Yes. Over a colourful clip (the before/after page, https://claude.ai/artifact/Xeddc1t9rEeAnqpMt571Jj) the feed finally looks like one piece of glass floating over the game: the clip glows through the bar, the hints and the name box, and the warm and cool edges catch the eye without shouting. It is a clear step up from the near-black slabs on `main`. The pictures were shot at `6d5759e`; the only later commit (`1a61f0c`) touches `progress.md` and the live file, so they show the head.

## What ran (at `1a61f0c`, in a cloud container)

| Check | Result |
| --- | --- |
| `pnpm lint` | passed |
| `pnpm typecheck` | 0 errors, 0 warnings (2,221 files) |
| `pnpm test` | 149 files, 2,163 tests passed |
| Journeys `bar`, `play`, `feed-controls`, `look`, `look-layout`, `game-page` on `computer` and `tablet` (Postgres 16 local) | 274 passed, 0 failed (3.6 min) |
| Phone (WebKit) project | **not run**: WebKit is not installed here. CI's phone pieces cover it. |
| Worst-case look: the real tokens from `look.css` over pure white, pale yellow/blue and a light stripe, at 375 px, normal and `prefers-contrast: more` | pictures in project files `audits/2026-11-23-glass-review-1a61f0c/` (`worst-glass.png`, `worst-more-contrast.png`, page `index.html`) |

## Pull request body

Starts with the attribution comment and the `_Requested by **McThayDT** · [project thread](…)_` line (its link names the build thread, which is right), has `## Lane`, `## Acceptance criteria` and `## Tests changed on purpose`, and its last line is `Requested by **McThayDT**`. Passes.

## The two changed tests: honest?

Yes, and disclosed. The owner asked for glass darkened by "maybe 10" percent; at about 9.5% (measured from the tokens: `0.04 × 17 + 0.96 × 255 × 0.94 ≈ 230.8`, so a white clip comes out near `#e7e7e7`) white chalk cannot reach 4.5:1 by the darkening alone, so keeping the old check would have overruled the owner. The new "darkens 5–12%" check fails by itself if someone drifts back towards near-black or towards no darkening, and "every glass surface has the lens edge" fails on a glass surface without the edge. The `look.test` exception strips only the three glass token definitions, `box-shadow: var(--glass-edge);` and `text-shadow: var(--glass-ink)|none;`; any other shadow still fails. The fallback for `prefers-contrast: more` and `prefers-reduced-transparency: reduce` turns every surface solid `--felt-deep` with no edge or shadow (checked by `glass.test` and seen in `worst-more-contrast.png`).

What the swap leaves unchecked is legibility over a bright clip, which the body hands to the reviewer as criterion 6. That is red 1 below.

## Coverage of floating pieces

Every `position: fixed|absolute` surface over content in `src/` was listed. Glass now: `.bar` (upright and the sideways right rail, same rule), `.sound`, `.share`, `.hints`, `.sharenote`, `.band::before`, `.panel.over` (welcome-back line), `.gamepage .heroname`, `.gamepage .back`, `.playing .menu > summary` (play tab), `.consent`, `.screen .acts` (phone Back/Next row), `.page-loading-spinner`. Still solid `--felt-deep` and correctly so: `.feed`, `section`, `video` (backgrounds under the clip), `.panel` when not over the feed (a patch of felt in the column), `.playing .starting` (covers the game while it loads), the play tab while pressed or dragged (by design, kept). Nothing floating was left out.

## Performance on phones

Backdrop blur is the costliest CSS there is to draw over a playing video. On `main` four pieces per clip were already glass at `blur(24px)`; this adds the bar, hints and Share note and raises the blur to 28px. Each screen has at most one clip section in view, so about seven blurred surfaces at once. That is in line with what iOS itself draws over video and the journeys show no timing regressions, but nothing here measures frame rate on a real phone. Note 2.

## Findings

### Red 1: labels and icons are faint over a white or very light clip

- UNIT: `src/lib/look.css`, tokens `--glass-ink` and `--glass-icon`.
- VERDICT: red.
- REQUIREMENT: the pull request's criterion 6, "Labels and icons on glass stay readable over a bright clip", and the drunk-grandma test.
- REASON: with the glass this clear, a white clip behind leaves white text on about `#e7e7e7` (about 1.25:1), and the shadows that are meant to carry it are too soft: the small hint line ("Tap the speaker for sound") and the outline icons in the bar and on Share all but vanish.
- EVIDENCE: `audits/2026-11-23-glass-review-1a61f0c/worst-glass.png` in project files (real tokens, 375 px, deviceScaleFactor 2): over pure white and the light stripe, the home and person outlines and the Share arrow are pale grey on pale grey, and the 14px hint line is readable only up close. The before/after page shows only a mid-green busy clip, so the bright case was never shown. Many web games have white or near-white screens.
- EXPECTED: over a pure white clip, every label and icon on glass is clearly readable at arm's length on a phone, while the glass still darkens what is behind it by 5–12% (the owner's ask stays as it is).
- FIX: strengthen only the shadow tokens, for example `--glass-ink: 0 1px 2px rgb(0 0 0 / 0.7), 0 0 8px rgb(0 0 0 / 0.55), 0 0 16px rgb(0 0 0 / 0.35)` and `--glass-icon: drop-shadow(0 1px 2px rgb(0 0 0 / 0.7)) drop-shadow(0 0 6px rgb(0 0 0 / 0.5))`, tuned by eye. Leave `--glass-bg`, `--glass-filter` and `--glass-edge` as they are. Add pictures over a pure white clip (feed on a phone: hints, name band, bar, Share; and a game page's Back) to the before/after page so the reviewer can check it. Files: `src/lib/look.css` only (plus `tests/lib/glass.test.ts` if its shadow pattern needs to accept the new values).

### Red 2: two comments still promise 4.5:1 over a white clip

- UNIT: `src/features/feed/Feed.svelte:671` and `src/lib/look.css:3828`.
- VERDICT: red (low).
- REQUIREMENT: consistency within the change; `this-repo` "a comment beside it says why", which must be true.
- REASON: this change removed the 4.5:1 guarantee, but `/* Frosted glass under the words (look.css): chalk on it is 4.5 to 1 or more over even a white clip. */` and `frosted glass over the game (chalk on it stays above 4.5:1 over a white game)` still say it holds.
- EVIDENCE: `grep -rn "4.5" src | grep -i glass` at `1a61f0c` returns those two lines; the token comment at `look.css:107` now says the opposite.
- EXPECTED: the comments say what is true: the glass darkens by about a tenth and the words carry the glass shadow.
- FIX: reword those two comments. Files: `src/features/feed/Feed.svelte`, `src/lib/look.css`.

## Notes (not blocking, not fixed here)

1. The phone's Back/Next row (`.screen .acts`) runs edge to edge, so its lens edge draws a red line down the left side of the screen and a blue one down the right (`after-phone-make-question.jpg`). Over plain felt it can read as a drawing glitch more than glass. Worth a look in the owner's walk; dropping the side fringes on full-width rows is one option.
2. Frame rate with about seven 28px backdrop blurs over a playing clip is not measured on a real phone. A quick look on the owner's iPhone during the slice-end walk would settle it.
3. The phone (WebKit) journeys did not run here; CI's phone pieces must be green before merge. The known `edit-page.test.ts:278` phone failure is owned elsewhere and ignored, as asked.

## Re-review

After the fix, a re-review checks red 1 by the new pictures over a white clip (and `worst-glass.png` re-shot from the new tokens), red 2 by the grep above returning nothing, and re-runs `pnpm test` and `tests/lib/glass.test.ts`.
