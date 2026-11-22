# Browser icon and titles: implementation audit, cycle 2

- Pull request: #320, branch `claude/project-thread-vffi7e`
- Reviewed commit: `8fa6473`
- Lane 2, a fresh re-review of cycle 1's two reds (`e4e5038`, at `0008924`) and the owner's later ask, tab icon padding. Reviewer: Opus 5.5, medium.
- Brief: the owner's request (2026-11-22 13:45 UTC), the owner's 14:32 UTC padding ask and 15:23 UTC home-screen answer, and the acceptance criteria in the pull request body.

## Verdict

PASS: 0 red, 2 notes.

## What changed since `0008924`

`tests/browser/browser-tab.test.ts` (+3 lines, R1), `static/favicon.ico` and `static/icons/favicon-32.png` (padding), `docs/superpowers/progress.md` (+2 owner entries), the cycle 1 audit file, and the live-state file (deleted at `8fa6473`). Nothing else.

## R1, the title journey after Back: fixed

- `tests/browser/browser-tab.test.ts:81-83`: after `page.goBack()` and the address check, the journey waits for the game page's "Play" link and `pageHasSettled(page)` before the title check and `goto("/help")`, as cycle 1's fix asked. The play screen has no "Play" link of its own, so the wait proves the game's page is back.
- CI quick run 45031675809 on `fddc3aa` succeeded on all six shards; its logs show `[phone] › tests/browser/browser-tab.test.ts:60:1` passed (11.2s), the WebKit case that failed in run 45030412892. The test file is unchanged from `fddc3aa` to `8fa6473`.
- Here, on `8fa6473`: `pnpm test:browser browser-tab --project computer --project tablet` 4 passed; the journey with `--repeat-each 5` on computer and tablet, 10 of 10 passed. The phone profile cannot run here (no WebKit in this container).

## R2, full-screen home-screen app: closed by the owner's choice

- The owner chose it (2026-11-22 15:23 UTC, "Home-screen app: yes, full screen"), recorded in `docs/superpowers/progress.md` and in the pull request body, which also says an iPhone home-screen app keeps its own sign-in, so a player signs in there once. `static/manifest.webmanifest` keeps `"display": "standalone"`. Nothing left to fix.

## Tab icon padding: done

Measured from the files, as the bounding box of white RKN pixels:

| File | Size | Before (`0008924`) | Now (`8fa6473`) |
|---|---|---|---|
| `icons/favicon-32.png` | 32x32 | columns 0 to 31 (no edge) | columns 5 to 26, rows 11 to 17 |
| `favicon.ico` 16px | 16x16 | | columns 3 to 13 |
| `favicon.ico` 32px | 32x32 | | columns 5 to 26 |
| `favicon.ico` 48px | 48x48 | | columns 7 to 41 |

Each now has a clear green (`#112f2c`) edge of about 12% to 19% of the side around the letters, with rounded corners; looked at each enlarged. The browser-tab journey's icon test (sizes and links) passes.

## Notes (not blocking)

- N1. The pull request cannot merge as it stands: it conflicts with `main` in `docs/superpowers/progress.md` (`git merge-tree` on `8fa6473` and `origin/main`), so GitHub has run no CI and no commit-authors check on `08bc963` or `8fa6473`. The merging session merges `main`, resolves `progress.md` (keep both sides' entries), and waits for green on that integration commit before merging. The resolution touches only `progress.md`, so this PASS holds for the code.
- N2. Cycle 1's notes N1 to N3 still stand (the `.ico` is labelled `sizes="48x48"` but holds 16, 32 and 48; no committed journey follows a link off a game's page; one title for every non-game screen).
