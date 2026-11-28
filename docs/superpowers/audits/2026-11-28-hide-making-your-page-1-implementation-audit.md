# Hide making your own page: implementation audit 1 (lane 2)

- Pull request: #459, head `328bcebd418f4670720009574ca78c983f13a762` (examined commit).
- Reviewer: a fresh session, Opus 5.5, medium. Review only: nothing but this file is changed.
- Written 2026-11-28 08:29 UTC (from `date`).
- Verdict: **FAIL: 3 red** (one needs the owner's choice).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

All in this container's Chromium (no WebKit here, so the phone profile ran with Chromium through a throwaway config that also skipped the WebKit warm-up; nothing of it is committed). Retries 0.

- `page-editor-closed.test.ts`: 4 of 4 passed (phone, computer).
- A probe of my own with `rk_test_pages=closed` (deleted after): every form post I tried answers 404 and makes no page (`/make/page?/make`, `/make/page/name`, `/make/page/links/add/where`, `/make/page/take-down`, `/make/page/colours`, `/make/page/photo`); PUT, PATCH and DELETE answer 404; a client-side tap to `/make/page` from `/make` shows "We can't find that page."; Tab through `/make` reaches `/`, `/make`, `/me`, the guide, `/make/new`, `/legal/maker-agreement`, `/help` and nothing under `/make/page`. Passed on phone and computer.
- Gamepad: the gamepad moves focus over the same links and buttons the keyboard reaches; no source outside `src/routes/make/page/` names `/make/page` except the three gated links (`grep -rn "make/page" src`), so no gamepad or key shortcut leads there.
- Overlap, closed editor, at 320×568, 375×667 and 667×375: the PR's new test (`/make`, `/about`) passed; the standing overlap tests passed; my probe on `/help/get-your-game-on-ruken`, `/me` and `/your-turn` failed on the guide at all three sizes (red 2). `/me` and `/your-turn` had no overlap.
- Switch on (the editor open, as slice 4 will have it): `edit-page`, `follow-a-maker`, `about`, `help-guide`, `friend-likes` on phone and computer: 80 of 80 passed. The Your page link, the guide line and the About `#fans` section come back with it, and the editor's full CRUD journey passes.
- CI on the PR was still running when this was written; this audit does not stand in for it.

## Red findings

### Red 1: nobody who joins after this merges can be followed, be a friend, or get a game sent to them

- UNIT: the change as a whole (`src/features/pages/editor-switch.ts` closing the only way to make a page).
- VERDICT: red, needs the owner's choice.
- REQUIREMENT: the brief, criterion 6 ("follows and sends are unchanged"), and the coordinator's ask that nothing break for follows, sends or the share sheet.
- REASON: a person is followed by their page's address, and the editor was the only place a page is made, so with it closed no new account ever gets an address.
- EVIDENCE: `src/features/pages/follows.ts` `follow()` returns `"no page"` when the handle has no `MakerPage`; `src/features/sends/who.ts` `canSend` needs two follows and `friendPagesOf` joins `MakerPage`, so share-sheet faces and sends need a page; the send looks up `makerPage` by `toHandle` (`src/features/sends/service.ts:111`). `db.makerPage.create` appears only in `src/features/pages/service.ts:117`, reached only from `/make/page`'s actions, which now answer 404. The journeys do not show it because `sent-to-you`, `friend-likes` and `follow-a-maker` seed pages with `givePage`. So after merge: a new player can follow makers who already have a page, but nobody can follow them back, so they never become anyone's friend, never get a game on Your turn and never show as a friend's face; a new maker's games show no follow plus and no maker card. The About page's players section still says "Send a game to a friend, someone you follow who follows you back."
- EXPECTED: either the owner accepts that Your turn and following work only between people who already have a page until slice 4, or everyone keeps a way to get an address.
- FIX (the owner picks; the builder then does only that): (a) accept it as is, and say so in the PR body; or (b) keep only the first question of the editor (name and address) open, and keep photo, links, colours, take-down, the About "fans" section and the guide line closed; or (c) give each account an address on its own at sign-up. Files for (b): `src/features/pages/editor-switch.ts`, `src/routes/make/page/+layout.server.ts`, `src/routes/make/+page.svelte`, `tests/browser/page-editor-closed.test.ts`. Recommendation: (b), because Your turn and friend faces are slice 3 features the owner asked for, and launch is 30 November.

### Red 2: the guide's contents links overlap at all three sizes

- UNIT: `src/routes/help/get-your-game-on-ruken/+page.svelte` (the contents links at the top).
- VERDICT: red.
- REQUIREMENT: the owner's standing rule that any two controls overlapping, on any page, at 320×568, 375×667 or 667×375, blocks, even when it predates the change. This PR also changes this page.
- REASON: the contents links sit on top of each other.
- EVIDENCE: `expectNothingOverlaps` (copied from `tests/browser/controls-overlap.test.ts`) on `/help/get-your-game-on-ruken`, editor closed: at 320 by 568, 375 by 667 and 667 by 375 it found "Let an AI helper do it / What you need", "What you need / Step by step", "Step by step / If Ruken can't start your game". The PR body names it under "Found, not fixed".
- EXPECTED: no two links touch at any of the three sizes.
- FIX: space or wrap the contents links in that file, and add `/help/get-your-game-on-ruken` to the paths in the PR's new overlap test in `tests/browser/controls-overlap.test.ts` so the journey covers it. Only those two files.

### Red 3: the PR body ends with a "Generated by" footer

- UNIT: the PR #459 body.
- VERDICT: red.
- REQUIREMENT: Identity in CLAUDE.md: no "Generated with Claude Code" line, and the body's last line is "Requested by **McThayDT**".
- REASON: the body ends `---` then `_Generated by [Claude Code](https://claude.ai/code)_` after the Requested by line.
- EVIDENCE: the PR body read from GitHub at this head.
- EXPECTED: the last line is "Requested by **McThayDT**".
- FIX: edit the body through a route the hooks check, removing the last two lines, and read the last line back.

## Notes (not blocking)

- A GET of `/make/page/__data.json` answers 200 with the layout's 404 node, but the page's own load still runs beside it (SvelteKit runs loads together) and returns the signed-in person's own page summary (`rooms`, `saved`, `host`). It reads only their own data and writes nothing, so it is harmless; a closed check in `ownPage`/the page load would stop it.
- Someone who already has a page can no longer change it or take it down, only delete their account. This follows from the owner's ask; worth saying in the PR body.
- The About makers line, "A good-looking page for each game, made in minutes.", reads plainly, and the About page has no dangling `#fans` link. The privacy page's "Your page" text is still true for pages that exist.
- The switch is well made: unset or empty is closed, any other value or a non-local address throws, and its unit tests cover each case.
