# Swipe between tabs: implementation audit, round 2

Reviewed: branch `claude/project-thread-ow9u4y` at `91d5d81` (a fast-forward of round 1's `eb26174`), the fix commit
`91d5d81` against `eb26174`. Lane 2. Round 1: `2026-11-22-swipe-between-tabs-1-implementation-audit.md` (FAIL, 1 red).

**Verdict: PASS.** The red is fixed, and round 1's note 2 (the jump to the top) is fixed correctly.

## What was checked

- Finding 1 (lint): `pnpm lint` on `91d5d81` exits 0. The diff to the two files is formatting only: the `if` condition
  in `src/routes/+layout.svelte` is split over lines, and the `toMatch` regex in `tests/loading-states.test.ts` moved
  to its own line, unchanged.
- `pnpm typecheck`: 0 errors. `pnpm test`: 1,900 passed.
- Round 1 note 2 (scroll): `src/lib/stay-in-app.ts:39` now scrolls to the top only when `!form.isConnected`, after
  `await update()`. `update()` runs `applyAction`, which sets `page.form` and awaits `tick()` (`@sveltejs/kit` 3.0.0
  `client.js:2989-3001`), so the DOM has the new screen when `isConnected` is read. Checked against every POST form
  in `src/` that answers on its own page:
  - Sign-up and forgot password: the start form gives way to the code form (`{:else if form?.step === "code"}`), and
    "too young" replaces the form: disconnected, scrolls to the top, as a new screen should.
  - Change password: `{:else if form?.done}` replaces the form with "Done": disconnected, top.
  - A refusal (sign-in, the code, change password, a page room): the form stays, so the person stays where they
    pressed, next to the `role="alert"` line, which sits by the button in each of them.
  - Your links' Up, Down, Hide, Show: each form is keyed by `link.id` in `{#each}`, so it is moved, not replaced, and
    stays connected: no jump. Remove takes the form away (disconnected, top); acceptable, since the line pressed is
    gone.
  - Live's "Show how many people played it": the form stays: no jump.
  - Redirects are not touched by this: SvelteKit's own navigation sets the scroll.
  - Passwords are still cleared in every in-place answer.
- Browser journeys on a fresh local Postgres 16 (Chromium only, computer and tablet), at `91d5d81`:
  `page-moves`, `sign-up`, `forgot-password`, `change-password`, `loading`, `sign-in`, `make-page*`: 94 passed.
  `edit-page` (Your links' Up, Down, Hide, Remove): 14 passed.
- Not run here: the phone profile (WebKit; none in this container). Round 1's note 1 on WebKit stands: the pull
  request's CI must show the phone piece green.

## Notes (not blocking)

1. No journey checks the scroll itself (that an in-place answer keeps the position and a next step starts at the top).
   It was round 1's note 2, read here from the code above; a check could be added in a later change if it regresses.
2. Round 1's notes 3 to 5 stand as written.
