# Implementation audit 1: flaky payment journeys (#293)

- Commit examined: `c2e147a` (branch `claude/project-thread-4625xg`), against `main` at `b17eaca`.
- Lane 2 (`tests/browser/support/account.ts` is shared). One fresh review, Opus 5.5 medium.
- Written 2026-11-22 02:39 UTC.

## Verdict

PASS: 0 red, 2 notes.

## Judged against

The pull request's five acceptance criteria and the `build` skill's flaky-test rules: a flake is fixed at its root cause; no rerun until it passes, no sleep, no skip, no wider limit; browser tests wait on readiness; no check weakened; the cause recorded under "Flaky tests"; changed tests named in the body.

## What was checked, and what it showed

1. **Diff scope.** `git diff origin/main...c2e147a --stat`: five files, `docs/superpowers/progress.md`, `tests/browser/{pay,play,rejoin}.test.ts`, `tests/browser/support/account.ts`. No app code, no config, no CI file. `playwright.config.ts` is untouched: `retries: 0`, `actionTimeout: 5_000`, `expect.timeout: 15_000` as on `main`. No `waitForTimeout`, `setTimeout`, `.skip`, `.fixme` or `retries` added. Criterion 5 met.
2. **Every check the journeys make is unchanged.** The only edits are `standInPayButton(page).click()` → `pressPay(page)` (five places, `grep` finds no direct press of "Pay" left) and one added `await pageHasSettled(page)` in `signUpFromTheCard`. Each journey's `expect` lines are the same. Nothing weakened.
3. **Cause 1 (play.test.ts:41), confirmed independently.** `tests/browser/support/fake-stripe-server.ts` answers the Pay POST only after `sendAll` has awaited the three webhooks (`checkout.session.completed`, `customer.subscription.created`, `invoice.paid`) one after another, so the press's navigation is the site's answer. With a temporary uncommitted 6-second hold added at the top of `sendAll`, on `computer`: `play.test.ts` and `rejoin.test.ts` at `c2e147a` passed (20 passed); with `pressPay` put back to a plain `click()` they failed with `TimeoutError: locator.click: Timeout 5000ms exceeded. - waiting for scheduled navigations to finish`, the CI run's exact message. The temporary edits were reverted (`git status` clean). Criterion 1 reproduced.
4. **Cause 2 (pay.test.ts:41), confirmed by reading.** In `node_modules/@sveltejs/kit/src/runtime/client/client.js`, `_start` calls `history.replaceState` (line 520) before `await _hydrate(...)` (line 553), and the announcer `#svelte-announcer` is rendered by `components/root.svelte`, which hydration mounts. So waiting for the announcer (`pageHasSettled`) waits past that history rewrite. It is the same readiness wait `signUp`, `signInAs` and `payAsNewMember` already use. Not run on WebKit: the container has only Chromium (`/opt/pw-browsers`), so the phone profile rests on CI (criterion 4).
5. **Touched journeys run here.** Postgres 16 in the container, `pnpm test:browser --project=computer --project=tablet tests/browser/pay.test.ts tests/browser/play.test.ts tests/browser/rejoin.test.ts`: **54 passed, 0 failed** (1.7 m). Criterion 2 is the builder's 3× repeat; this is one further clean run, not a repeat.
6. **`pnpm lint` and `pnpm typecheck`:** both exit 0 at `c2e147a` (svelte-check: 1902 files, 0 errors, 0 warnings). Criterion 3 met.
7. **Flaky tests records.** Both entries in `progress.md` now give the cause and the fix in place of "Root cause not found yet", with run ids, commits and the WebKit gap stated. Met.
8. **Changed tests named in the body.** The "Changed tests" section names all four test files and what changed in each. Met.
9. **CRUD.** The change adds or touches nothing a user can make; no CRUD journey is in scope.

## Not run

- The phone (WebKit) profile: not installed in the container. CI's full run covers it (criterion 4); this review does not claim it.
- CI on `c2e147a`: the pull request is a draft, so only the quick run applies until it is marked ready.

## Notes (not blocking, not fixed here)

- **N1. The wait after Pay is now 15 seconds, not 5.** `pressPay` drops the click's own 5-second wait for the navigation, and the next `expect(page).toHaveURL(...)` waits with the config's existing 15 seconds. No limit is raised; this files the press under the repo's recorded rule that a wait for the site's answer gets 15 seconds (the `connect-github` entry under "Flaky tests", `SITE_ANSWER_TIMEOUT`), the same treatment "Create account" and "Sign in" already have. The root cause, the stand-in answering only after three serial webhooks, stays in the stand-in; if Pay ever needs more than 15 seconds on CI, the next fix is the stand-in answering first and sending its news after, not a longer wait.
- **N2. `noWaitAfter` is marked deprecated in Playwright's docs** ("will default to true in the future"). It is honored in the installed 1.63 (the reproduction in check 3 shows the difference), and when it becomes the default the helper's behavior stays the same.
