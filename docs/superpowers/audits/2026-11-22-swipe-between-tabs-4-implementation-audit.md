# Swipe between tabs: implementation audit, round 4

Reviewed: branch `claude/project-thread-ow9u4y` at `8049302` (a fast-forward of round 3's `913c56d`), the fix commit
`8049302` against `913c56d`. Lane 2. Round 3: `2026-11-22-swipe-between-tabs-3-implementation-audit.md` (FAIL, 1 red).

**Verdict: PASS.** Round 3's red is fixed, and both new checks fail by themselves.

## What was checked

- Round 3 finding 1. `src/lib/stay-in-app.ts:52-63`: a redirect to the page the person is on now goes through
  `goto(location, { refreshAll: true, reset: false, replace: true })`. In `@sveltejs/kit` 3.0.0 a navigation sets
  `form` to `form ?? null` (`client.js:1081`), so an earlier refusal goes; `reset: false` skips the scroll and focus
  reset in `finish_navigation` (`client.js`, `restore_scroll(url, reset, ...)` and `if (reset && ...) reset_focus`)
  and the blur (`blur_active_element(reset)`), so the person stays where they pressed; `replace: true` adds no
  history entry for the same address. The heading rule now runs after both branches (not on `error`), so "You're in."
  becoming Live goes to the top.
- `src/routes/make/+layout.svelte:49`: the maker area's step is skipped when `to.href === from.href`. The root layout
  already returns for the same path (`moveBetween` gives null), so neither layout animates a same-page answer.
- Each new check, with its fix taken out, on a fresh local Postgres 16, Chromium, computer:
  - `make-after.test.ts:270` ("a refusal on Live goes once the player count switch's answer brings the page back"),
    with `stay-in-app.ts` from `913c56d`: fails at line 287, `getByRole("alert")` count 1, expected 0. With
    `8049302`: passes. (It is round 3's probe, made a journey.)
  - `edit-page.test.ts:277` (`data-step` stays unset after Up), with the two lines in `make/+layout.svelte` taken
    out: fails, `Received: "on"`. With them: passes. (With round 3's `stay-in-app.ts` it passes either way, since
    `refreshAll` was no navigation; the check guards the `goto` path, which is the code now on the branch.)
- `pnpm lint`: 0. `pnpm typecheck`: 0 errors. `pnpm test`: 1,900 passed.
- Browser journeys at `8049302`, fresh database, Chromium, computer and tablet: `make-after`, `edit-page`,
  `page-moves`, `sign-up`, `forgot-password`, `change-password`, `loading`, `sign-in`, `player-count`,
  `make-live-changes`, `make-second-look`: 248 passed, 0 failed.
- Not run: the phone profile (WebKit), as in every round; none in this container. The pull request's CI must show it.

## The skipped Taken off journey

Acceptable. The clearing is not per screen: every same-page redirect from a plain form takes the one `goto` branch,
and `make/[game]/+page.svelte` hands `form?.problem` to Live, Sent back and Taken off alike (lines 34, 49, 59). The
Live journey proves the branch clears `form`; Taken off's "Delete them" (`?/deleteLeft`, redirect to
`/make/${slug}`) differs only in which action answered. A journey for it would add the R2 files setup and test the same
lines again.

## Notes (not blocking)

1. No journey checks that "See your game" on "You're in." lands at the top of Live. It follows from the heading rule,
   read above; the sign-up code screen's move to the top is the journey-checked case of the same rule.
2. Earlier notes stand: WebKit (phone) unrun here; change password's "Done" keeps its heading and so its place.
