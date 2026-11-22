# Wishlist before launch: implementation audit 1 (lane 2)

Examined: `ae51633` on `claude/project-thread-mqxj7b` (two commits plus one CSS fix on `main` 74bd185). Written 2026-11-22 16:30 UTC.
Brief: the owner's words (progress.md, 16:03 and 16:05 UTC), the wishlist spec's "Changed on 2026-11-22", and the builder's six acceptance criteria.

**Verdict: ae51633 FAIL: 3 red.**

## What ran

| Check | Result |
| --- | --- |
| `pnpm typecheck` | 0 errors |
| `pnpm lint` | **fails**: Prettier flags 3 files (red 1) |
| `pnpm test` (unit) | 129 files, 1,889 tests pass |
| `vitest --project postgres tests/features/launch` (local Postgres 16) | 11 pass (wishlist add/remove/count, schema) |
| `playwright test tests/browser/wishlist.test.ts`, tablet and computer | 10 of 10 pass |
| Same, phone (WebKit) | not run: WebKit runs in CI only, and no CI has run on this branch yet (no pull request) |
| Probe journey (not committed; copy in project files `audits/2026-11-22-wishlist-before-launch-1-probe.test.ts.txt`) | passes, and that shows red 2 |
| Screens looked at (feed, maker page, game page; tablet and computer, before launch) | see notes |

## What holds

- **One launch switch.** All three screens get their state from `launchServices().screenFor` (`src/features/launch/services.ts`), which reads `isOpen(now(cookies))`. The maker's live screen uses the same `now()` and `isOpen`. Nothing else reads a clock for launch.
- **The instant and the zone.** `LAUNCH_MS` is built from 11:00 America/Chicago on 30 November 2026 by Temporal. `tests/features/launch/switch.test.ts` pins it to 17:00 UTC, false at `LAUNCH_MS - 1`, true at `LAUNCH_MS`, and checks that "Opens 30 November" is derived from the same moment.
- **The test cookie cannot flip production.** `createLaunchNow` (`now.ts`) reads `rk_test_launch` only when `LAUNCH_TEST_SWITCH=on`, and throws if the switch is set on a site whose address is not this machine. `now.test.ts` covers both.
- **Play stays open.** `/g/<game>/play` is untouched and the journey plays a free game there before launch.
- **CRUD.** Add (signed out through sign-up, signed in with script, signed in without script), read back after a reload and on another screen, and remove are all in `tests/browser/wishlist.test.ts`. There is nothing to edit on a wish. Account deletion deletes the person's rows (`deletion.ts:172`).
- **Counts.** One row per person and game (`@@unique([userId, gameId])`, `skipDuplicates`). The maker's own row is left out (`countFor`). Counted from rows on every load. Except for red 2, a wish needs a signed-in person's own press.
- **Spinner and focus.** The button sets `aria-busy`, which gets the shared spinner from `look.css`. It uses `aria-disabled` instead of `disabled` so focus stays, and the journey checks focus after an Enter press.
- **Owner UI rules.** No browser-default controls: the button is styled like the Play it replaces, with its own heart drawing. No new see-through surface: the feed card that holds it was already there. No page reload with script (the journey checks that `window` survives the press).

## Red findings

### Red 1
UNIT: `src/features/launch/services.ts`, `src/routes/+page.server.ts`, `tests/browser/wishlist.test.ts`.
VERDICT: red.
REQUIREMENT: CLAUDE.md "Stack and checks": `pnpm lint` passes; CI's `verify` job runs it.
REASON: Prettier rejects the formatting of these three files.
EVIDENCE: `pnpm lint` on ae51633: `[warn] src/features/launch/services.ts`, `[warn] src/routes/+page.server.ts`, `[warn] tests/browser/wishlist.test.ts`, "Code style issues found in 3 files", exit 1. For example, `screenFor`'s return object is one line of 121 characters.
EXPECTED: `pnpm lint` exits 0.
FIX: `pnpm exec prettier --write` on those three files only.

### Red 2
UNIT: `src/routes/g/[game]/wishlist/+server.ts` (`GET`).
VERDICT: red.
REQUIREMENT: the coordinator's brief: "counts that can't be inflated". Also the spec: a game goes on a list only when the person presses Wishlist.
REASON: any link on Ruken itself to `/g/<game>/wishlist` adds that game to a signed-in visitor's list with no press, and that raises the maker's count. A maker can put such a link on their own page: `cleanLinkUrl` accepts any https address, `/<handle>/out/<id>` redirects to it, and the whole chain is same-origin. A typed or pasted address (`Sec-Fetch-Site: none`) adds too, and so does any browser that sends no `Sec-Fetch-Site`, because the check is only `!== "cross-site"`.
EVIDENCE: the probe journey signs a person up, puts `<a href="/g/<slug>/wishlist">My Discord</a>` on a Ruken page, follows it, and lands on `/g/<slug>` showing "On your wishlist". It passes on ae51633.
EXPECTED: the GET adds a game only for the person who pressed Wishlist while signed out, coming back from sign-up or sign-in. Any other GET only redirects.
FIX: in the signed-out branch of `POST`, set a short-lived (for example 30 minutes), httpOnly, SameSite=Lax cookie naming the game's slug. `GET` adds only when that cookie names this game, then deletes it, and drops the `sec-fetch-site` test. Add a journey in `tests/browser/wishlist.test.ts` that follows a plain Ruken link to the GET while signed in and still sees "Wishlist". Files: that route and that test.

### Red 3
UNIT: `tests/browser/loading.test.ts` (or `wishlist.test.ts`).
VERDICT: red.
REQUIREMENT: acceptance criterion 6 ("a busy sign while it sends"), and the `this-repo` rule "Every wait shows it … a new kind of wait gets a journey there".
REASON: no test holds the Wishlist answer back to show the busy sign. The only check is focus after the answer has arrived.
EVIDENCE: `grep -n wishlist tests/browser/loading.test.ts` finds nothing. In `wishlist.test.ts`, the keyboard step asserts `toBeFocused()` only after the label has changed back.
EXPECTED: a journey holds the POST to `/g/<game>/wishlist` back (`page.route`), sees the button with `aria-busy="true"`, the words "Adding it…" and focus still on it, then lets the answer through and sees "On your wishlist".
FIX: one journey in `tests/browser/loading.test.ts`, the file that rule names. No source change.

## Notes (not blocking, follow-ups)

1. `this-repo` says a scripted form "sets `disabled` and `aria-busy`". This button uses `aria-disabled` so focus stays, and `busy-forms.ts` does the same. The rule text should say `aria-disabled` (a `this-repo` edit, lane 1). Not fixed here.
2. On the tablet maker page, "Opens 30 November" wraps onto two lines in the narrow game column and leaves a gap above the button. Readable, but looser than the feed and the game page. Worth a look in the slice's design round.
3. A maker looking at their own game before launch also sees Wishlist, not Play. That matches the owner's words ("Wishlist if it's not out"). They can still play from the play address.
4. With no script, a press in the feed comes back to `/`, the top of the feed, not the clip you were on.
5. The "Text me when it's out" tick and the launch text job are not built. The builder reported this, and the owner's brief for this change does not ask for them.
6. Phone (WebKit) has not run. It runs in CI once a pull request exists.
