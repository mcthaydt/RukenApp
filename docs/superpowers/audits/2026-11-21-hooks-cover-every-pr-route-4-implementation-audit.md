# Implementation audit 4: hooks cover every PR route, PR-R re-check

**d5d4dd9 FAIL: 1 red**

Branch `claude/project-thread-c0wy83` at `d5d4dd9` (cb81afe, 9632dc0, d5d4dd9 on `main`). Re-check of audit 3 (cb81afe FAIL, R1). Written 2026-11-21 20:00 UTC (`date`). Read only.

## What ran

- `git diff cb81afe d5d4dd9`: only `CLAUDE.md` (lines 33, 34, 61) and `docs/superpowers/history.md` (one new Standing permissions line). Both workflow files are unchanged since cb81afe, so audit 3's footer run (19 bodies) and criterion 6 grep still stand. History.md is a doc (`ruleMix.docPaths`), so the mix is allowed.
- All three commits authored and committed by McThayDT; d5d4dd9 quotes the owner's 19:59 UTC words. I did not read the owner's 19:58 and 19:59 messages myself; the quotes come from the commit and the coordinator.

## R1 from audit 3: closed

- Line 34 (Merge permission): lane 3 needs "the owner's approval or the standing permission recorded under 'Standing permissions'".
- Line 61 (Lane 3): checks, plan audit, implementation audit, green CI, "plus the owner's approval or the standing permission recorded … covering the exact action".
- `history.md` line 20: every pull request, lane 3 and Cloudflare included, merges once its audits pass and CI is green; it replaces the 2026-11-20 Cloudflare exception.
- Read together, no line demands per-PR owner approval where that permission applies. The hook's lane notice (`rules.mjs` 1361, "or a recorded standing permission") now agrees too.

## Red

### R2. The owner-questions bullet still says merges go without the owner

- UNIT: `CLAUDE.md` line 33.
- VERDICT: red.
- REQUIREMENT: the owner, 2026-11-21 19:59 UTC (quoted in d5d4dd9): "Remove the merge without asking and double check if that's mentioned … because that shouldn't be there"; the coordinator's re-check brief: the owner-questions bullet has no merge wording.
- REASON: the bullet still reads "Process snags (merges, pull request slots, footers, audit paperwork) are settled without the owner." That says merges are settled without the owner, which is the merge-without-asking wording in other words.
- EVIDENCE: `git show d5d4dd9:CLAUDE.md`, line 33.
- EXPECTED: no CLAUDE.md line says merges go ahead without the owner; merge permission lives only in lines 34 and 61, which point to `history.md`.
- FIX: in `CLAUDE.md` line 33 only, drop "merges, " from the parenthesis, so it reads "(pull request slots, footers, audit paperwork)". Nothing else.

## Notes (not blocking)

- N1. `history.md` line 19 (2026-11-20) still says "Live Cloudflare and console switches still need the owner", and line 20 says it replaces that exception. Consistent as written, but a reader of line 19 alone is misled; consider marking it "(Cloudflare exception replaced 2026-11-21, see below)".
- N2. Audit 3's N1, N3, N4, N5 (resolved by the record), N6 stand as written. N2 (missing "hook paperwork", "re-audits") still stands.

## Re-check

On the fix commit: line 33 has no merge wording, and the diff from d5d4dd9 touches only line 33 (plus any notes taken).
