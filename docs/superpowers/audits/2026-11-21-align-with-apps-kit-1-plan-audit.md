f6ba426 FAIL: 2 red

# Plan audit: align Ruken's rules and records with the apps kit (cycle 1)

Pull request #280, head `f6ba426`, spec `docs/superpowers/specs/2026-11-21-align-with-apps-kit-design.md`. Lane 3 plan audit, read only. Written 2026-11-21 20:29 UTC (from `date`).

## What I compared, myself

- The kit: https://mcthaydt.com/prompts/claude-md-apps/ fetched with `curl` (HTTP 200, 990,351 bytes). I pulled out its 56 `<pre>` blocks and rebuilt CLAUDE.md, the seven shared skills, `verify`, `settings.json`, `after-compaction.md`, `rules.mjs`, `rules.json` and the Project instructions.
- Ruken at PR-R's head `cdc520b` (the spec's stated base), plus `main` at `fe5f5ee`.
- A sentence-by-sentence diff of CLAUDE.md and every skill. The only differences are Ruken's filled blanks, the #99 rules (owner questions and hooks), and the `history.md` → `progress.md` repointing. The spec is right that these match.
- `after-compaction.md`: identical. `settings.json` and `rules.json`: Ruken adds the merge-tool allow rule, blocking hooks on the GitHub MCP tools, `prRoutes`, the proxy footer and `lanePaths`. Nothing the kit has is gone.
- `rules.mjs`: I checked all 179 long literals in the kit against Ruken. The ones that look missing are extraction noise, with one real difference. The kit's `onlyRulesAndDocs` lets a branch with only rules and docs open past the 3-PR limit, and Ruken counts every PR. That is stricter, and it is the owner's own card. See N1.
- Measured with `gh api`: #240 merged 2026-11-20 23:02 UTC, #241 23:42 UTC, #268 2026-11-21 16:00 UTC, #274 19:16 UTC, #276 20:00 UTC, #277 20:07 UTC. Protection on `main` requires `["gate","commit-authors"]`. #279 is open and `mergeable: false`.
- Criteria 3 and 4 hold today. On `cdc520b`, `history.md` appears only in `progress.md`'s History note. No hook, settings or workflow file is in the plan.

The spec invents no rule. It weakens no hook, since no hook file, `settings.json` or workflow is touched. It keeps the dated standing permissions as records, and F1 marks one line not in force without deleting it. F1 and F5 are correct as written. CRUD does not apply, because the change adds nothing a user can make.

## Red

