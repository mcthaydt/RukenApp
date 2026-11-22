# Swipe between tabs: implementation audit, round 3

Reviewed: branch `claude/project-thread-ow9u4y` at `68f140e` (a fast-forward of round 2's `2dc952c`), the fix commit
`68f140e` against `2dc952c`. Lane 2. Rounds 1 and 2: `2026-11-22-swipe-between-tabs-{1,2}-implementation-audit.md`.

**Verdict: FAIL, 1 red, 2 notes.** The scroll on Your links is fixed and its new check is real, but the new
same-page-redirect branch leaves a refusal on the screen after a later answer succeeds, and skips the heading rule.

## What was checked

- `pnpm lint`: 0. `pnpm typecheck`: 0 errors (on a clean `.svelte-kit`; my own local build output gave false errors
  first). `pnpm test`: 1,900 passed.
- Browser journeys on a fresh local Postgres 16, Chromium only (computer and tablet), at `68f140e`: `edit-page`,
  `page-moves`, `sign-up`, `forgot-password`, `change-password`, `loading`, `sign-in`, `make-live-changes`,
  `make-second-look`: 192 passed. Phone (WebKit) not run: none in this container.
- `edit-page.test.ts:258` (the new scroll check): with `src/lib/stay-in-app.ts` put back to `2dc952c`'s, it fails at
  line 272, "expect(received).toBeGreaterThan(expected) ... Received: 0"; with `68f140e`'s it passes. It fails by
  itself, so it is a real check. Its other edits wait for the busy mark and restore the window size; nothing weaker.
- The heading rule on answers that stay on the page (`success`/`failure`), against every plain POST form:
  - Sign-up: "Join Ruken" to "We texted you a code" or "Ruken isn't for you yet.": changes, top.
  - Forgot password: "Forgot your password?" to "Choose a new password": changes, top.
  - Refusals everywhere: the heading stays, the person stays. Right.
  - Change password: "Done" keeps the heading "Change your password", so no jump; the form it replaces is the rest of
    a short card and the page shrinks under it, so "Done" is in view. Note 1.
  - No layout puts an `<h1>` before the page's own (grep of `src/routes/+layout.svelte`, `make/+layout.svelte`,
    `src/features/feed/*.svelte`, `src/lib/*.svelte`), so `querySelector("h1")` reads the screen's heading.
- Same-page redirects (`isThisPage`): every action in `src/routes/**/+page.server.ts` that redirects to the page its
  form is on: Your links (`make/page/links/+page.server.ts:39`), and on `/make/[game]` the plain forms `?/seen`
  (AcceptedScreen), `?/playerCount` (LiveScreen) and `?/deleteLeft` (TakenOffScreen), which all redirect to
  `/make/${slug}` (`make/[game]/+page.server.ts:228-307`); and `/me/delete` for staff.

## Findings

### 1. A same-page redirect keeps the last refusal on screen, and skips the heading rule

- UNIT: `src/lib/stay-in-app.ts:50-54` (the `result.type === "redirect" && isThisPage(...)` branch).
- VERDICT: red.
- REQUIREMENT: the owner's "almost never have page reload transitions" without changing what a screen says, and
  round 2's PASS behaviour (refusals and next steps right). A screen must not show a refusal for something that then
  worked.
- REASON: `refreshAll()` re-runs the loads but leaves `page.form` as it was, where the redirect it replaces went
  through navigation, which sets `form` to null (`@sveltejs/kit` 3.0.0 `client.js:1081`, `form: form ?? null`). The
  branch also returns before the heading check, so a redirect that brings a new screen stays scrolled.
- EVIDENCE:
  - Probe (`/mnt/project-files/audits/2026-11-22-swipe-between-tabs-3-probe.test.ts.txt`, not committed): a live
    game GitHub stopped showing; press "Send a new version" (refused, `role="alert"` shown, `form.problem` set); then
    press "Show how many people played it" (plain form, `?/playerCount`, redirects to `/make/${slug}`). At `68f140e`:
    the switch turns On, and the refusal "Ruken can't see your game on GitHub any more..." is still there,
    `getByRole('alert')` count 1, expected 0. With `stay-in-app.ts` from `2dc952c`: passes (count 0). The same holds for
    TakenOffScreen: a "Put it back" refusal stays after "Delete what's left" succeeds (`+page.svelte:59` passes
    `form?.problem` to every screen).
  - AcceptedScreen "OK" (`?/seen`) redirects to the same address and the screen becomes Live ("You're in." to "Live"),
    but the branch returns before `headingNow() !== headingBefore`, so the new screen opens where the old one was
    scrolled.
- EXPECTED: after a same-page redirect, no refusal from an earlier answer is shown, and a changed heading starts at the
  top, while Up and Down on Your links still keep the person where they pressed.
- FIX: in that branch only, clear the old answer as navigation does and then apply the heading rule: for example
  `goto(result.location, { refreshAll: true, noScroll: true, keepFocus: true })` in place of `reset` + `refreshAll()`
  (it sets `form` to null; check that the maker area's step does not now play on Up), or keep `refreshAll()` and clear
  `page.form` another way; then run the same `headingNow() !== headingBefore` check before returning. Files:
  `src/lib/stay-in-app.ts`, plus the probe above added as a journey (for example in `tests/browser/make-after.test.ts`
  beside "a live game GitHub stopped showing") so it fails by itself. Done when that journey and `edit-page.test.ts:258`
  both pass.

## Notes (not blocking)

1. Change password's "Done" keeps its heading, so it does not jump to the top; it is in view because the page shrinks.
   Fine today; a step that keeps its heading and grows would not be.
2. Rounds 1 and 2 notes stand: WebKit (phone) unrun here, the pull request's CI must show it green.
