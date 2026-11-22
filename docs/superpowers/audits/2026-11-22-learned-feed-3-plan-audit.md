# Learned feed: plan audit 3

Audited: RukenApp `claude/learned-feed-spec` at `4637ec1` (one commit after audit 2's `c325348`, changing only the spec) and RukenPrivate #18 at `aa31645`, against audit 2's findings, the consent spec at `origin/claude/project-thread-rnuc8p` and the private design. Written 2026-11-22 17:20 UTC by the session that wrote audits 1 and 2 (Opus 5.5, medium, `review` skill). Audit only. It names keys and never a value from `feed/settings.json`.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: PASS, 0 red, 1 note.**

## Audit 2's reds

| Red | Fixed? | Evidence at `4637ec1` |
|---|---|---|
| R1, consent interface | Yes | "For every unit" places each new route in `consent/routes.ts` as Open, Machine or Gated, which are the consent spec's file and kinds (its 3.7): `/api/feed/seen` and the other `/api/feed/` write routes Gated with a 403, which is one of the answers its gated test accepts ("the notice, a refusal, or a redirect"); `/me/feed` by `/me/*`; `/parent/[token]` Gated; `/healthz/feed` Machine; `/jobs/high-taste` by `/jobs/*`. B2, B7 and K5 match. |
| R2, waits | Yes | C waits on F only and touches none of B's files; D waits on C and E; the paragraph, section 8 item 6 and section 9 now all say B, D, G, I and K wait on consent, L through G, and A, F, C, E and H do not. Checked against the table row by row. |
| R3, link before its page | Yes | L2 adds How the feed works to the ••• sheet and Your feed; L owns those edits and runs last; D7 hides ••• without consent until then; D6 says the link comes with L. |
| R4, promises with no step | Yes | A13 (ranking imports nothing from money and only the status read from membership) with step 7; `teenPersonal` in A8 and A's step 2; the switch-off test in I step 5; `User.feedPersonal` in D1 and D's Owns. |
| R5, source rows | Yes | RukenPrivate `feed/settings.md` at `aa31645` has a row for each of the four sky keys (grep: 4); J1 step 2 is ticked. |

Audit 2's notes N1 to N8 were all taken (G5's words, D6 marked **Call**, the Owner line for L, H5, G owns `signals/quiet.ts`, no put-ins past the cap, C and E under the consent work's `/make/*` test, A8 over https through the hooks).

## Checked again

- **No private values.** A script read every line added by `4637ec1` for the private values, as digits and in words: none (its only numeric matches are section numbers such as "10.1").
- **No live file** under `docs/superpowers/live/` at `4637ec1`.
- **Lanes** unchanged and still right; L stays lane 1 while editing `Feed.svelte` and `/me/feed`, which are not on the lane 2 list.

## Note (not blocking)

- **N1.** L now edits `Feed.svelte` and `/me/feed` and stays lane 1, which allows a merge on green with no review. It changes two screens other units built; a lane 2 review would be cheap insurance. The plan may keep lane 1.
