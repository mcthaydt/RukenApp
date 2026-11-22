**9c0ed5f PASS**

# Lane 2 review: the 18+ refusal's "Sign in" brings the person back to the game

- Branch: `claude/project-thread-flhrso`. Code commit 3537897. Examined 9c0ed5f, and the branch head 92b5f36, which differs from 9c0ed5f only in `docs/superpowers/live/claude-project-thread-flhrso.md` (checked with `git diff --stat 3537897 92b5f36`: that one file only).
- Base: main 3a60ce9 (merge base). Diff: `src/routes/+error.svelte` (+2/-1), `tests/browser/adults-only.test.ts` (+72/-1), the live-state file.
- Brief: `/mnt/project-files/pr-drafts/adults-only-sign-in-returns-pr-body.md`.
- Reviewer: fresh session, read only (a scratch worktree outside the repo for running checks; nothing in the repo changed).
- Finished: 2026-11-21 21:28 UTC (from `date`).

## Verdict

PASS. No red findings. Two notes, not blocking.

## What ran

| Check | Where | Result |
|---|---|---|
| `pnpm lint` | 92b5f36 | exit 0 |
| `pnpm typecheck` | 92b5f36 | exit 0 |
| `tests/lib/safe-next.test.ts` | 92b5f36 | 18 passed |
| `adults-only.test.ts`, tablet profile (Chromium) | 92b5f36, Postgres 16 local | 7 passed |
| `adults-only.test.ts`, computer profile | 92b5f36 | 7 passed |
| Same three journeys with `+error.svelte` put back to main's (mutation) | scratch copy | all 3 FAIL: button lands on `/sign-in` with no `next`; adult and under-18 land on `/` instead of `/g/<game>` |
| phone profile (WebKit) | not run | no WebKit in this container; CI runs it |

The mutation run proves the changed assertion and both new journeys fail by themselves without the fix.

## Acceptance criteria

1. **Button address carries the page.** `signInHref = /sign-in?next=${encodeURIComponent(page.url.pathname + page.url.search)}` (`src/routes/+error.svelte`). Journey asserts `/sign-in?next=%2Fg%2F<slug>` on the game page; the play screen case is proven by the adult landing back on `/g/<slug>/play`. PASS.
2. **Adult lands back and sees/plays the game.** Journey checks the URL, the game's name as heading, and the iframe body `data-loaded="yes"` on the play screen (same assertion `play.test.ts` uses). PASS.
3. **Under 18 lands on the same refusal, no "Sign in", one way out.** Journey checks URL `/g/<slug>`, the heading, `TOO_YOUNG` text, zero "Sign in" links and "Back to Ruken" → `/`. The markup shows the else branch gives exactly one button. PASS.
4. **Off-site `next` ignored.** Journey signs in at `/sign-in?next=https%3A%2F%2Fevil.example%2F` and lands on `/`. PASS (see note N2).
5. **Keyboard and focus.** The existing journey still tabs to the link, checks focus and a visible outline, presses Enter. PASS.

## Open redirect

- `next` is never followed raw. Both places that act on it pass it through `safeNextPath` (`src/lib/safe-next.ts`): the page load (`signedInRedirect`, `src/features/accounts/pages.ts:10`, which also redirects an already signed-in person) and the form action (`signInWithPassword`, `src/features/accounts/forms.ts:84`). The hidden field on the form holds the already-checked value. Sign-up carries the same checked value (`forms.ts:187`).
- `safeNextPath` refuses anything not starting with exactly one `/`, any backslash and any control character. Its 18 unit tests pass.
- The new button builds `next` from the error page's own `page.url`, always a path starting with `/`, encoded with `encodeURIComponent`. It is the same construction `signedInOnly` already uses (`pages.ts:20`). The button only shows for the `adults-only:signed-out` refusal, which only `/g/[game]` and `/g/[game]/play` throw, so an attacker-shaped path such as `//evil.example` can never reach it; and if one did, `safeNextPath` would send the person home.

## The 18+ gate

- No server code changed: `adultsOnlyRefusal` and its two callers (`src/routes/g/[game]/+page.server.ts:33`, `src/routes/g/[game]/play/+page.server.ts:20`) are untouched. Landing back on the game re-runs the same check, which is what the under-18 journey proves (refused again after signing in).
- The four existing gate journeys (signed out, under 18, unknown age, rating changes and take-off) all still pass on tablet and computer.

## Test honesty

- One existing assertion changed (`toHaveURL("/sign-in")` → with `next`), and the PR body names it and why. Nothing was weakened: the new value is stricter.
- New helpers make the accounts in a separate browser context, so the journey's own browser really is signed out when it meets the refusal. `signUpAgedElsewhere` hard-codes `http://localhost:4173` as baseURL, the same as the existing `takeOffAsMaker`.
- CRUD: the change adds nothing a person can make. Agreed, nothing applies.

## Notes (not blocking)

- **N1.** UNIT: branch live-state file. VERDICT: note. REQUIREMENT: CLAUDE.md "Live state in a file" (delete it in the last commit before handing the branch to the audit). REASON: the branch still carries `docs/superpowers/live/claude-project-thread-flhrso.md` at 9c0ed5f and 92b5f36. EVIDENCE: `git diff --stat origin/main...92b5f36` lists it. EXPECTED: the deletion commit before the pull request is marked ready and merged. FIX: delete that file only. It touches no code, so this verdict's findings hold for that commit; whether the verdict needs re-posting on the new head is the coordinator's process call.
- **N2.** UNIT: `tests/browser/adults-only.test.ts`, off-site step. VERDICT: note. REASON: it opens `/sign-in?next=https://evil.example/` directly, not through the refusal button. This is fine: the button cannot produce an off-site address (see Open redirect), so the step is really checking `safeNextPath` end to end, which is the risk that matters.

No follow-ups outside this change were found.
