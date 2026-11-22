# Implementation audit: frosted glass rule (PR #330), round 1

Commit examined: 1268405 (branch claude/project-thread-b1h8tt). Written 2026-11-22 16:45 UTC. Reviewer: fresh session, Opus 5.5, medium.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: PASS.** No red findings. One note.

## What was checked, and how

- **Diff is the single line.** `git diff --stat origin/main...1268405`: `.claude/skills/this-repo/SKILL.md | 1 +`. Commits: 4727bb7 (the rule), 863ca70 (live state removed), 1268405 (merge of main, clean). Merge base 23d178f = `origin/main`.
- **Quote is faithful.** Bullet text equals the owner's 13:46 UTC words as recorded in project memory and in the `look.css` comment (line 101, first clause).
- **Tokens exist and match the rule.** `src/lib/look.css` on main: `--glass-bg: rgb(17 19 20 / 0.12)`, `--glass-filter: blur(24px) brightness(0.29) saturate(1.3)`, `--dim-bg: rgb(17 19 20 / 0.62)`, `--dim-filter: blur(6px)`. Comment says they are the editors' pop-up glass (layer 2): matches "the Automata Framework editors' pop-up glass".
- **"Both prefixes set" matches the guard.** `glass.test.ts` test 1 fails on any `backdrop-filter` not equal to `var(--glass-filter)` or `var(--dim-filter)`, and on a rule with one of the two properties but not the other. Every current user on main (look.css lines 2292-2294, 2553-2555, 2907-2909, 2976-2978) sets both.
- **"Never a colour with see-through of its own, never opacity on a surface" matches the guard.** Test 2 fails on an alpha colour in any notation, a mix or gradient with `transparent`, or a partial `opacity` / `filter: opacity()` on a rule that has a background; the token block in `:root` is exempt.
- **"Turn solid where there is no blur, less see-through or more contrast"** is backed by `@supports not (backdrop-filter…)` (look.css 116) and `@media (prefers-reduced-transparency: reduce), (prefers-contrast: more)` (124). See N1 for the dim.
- **No contradiction with the kit or CLAUDE.md.** `grep -i "glass|transparen|opacity"` over CLAUDE.md and every other skill finds nothing; within `this-repo` the bullet is the only one. It sits with the other look rules after "Every wait shows it", in the same form (owner quote, shared piece, guard test). It is consistent with the owner's rule that everything is custom and with "Do not overengineer" (it points at existing pieces and adds none).
- **PR body.** Starts and ends as required ("Requested by **McThayDT**" precedes the proxy footer, which the hooks ignore per project memory). It names the `this-repo` edit, as CLAUDE.md asks.
- **CI on 1268405:** every check was `queued` at the time of this audit (commit-authors, verify, postgres, six browser shards). This audit does not cover CI; the merge waits for green as the lane says.

## Notes (not blocking)

**N1.** UNIT: `.claude/skills/this-repo/SKILL.md` line 55. VERDICT: note. REQUIREMENT: accuracy (Report honestly). REASON: "the tokens already turn solid" is true of the glass but not of the dim: in both fallbacks `--dim-bg` keeps its 0.62 tint and only `--dim-filter` becomes `none` (look.css 114-130, whose comment says "while a dim still dims"). EVIDENCE: look.css lines 116-130 reset `--glass-bg`, `--glass-filter`, `--dim-filter` only. EXPECTED: e.g. "the glass turns solid and the dim stops blurring where there is no blur, less see-through or more contrast". The practical instruction ("with nothing to add") is still right, so no one is misled into wrong code. FIX: that one sentence, same file, if the implementer chooses.

**N2.** See the plan audit's N1 (lane reason in the PR body).
