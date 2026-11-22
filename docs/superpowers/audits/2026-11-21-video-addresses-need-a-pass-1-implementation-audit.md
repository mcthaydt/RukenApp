90beb7b PASS

# Implementation audit: a video's address needs a pass (cycle 1)

- Branch `claude/project-thread-8400fx` at 90beb7b (base 3a60ce9). Spec `docs/superpowers/specs/2026-11-21-video-addresses-need-a-pass-design.md` on that branch; plan audit 1 PASS at a83679f.
- Lane 3 implementation audit, read only. Opus 5.5, medium. Written 2026-11-21 22:22 UTC (from `date`).
- Result: **PASS, no red findings.** Four notes, none blocking. Merge still needs green CI, which runs the phone profile this container could not (N1).

## What ran here, at 90beb7b

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings |
| `pnpm test` | 120 files, 1,788 tests passed |
| `pnpm test:pg` (Postgres 16) | 44 files, 698 tests passed |
| `pnpm build` | exit 0 |
| `pnpm test:browser`, all three profiles | computer and tablet: every journey passed. phone: 441 failed, all with `browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh` (no WebKit in this container), 55 did not run. 991 passed, 130 skipped. |
| Branch merged with `origin/main` (eaa777e, merges clean): `pnpm test` plus journeys `make-waiting-and-off`, `make-after`, `adults-only`, `game-page`, `make-live-changes`, `make-questions`, `join`, `rejoin` on computer and tablet | unit passed; 245 journeys passed, 3 failed: the payment ones (below). |

## The builder's claim about the two payment journeys

