# Privacy and terms pages: implementation audit 2

**18acda4 FAIL: 1 red**

- Examined: `claude/project-thread-xa97zr` at 18acda4, which fast-forwarded to audit 1 (8d860b2) and added 040058f (live state) and 18acda4 (fixes). The live-state file is gone at 18acda4.
- Lane 2, re-check of audit 1's six reds. Reviewer: Opus 5.5, medium. Audit only; nothing but this file changed.

## What ran

- `vitest run tests/routes/privacy/cookies.test.ts tests/lib/look.test.ts`: 139 passed.
- The cookie check fails by itself: with `<strong>page-saved</strong>` changed to `<b>`, it fails and names `page-saved` (1 failed, 2 passed). The page was restored afterwards.
- Playwright on tablet and computer, against `wrangler dev` and a local Postgres 16: `legal-pages.test.ts`, plus the privacy and terms cases of `look.test.ts` and `look-layout.test.ts`. 14 passed. The phone (WebKit) project was not run here; CI runs it.
- A throw-away probe (not committed) read the lists' computed style and shot both pages on tablet and computer.

## Audit 1's reds

- **R1 PASS.** The page lists `ruken_sign_up` (10 minutes) and `page-saved` (1 minute), matching `forms.ts:46-48` and `page-words.server.ts:10`. The check now reads the name handed to every `cookies.set(` and `local/sessionStorage.setItem(`, through constants. It treats any name it can't read as missing unless `PASSED_THROUGH` names it. Both entries in `PASSED_THROUGH` are the session cookie, as `cookies.ts:39` and `forms.ts:384` show. The `rk_` net is kept, which still covers `rk_welcome_back` (set through better-auth's `setCookie`).
- **R2 PASS.** Logs now say Cloudflare keeps a record of each visit (`wrangler.jsonc:18`). They add the error notes and the GitHub-accounts note (`make/github/callback/+server.ts:36`).
- **R3 PASS.** The page says `rk_arrival` is set by any maker's page or game's page, feed taps included, and runs 400 days from the last time. That matches `g/[game]/+page.server.ts:37`, `[handle=handle]/+page.server.ts:18` and `services.ts:156`.
- **R4 PASS.** Remaining records are now "with no phone number or email". For makers, the page adds the game's name and line, the GitHub repository and staff notes, and notes that a page's old address stays on members' records. All of this matches `deletion.ts` (`takeGamesOff`) and `arrivalPath`.
- **R5 FAIL, as R1 below.** The lists are custom on both pages. Computed style on tablet and computer: `list-style: none`, 20px indent, a 6px square in `--felt-raised`, 8px between points, and nothing wider than the screen. All 14 lists on /privacy and 6 on /terms carry `bullets`, and none is left plain. `bullets` is added to the class list `tests/lib/look.test.ts` allows. The one defect left is the duplicated rule (R1 below).
- **R6 PASS.** The comment names `tests/routes/privacy/cookies.test.ts`.
- **N1 taken.** The "While you sign up" line matches `PendingSignUp` (hashed number, hashed password, `adultOn`) and `Verification` (the code by the number), each up to 10 minutes.

## Red finding

### R1. The `.card ul.bullets` rules appear twice, and the two copies disagree

UNIT: `src/lib/look.css`.
VERDICT: red (low).
REQUIREMENT: this-repo, "Write code a junior developer can follow" and "Do not overengineer". Audit 1's R5 fix, which asked for one rule block.
REASON: the same five rules are pasted twice. The first copy sets `margin: 0.75rem 0 0` and the second `margin: 1rem 0 0`, so a reader of the first copy gets the wrong spacing.
EVIDENCE: `grep -n '^\.card ul\.bullets {' src/lib/look.css` finds lines 2043 and 2074. The computed `margin-top` on /privacy and /terms is 16px, so the second copy wins and the first is dead.
EXPECTED: one block, the one that renders today (`margin: 1rem 0 0`), with its comment.
FIX: delete the first copy, lines 2040–2070 (its comment, five rules and the blank line after). Nothing else changes, and the shots stay the same. File: `src/lib/look.css` only.

## Notes

- N1. **Main conflicts.** Main is now c3c4d68. `git merge-tree origin/main 18acda4` conflicts in `.claude/skills/this-repo/SKILL.md`, because #330 added the frosted-glass line next to this branch's new line. The builder merges main and keeps both lines. A merge with a resolved conflict needs a re-pointed PASS (project practice), so the fix and the merge can go in one push and be re-checked together.
- N2. Audit 1's notes N2–N6 (two Stripe dashboard settings, lines for the lawyer, `__Host-rk_session`, pre-launch play, the unsent launch email) still stand. None of them blocks this change.

## Verdict

**18acda4 FAIL: 1 red** (a duplicated CSS block). All six of audit 1's reds are fixed in the page and the checks. Delete the first copy of the `.card ul.bullets` rules, merge main (resolving `this-repo`), and the re-check is a diff read.
