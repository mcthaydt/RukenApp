# Privacy and terms pages: implementation audit 4

**5be5e00 FAIL: 1 red**

- Examined: PR #341 at 5be5e00, a merge of fbb489a (audit 3, which PASSed 01268fc) and main at ed9d4a9. Reviewer: Opus 5.5, medium. Audit only.

## The merge took only main's changes

- `git show --remerge-diff 5be5e00` is empty: git resolved everything itself, with no hand edits.
- `git diff ed9d4a9 5be5e00 --stat` is this pull request's 12 files and nothing else (the pages, sign-up, look.css, the tests, the this-repo line and the three audits).
- `vitest run tests/routes/privacy/cookies.test.ts tests/lib/look.test.ts tests/lib/glass.test.ts` at 5be5e00: 182 passed. Main brought no new cookie or browser-kept value.
- `git merge-tree` with main as it is now (4c08665) also merges cleanly.

## Red finding

### R1. The privacy page does not mention the computer keys main just shipped

UNIT: `src/routes/privacy/+page.svelte`.
VERDICT: red.
REQUIREMENT: criterion 2 (the page says what the code keeps today) and this pull request's own this-repo rule ("A change that keeps something new about a person … updates the page"). The page says "While you have an account, we keep what this page lists."
REASON: #331 ("Ruken from your computer", merged to main and now in this head) keeps new things about makers, and the page lists none of them. It shipped before this page existed, so the merge is where the page has to catch up.
EVIDENCE: `prisma/schema/accounts.prisma`, from main, adds `ComputerKey` (the computer's name, a SHA-256 of its key, when it was made and last used; it stops after 90 days unused) and `ComputerSignIn` (the computer's name and the city and country the sign-in was asked from, `startedFrom`, for ten minutes). `src/features/accounts/computer-keys.ts:163` keeps `startedFrom`, and `:182-188` deletes expired rows. `deletion.ts` removes both when an account is deleted. Pages `/me/computers` and `/me/link` exist. None of this is on /privacy.
EXPECTED: under "If you make games", a line such as: "**Your computers.** If you sign in from your computer (`npx ruken sign-in`), we keep each computer's name, a scrambled copy of its key, and when it was last used. A key stops working after 90 days unused, or when you remove it. While you say Yes, we keep the city and country the sign-in came from, for 10 minutes." Under "Your choices": "Remove a computer: go to You, then [the /me computers link's own words]." Under "How long we keep it", computers go on the list of what deletion removes. The "Last updated" date stays or moves to the day of the change.
FIX: those lines on the privacy page only. Read the button and link words from `src/routes/me/+page.svelte` and `src/routes/me/computers/+page.svelte` rather than guessing them. File: `src/routes/privacy/+page.svelte`.

## Notes

- N1. Audit 3's N1 (the this-repo line's `rk_` wording) and audit 1's N2–N6 still stand.

## Verdict

**5be5e00 FAIL: 1 red.** The merge itself is clean and took only main's changes. Main also brought a new kind of kept data, though, so the privacy page is behind the code at this head. Once the lines above are added, the re-check is a diff read.
