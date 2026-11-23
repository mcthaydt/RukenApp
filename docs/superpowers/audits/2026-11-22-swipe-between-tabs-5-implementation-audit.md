# Swipe between tabs: re-review after merging main (round 5)

- Reviewed commit: 9f35060 (PR #347 head 9f3506091e8314a00b29a945702f319e2b4e7e66), merge of `main` cc4e4db (#340 test-play) into the branch last passed at 88c2d27.
- Reviewer: Opus 5.5, medium. Lane 2. Scope: the merge delta only.
- Verdict: **PASS**

## The conflict in `src/routes/+layout.svelte`

`git diff 9f35060^1 9f35060` on the file is only main's `gameScreen` change (adds `/make/[game]/play` so test play names the game in the tab). `git diff 9f35060^2 9f35060` is only the branch's own work (`place`, `onNavigate` slide, `sent`, `wentBack`, `Bar on={place}`). Both sides are kept whole; nothing was dropped.

## Test play's screen with the slide

- Bar: `place` is null for `/make/[game]/play` and `browsing` does not cover it, so no bar shows. The game fills the window, as #340 intends.
- Going in (`/make/x` or `/make/x/check` to `/make/x/play`): the root layout's `moveBetween` returns null (both paths in the maker area), so no sideways slide. The maker layout is still mounted at the start of the move, so its `onNavigate` runs the maker step (`data-step="on"`, lift-away). This is the same as on `main`, whose maker layout also stepped any move into `/make...`.
- Leaving (Leave game, a link to `/make/x`): the maker layout is not mounted on the `+page@` play screen and the root returns null, so the page just appears. Same as `main` (no transition there either). No page reload: the link is a plain in-app link.
- Note, not blocking: leaving test play leaves `data-step="on"` from the way in, so the maker page's lines rise (not sink). This was so on `main` too. If a slide out of test play is wanted, `moveBetween` could treat `/make/[game]/play` as outside the maker area; that is a product polish, not a defect of this merge.

## Checks run on 9f35060

- `pnpm typecheck`: 0 errors.
- `vitest run` page-moves, test-play, loading-states, look: 163 passed.
- Playwright (local Postgres 16, Chromium) `test-play.test.ts` + `page-moves.test.ts`, tablet and computer: 18 passed, 0 flaky (1.5 min). Phone (WebKit) left to CI.
- CI at 9f35060 was still running when this was written.

## PR body

Has `## Lane`, last line `Requested by **McThayDT**`, no Generated-by footer. Its "Commits" section still names 88c2d27 and eb655ac; the implementer should re-point it to 9f35060 / cc4e4db (paperwork, not blocking).
