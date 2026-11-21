# Plan audit 5: everything is editable

Examined: `docs/superpowers/specs/2026-11-21-everything-editable-design.md` at **302a3b7** (branch `claude/project-thread-kjfg1t`, draft PR #269), read against `main` at ef720a9 and the two unmerged branches the spec waits on: `claude/project-thread-u1uamt` at 3981563 (live files and websites, no pull request) and `claude/project-thread-vhfmo8` at 30975cc (the purge, PR #268, open draft). All three are at the commits round 4 read. Lane 3 plan audit, round 5, Opus 5.5 medium. Graphify's index of RukenApp is older than `main` and holds neither branch (round 4), so grep over these exact commits answered every question.

**Verdict: 302a3b7 PASS, 0 red, 2 notes.**

Round 4's one red is fixed, and its three notes are taken in. Nothing else in the spec changed (`git diff 1df63b5 302a3b7`: the status line, one new paragraph in 5.1, two bullets in 5.5, criterion A4).

## Round 4 findings, checked again

| Round 4 | Fixed? | Evidence |
|---|---|---|
| R1 "Keep the old one" on the only held part sent back leaves "Send it again" | Yes | 5.1 "Plain live again after a send back" states the rule exactly: newest review `sent_back`, every part of it one of `upright_video`, `wide_video`, `age_rating`, nothing held, `toFix` empty, `pullProblem` null, newest pull = `livePullId`; then `liveSend` and `listWords` read plain live ("Players can find it on Ruken.", no button, "Live"). A4's third journey checks the line, no button, Your games, and `/jobs/review` `list`. The rule can be built from what is stored: a review's parts are `GameReviewPart` rows (u1uamt `prisma/schema/games.prisma:252`), the maker game already loads them (`service.ts:1146-1153`) and its newest pull (`newestPull`, `:1210`). `liveSend` (`make/[game]/+page.server.ts:79-82`) and `listWords` (`review.ts:72`) are inside row A (`src/routes/make/[game]/`, `src/features/games/`). |
| N1 "same write" in 5.5 | Yes | 5.5 now says "same transaction", columns in the step's update, `GameHeldClip` rows by a delete beside it, and the held files go with the purge's existing `clips/<publicId>/` delete. |
| N2 status line | Yes | Line 3 names `main` at 583661f as written and ef720a9 as read by audits 3 and 4. |
| N3 A-first order | Yes | 5.5 asks the coordinator to write the line on the purge's `progress.md` row when this spec merges. |

## Cases walked against the new rule

- Sent back for the held video only, maker keeps the old one: every condition holds, plain live. A4 journey 3.
- Sent back for the video while a held rating waits, maker keeps the old video: a held value remains, so the rule does not apply and "Keep the old one" sends through `sendLiveUpdate` (5.1 "Sending"). A4 journey 2.
- Sent back for the video and the name; maker fixes the name and keeps the old video: the review names `name`, so the rule does not apply and "Send it again" sends the mended name, as it should.
- Sent back for a held video on an update that also carried a new GitHub copy: the newest pull is not `livePullId`, so the rule does not apply; "Keep the old one" ends in `sendLiveUpdate` because a new copy waits (5.1 "Sending"), and the new files still get their review.
- Newest copy refused (`pullProblem`): excluded by the rule; Live keeps its GitHub line as today.

## Red findings

None.

## Notes (recorded, not blocking)

- **N1. Your games needs more than it reads today.** `gamesOf` on u1uamt (`service.ts:1272`) selects only the newest review's `decision`, with no parts, no `livePullId` and no newest pull, and `listWords` takes only `sentBackLast`. To say "Live" by the rule, the builder widens that select and passes `listWords` the answer (or a precomputed "nothing to send"). It is inside row A's files; worth one line in unit A's pull request body so the A4 Your games check is not met only on Live.
- **N2. Other parts in a live send back.** The rule names three parts; a send back that names `other_websites` or `plays_on` keeps "Send it again" by "exactly". That matches today's behaviour on u1uamt and needs no change, but the sentence after the rule lists only the name, the line and the files; the builder should follow the rule, not that sentence.

## What was checked and how

- The diff since round 4: `git diff 1df63b5 302a3b7` (spec only).
- Branch heads: `git log -1 origin/<branch>` for `main` (ef720a9), u1uamt (3981563), vhfmo8 (30975cc). Open pull requests: `gh api 'repos/mcthaydt/RukenApp/pulls?state=open'` (#209, #251, #267, #268, #269, #270, all drafts).
- On u1uamt: `liveSend` and `liveLine` (`src/routes/make/[game]/+page.server.ts:60-92`), `listWords` (`src/features/games/review.ts:50-80`), `sendForReview`, `sentBackNow`, the maker game select and mapping, `partsToFix`, `gamesOf` (`src/features/games/service.ts`), `GameReview`, `GameReviewPart` and `GamePart` (`prisma/schema/games.prisma`).
- Not run: no tests or builds (a plan audit changes no code).
