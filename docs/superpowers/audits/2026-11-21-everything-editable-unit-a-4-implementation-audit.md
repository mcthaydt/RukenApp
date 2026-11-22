# Everything editable, unit A: implementation audit 4 (re-check)

**836401f FAIL: 1 red**

- Examined: `mcthaydt/RukenApp` branch `claude/project-thread-85j3yr` at 836401f (two commits after audit 3's PASS at 5abd08d: 778190c and 836401f), against `main` at 6dcd1e0. No pull request yet.
- Scope: everything 5abd08d..836401f, checked for regressions against audit 1's R1 and R2, audit 2's N8 and audit 3's N9.
- Lane 3. Auditor: Opus 5.5, medium. Read only: nothing in the repo was changed (`git status` clean).
- Written 2026-11-21 18:36 UTC (from `date`).

## What I ran

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings (a first run failed only on `.svelte-kit/` build output my own earlier browser run left in this container, which is git-ignored; after removing it, clean) |
| `pnpm test` | 1706 tests passed |
| `pnpm test:pg` (local Postgres 16) | 43 files, 686 tests passed |
| `pnpm test:browser` for `make-live-changes`, `make-after`, `make-design-pass`, `make-look`, `make-second-look`, tablet and computer profiles | 212 passed, 108 skipped (the files' own skips), 0 failed |
| Same, phone profile (WebKit) | **not run**: WebKit is not installed in this container. CI must run it. |

## Red finding

### R3. Three files changed outside unit A's row (G6 again)

- UNIT: the diff 5abd08d..836401f.
- VERDICT: red (a gap against a written criterion; the fix is a document change only). Same kind as audit 1's R2.
- REQUIREMENT: G6, "No file outside the unit's row in section 6 changes".
- REASON: 778190c changes `src/routes/make/parts/GamePreview.svelte`, `src/routes/make/parts/preview.svelte.ts` and `src/routes/make/new/+page.svelte`. Section 6 row A and its added list (from R2's fix) name none of them, and the spec did not change in these commits.
- EVIDENCE: `git diff --stat 5abd08d 836401f` lists the three files; `grep` of the spec at 836401f finds no `GamePreview`, `preview.svelte` or `make/new`. Each change is needed and small: the card beside a question gets a `waits` flag so its heading reads "What players will see after we say yes" (`GamePreview.svelte`, `preview.svelte.ts`), and the new-game screen passes `waits: false` to satisfy the type (`make/new/+page.svelte`).
- EXPECTED: the files a unit changes are the ones its brief names.
- FIX: add the three files, each with its one-line reason, to the list under section 6 row A in `docs/superpowers/specs/2026-11-21-everything-editable-design.md`, and list them in the PR body for G6. No code change.

## Nothing else regressed

- **R1 and N8:** `service.ts` and `deletion.ts` are unchanged since 5abd08d; the race and purge pg tests pass.
- **N9 (question screens said "Waiting for review" for an unsent change):** fixed. The video and rating notes now read `hasPending` (`withStaff`, `ratingWithStaff`), as Live does, and say "Not sent yet. Players see the old one." / "Not sent yet. Players see 12+." The sent-back journey checks both screens and that "Waiting for review" does not appear on either.
- **Layout (778190c):** the wide frame shrinks on a 1200px+ landscape window only when a held video is shown (`data-waiting`), so Save and Keep the old one fit at 1280 by 800; the journey measures both buttons' bottoms against 800. Taller windows and other questions keep the usual width. The phone rule only tightens the gap under the "other video" link.
- **Test changes:** additions only, all in `make-live-changes.test.ts`, which this branch adds. No existing test was changed or removed in these two commits.

## Still owed before merge (open, not red)

- G1: the whole browser suite on CI, including the phone (WebKit) profile.
- G5: the PR body names every changed existing test (audit 1's list, plus `make-design-pass` P11, `make-after` link names, `tests/lib/look.test.ts`).
- G4: the coordinator reports design round 3 passed; I did not check it.

Once R3's spec lines are added, a re-check needs only to confirm the diff from 836401f is that spec edit.
