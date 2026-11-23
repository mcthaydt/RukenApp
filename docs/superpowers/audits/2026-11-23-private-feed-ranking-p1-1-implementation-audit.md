# P1 audit: the private-move spec, the trimmed learned spec, progress.md (PR #360)

- Examined: PR #360, branch `claude/project-thread-t02epm`, head **`2f07b8128eaefae2d976f7b676e7a8989a1ea7dc`**, against `origin/main` (merge base of the PR) and against plan audit 3's PASS at `05e6bfc`.
- Reviewer: Opus 5.5, medium, `review` skill, a fresh session that wrote none of this.
- Lane: 1 (docs only: three files under `docs/superpowers/`).
- **Verdict: `2f07b81` PASS.** No red. Two notes, kept as follow-ups.

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| Diff touches only P1's files | PASS | `git diff --stat origin/main...2f07b81`: `progress.md` (+15), `specs/2026-11-22-learned-feed-design.md` (+113 / −256), `specs/2026-11-22-private-feed-ranking-design.md` (+155, new on `main`). No code, no live-state file (`docs/superpowers/live/` empty at the head). |
| Private-move spec unchanged since its PASS, apart from recorded additions | PASS | `git diff 05e6bfc 2f07b81 -- …private-feed-ranking-design.md`: one added line, the P8 row (`pr-rules` in RukenPrivate, lane 3, waits on P0 and C10). It matches the P0 audit's note and the coordinator's record (P8 added 2026-11-22 20:45 UTC). Nothing else in the passed spec changed. |
| Trimmed learned spec matches section 4 of the passed plan | PASS | Keeps sections 0, 1, 3, 4.1, 4.7, 6, 10 and the public halves (section 7). Section 3: `FEED_SETTINGS` becomes `FEED_PUBLIC` on `ruken` (only `learned`, `teenPersonal`, `windowDays`) and `FEED_SETTINGS` on `ruken-private`, both loaded by RukenPrivate's workflow. 10.1 keeps `docs/feed-sky.md` in words, marked **Call**. 10.2 gains the Repo column, with `teenPersonal` and `learned` (who is `full`) in RukenApp and `learned` alone, `highTaste`, `sky` in RukenPrivate, as the plan says. 6.6 and unit L carry the "stays true" rule. Unit table: A split at `Ranker`; B, C, D, E, G, I, L public with each scoring step (B's echo/second try, C's learned mood, D's taste and Good pick rule, E's slot pick, G's likes in the order) as the private half; F the line only; H `docs/feed-sky.md` and H3; K K3 and a neutral route only if needed. |
| The ranking, setting key list and hidden layers' units are gone | PASS | Grep of the trimmed file for weight, half-life, decay, percent, multipliers, `settings.json`, epsilon: the only hits are the prohibition itself (section 3, "No ranking rule, weight, …"), "boost" in the Owner's words and in H3/K3/10.x tests, "seed" (crowd surprises use their own seed; no value), and "no sky lift" (10.2's test). No setting key other than the three public ones; no number from RukenPrivate. |
| Pointers to RukenPrivate resolve | PASS | `gh api repos/mcthaydt/RukenPrivate/contents/…`: `feed/2026-11-22-learned-feed-design.md` (blob `0fc90f3`) and `strategy/2026-11-15-feed-design.md` (blob `05f171e`) both exist. |
| No secrets | PASS | `git grep` of the three files for key shapes (`AKIA`, `sk_live`, `sk_test_`, `BEGIN PRIVATE`): none. Secrets are named only (`FEED_PUBLIC`, `FEED_SETTINGS`, `LIMITS`), never valued. |
| `progress.md` merge kept both sides | PASS | `git diff --numstat origin/main...2f07b81 -- progress.md`: 15 added, 0 removed, so every line on `main` is kept. No conflict markers (`grep -c '^<<<<<<<\|^>>>>>>>'` = 0). Additions: three Owner entries (20:22, 20:25, 20:37 UTC) under the Owner log, nine P0–P8 rows in the stage table after `main`'s last row, three flaky entries under Flaky tests. Rows agree with the spec (lanes, waits) and with memory (P0 merged `018ccc9`; RukenPrivate #20 `3526137`). |
| CI | green per the coordinator; not re-run here (docs only). |

## Notes (not blocking, follow-ups)

**N1.** UNIT: `specs/2026-11-22-learned-feed-design.md` section 3 and I1. VERDICT: note. REQUIREMENT: private-move spec section 6 ("new numbers are private"; the Owner, 20:25 UTC, put text-code abuse limits private) and C13. REASON: the trimmed spec still states the parent-text cap as "at most three per teen a day" (lines 33 and 246), and B2's `watchedMs` cap as "three times the clip's length" (line 163). EVIDENCE: both lines are identical on `main` (lines 45, 240, 339 there), so this PR publishes nothing new, and section 6 leaves numbers already in public history public. EXPECTED: when unit I and unit B are built, their caps read from `LIMITS` by name with a placeholder public default, as C13's architecture test will require; the spec's figure is then a public placeholder, not the live number. FIX (optional, for P6 or unit I's builder, not here): word the cap as "a daily cap from `LIMITS`" in the spec; touches only this spec file.

**N2.** UNIT: `specs/2026-11-22-learned-feed-design.md` 10.2. VERDICT: note. REASON: "it is on in the private settings" states the live value of `teenPersonal`. EVIDENCE: the same fact is in the Owner's recorded decision on `main` (16:40 UTC, "No, turn it on anyway") and the key is one of the three public `FEED_PUBLIC` keys, so nothing new leaks. EXPECTED/FIX: none needed; recorded so a later reviewer does not raise it again.
