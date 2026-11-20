# Plan audit: CI screenshots in R2, cycle 2

Examined: spec `docs/superpowers/specs/2026-11-20-ci-screenshots-in-r2-design.md` at commit `e4208bb` (branch `claude/project-thread-277u1i`, draft pull request #211), against cycle 1 (`2026-11-20-ci-screenshots-in-r2-1-plan-audit.md`, which examined `8bf3e49`), `main` at `36e87c0`, and the shared skills `release`, `visual-check` and `this-repo` on `main`. Lane 3 plan audit (`review`, `staged-path`).

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**Cycle 1's three reds are fixed. 2 new red, 3 notes.** Both reds come from the two additions made in the fix round, not from the cycle 1 fixes. Unit C can start once they are settled.

## Cycle 1, checked

| Finding | Status at `e4208bb` | Evidence |
|---|---|---|
| R1, the "no secrets" comment | fixed | Step 1 now ends: rewrite the comment above `permissions`: one secret, this step's `env` only, a fork gets none (A5), the token reaches one bucket (A9). |
| R2, the Owner quoted in the commit | fixed | Step 4: "Every commit that touches `.github/workflows/` quotes the Owner's 2026-11-20 words"; Step 2 gives `screenshots-sweep.yml` a header like `ci.yml`'s. |
| R3, the sweep unchecked before merge | fixed | Step 2 names one string-compare filter, `.Contents // [] \| .[] \| select(.LastModified[0:19] < $cutoff) \| .Key`, with `cutoff` from `date -u -d '3 hours ago' +%Y-%m-%dT%H:%M:%S`. Both forms the AWS command line may print (`…T01:00:00+00:00`, or with fractional seconds) cut to the same 19 characters, and `// []` covers a listing with no `Contents`. Step 4 runs it on three samples before the audit hand-off. |
| N1, keys in the step's `env` only | taken | Step 1, said outright. |
| N2, slow backup | taken | Section 6, "The backup is slow". |
| N3, notice copy | taken | A5's new wording. |
| N5, quick run misses T's test | taken | Section 6, as a follow-up. |
| N6, checksum settings | taken | Steps 1 and 2. |
| N7, narrower artifact delete | not checked here | It is in the Owner's commands file, outside the spec; the fix thread reports it taken. |
| N9, what is shot does not change | taken | Section 1, but see R5 below. |

## Red

### R4. Step 1b widens the change past the request and breaks A8

- UNIT: Task 2, Step 1b, and the matching half of Step 3 (`this-repo`).
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, "Keep to the request": "A second problem found on the way is reported, not fixed, unless it blocks the task." The spec's own A8: "the step names, the draft rules and the `browser` and `gate` checks are as before." And `visual-check`, "Shoot what the change touches": "a person adds a screen or a size only with a reason in the pull request."
- REASON: removing the `screenshots` label changes which drafts take screenshots. Nothing about moving reports to R2 needs it, so it is a second problem fixed on the way; and it contradicts A8 and the new line in section 1 ("What is shot does not change: `LOOK_SHOTS` and the 'Decide whether to take the screenshots' step stay as they are").
- EVIDENCE: cycle 1 N9 reported the mismatch between `release` ("with no label needed") and `ci.yml` as pre-existing, "for the retrospective, not fixed here". On `main`, the label is the only way for a person to add screenshots to a draft whose changed files do not match `\.(svelte|css)$|^static/|^tests/browser/(support/)?look` (for example a change in `src/features/` that alters a screen's words). `release`'s line describes a program that picks screens from the changed files, which `this-repo` line 26 says does not exist yet; the label stands in for it. Dropping it leaves no way to shoot such a draft.
- EXPECTED: C changes only where the report goes. The label question goes to the retrospective's rule-change pull request, or to the Owner, as cycle 1 said.
- FIX: delete Step 1b and the sentence of Step 3 that drops the label; keep the N9 follow-up in section 6 instead. Spec only.

### R5. "Once seen, nothing keeps them" contradicts the screens page and the spec itself

- UNIT: section 0 (the new relayed Owner line), section 1 (second paragraph), Step 3 and section 6.
- VERDICT: red.
- REQUIREMENT: consistency within the spec and with `visual-check` ("Screens page", "Skip what is already approved"); CLAUDE.md "Report honestly": an Owner rule is recorded from its source.
- REASON: section 1 now says the pictures are viewed on the screens page, and that once seen "no copy goes into this repository, the project's files or anywhere else". But the screens page is a Claude artifact that holds the pictures after the Owner has seen them, and `visual-check` has the coordinator show it twice per slice with "Screens the owner already approved ... included and marked as approved", across rounds run by different sessions hours apart. Read literally, the spec forbids the page it names as the place to view them.
- EVIDENCE: spec section 1: "The pictures are for viewing in the project chat (the screens page, or a reply), and once the Owner has seen them nothing keeps them: no copy goes into this repository, the project's files or anywhere else". `visual-check` line 26 (on `main`). The source is "relayed by the coordinator, recorded in ... McThayDT-Website#95", a repository outside this session's access, so this audit could not read the Owner's own words. This project's own record of #95 (project memory, `apps-guide-repo`) already reports the same clash in the games guide: "nothing keeps a longer copy" yet "its screens page keeps them in a Claude artifact".
- EXPECTED: the spec says only what C and `this-repo` actually do, in words that agree with `visual-check`: CI sends no copy to GitHub; no copy goes into this repository or the project's files; the screens page is where the Owner views them; a session that needs pictures after a link runs out shoots them again. Whether the screens page itself may keep them after the Owner's look is the Owner's call, asked once.
- FIX: narrow the section 1 sentence and the Step 3 bullet to the line above; quote the Owner's words from #95 exactly (the fix thread or the coordinator can read it), not a paraphrase; and send the one open question (may the screens page keep the pictures until the slice ends?) to the coordinator for a decision card. Any change to `visual-check` that follows is a shared skill, so it goes in a rule-change pull request, not in C. Spec only.

## Notes

### N13. Step 4 still says "the three commits"

- Step 4 ends: "lists the three commits (`release`)". The count no longer follows from the plan, which now has a commit per workflow change plus `this-repo`. Suggest "lists its commits". Spec only.

### N14. The branch holds two plan-audit files, as it should

- `…-1-plan-audit.md` (cycle 1) and this file share the branch; the names differ by cycle as `review` asks. Both merge with the spec.

### N15. Nothing else changed

- `git diff 8bf3e49 e4208bb` touches only the spec and cycle 1's audit file. The Owner's commands file, units, order, lanes, A1 to A7 and A9 are as cycle 1 examined them; cycle 1's findings on variables, link timing, forks, runner load and the open pull requests still hold.
