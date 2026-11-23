# Swipe between tabs: re-point after merging main (round 6)

- Reviewed commit: 3146260 (PR #347 head 3146260cf3b503cbbea1080c25656c774a417c77), merge of `main` 7d718fc (#344 cookie consent) onto 9f35060 (PASS, round 5).
- Reviewer: Opus 5.5, medium. Lane 2. Scope: the merge delta only.
- Verdict: **PASS**

## The delta is only #344

- `git log --first-parent cc4e4db..7d718fc` is one commit: the #344 merge.
- `git diff --name-only 9f35060 3146260` equals `git diff --name-only cc4e4db 7d718fc`, and for every file the added and removed lines are the same (only hunk offsets differ). It merged clean, with no hand resolution.

## Consent against the slide and in-app sending

- `src/routes/+layout.svelte`: #344 adds `setAgreed` and the cookie card under the page. Both sit beside the branch's `place`, `onNavigate` slide and `sent`. Nothing of either side is lost.
- "I agree" is a `use:enhance` form. Its own listener on the form calls `preventDefault` before the layout's document listener runs, and `sendInApp` returns on `defaultPrevented`, so it is sent once, not twice.
- Note, not blocking: the card's `aboveBar={browsing}` does not count the bar this branch adds on `/make` and `/me`. That can't happen today. Both pages are signed-in only (`signedInOnly`), signing in needs the yes, and taking the yes back (`/cookies?/takeBack`) signs out. So the card never shows there. If either changes, use `aboveBar={browsing || place !== null}`.

## Checks run on 3146260

- `pnpm typecheck`: 0 errors (with stale Playwright build output removed from `.svelte-kit`, which is not source).
- `vitest run` page-moves, loading-states, privacy/cookies: 24 passed.
- Playwright (local Postgres 16, Chromium) page-moves, cookie-consent, test-play and bar, tablet and computer: 58 passed, 0 flaky (2.1 min). Phone (WebKit) left to CI.

## PR body

Has `## Lane`, ends `Requested by **McThayDT**`, no footer. "Commits" still names 88c2d27 / eb655ac (paperwork, not blocking).
