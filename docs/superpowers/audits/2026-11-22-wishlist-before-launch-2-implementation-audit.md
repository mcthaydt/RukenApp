# Wishlist before launch: implementation audit 2 (lane 2)

Examined: `fb0401b` on `claude/project-thread-mqxj7b` (the fix commit for audit 1's three reds, on top of `ec81bea`). Written 2026-11-22 16:46 UTC by a fresh session (Opus 5.5, medium).
Brief: as audit 1 (`2026-11-22-wishlist-before-launch-1-implementation-audit.md`), plus its three reds.

**Verdict: PASS, 0 red.** The verdict line naming this audit's own commit is in the commit that adds this file.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0, "All matched files use Prettier code style!" |
| `pnpm typecheck` | 0 errors, 0 warnings |
| `pnpm test` (unit) | 129 files, 1,889 tests pass |
| `playwright test wishlist.test.ts loading.test.ts`, computer (local Postgres 16) | 13 of 13 pass, the two new journeys included |
| Same wishlist journeys and the new loading journey, tablet | 7 of 7 pass |
| Probe journeys P1 to P4 (not committed; copy in project files `audits/2026-11-22-wishlist-before-launch-2-probe.test.ts.txt`), computer and tablet | 8 of 8 pass, so each attack fails |
| Mutation: put back the old `GET` (adds for any signed-in visitor) | the new journey "going to the way back … adds nothing" and probe P1 both fail, so the journey catches red 2 by itself |
| Phone (WebKit) | not run: WebKit runs in CI only, and no pull request exists yet |

## Audit 1's reds

### Red 1, Prettier: fixed
`pnpm lint` exits 0 on `fb0401b`. The diff on the three files is formatting only.

### Red 2, a link adds a wish: fixed
`src/routes/g/[game]/wishlist/+server.ts`: the signed-out `POST` sets `rk_wish_pressed` to the game's slug. The probe read it back from the browser: `httpOnly: true`, `sameSite: "Lax"`, `path: "/"`, expiry 30 minutes ahead. `GET` adds only when the caller is signed in and the cookie names this game, then deletes it. The `sec-fetch-site` test is gone.

Tried to break it:
- **P1, a link on a Ruken page** (the audit 1 probe, a same-site `<a>` clicked while signed in): lands on the game with "Wishlist", nothing added. A maker's own page link goes through `/<handle>/out/<id>` to the same `GET`, and the `GET` no longer reads where the visit came from, so it is covered by the same result.
- **P2, cookie reuse:** press Wishlist signed out on game B, sign up, come back with B on the list. The cookie is gone after that. A link to A's way back then adds nothing. Taking B off and following a link to B's way back adds nothing either.
- **P3, a press for a different game:** press Wishlist signed out on B, leave sign-up, sign up from `/sign-up` directly. A link to A's way back adds nothing.
- **P4, cross-site:** a signed-in `POST` with `Origin: https://evil.example` and form data gets 403 from SvelteKit's own cross-site check (on by default; nothing turns it off). A cross-site top-level `GET` does carry the Lax cookie, but the cookie only exists after this browser's own press on that game, so it can only finish a wish the person asked for.

### Red 3, no busy-sign journey: fixed
`tests/browser/loading.test.ts:155` holds the `POST` with `holdAnswersTo`, presses Enter on the focused button, and sees "Adding it…" with `aria-busy="true"` and focus kept. A second Enter sends nothing more (`requestsSoFar()` is 1). After release it sees "On your wishlist", not busy, still focused. It passes on computer and tablet.

## New reds

None. The fix touches only the route, the two journey files and formatting. Nothing else changed since audit 1.

## Notes (not blocking, follow-ups)

1. **A press that never finishes sign-up keeps its cookie for 30 minutes.** In P3, after the abandoned press on B, a later link to B's way back did add B. That is a game this browser pressed, so it is not inflation. On a shared computer, though, a second person who signs in within those 30 minutes and follows such a link gets B on their list. Small and bounded (one game, one browser, one real press). Deleting the cookie when someone signs in, or keying it to more than the slug, would close it. Not fixed here.
2. The new red-2 journey goes to the way back with `page.goto` (a typed address), not by following a link as audit 1's fix asked. The server no longer looks at where a visit came from, so the two are the same to it, and probe P1 confirms the link case. A one-line change to follow a link would make the journey match its own comment.
3. The "second press sends nothing" check reads the count straight after the key press. That is the same pattern as the other journeys in the repo. It holds here because the button refuses a second send in the same event, but it would not catch a second request that left later.
4. Audit 1's notes 1 to 6 still stand (the `this-repo` wording on `aria-disabled`, the tablet maker page wrap, a maker seeing Wishlist on their own game, the no-script feed return, the launch text tick not built, and phone not run).
