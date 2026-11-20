# Live state: branch B (phone sign-in and forgot password)

- Task: build Tasks 3, 4 and 5 of docs/superpowers/plans/2026-11-15-texts-not-email.md on top of main at cfa20b4. Lane 3, stays a draft and unmerged until Step 1a and the owner's OK.
- Last commit: caa7faa (tables, limits, better-auth setup, forms, screens, first owner, purge, paid-with email, journeys moved to numbers; unit and database tests green, lint and typecheck clean)
- Next step: run the new browser journeys (sign-up, sign-in, forgot-password) against the built site, fix what they find, then build, push, open the draft PR.
- Open decisions: none. The ruken_sign_up cookie must not use the __Host- prefix (its path is /sign-up).
- Updated: 2026-11-20T00:20:34Z
