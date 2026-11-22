# Privacy and terms pages: implementation audit 5

**a5d0b36 PASS**

- Examined: PR #341 at a5d0b36. It fast-forwards from audit 4 (8e73f8b) with 46748e8 (live state, later removed) and a5d0b36. `git diff --stat 8e73f8b a5d0b36` shows only `src/routes/privacy/+page.svelte` (+12/-1). Reviewer: Opus 5.5, medium. Audit only.

## Audit 4's R1, line by line against the code

- "Your computers … its name, a scrambled copy of its key, and when it was let in and last used": `ComputerKey` keeps `name`, `keyHash` (SHA-256), `createdAt` and `lastUsedAt` (`computer-keys.ts:343`). Placing it under "Your account" is right, because `/me` links "Your computers" for every account (`src/routes/me/+page.svelte:42`).
- "A key stops working after 90 days unused, or when you remove it": `KEY_UNUSED_DAYS = 90` (`:17`, checked at `:366`). The "Remove" button is in `src/routes/me/computers/+page.svelte:45`.
- "We keep the city and country it asked from, to show you before you say Yes": `startedFrom` (`:163`), shown by `placeWords` and `placeWarning` (`:103-118`).
- "The code works for 10 minutes, and old codes are cleared out as new ones come in": `CODE_LIFETIME_MS = 10 * MINUTE_MS` (`:16`), and `startSignIn` deletes up to 10 expired rows before it makes a new one (`:150`, `:180-189`). This is more accurate than audit 4's suggested "for 10 minutes": an expired row stays until the next sign-in starts.
- "every computer you let in is removed" on deletion: `requestDeletion` deletes `computerKey` and `computerSignIn` rows at the time of the request (`deletion.ts:70-72`).
- "Remove a computer: go to You, then 'Your computers', then 'Remove'": all three words are on screen, as above.
- No other file changed, so audit 3's checks (182 unit tests) and audit 2's journeys still hold for everything else.

## Notes

- N1. A changed or reset password also removes every computer (`computer-keys.ts:413`). The page could add "or when you change your password". It is not wrong without it.
- N2. Audit 3's N1 and audit 1's N2–N6 still stand.

## Verdict

**a5d0b36 PASS.**
