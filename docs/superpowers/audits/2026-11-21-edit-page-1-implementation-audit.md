# Unit I, editing your page: implementation audit 1 (lane 2)

Commit examined: `2428774` on `claude/project-thread-dkbck6` (base `eaa777e`; `main` at `aedd00d`).
Brief: unit I (I1 to I11) in `docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md`, plus `CLAUDE.md` and the `build` quality bar (CRUD in the journeys).
Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-21 22:33 UTC.

## Verdict

**2428774 FAIL: 3 red, 4 notes.**

## What ran

| Check | Result |
|---|---|
| Merge with `origin/main` (`git merge-tree`) | clean; `main` moved only docs, `CLAUDE.md` and `this-repo` |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors |
| `pnpm test` | 121 files, 1,779 tests passed |
| `pnpm test:pg` (Postgres 16 in the container) | 44 files, 716 tests passed |
| `edit-page.test.ts` and `maker-page.test.ts`, tablet and computer | 26 passed |
| Every journey, computer profile | 485 passed, 62 skipped, **1 failed** (R1) |
| Phone (WebKit) | not run: WebKit is not in this container; left to CI as the coordinator asked |

## Criteria

| | Result | Evidence |
|---|---|---|
| I1 | pass | journey "signed out, your page asks for an account and comes back" |
| I2 | pass | journey: address question, `role="status"` "Saved. Your page is live.", name is the address |
| I3 | pass | rooms list, "See your page", "Opened 0 times."; `timesWords` unit test incl. "1,204 times" |
| I4 | pass | refusals in service words keep the text and focus the box (address, name, one line) |
| I5 | pass | old address 404, new one opens |
| I6 | pass, note N2 | tiles ≥ 48px, chosen theme applied, 999999 refused and colours kept |
| I7 | pass, note N3 | photo kept, replaced (old address 404), non-picture refused, Remove photo |
| I8 | pass, note N4 | two-question add, https refusal, Up/Down/Hide/Show/Remove, 30 is the most |
| I9 | pass | another maker's up/down/hide/show/remove each 404, link unchanged |
| I10 | pass | "Your page" link on `/make` (but see R1) |
| I11 | pass | `reserved-slugs.test.ts`; pg test `New`/`GitHub`/`Page` get `-2`; journey |

## Red

**R1.** UNIT: `src/routes/make/+page.svelte`. VERDICT: red. REQUIREMENT: CI green; an existing journey is not broken or quietly edited. REASON: the new `<p class="note">Your page</p>` breaks the existing journey "the Maker agreement link has a line's room above it". EVIDENCE: `tests/browser/make-second-look.test.ts:302` fails on tablet and computer with `Expected: >= 16, Received: -19.3125`; with `main`'s `src/routes/make/+page.svelte` put back and nothing else changed, the same test passes on both. The test takes the first `:scope > .note` (now "Your page") as the note and counts the Maker agreement note as a section above the link. EXPECTED: the journey passes. FIX: place "Your page" so both notes keep a line's room (for example one `.note` holding both links, or "Your page" in the list above), or, if the test's selector is what is wrong, change it and name the change and why in the PR body. Files: `src/routes/make/+page.svelte`, and `tests/browser/make-second-look.test.ts` only with that note.

**R2.** UNIT: links (`src/routes/make/page/links/`, `src/features/pages/service.ts`). VERDICT: red. REQUIREMENT: `CLAUDE.md` Verification and `build` "CRUD in the journeys"; owner rule 2026-11-21 14:29 UTC "Nothing should be permanent ... everything is editable". REASON: a link's words and address cannot be changed; the only way is Remove then add again, which loses its place and its tap count. EVIDENCE: the service has `addLink`, `moveLinkOf`, `setHidden`, `removeLink` and no update of `title` or `url`; the links screen offers Up, Down, Hide/Show, Remove only; no journey updates a link's words or address. No "Kept on purpose" record covers links. EXPECTED: a maker can change a link's words and address (the same two questions, filled in), refused in the same words (`https://`, length), and a journey does it and reads the change on `/<handle>`; another maker's id is the missing page. FIX: `updateLink(userId, linkId, { title, url })` in the pages service (test first, pg test for another maker's id), a "Change" on each row opening the two questions prefilled, and the journey steps in `edit-page.test.ts`. Files: `src/features/pages/service.ts`, `src/routes/make/page/links/`, their tests.

**R3.** UNIT: the page itself (`src/routes/make/page/`). VERDICT: red. REQUIREMENT: `build` "CRUD in the journeys" ("delete it or take it off ... Only the owner can keep a thing from being updated or deleted"); review skill: "Each one missing is red, unless the owner's recorded choice keeps that thing". REASON: once made, a maker cannot take her page down; it goes only with her whole account (`src/features/accounts/deletion.ts:167`), and no journey checks even that. EVIDENCE: no delete in the pages service, no way on the rooms screen; `purged-account.test.ts` and `delete-account.test.ts` never give the account a page. EXPECTED: a maker can take her page off (the address then is the missing page, and she can make one again), checked in a journey. FIX: `removePage(userId)` in the service (deletes links, the photo file, the page), a quiet "Take my page down" on the rooms with one confirm screen, and the journey steps. Files: `src/features/pages/service.ts`, `src/routes/make/page/`, their tests. If the coordinator judges a page should only go with the account, that is the owner's to record under "Kept on purpose"; the journey then has to show the page gone after the account is purged.

## Notes (not blocking)

- **N1.** `make` action in `src/routes/make/page/+page.server.ts`: when a page already exists it redirects with "Saved." though nothing was saved. Harmless; "Saved." could be dropped there.
- **N2.** `ThemePicker.svelte`: `buttonText` is passed and set as `--button-text` but never used; the bar is one flat colour (its `box-shadow` repeats the same colour). I6 says "a bar in its button colours"; showing the button's text colour on the bar (a short line or "Aa") would match it better.
- **N3.** I7's square cut to 512px (`cutPhoto`) is not checked by any test; the journey sends a 1px PNG. A journey sending a large non-square picture and reading the stored size would make it a check.
- **N4.** I8 "each link as it will appear": the list shows the words as plain bold text, not in the page's own link style. Acceptable for now; the slice-end design round can judge it.

## Exploratory, no finding

- Shared `QuestionScreen` change: the `enhance` callback is now async and awaits `submit`; a second press still cancels. All game-question journeys (`make-questions`, `make-send`, `make-live-changes`, `make-second-look` apart from R1) pass on computer.
- `Picks` `legend`: `aria-labelledby` falls back to the question when no legend; existing uses unchanged.
- `RESERVED_GAME_SLUGS` only adds to `freeSlug`'s taken set; existing games already holding `new`, `github` or `page` are not moved (none can be opened today, as the spec says).
