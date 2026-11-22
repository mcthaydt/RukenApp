# Unit I, editing your page: implementation audit 2 (lane 2)

Commit examined: `4437f1b` on `claude/project-thread-dkbck6` (merges `main` at `aedd00d` in `d97c110`). Audit 1: `2026-11-21-edit-page-1-implementation-audit.md`, at `2428774`.
Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-21 (times from `date`, see the thread).

## Verdict

**4437f1b PASS.** The three reds from audit 1 are fixed and checked by a program. Notes stay notes.

## What ran

| Check | Result |
|---|---|
| Merge with `origin/main` | `main` already merged in (`d97c110`); no conflict |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors (an earlier run counted errors only in `.svelte-kit/` build output left by this container's own journey runs; removed and re-run) |
| `pnpm test` | 1,779 passed |
| `pnpm test:pg` | 721 passed (5 new: updateLink and removePage) |
| Every journey, computer profile | 475 passed, 62 skipped, 12 failed in money, membership, pay, purge-job, rejoin and change-credentials. All 12 came from this container reusing the test database of the earlier run while the Stripe stand-in started empty ("No such invoice"). Those six files re-run on a fresh database: 33 passed |
| `edit-page`, `make-second-look`, `make-games`, tablet | 32 passed |
| Phone (WebKit) | not run: WebKit is not in this container; left to CI |

## Audit 1's reds

- **R1, fixed.** `src/routes/make/+page.svelte` puts "Your page · Maker agreement" in one note. `make-second-look.test.ts:302` passes on tablet and computer, and the test itself is unchanged.
- **R2, fixed.** `updateLink` in `src/features/pages/service.ts` changes kind, words and address where the link sits. Pg tests show the place, taps and hidden state stay, refusals use the add-link words, and another maker's id is NOT_FOUND. The journey changes "My Discord" to "Our Discord" through "Change", is refused on `http://`, and reads the new words on the public page. Another maker's GET of both change questions is 404.
- **R3, fixed.** `removePage` plus `/make/page/take-down` ("Keep my page" focused first; "Take my page down" is red, and the act cannot be undone). The journey covers keep, take down (the address 404s, status "Your page is down."), and making a page again at the same address. A new journey shows the page staying through the 14 days after an account deletion and gone after the purge. Pg tests show links, photo file and address go, and no other page is touched.

## Notes (not blocking, carried or new)

- N1 to N4 from audit 1 stand (the "Saved." on a page that already exists, the unused `buttonText` in `ThemePicker`, the 512px cut not checked, links listed in plain style).
- **N5.** `src/routes/make/page/take-down/+page.svelte`: `if (sending) cancel();` has no `return`, the same shape `QuestionScreen` was fixed for in this unit. The button is also `disabled` while sending, so a double press is already stopped; adding `return` would match.
- **N6.** The take-down journey opens `/make/page/take-down` by its address and never taps the "Take my page down" link on the rooms. One `getByRole("link", { name: "Take my page down" }).click()` would prove the way in.
- **N7.** The change-link `save` action posted by another maker is covered by the pg test (NOT_FOUND) and maps to 404 in code, but no journey posts it the way the other five actions are posted.