**R1. F4 leaves out most of the owner's missing instructions.**
UNIT: spec, F4. VERDICT: red.
REQUIREMENT: F4's own expected result ("every owner instruction is in the record, with its date") and the kit's `owner-updates`: "The record's writer writes each owner instruction into it in the turn it is given".
REASON: the fix lists only five instructions (14:32, 19:30, 19:59, 20:02, 20:19). Project memory holds many more that `progress.md` on `cdc520b` does not have.
EVIDENCE: project memory `owner-instructions` and the related owner files list these, none of them in `progress.md`:
- 2026-11-20 22:32 UTC (the one-time computer run for setup)
- 2026-11-20 22:33 UTC (a new "Finish Ruken" thread after setup)
- 2026-11-20 23:38 UTC ("this is taking too long", meaning run units in parallel)
- 2026-11-21 00:05 and 00:09 UTC (approve Floor Fifty again, and rotate the jobs secret)
- 2026-11-21 03:12 UTC ("clean up our tests for our new paradigm")
- 2026-11-21 03:26 UTC card (three devices: iPhone, iPad, computer)
- 2026-11-21 06:05 UTC card (shoot only the screens a change touches)
- 2026-11-21 06:54 UTC ("add a permission rule": the merge and ready tools; the spec itself cites this one)
- 2026-11-21 08:56, 08:57 and 09:17 UTC (Notion is the second brain, keep it current, private notes go there)
- 2026-11-21 14:26 and 14:28 UTC (just edit the submission; "Everything, reviewed first")
- 2026-11-21 15:07 and 15:08 UTC (add the phone to the existing account; "Lane 3 is permitted" for #209)
- 2026-11-21 19:16 UTC ("I created a workflow that should not need my intervention", a safety or access gap goes straight to a fix)
- the PR-H cards (commit-authors ignores only the exact proxy footer; docs-only PRs count toward the limit; forks are never counted or closed)

EXPECTED: after the fix, every owner instruction in project memory is in `progress.md` with its date. Ones already met can be marked done.
FIX: F4 checks every owner entry in project memory against `progress.md` and adds each missing one, quoted where memory quotes it and marked as a paraphrase where it does not. Files: `docs/superpowers/progress.md` only.

**R2. F2 and F3 leave other stale sections in place, one of which F4 would contradict, and add no stage rows.**
UNIT: spec, F2 and F3. VERDICT: red.
REQUIREMENT: the spec's outcome ("nothing in RukenApp's ... process records contradicts the kit"); `owner-updates` (current work, completed outcomes, remaining work); CLAUDE.md Settings, Progress: "the coordinator keeps each stage's row in `progress.md` up to date, with a percentage from the plan's ticked steps"; `staged-path`, Splitting: each unit's "status is in `progress.md`".
REASON: F2 and F3 fix only the active milestone and "Everything editable". Three more parts of the same file are stale, and the file has no stage rows.
EVIDENCE:
- `progress.md:42` says the slice 2 slice end is "in progress, branch `claude/project-thread-7wmhqn`". That branch returns 404, and its pull request #266 merged 2026-11-21 14:26 UTC.
- `progress.md:50-52` "Slice 3 parked" says "Units D and I are paused". Once F4 adds the 14:32 UTC instruction (slice 3 unparks once the editing work lands, which it has: #274 and #276), this section contradicts it.
- `progress.md:3` "Last updated: 2026-11-21 16:00 UTC".
- No section has a stage row with a status and a percentage.

EXPECTED: every section above History states what is true now, measured from `gh api` and `date`. Each running stage or unit has a row with its status and a percentage from its plan's ticked steps, or "no plan" on the short path.
FIX: widen F3 to cover "Slice 2", "Slice 3 parked" and "Last updated", and add the stage rows to F2's rewrite. Add a criterion: no section above History names a branch that does not exist or a merged pull request as open. Files: `docs/superpowers/progress.md` only.

## Notes (not blocking)

- **N1.** The line "the one known place Ruken differs from the kit on purpose" (Source of truth, repeated in the report) is not accurate. Owner-chosen, stricter differences also exist: every same-repo PR counts toward the limit (the kit's `onlyRulesAndDocs` exempts rules-and-docs branches), forks are not counted, commit-authors ignores the exact proxy footer (`footerStrippedByCi: true`, `proxyFooter`), and there is the merge-tool allow rule with its blocking hooks. Naming them as deliberate would stop a later session from "aligning" them away.
- **N2.** F4 adds the 19:59 UTC instruction (no written rule says "merge without asking"). Standing permissions `progress.md:79` still quotes "without asking the owner". As a dated quote it is a record, not a rule, and the coordinator asked that it be kept. The spec should say so in one line so the implementation audit doesn't flag it.
- **N3.** The "already matches" comparison was measured on `cdc520b`. #279 currently has a merge conflict, so the implementer should rerun the comparison on `main` after #279 merges and before building.
- **N4.** CLAUDE.md's owner-questions line ends "If something outside this list is brought to the owner, say so." The owner's words, and the project instructions, say the owner will call it out. The meaning is close but not the same. It is CLAUDE.md wording (lane 3, PR-R's), so it is reported here and not added to this spec.

Graphify: not used. The change is two Markdown files with no code symbols.
