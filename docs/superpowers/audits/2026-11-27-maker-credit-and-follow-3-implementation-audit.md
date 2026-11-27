# Maker credit and follow: implementation audit 3

Lane 3 implementation audit of PR #400 at `658447c8f358deb6a3569244c79ead05aa7834cf` (branch `claude/project-thread-6790hn`), against the brief `docs/superpowers/specs/2026-11-27-maker-credit-and-follow-design.md`. Fresh session, Opus 5.5, medium. Finished 2026-11-27 02:39 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**658447c PASS.** No red.

## Audit 2's red

**The way back must always clear `rk_follow_pressed`, and a missing page is 404.** Fixed. The `GET` in `src/routes/[handle=handle]/follow/+server.ts` now reads the cookie and deletes it whenever it is there, before anything else; then answers 404 when `pageByHandle` finds no page; then follows only when signed in and the cookie named this handle. The 404 path also clears the cookie (checked below: the response to the missing-page GET with a mark carries the deletion).

The new checks fail on the old route. With only `+server.ts` put back to `bdba4e5` and the journeys of `658447c`, WebKit phone:

- "going to the way back without pressing the plus follows nobody" failed at line 166 (`rk_follow_pressed` still there after a way back with a mark naming another maker).
- "signed out, the way back follows nobody and uses up the pressed mark" failed at line 188 (the mark still there after a signed-out way back).

With `658447c`'s route both pass, including the two GET 404 asserts and the cookie cleared after the 404 with a mark.

## Extra lens: a forged follow from another site

Asked by the coordinator after the Like/Save/Repost review found a forged press there. **Not present here.**

- The way back follows only when `rk_follow_pressed` names exactly the handle in the address. A cross-site link to `/<handle>/follow`, or to `/sign-up?next=/<handle>/follow…`, carries no mark, so it follows nobody; a mark naming another maker follows nobody and is used up.
- The only way to set the mark is a signed-out `POST /<handle>/follow`. SvelteKit's origin check is on (no `csrf` override in the repo), so a form posted from another site is refused with 403 before the handler runs, and no mark is set. A signed-in cross-site post follows nobody for the same reason.
- The mark is `httpOnly`, `SameSite=Lax`, path `/`, 30 minutes, so another site's script can't write it.
- The one case left is by design: a person who really pressed the plus on maker A while signed out, and then reaches `/A/follow` within 30 minutes, follows A, the maker they chose.

Probe (not part of the PR, saved as `/mnt/project-files/audits/2026-11-27-maker-credit-and-follow-3-probe-forged-follow.test.ts.txt`): a page on `http://evil.example` that auto-posts the follow form, and a JSON post with that origin, both answered 403 and set no mark signed out; signed in, the auto-post, a cross-site link to the way back and a sign-up link whose `next` is the way back each left the person following nobody. 2 of 2 passed on WebKit phone.

## What ran, at `658447c`

- In `mcr.microsoft.com/playwright:v1.63.0-noble` (Node 24.20, pnpm 10.34.6) against a local Postgres 16:
  - `pnpm install --frozen-lockfile`, `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 0 warnings.
  - `pnpm test` (unit): 2230 passed, 19 failed, all in `tests/deploy-target.test.ts` and `tests/games-check.test.ts`, because the image has no `jq`. Those two files on the host (which has `jq`): 26 of 26 passed. So 2249 of 2249. This PR touches neither.
  - `vitest --project postgres`: 53 files, 798 tests passed.
  - WebKit phone (iPhone SE), 2 workers: `follow-a-maker.test.ts`, `feed.test.ts`, `feed-controls.test.ts`: 43 of 43 passed (438, the recorded flake, passed this time).
- CI on this head (run 45928149642, quick draft): verify, postgres, browser shards 1 to 6 and gate passed; commit-authors and pr-rules passed.
- Not run here: tablet and computer projects (CI's shards passed); the full journey suite (a ready PR's full run covers it).

## Against the brief

Read again in full at this head, with audits 1 and 2 as a guide but not taken on trust:

- Migration (criterion 15): only `CREATE TABLE "MakerFollow"`, two `CREATE … INDEX "MakerFollow_…"`, and `ALTER TABLE "MakerFollow" ADD CONSTRAINT` (two foreign keys, Restrict, and `MakerFollow_not_self`). Back-relations on `User` are Prisma-only.
- Service: `follow` (`createMany` + `skipDuplicates`, "no page", "own"), `unfollow` (not followed is fine), `followedAmong`, `followedMakerIds` newest first. Both sides purged in `deletion.ts`.
- Feed: `page(after, asking, viewerId)` with `viewerOf(caller)`; `Asking` and the ranker's viewer unchanged; `following` and `mine` on `FeedClip.maker`; `followedAmong` optional. Both `+page.server.ts` and `/api/feed` pass the viewer.
- Route POST: 404 for no page, 400 for own, `want=off` else on, `back` through `safeNextPath`, JSON or 303, signed-out mark plus `/sign-up?next=…`. GET as above.
- Consent: route in `GATED`, the `follow` reason in `gate.ts`, `Notice.svelte` and `/cookies`, with the brief's words; `rk_follow_pressed` on `RUKEN_COOKIES`.
- Privacy (what a follow keeps, the cookie, the date) and the `/about` line.
- Badge: plain form, `aria-label="Follow <name>"`, `aria-pressed`, `aria-busy`/`aria-disabled` while sending and a second press refused, the `role="alert"` line on failure, hidden on your own clip, every clip by the maker changing together.
- CRUD: create, read and delete in the journey; a follow has no update, as the brief says.

### Notes (not blocking)

1. Audit 1's notes still stand: no journey presses the plus before the cookie yes (the gate's unit tests cover the reason and route), and no journey follows again after an unfollow.
2. Criterion 9's hand-off still applies: whichever of this PR and Like/Save/Repost (#404) merges second merges `main` and runs the column journey with every button in it.
3. The playwright image has no `jq`, so the two deploy-script unit files fail in it; worth knowing for the next audit that runs there.
