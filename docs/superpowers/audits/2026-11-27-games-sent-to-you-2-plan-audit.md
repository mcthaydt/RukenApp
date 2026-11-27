# Plan audit 2: games sent to you ("Your turn")

- Examined: `fd79d89` (branch `claude/project-thread-vtpb30`, draft pull request #407), brief `docs/superpowers/specs/2026-11-27-games-sent-to-you-design.md`. The branch differs from `main` (`16f8996`) only in the brief and one `progress.md` row.
- Read against: CLAUDE.md, the `review` and `build` skills, the owner's rules in `progress.md` and project memory, plan audit 1 (`1c68797`, branch `claude/project-thread-t8zpxy`), `main` at `16f8996`, Follow (#400) at `bdba4e5` and the top bar (#402) at `d25c58c` (no `src/` change from its passed head `a4dd09a`).
- Reviewer: Opus 5.5, medium. Written 2026-11-27 02:18 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 2 red, 5 notes.**

## Audit 1's reds, checked

| # | Finding | At `fd79d89` | Evidence |
|---|---|---|---|
| R1 | Live-state file at hand-off | fixed | `git ls-tree -r origin/claude/project-thread-vtpb30 docs/superpowers/live/` is empty |
| R2 | Send limits public | fixed in words | the brief has no numbers; stand-ins in `limits.ts`, real ones from `env.PRIVATE.sendLimits` via `cloudflarePrivateSendLimits()`; criterion 16. The wiring has a gap, see red B |
| R3 | Button on the speaker | moved, but does not fit | see red A |
| R4 | Faces and names | fixed | page photo or the page name's first letter, page `name` cut with "…"; matches #400's `initialOf` in `Feed.svelte:73` and `MakerPage.svelte:29`; criterion 5 covers a friend with no photo |
| R5 | `/your-turn` not gated | fixed | unit 3 owns `"/your-turn"` in `GATED` and `routes.test.ts`; `under()` in `routes.ts` covers every route below it |

Audit 1's notes N1 to N6 are all written into the brief (Stop deletes the rows, a sent game outlives the friendship, sibling link and buttons, the 48px Stop target, the Following tab left for later, one statement in the game page's `Promise.all`).

