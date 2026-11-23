# Swipe between tabs: implementation audit, round 1

Reviewed: branch `claude/project-thread-ow9u4y` at `e64e320`, against #319's head `1bee0b5` (the branch is built on
it). Lane 2 (`src/lib/`, `src/routes/+layout.svelte`), one fresh review. Brief: the owner, 2026-11-22 15:52 UTC, "the
page should transition like a swipe when we go from Feed, Submit Game, You; we should almost never have page reload
transitions because that's jarring", and the card at 15:55 UTC, "Yes, on all three" (the bar on Feed, Your games, You).

**Verdict: FAIL, 1 red, 5 notes.** The one red is formatting: `pnpm lint` fails. The behavior holds up.

## What was checked

- `pnpm lint` on `e64e320`: **fails**, Prettier flags `src/routes/+layout.svelte` and `tests/loading-states.test.ts`.
  `prettier --check .` on `1bee0b5`: passes. So the change brought it in.
- `pnpm typecheck`: 0 errors. `pnpm test`: 129 files, 1,900 tests passed.
- Browser journeys, on a local Postgres 16 in this container, Chromium only (this container has no WebKit):
  - `computer`: `page-moves`, `loading`, `bar`, `sign-up`, `make-questions`: 78 passed.
  - `computer` and `tablet`: `make-screen-review`, `make-second-look`, `page-moves`, `loading`, `sign-in`: 122 passed,
    1 failed (`make-second-look.test.ts:219` [tablet], "no code waiting for +12055551582" while signing up). See note 5.
  - `computer` and `tablet`, `make-second-look` and `sign-up`, each four times: 336 passed.
  - `phone` (WebKit, iPhone SE) was **not run** here: CI must run it. No CI run exists for this branch yet (no pull
    request; `list_workflow_runs` for the branch is empty).
- Global enhance (`src/lib/stay-in-app.ts`) against every POST form in `src/` (18 files with a `<form>`):
  - Sign-in cookies: the action's `Set-Cookie` lands on the `fetch` answer, same origin, so the browser keeps it; the
    redirect is followed with `_goto(..., { refreshAll: true })` (`@sveltejs/kit` 3.0.0
    `src/runtime/client/client.js:2980`), so the layout's signed-in data reloads. Covered by `page-moves.test.ts`
    ("a form that is refused, a form that is answered and signing out all stay in the page") and passing here.
  - Stripe and the billing portal: `redirect(303, ..., { external: true })` in `me/+page.server.ts:41` and
    `join/+page.server.ts:107` comes back as `{type: "redirect"}`; `navigate` sends a URL that is not the app's to a
    native page load, and that promise never settles, so the `finally` that frees the button does not run before the
    page leaves (no double press into a second Checkout).
  - Sign out posts to `/sign-out`, which is a page action (`+page.server.ts`, `actions.default`), not a `+server.ts`
    endpoint, so `enhance`'s JSON answer is understood. No POST form targets a `+server.ts` route or another origin.
  - File uploads: `make/page/[room]` is `enctype="multipart/form-data"`; `enhance` sends `FormData` as is. The video
    question's file box sits in `QuestionScreen.svelte`, which has its own `use:enhance` and is left alone
    (`event.defaultPrevented`).
  - Forms posting to another page's action (`/make?/throwAway`, `/me?/portal` from `/join` and `/me/delete`): Kit 3's
    `enhance` emulates the browser and navigates where the submission lands (`forms/client.js:89-110`).
  - No script: the listener lives on `<svelte:document>`, so before hydration, or with no script, a form posts the plain
    way. `markThePage` now waits for `pageHasSettled` before marking (the hydration race fixed in `8ac1b04`).
  - Errors: a network failure or an unexpected 500 becomes `{type: "error"}` and shows the nearest error page;
    a refusal (`failure`) keeps the page, shows the `role="alert"` line (every form's refusal has one), clears password
    boxes and frees the button.
  - Double sends: the re-dispatched submit is taken by `enhance`'s own listener (form, before the document listener),
    and a second press while the first is out is cancelled by the `alreadySent` guard. `loading.test.ts:27` still
    proves exactly one POST (`held.requestsSoFar() === 1`).
- Test changes, each read for weakening:
  - `tests/loading-states.test.ts`: now checks `onsubmit={sent}` and that `sent` calls `markSending` then `sendInApp`
    in that order. Same strength.
  - `tests/browser/loading.test.ts:58-65`: was an exact list of two lines; now the first line is `busy=true` and every
    later line is `second press stopped=true`, with at least three. The extra line is the in-app re-send. A second
    press that went out would log `stopped=false` and fail the set check, and the one-POST check is unchanged. Not
    weakened.
  - `sign-up.test.ts:147` and `support/account.ts` `textItAgain`: add a wait for the busy mark to come off, because the
    answer no longer reloads the page. The checks after them are unchanged. Not weakened.
  - `make-questions`, `make-screen-review`, `make-second-look`: "Add a game" is scoped to `main`, since the bar now has a
    link with the same name on `/make`. Same assertion on the same element.
- Direction (`src/lib/page-moves.ts`, `tests/lib/page-moves.test.ts`): bar order Home, Your games, You; Back is
  "back"; inside the maker's area returns null and `make/+layout.svelte` keeps its own step; same path is null.
  Read against the root and maker layouts: exactly one of the two `onNavigate` handlers acts on any move, and each
  clears the other's mark.
- Reduced motion: both layouts check `prefers-reduced-motion: reduce` before `startViewTransition`; the journey "with
  less motion asked for, a move does not slide" passes on computer.
- Safari's own swipe back: `popstate` listeners run in one dispatch before SvelteKit's async `navigate` reaches the
  `onNavigate` callbacks, so `hasUAVisualTransition` is read in time. Only checkable in WebKit on a real swipe; not
  covered by a journey (note 4).
- Focus after a move: SvelteKit's own focus reset after navigation is untouched (the transition only wraps the DOM
  swap). After a refusal, focus stays on the pressed button and the `role="alert"` line is announced.
