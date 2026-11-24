# Spinner only: implementation audit, round 1

- Pull request: #390, branch `claude/project-thread-zo5n98`, head `63412c7` (merge base with `main`: `d5988b3`).
- Lane 2 (`src/lib/look.css`, `src/lib/page-loading.svelte`). Reviewer: Opus 5.5, medium, fresh session.
- Brief: the owner's request (2026-11-22 queue, 2026-11-24 13:53 UTC): async actions show only the spinner, no double feedback, no waiting words; standing rules: no "Loading..." text, spinners everywhere, everything custom, accessible.

**Verdict: FAIL, 3 red.**

## What ran on 63412c7

- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0, 0 errors. `pnpm test`: 154 files, 2,222 tests passed, exit 0.
- Browser journeys: not run here (no database in this container); CI's quick draft run was in progress at audit time.
- Probe (Chromium, Playwright, the PR's whole `src/lib/look.css` loaded, buttons shaped as the screens build them), reading Chrome's own accessibility tree through CDP:
  - `<button aria-busy="false"><svg aria-hidden="true"/><span>Wishlist</span></button>` → name `"Wishlist"`.
  - same with `aria-busy="true"` → name `""`.
  - `<button aria-busy="true">Next</button>` → `"Next"`; the video picker (`.file` with a busy input labelled by `#clip-words`) → `"Choose video"`.

## Findings

### 1. A busy button with an element inside loses its name (red)

- UNIT: `src/lib/look.css`, the rule `:is(button, .button)[aria-busy="true"] > * { visibility: hidden; }`.
- REQUIREMENT: the brief's "keep it accessible"; the PR's own claim that the words are "kept as the accessible name".
- REASON: `visibility: hidden` takes an element out of the accessibility tree, so a button whose words sit in a child element has no name while busy.
- EVIDENCE: probe above: the Wishlist button (`src/features/launch/WishlistButton.svelte:62-77`, words in a `<span>`) is named `""` while busy, `"Wishlist"` otherwise. `tests/browser/loading.test.ts:504` looks the busy button up as `getByRole("button", { name: "Wishlist", exact: true })`; the same lookup in the probe finds 0 buttons, so that journey should fail. A plain-form button with a child element, `src/routes/make/parts/LiveScreen.svelte` ("Show how many people played it: <span class="chip">On</span>"), would be read without its On/Off while busy.
- EXPECTED: a busy button keeps its full name; only its drawing changes.
- FIX: hide the children's drawing without removing them from the tree, for example `opacity: 0` (or `-webkit-text-fill-color: transparent` plus `visibility` only on `svg`, which is already `aria-hidden`) in place of `visibility: hidden`; add a check that a busy Wishlist button is still found by role and name. Files: `src/lib/look.css`, one journey in `tests/browser/loading.test.ts`.

### 2. Two "Keep this page open" lines still show beside the spinner (red)

- UNIT: `src/routes/make/parts/LiveScreen.svelte:95-96`, `src/routes/make/parts/TakenOffScreen.svelte:72-73`.
- REQUIREMENT: the brief, "show ONLY the spinner, no second sign beside it"; the PR removes the same line elsewhere (`busyLine` "Copying your game can take a minute. Keep this page open." in `FilesQuestion.svelte`, and "Adding your video. Keep this page open." in `VideoQuestion.svelte`).
- REASON: while `sending`, each screen swaps its note to "Copying your game can take a minute. Keep this page open." next to the spinning button: the double feedback the change removes.
- EVIDENCE: `{:else if sending}` / `{#if sending}` blocks at those lines on 63412c7. The new test in `tests/loading-states.test.ts` only looks for "…" and the two prop names, so it misses them.
- EXPECTED: while sending, the note does not change into a waiting line (keep the resting note, or drop the `sending` branch).
- FIX: remove the `sending` branch in both notes; widen the new unit test to catch a note that only shows while sending/saving (for example lines under an `{#if sending}`/`{:else if sending}`/`{#if saving}` that hold words). Files: the two screens, `tests/loading-states.test.ts`.

### 3. The repo's rule still tells sessions to put waiting words on buttons (red)

- UNIT: `.claude/skills/this-repo/SKILL.md:54`, "Every wait shows it".
- REQUIREMENT: CLAUDE.md, "A repo's own skills": an edit to `this-repo` takes the lane of the code change it describes and is named in the PR body; the rule must match the code it describes.
- REASON: the rule still says a `use:enhance` form "says what is happening in its words ("Sending your game…")", that "the layout's bar and a spinner" show, that a frame keeps a "Starting…" screen, and that a fetch "shows a line that says what it is doing". All four are what this PR removes, so the next session will put them back.
- EVIDENCE: the line on 63412c7; the PR does not touch the file.
- EXPECTED: the rule says a wait shows only the spinner: a busy button keeps its words unseen with the spinner in their place, the page loader is the spinner alone, a frame or fetch shows a spinner with an `aria-label`.
- FIX: rewrite that bullet; name the edit in the PR body. File: `.claude/skills/this-repo/SKILL.md`.

## Notes (not blocking)

- `tests/loading-states.test.ts:37` comment still says the game frame's "Starting…" screen; it is a spinner now.
- `src/lib/busy-forms.ts:30` still sets "Sending…" in the hidden live line for plain forms. It is screen-reader only, not drawn, so it does not break the rule; kept as is.
- No regression found in the rest: the old `.page-loading` bar rule and its keyframes are gone with no remaining user; no button that can go busy is positioned absolute or fixed, so the new `position: relative` moves nothing; the spinner is drawn in `currentColor`, which `-webkit-text-fill-color` does not change; `role="progressbar"` with an `aria-label` on every new spinner (page loader, play start, branches, payment finish) gives each a name.
- CRUD: the change adds nothing a user can make.
