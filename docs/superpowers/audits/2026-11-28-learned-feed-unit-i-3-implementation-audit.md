# Learned feed unit I (a parent's yes), implementation audit 3

- PR: #457, head `f90f1219a6c224040a59c1a9e6efd7da3b594c12` (fixes in `91407eb`; the two commits after it touch only the live file).
- Spec: `docs/superpowers/specs/2026-11-22-learned-feed-design.md`, 6.5 and unit I; the PR's acceptance criteria.
- Lane 3 (a migration). Auditor: fresh session, Opus 5.5, medium. Written 2026-11-28 09:45 UTC.
- Scope: the three reds of audit 2 (`157c7c2 FAIL: 3 red`), plus whether the one refusal leaks through timing or any other path.

**Verdict: `f90f121` PASS.** No red findings.

## What ran, on `f90f121`

- `pnpm typecheck`: 0 errors. `pnpm lint`: clean. Unit suite: 170 files, 2,457 tests passed.
- `tests/features/feed/parent-asks.pg.test.ts` on a local Postgres 16: 18 of 18 passed.
- Not run: the browser journeys (no change to screens since audit 2; the only screen change is one problem line) and the full Postgres suite. CI on this head had only `pr-rules-run` queued when this was written.

## Audit 2's reds

1. **One plain refusal, counted toward three a day.** PASS.
   - `AskOutcome` now has one `refused-number` in place of `own-number`, `teen-number`, `said-no`, `number-busy`; `PROBLEMS` has one line for it: "We can't text that number. Type your parent's number." No other copy or code path names the reason (grep of `src` and `tests` for the old codes and words: none left).
   - A refused try is kept as a `ParentAsk` already ended (`revokedAt` set, no answer), so it counts toward the teen's three a day and never opens an ask.
   - Fails without the fix, each run by me: with the refused row not kept, "refuses the teen's own number ... the same way each time" fails (its fourth try, a number on no account, is texted instead of `too-many`). With the refused row kept open (no `revokedAt`), 3 tests fail (same test, the per-number test, the No test).
2. **Strict fallback and `.env.example`.** PASS.
   - `STAND_IN_PARENT_ASK_LIMITS.perNumberADay` is 3. Set back to 10, "holds to three texts a day to one number where its secret is missing" fails (run by me).
   - `.env.example` lists `FEED_PUBLIC` and `PARENT_ASK_LIMITS` as optional, with no real number.
   - The PR body names the RukenPrivate load step under "Follow-up for the deploy".
   - Deferring the RukenPrivate secret load is safe: with the secret missing, one number gets at most 3 asks a day from every teen together, the same as one teen's own limit, and the owner's rule (no one can flood a stranger's phone) holds. The only thing the secret adds is the option of a different private number. The follow-up should still be queued so the secret exists when the owner wants to tune it.
3. **Wishlist flake recorded.** PASS: under Flaky tests in `progress.md`, with the run, attempt, commit, shard and likely (unproven) cause.

## Does the refusal leak?

- **Words and response:** every refused reason returns the same `fail(400, { name, country, phone, problem })` with the same line. Nothing is logged per reason.
- **Order:** `too-many` is checked before the number, so a fourth try says nothing about the number typed.
- **Timing:** a number on a teen's account (or the teen's own) is refused after one lookup; a No'd or busy number after one or two more counts in the same transaction. That gap is a few database round trips. It could only tell "a teen's number" from "No'd or busy". The teen already knows their own No's, a busy number needs three asks to it the same day, and each probe spends one of three tries a day. Not worth fixing. Note only.
- **What is inherent:** "can't text" versus "texted" still tells a teen that a number is on a Ruken account that is not a known adult's (or busy). The spec requires refusing those numbers, and the texted branch sends a real text to the number, so this oracle costs a text to a stranger or a try, at most three a day. This is the shape audit 2 asked for. Note only.

## Notes (not blocking, not fixed here)

- **N1. Refused tries fill a number's daily cap without texting it.** The per-number count (`parent-asks.ts`, the `phoneHash` count) includes refused rows. Probe, run by me and then removed: with the cap at 3, teen A asks parent P (texted), P says No, A tries P twice more (refused, no text); then sibling teen B asks P and gets `refused-number` with only 1 text ever sent. So after a No, one sibling can block the parent's number for the other for a day. Small; the code comment says "texted only so often", which the code doesn't quite match. A bounded fix, if wanted later: count only rows that were texted (for example, exclude rows refused at birth), in `parent-asks.ts` and its pg test.
- **N2. Merge conflict with `main`.** `git merge-tree origin/main f90f121` (main at `7d058b7`) conflicts in `tests/browser/controls-overlap.test.ts`, outside `progress.md`, so this PASS does not carry through that merge: the merge commit needs its own check before it merges.
- **N3. Deploy follow-up.** Queue the RukenPrivate step (`wrangler secret put PARENT_ASK_LIMITS --name ruken` in `private-worker.yml`, lane 3 there).
