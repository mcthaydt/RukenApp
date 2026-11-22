ba4bf65 FAIL: 2 red

# Plan audit: align Ruken's rules and records with the apps kit (cycle 2)

Pull request #280, head `ba4bf65`, spec `docs/superpowers/specs/2026-11-21-align-with-apps-kit-design.md`. Lane 3 plan audit, read only. Written 2026-11-21 20:35 UTC (from `date`).

## What I checked, myself

- The PR's diff against `main` (`fe5f5ee`): only the spec changes. Commits since round 1: `5a397fc` (R1, R2) and `ba4bf65` (N4 as F6, and F7).
- The kit: https://mcthaydt.com/prompts/claude-md-apps/ fetched with `curl` (HTTP 200, 990,351 bytes, 56 `<pre>` blocks). I re-read the parts this spec relies on: `owner-updates` ("maintain `progress.md` with a last-updated time, current work, completed outcomes ..., remaining work, blockers, preview links and material decisions"; "writes each owner instruction into it in the turn it is given"), Settings (stage rows with a percentage), and `staged-path` Splitting. I did not redo round 1's sentence-by-sentence diff of CLAUDE.md and the skills; nothing in the spec's "What was compared" changed since then.
- `progress.md` on PR-R's head (`cdc520b`), the file the build will edit.
- Every owner file in project memory (`owner-instructions`, `owner-crud-e2e`, `owner-everything-editable`, `owner-follow-hooks`, `owner-follow-the-hooks`, `owner-no-intervention`, `owner-rule-no-process-cards`, `owner-wants-speed`, `notion-ruken-page`, `private-notes-notion`, `slice-3-plan`, `kit-alignment`, the index).
- The owner's own messages in the project chat, read from the first message to 20:34 UTC.
- Measured with `gh api`: #266 merged 14:26:10 UTC, #268 16:00:46, #274 19:16:52, #276 20:00:57, #277 20:07:30; #209 and #279 open; branch `claude/project-thread-7wmhqn` returns 404.
- `.claude/hooks/rules.mjs` lines 1103 to 1108 and 1126 (the refusal F7 describes).

## Round 1 findings

- **R1: fixed for project memory.** Appendix A now holds every owner entry I found in the memory files that `progress.md` lacks. I found none missing from memory. But memory is not the whole record; see R3.
- **R2: fixed.** F3 now covers "Slice 2", "Slice 3 parked", "Last updated" and a "Stages" table, and criteria 3 and 4 check them. The 14:32 UTC unpark word is real: at 14:31:14 the coordinator asked "Want me to run it that way and unpark slice 3 once the editing work lands?", the owner answered at 14:32:35 "Yes, but ...", and the coordinator confirmed at 14:32:45.
- **N4 (now F6): correct.** The owner's words at 19:30:27 are "If I bring you something outside that, call it out", spoken as Claude to the owner, which the project instructions carry as "they will call it out". F6's sentence matches.
- Owner-chosen differences are kept and named: `history.md` deleted, every same-repo PR counted with docs-only ones included, forks never counted, `commit-authors` ignoring only the exact proxy footer.

## Red