What holds besides: `MakerFollow` has `followedAt` (#400), so "newest friendship first, the later of the two follows" can be computed. The layer place (between `pages` and `feed` in `FEATURE_ORDER`, lowest first) is right: sends reads pages and games, and the feed's sheet uses sends. `deletion.ts` deletes by raw `tx.*.deleteMany` (as #400 does for `makerFollow`), so accounts, below sends, needs no import. `tests/lib/glass.test.ts`, `tests/loading-states.test.ts`, `src/lib/icon.svelte`, `src/routes/about/sections.ts` exist. CRUD: a send is created (1), read (2), updated (`seenAt`, 2), deleted (3); a stop created, read, deleted (4).

## Red

### A. The Your turn button has no room beside Search on a 375px phone

- UNIT: "Where they land", unit 5 (`src/features/feed/FeedTop.svelte`), criterion 13.
- VERDICT: red.
- REQUIREMENT: criterion 13 (the speaker, tabs, Search and the button do not overlap at 375 by 667); the owner's top bar, tabs "in the middle" (#402).
- REASON: "just inside Search" puts a 48px button where the centred tabs already are.
- EVIDENCE: #402's `FeedTop.svelte` centres the tabs (`justify-content: center`) and puts Search `position: absolute; right: 0.75rem`. Measured in Chromium at 375 by 667 with `look.css` and its Schibsted Grotesk 600 file, the same tab CSS and words: speaker 12 to 60px, tabs 83 to 292px, Search 315 to 363px. A 48px button touching Search spans 267 to 315px, 25px over the tabs; the left gap (60 to 83px) is 23px. No 48px spot is free in that row without moving the tabs off centre. The owner has also asked to rename the two tabs (memory, 02:07 UTC), so their width may change.
- EXPECTED: a place for the button that is free at 375px today and does not move the tabs, written in the brief with how it sits on a sideways phone.
- FIX: in the brief, move the button out of the tab row, for example directly under Search on the right edge (a second 48px glass circle, `top` one target and a gap lower), and in the sideways column under Search. Keep criterion 13 as written; it will now be meetable. Files: the brief.

### B. The plan's file lists miss files the build must touch

- UNIT: plan units 2, 4 and 5.
- VERDICT: red.
- REQUIREMENT: the plan's own check, "the diff touches only files in the plan" (CLAUDE.md, "A check is a test that fails by itself"); the same class as audit 1's R5.
- REASON: three paths the build cannot avoid are owned by no unit.
- EVIDENCE:
  1. **The private limits wiring.** `src/lib/server/cloudflare.ts` says "only src/hooks.server.ts imports this one", and the feed's private order reaches its feature only through `setPrivateRanker(cloudflarePrivateFeed)` in `src/hooks.server.ts:27`. `cloudflarePrivateSendLimits` can reach `src/features/sends/` only the same way, so `src/hooks.server.ts` (a lane 2 path) changes; unit 2 does not name it.
  2. **The faces' road to the sheet.** `ShareSheet` takes no data today (`<ShareSheet bind:this={shareSheet} />` at `Feed.svelte:527` and `src/routes/g/[game]/+page.svelte:279`). Faces loaded in `src/routes/+page.server.ts` reach it only through `src/routes/+page.svelte` and `src/features/feed/Feed.svelte`, and on the game page through `src/routes/g/[game]/+page.svelte`. Unit 4 names only the two loads, `ShareSheet.svelte` and `SendRow.svelte`. `SendRow.svelte` also reaches the feed only through a browser entry (`tests/architecture.test.ts:110`, "`<feature>.browser.ts`"), so name `src/features/sends/sends.browser.ts` beside `sends.ts`.
  3. **The dot's count.** `FeedTop` shows on `/` (`Feed.svelte`) and `/following` (`Following.svelte`, #402), each with its own load. The brief says where the dot shows but not which load counts the unseen games, and `src/routes/following/+page.server.ts` and `src/features/feed/Following.svelte` are in no unit.
- EXPECTED: each unit's "Files it owns" names every file the build changes.
- FIX: in the brief: unit 2 adds `src/hooks.server.ts` (one `setSendLimits(cloudflarePrivateSendLimits)` line) and `sends.browser.ts`; unit 4 adds `src/routes/+page.svelte`, `src/features/feed/Feed.svelte`, `src/routes/g/[game]/+page.svelte`; unit 5 says the unseen count comes from the `/` and `/following` loads (or one named layout load) and adds those files and `Following.svelte`. Files: the brief.

## Notes (not blocking)

- N1. **The shape of `sendLimits`.** Two repos must agree on it. Write it in the brief (for example `sendLimits(): Promise<SendLimits>` with the same `{ rules: { name, rule }[] }` shape as `ReportLimits`), and say what happens when the call throws (use the stand-ins, as the open order stands in for the feed).
- N2. **Undo of someone else's stop.** Rules say it answers 404; criterion 7 checks only Remove and Stop. Add Undo to criterion 7.
- N3. **One stop per pair.** Say `SendStop` has `@@unique([stopperId, stoppedId])`, or two quick Stops make two rows and one Undo leaves the person stopped.
- N4. **Remove's spinner.** "Takes the row off at once" and "spinner on the button while it sends" cannot both be seen. Pick one (off at once, put back on a fail, matches the rest).
- N5. **Criterion 12 says "its Stop link"**; the brief makes it a → button. Use one word.
- Follow-up outside this change (from audit 1's N7, still open): the report limits in `src/features/moderation/limits.ts` are exact spam numbers in the public repo.