**Confirmed: they fail on `main` itself, not because of this branch.** On `origin/main` at eaa777e, `game-page`, `join` and `membership` on computer and tablet gave 15 failures, all in paying: "Continue to payment opens the payment page" (tablet), "a member reads that Play is included, and has no Join" (both), six `membership.test.ts` journeys and `rejoin.test.ts` (tablet). They fail at the stand-in payment step (`tests/browser/support/account.ts:112`, waitForURL timeout, or `toHaveURL("/me")` while still on the stand-in's `/pay/cs_test_…` page).

On this branch alone (base 3a60ce9) the same journeys pass on computer and tablet. So the break came into `main` after 3a60ce9 (one of #279, #280, #282). That is a follow-up for its own thread, not a finding against this change.

## Criteria, with evidence

1. **Pass helper.** Passes. `tests/lib/files/media-pass.test.ts` covers before and at the expiry, another key, another secret, every single-character change, a play pass, `""`/null, 1,000 seeded strings, the same pass within one window and a different one across windows, a 12 to 24 hour life, and an empty secret throwing. `src/lib/files/media-pass.ts` imports only `node:crypto` and compares the mac with `timingSafeEqual` on the written string.
2. **Gate.** Passes. `tests/features/play/gate.test.ts` checks both address forms. A good pass gives 200 with `private, max-age=3600`, and a range request gives 206. No pass, an empty pass, a changed pass, a run-out pass and another video's pass each give 403, `no-store`, with the spec's words, and `files.reads` stays empty. A photo still gets `public, max-age=31536000, immutable`. In `gate.ts`, `serveMedia` checks the pass before `serveFile`.
3. **`media()`.** Passes. `tests/features/games/services.test.ts` uses a clip key of the real shape. It checks that the pass is accepted by `checkMediaPass` at the injected time and refused for another key, that a photo key gives no query, and that a missing `PLAY_PASS_SECRET` throws `Missing setting PLAY_PASS_SECRET`.
4. **Journey: an adult's video.** Passes. In `tests/browser/adults-only.test.ts:159-175`, the address with its pass gives 200 or 206 with `video/*`, the bare address gives 403, and a pass with a changed expiry digit or changed mac gives 403. Before the change, the gate served a clip to anyone (the old unit test "sends a clip to anyone"), so the bare-address step would have failed.
5. **Journey: refused people.** Passes. `expectRefusedEverywhere` (`adults-only.test.ts:82-85`) asserts the page HTML has no `/clips/` and no `pass=`. It runs for the signed-out person (`:115`) and for both under-18 cases (`:134`, `:146`).
6. **Journey: a game for everyone.** Passes. In `tests/browser/game-page.test.ts:49-63`, a signed-out page plays the 12+ game's clip (readyState >= 2), and its bare address gives 403.
7. **CRUD stays whole.** Passes. The journeys that create, read, replace and remove a video (`make-game-crud`, `make-live-changes`, `make-questions`, `maker-page`, `join`, `review-job`) passed on computer and tablet. The changed assertions now compare addresses without `?pass=`: `make-questions.test.ts:591-605` (plan audit N3), `make-live-changes.test.ts` `playersSee`, `videoInFrame` and the staff look comparison. `gateAnswers` now signs its own pass with the journeys' test secret, so a removed file still has to give 404 and not 403. Nothing that a user makes was added, and no CRUD leg was lost. After the merge, `main`'s new `make-waiting-and-off` journey also passes with passes on.
8. **No screen change.** Passes. No `.svelte` or copy file changed. The 403 line is "This video's link has run out. Go back and open the page again."
9. **No cache use.** Passes. `gate.test.ts:382-395` reads both files and fails on `caches.`, an outgoing `fetch(` (the handler is allowed and the test says why) or `globalThis.fetch`.
10. **Suites.** Passes, except the phone profile, which was not run here (N1).
11. **Run like a person.** I did not walk it by hand. Journey 4 opens the adult's video in a second tab, with and without the pass, in a real browser against the real gate. The 403 words are checked by the gate unit test. The builder should name their `verify` run in the PR body.

Comments: `clips.ts`, `gate.ts`, `cloudflare/games/worker.ts` and `cloudflare/games/wrangler.jsonc` are updated. `prisma/schema/games.prisma` never said "anyone", so it was rightly left alone. `verify` and `this-repo` fetch no video address by hand, so they were rightly left alone. Every place that builds a clip address goes through `GamesServices.media`: the feed, the game page, join, the make routes, the laid-out screens and the review job. The live-state file was deleted in 90beb7b, and every commit's author is McThayDT.

## Notes (not blocking)

**N1.** UNIT: browser suite, phone profile. VERDICT: note. REQUIREMENT: criterion 10. REASON: WebKit is missing in this container, so no phone journey ran here. EVIDENCE: 441 phone failures, all at `browserType.launch`. EXPECTED: CI's full run covers the phone profile before merge. FIX: none here; the merge waits on green CI as usual.

**N2.** UNIT: `src/lib/files/media-pass.ts` `SHAPE` / `checkMediaPass`. VERDICT: note. REQUIREMENT: none broken. REASON: the expiry is parsed as a number, so `v1.01795…` (a leading zero added) is accepted as the same pass. EVIDENCE: `Number(match[1])` is fed back through `String(seconds)` into the mac. EXPECTED: one string per pass. FIX (optional): change `SHAPE` to `/^v1\.([1-9]\d{0,14})\.…$/`. This gives no extra access (same video, same expiry), so it can be left.

**N3.** UNIT: the spec's Status line and plan table. VERDICT: note. REQUIREMENT: records. REASON: the Status line still says "building", and the plan says the build waits on "this spec on main", but the spec and the build ship in one PR (the same-repo PR slots were full). EXPECTED: the PR body says the spec rides with the build, and the Status line names this audit. FIX: spec Status line only.

**N4.** UNIT: the PR body when it opens. VERDICT: note. REQUIREMENT: criteria 2 and 7, plan step 7. REASON: the changed existing tests must be named. EXPECTED: these are named, each with why: gate tests "sends a clip under a good pass…", "sends a QuickTime clip…", "answers a byte range…", "says a clip is not found…", "sends a clip under a pass and a photo to anyone"; `services.test.ts` clip/photo; `make-questions.test.ts:591-605`; `make-live-changes.test.ts` `playersSee`, `gateAnswers`, `videoInFrame` and the staff look comparison. Also name the deploy order (`pnpm run deploy && pnpm run deploy:games --route …`), and say the gap stays open live until then. FIX: PR body only.

## Follow-ups for the coordinator (outside this change)

- `main` at eaa777e fails the payment journeys on computer and tablet (see above). They passed at 3a60ce9, so the break is in #279, #280 or #282. This change's merge will be red on those journeys until `main` is fixed.