**R3. F4 reads only project memory, so owner instructions that never reached memory stay missing.**
UNIT: spec, F4 and Appendix A. VERDICT: red.
REQUIREMENT: the kit's `owner-updates`: "The record's writer writes each owner instruction into it in the turn it is given"; the spec's own outcome (nothing in the records contradicts the kit).
REASON: F4 says "every owner instruction in project memory". These owner messages in the project chat are in neither memory nor `progress.md` on `cdc520b`:
EVIDENCE (times from the project chat):
- 2026-11-21 09:21:44 UTC: "Going to sleep, you don't have to wait on my approval to begin work".
- 09:22:30 UTC: "yes" to "Want me to merge lane 3 changes tonight once they pass audit". A standing permission, later widened by 19:16; it belongs under Standing permissions as a dated line.
- 14:22:17 UTC: "Audit our existing e2e tests to ensure we can CRUD everything" (done, #267).
- 15:33:25 UTC: "yes you can close it" (the parked feed screen pull request).
- 15:50 UTC, card: "Yes, merge when green" (the CRUD tests and the deleted-maker purge, #268).
- 16:54:39 UTC: "can you create a local session to do it", and 19:16:18 UTC: "I TOLD YOU to create the session, so YES YOU CAN CREATE THE MAC SESSION". This one is a live contradiction with the kit: its Project instructions say "On a public repo nothing runs on the owner's computer", and RukenApp is public. Project memory already treats the kit as winning after the 20:19 instruction, but nothing in the spec says so, so the build would either leave it out or record it as a live permission.
- 19:32:20 UTC: "Add to the claude.md for apps and games on mcthaydt - in the claude.md section and in the project instructions" (mcthaydt-website #99), and 19:35:06 UTC: "mcthaydt-website" (where the kit lives).
- 20:09:11 UTC: "I won't restart".
EXPECTED: every owner instruction, from memory and from the owner's own messages, is in `progress.md` with its date; the 19:16 Mac-session permission is recorded with a line saying how it stands against the kit's public-repo rule.
FIX: widen F4's source to project memory plus the owner's own messages in the project chat, read to the end at build time; add the entries above to Appendix A; add one line to F4 saying the 16:54 and 19:16 Mac-session words are kept as dated records and are not in force for RukenApp, citing the owner's 20:19 instruction and the kit's public-repo line. If the spec author reads the owner's intent differently, that is an access question for the owner, asked once. Files: the spec only.

**R4. F7's record names the wrong trigger and leaves the breach out of `progress.md`.**
UNIT: spec, F7. VERDICT: red.
REQUIREMENT: CLAUDE.md, Findings carry evidence ("what is wrong, the evidence, the expected result and a bounded fix"); the owner's NON-NEGOTIABLE rule (14:41 UTC, "ALL SESSIONS NEED TO FOLLOW THE HOOKS") and Report honestly.
REASON: (a) F7 says the hook reads "prose containing 'gh api' inside a local script" as a GitHub call. The rule is wider. `rules.mjs:1126` refuses any interpreter (`python3`, `node`, ...) whose script text has the word `gh` (`GH_WORD`, line 1106), any of `pr|api|alias|workflow|ruleset|repo|issue|release|run` as a word (`GH_SUBCOMMAND`, 1108), and any launcher word or a single backtick (`LAUNCHES_OR_REQUESTS`, 1107, ends in ``|` ``). So any script that edits Markdown with backticks and mentions "gh pr" is refused. A follow-up written from F7's line would fix the wrong thing. (b) The Known issues line covers only the hook. The breach itself (the refused edit redone with the Edit tool) is written only in the spec, which is a design record; the History in `progress.md`, where events live, would not show it.
EXPECTED: the Known issues line states the real trigger with its line numbers, and History records the breach with its date.
FIX: rewrite F7's "Expected and fix" so its line reads, in substance: on 2026-11-21 the Bash hook (`rules.mjs:1126`) refused a local `python3` edit of a spec because the script had "gh", a subcommand word and a backtick; the session then made the same edit with the Edit tool, which broke the follow-the-hooks rule; follow-up: a lane 3 hooks change to stop refusing interpreter scripts that only mention gh in text. Files: the spec only.

Judgment on the event itself: the spec records it honestly and does not change the hook, which is right. The edit it produced is spec text, and this audit read the whole spec at `ba4bf65`, so its content has been checked by a second session; nothing needs reverting. A Lessons line (trigger: a hook refuses a call that looks wrong; look for: the same change retried through another tool) is the coordinator's to add when the work is archived (`review`, Lessons).

## Notes (not blocking)

- **N5.** F2 says the active milestone "keeps only 'Finish Ruken'". The kit's `owner-updates` list also wants blockers, the preview link and remaining work, and says to distinguish unresolved assumptions. Say the rewrite keeps those lines (Preview: https://ruken.io; #209 still open in Remaining).
- **N6.** `progress.md` repeats two owner entries (14:20 UTC twice, 14:26 UTC twice). The builder may merge each pair while editing that section.
- **N7.** The Known issues line about the hook reading a pull request's lane from its body may be stale: `rules.mjs` on `cdc520b` has `laneOfFiles` (line 972) and no `LANE` constant. It sits under History, outside this spec's sections; report it to the coordinator, don't fix it here.

CRUD: does not apply; the change adds nothing a user can make.
Graphify: not used. The change is Markdown only.
