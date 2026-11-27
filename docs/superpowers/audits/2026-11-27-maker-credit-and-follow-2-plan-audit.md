# Plan audit 2: maker credit and follow

- Pull request: #400, branch `claude/project-thread-6790hn`
- Reviewed commit: `f338af9` (spec `docs/superpowers/specs/2026-11-27-maker-credit-and-follow-design.md`), on main `67ba234`
- Lane: 3 (adds a table and a migration). Reviewer: Opus 5.5, medium, a fresh session that wrote neither the brief nor audit 1.
- Scope: the brief only. `a930a52` (table, follows service, purge) is build code for the implementation audit; it was read only to see what the brief's units will plug into.
- Verdict: **FAIL: 1 red**, 5 notes

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Audit 1's findings

- **Red 1, self-follow on the way back: fixed.** The new Rules bullet "The way back is checked too" puts the GET under the same guards as the POST (signed in, cookie names this handle, handle has a page, not the caller's own; no page is 404; own page or no cookie saves nothing). Criterion 5 now tests the GET with the cookie naming your own page, and the table's `CHECK` (`MakerFollow_not_self`) backs it. Holds.
- **Red 2, files missing from the plan: fixed.** Unit 4 owns `src/features/feed/service.ts` (where `FeedClip` and `FeedServiceDeps` are, lines 33 to 61) and the two test files with clip expectations (`service.test.ts` line 103, `ranker.test.ts` line 122). Unit 3 owns `src/features/consent/cookies.ts` (`RUKEN_COOKIES`, line 47). Unit 6 names `src/routes/privacy/+page.svelte` and `src/routes/about/sections.ts` by path. Holds, with note 2 below.
- **Audit 1's notes:** the indexes are named (unique `(followerId, makerId)`, `makerId`, the `CHECK`); the roadmap citation points at `/mnt/project-files/roadmap.md`; criterion 9 says whoever merges second with Like/Save/Repost re-runs it; the JSON answer (`{ following }` / `{ go }`) is stated. The live-state file is gone from `f338af9`. All hold.

## Re-checked, and held

- CRUD: create (1), read (2), delete (3) as journeys; update explained (a follow has nothing to change). Matches the owner's rule that e2e covers all CRUD.
- The migration only adds, `onDelete: Restrict` like `Wishlist`/`GameReport`, rows removed in `deletion.ts`; rollback by `wrangler rollback` with the table kept.
- The address: `src/params/handle.ts` matches handle shapes only and fixed routes win; `src/routes/[handle=handle]/` already has `out`, so a `follow` child fits. `safeNextPath` exists (`src/lib/safe-next.ts`) and accepts `/<handle>/follow?back=…` as a `next`.
- The signed-out press mirrors `src/routes/g/[game]/wishlist/+server.ts` (30-minute HttpOnly Lax cookie, `/sign-up?next=`, GET way back).
- Glass tokens and `tests/lib/glass.test.ts`, `src/lib/busy-forms.ts`, `/about` `sections.ts`, `/privacy` and `tests/routes/privacy/cookies.test.ts` all exist.
- `followedAmong` and `followedMakerIds` exist on the follows service in `a930a52`, so unit 4's neighbour has a source.

## Red findings

### 1. The feed service has no way to know who is asking

- UNIT: unit 4, `src/features/feed/service.ts` and `src/features/feed/services.ts`.
- VERDICT: red
- REQUIREMENT: criteria 1, 2, 3, 5 ("on the player's own game's clip there is no badge") and 13; the Rules bullet "A feed page only carries whether the person asking follows each clip's maker".
- REASON: unit 4 says `FeedClip.maker` gains `following` and `mine` set by a `followedAmong` neighbour, but the only person-shaped input `page()` takes is `Asking`, and today `Asking` is always the crowd, with no user id.
- EVIDENCE: `service.ts` line 113, `page(after, asking: Asking = CROWD)`; `feed-public.ts` line 66, `Asking = { kind: "crowd" } | { kind: "full"; id }`, and line 76 returns `CROWD` unless `person.consented`; `services.ts` lines 47 to 52 always pass `consented: false` ("until then everyone is the crowd"). So `asking.kind` is never `"full"` and the service cannot read the caller's id from it: every badge would draw as "not followed" and `mine` would always be false, so criteria 1 to 3 and 5 fail. The tempting shortcut, making `askingOf` return `full` for signed-in people, would tell the private ranker who is watching (the `Viewer` at line 142) without the cookie yes, which the learned-feed rules forbid. Audit 1's line "`askingOf(caller)` already carries `userId`" was about the input to `askingFor`, not what comes out of it.
- EXPECTED: the brief says how the person reaches the feed service apart from `Asking`: for example `page(after, asking, personId: string | null)` (or a `FeedServices.pageFor(after, caller)`), with `following` and `mine` set from `personId` and `game.makerUserId`, and `Asking`/`Viewer` left exactly as today so the ranker is still told the crowd. A unit test pins that a signed-in person's page sets `mine`/`following` while the ranker still receives `{ kind: "crowd" }`.
- FIX: in the brief, add one Rules line ("Who is asking for follows is not who the ranker is told: the feed service takes the person's id on its own, and the ranker's viewer does not change") and name the signature in unit 4; add the "ranker still sees the crowd" test to criterion 13. Files: the spec only. (The build then touches `service.ts`, `services.ts` and the two routes, all already in unit 4.)

## Notes (not blocking, recorded)

1. **The consent test does not catch a missing cookie name.** The brief says `tests/features/consent/cookies.test.ts` "checks every name the code sets", but that test (lines 62 to 67) lists five names by hand; `rk_wish_pressed` is not among them. Leaving `rk_follow_pressed` off `RUKEN_COOKIES` would pass. Add `"rk_follow_pressed"` to that test's list in unit 3 so the check fails by itself.
2. **Test files outside the plan table.** `tests/features/feed/worlds.ts` builds a full `FeedServiceDeps` (line 53); if `followedAmong` is a required neighbour it must change too. The route, journey and migration test files (`tests/features/pages/migration.test.ts` in `a930a52`) are named only by their checks. Either make the new neighbour optional or add `worlds.ts` to unit 4, and say test files named in a unit's Check column belong to that unit.
3. **The cookie is used once.** The Wishlist GET deletes its cookie after the way back (`wishlist/+server.ts` line 62). The brief should say the follow GET does the same, so a second visit to the way back within 30 minutes (for example after unfollowing) does not follow again.
4. **Signed out, no script.** The JSON line says a plain form gets "a 303 to `back`"; for a signed-out plain form it is a 303 to `/sign-up?next=…`, as Wishlist does. Say so, so the no-script, signed-out press is not built to drop the person back on the feed with nothing done.
5. **Where `followedMakerIds` lives.** The brief says "the pages service exposes" it; in `a930a52` it is on `pagesServices().follows`, not `pagesServices().service`. Name `pagesServices().follows.followedMakerIds` so the top bar thread calls the right one.

## Follow-up outside this change

None found.
