# Phone sign-in (#209): main merge, round 6 implementation audit

**1a1809c PASS**

Lane 3 re-audit of #209 at 1a1809c, the merge of main a038c20 (#283 to #291, #295) into 8c50e2d (last PASS). Opus 5.5, medium. Read only, apart from this file. Written 2026-11-22 03:16 UTC.

## The conflict resolution

- `.claude/skills/verify/SKILL.md` (the only conflict): main's new list of journeys (Feed, Sign up, Sign in, Your account, Delete, Send a game, and so on) is kept whole. Its email lines are rewritten for phone: Sign up keeps the branch's phone and texted-code steps; Sign in names the phone number and the texted reset (`sign-in.test.ts`, `forgot-password.test.ts`); Your account shows the number and names `change-password.test.ts`, with "no email to change". Main's Home line is replaced by its Feed line, as main intended. The named test files exist on the branch.

## Main's changes that touch #209's files

Every file both sides changed since the last merge (8 files) was read:

- `tests/browser/adults-only.test.ts`: main's new sign-in-from-the-refusal journeys now type a phone number (`nationalOf(account.number)`) and return `{ number, password }`; `forgetAgeOf` takes the number. Nothing asserted was removed.
- `tests/browser/edit-page.test.ts`: main's page journeys sign in with `signInAs(page, number, password)` and make the deletion due by number. Same assertions.
- `src/features/games/service.ts`, `look-layout.test.ts`, `look.test.ts`, `fake-stripe-server.ts`, `review.pg.test.ts`: merged without conflict; `git show --remerge-diff 1a1809c` shows no hand edits there. `makerEmail` is gone from the waiting-games list and nothing reads it.
- Main's new code (maker page editing) adds no use of a person's email.
- No journey on the branch still signs in by email.

## What I ran at 1a1809c

- `pnpm typecheck`: 0 errors (2011 files). `pnpm lint`: clean.
- `pnpm test`: 123 files, 1850 passed.
- `pnpm test:pg` on local Postgres 16: 49 files, 723 passed. The count is lower than at 8c50e2d (761) because main removed pg tests in this range: counting `it(`/`test(` lines in `tests/**/*.pg.test.ts`, main went 660 to 624 (-36) and the branch went 696 to 660 (-36), so the merge dropped none of the branch's own.
- Browser journeys, tablet and computer: adults-only, edit-page, look-layout, look, membership, review-job, purged-account, change-password, sign-in: 198 passed, 0 failed. The phone profile (WebKit) can't start in this container; CI runs it.

No findings.