- CRUD: the change adds nothing a user makes. Sign-in, sign-up, sign-out and the links page's Up/Down/Hide/Remove still
  run through their journeys.

## Findings

### 1. Lint fails on two files

- UNIT: `src/routes/+layout.svelte` (line 68), `tests/loading-states.test.ts` (line 97).
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "Stack and checks", `pnpm lint`; CI's `verify` job runs it.
- REASON: two lines are longer than Prettier allows.
- EVIDENCE: `pnpm lint` on `e64e320` exits 1: "[warn] src/routes/+layout.svelte", "[warn]
  tests/loading-states.test.ts". `prettier --check .` on `1bee0b5` passes. Prettier wants the `if (slid || ...)`
  condition split over lines and the `toMatch(...)` regex on its own line.
- EXPECTED: `pnpm lint` exits 0.
- FIX: `pnpm exec prettier --write src/routes/+layout.svelte tests/loading-states.test.ts`. Only those two files.
  The `loading-states` regex matches the function's text either way, since it uses `\s*`.

## Notes (not blocking, recorded)

1. **WebKit is unrun.** The phone profile is WebKit, and Safari is where view transitions and `hasUAVisualTransition`
   matter most. Nothing here could run it; the pull request's CI must show the phone piece green before the merge.
2. **In-place answers jump to the top.** `stay-in-app.ts:38` scrolls to the top after any `success` or `failure` on
   the same page. That matches the old full page load, so it is not a regression, but on Your links (Up, Down, Hide)
   and Live's "Show how many people played it" switch at the foot of the page, an app would keep the person where they
   pressed. Worth an owner look at the next walk; no change asked here.
3. **Development only:** `enhance` throws in DEV when a form without `enctype="multipart/form-data"` holds a file box
   (`@sveltejs/kit` `client-errors.js:11`). No plain form in `src/` does today. A future one would silently do nothing
   under `pnpm dev`; production is unaffected.
4. **No journey covers Safari's swipe back** skipping the second slide. Playwright cannot make a real edge swipe, so
   this stays a read of the code (above).
5. **`no code waiting` on my second local run** (`make-second-look.test.ts:219` [tablet]): I reused one database
   across two local runs, so each worker drew again from the same area codes as the first run, and a number that
   already has an account gets no code: the cause recorded in `progress.md` line 190. Repeat run on the same database
   (`--repeat-each=4`, tablet and computer, `make-second-look` and `sign-up`): 336 passed, 0 failed, so it does not
   point at this change. Recorded here, not as a flaky test, since a fresh database per run (as CI has) prevents it.
