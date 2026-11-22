**8c50e2d PASS**

Lane 3 re-audit of #209 at 8c50e2d. Since f404b47 (last PASS): 465dc2a merges main (#280 spec, and the throw-away-waiting / change-or-delete-taken-off games work), and 8c50e2d changes two `signInAs` calls in `tests/browser/make-waiting-and-off.test.ts` to the phone shape `(page, number, password)`. Read only.

## Checked
- The merge is clean: `git show --remerge-diff 465dc2a` shows no conflict resolution, so no line differs from an automatic merge.
- 8c50e2d is 2 lines, test only, and makes main's new journey sign in the way every other journey on this branch does. Nothing in the test is loosened.
- No journey on the branch still uses an email sign-in shape.

## What I ran at 8c50e2d
- `pnpm typecheck` 0 errors (1961 files), `pnpm lint` clean.
- `pnpm test`: 118 files, 1820 passed. `pnpm test:pg` on local Postgres 16: 49 files, 761 passed.
- Browser journeys, tablet and computer: make-waiting-and-off, purged-account, make-game-crud: 18 passed, 0 failed. The phone profile (WebKit) can't start in this container; CI runs it.

No findings.
