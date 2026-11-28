# Open tab loads a newer version: review 2 (implementation audit)

- Pull request: #444, head `d6daa6a1e4fbb1b374b7d76c024f06859dd6e17b`, base `main` at `2b777a8`.
- Lane 2 (`src/lib/new-version.ts`, the root layout). Reviewer: fresh session, Opus 5.5, medium.
- Verdict: **PASS**. No red findings. Three notes, kept apart.

## What was checked, and how

| Check | How | Result |
| --- | --- | --- |
| Review 1's R1 (typing in Search reloaded mid-typing, added a Back step) | `tests/browser/new-version.test.ts` "typing in Search…" on the computer profile at `d6daa6a` | PASS |
| The R1 journey fails by itself | Put back `e366393`'s `src/lib/new-version.ts` and its `here: location.origin` in the layout, rebuilt, ran the same journey | FAIL (`stillOpen` false: the page loaded again), as it should |
| All four new journeys | `tests/browser/new-version.test.ts`, computer profile | 4 passed |
| A text field on another screen (maker's name question): slow typing, a refusal, then Next, with a newer version out | Reviewer's own probe (not committed) | Typed text kept, page not loaded during typing or on the refusal; Next saved the name, arrived at `/line` as a page load with the name in the heading, history +1 (the same as without a newer version), Back went to `/make/new` |
| Back and Forward with a newer version out | Probe: `/search` → You, newer version out, Back, Forward | Both stayed in the open page; history length unchanged |
| No reload loop | Probe: feed, newer version answered forever, come back once, then wait 5 s | Exactly 1 page load; stays on `/` |
| Mid-game | Probe: member on `/g/<game>/play`, game loaded, mark set inside the frame, newer version out, come back | Page and game both kept (marks survive) |
| Every other text field | Read every `goto(` caller: only Search moves while a person types, and it moves to its own path (left alone). Every other form sends on its button press (`src/lib/stay-in-app.ts`): an answer to the same page stays in-app, an answer to another page arrives after the server has saved it. The feed tabs hold only hidden inputs, so the at-once load there drops nothing typed | No field loses keys |
| SvelteKit's cancelled `goto` | `node_modules/@sveltejs/kit/src/runtime/client/client.js` `navigate`: a cancelled `beforeNavigate` returns without throwing; the follow-up `location.href` goes through `beforeunload` as type `leave` with `willUnload: true`, which `movesAsPageLoad` leaves alone | No second cancel, no loop |
| Unit | `pnpm test`: 170 files, 2448 tests | exit 0 |
| Lint, typecheck | `pnpm lint`, `pnpm typecheck` (after clearing the local build output) | exit 0 |
| CI on `d6daa6a` | Quick draft run: verify, postgres, 6 browser shards, gate | all success |
| CRUD | The change adds nothing a person can make | n/a |

Not run here: the phone profile (WebKit). This container has no WebKit browser; the quick draft run passed, and the full run starts when the pull request is marked ready.

## Notes (not blocking, not fixed here)

- **N1.** UNIT: `src/routes/+layout.svelte` `checkForNewerVersion`. VERDICT: note. REASON: on a feed tab the at-once load starts the feed from its first clip and closes an open panel. EVIDENCE: `location.reload()` with no kept place. EXPECTED: as the brief says (nothing typed there); the owner may later want the clip kept. FIX: none now.
- **N2.** UNIT: `src/lib/new-version.ts` with `beforeNavigate` in the layout. VERDICT: note. REASON: a future `goto(other path, { replace: true })` would become `location.href`, which adds a history step instead of replacing one. EVIDENCE: no caller today (the only `replace: true` callers go to their own path, which is left alone). FIX: if such a caller is added, use `location.replace` for it.
- **N3.** UNIT: the layout. VERDICT: note. REASON: a tab brought back from the back-forward cache gets two checks (`pageshow` and `visibilitychange`), and SvelteKit's own `focus` check can turn on the page-load moves without a return. EVIDENCE: `cameBack` and `cameIntoView` both call `checkForNewerVersion`; kit calls `updated.check()` on focus. EXPECTED and seen: harmless (two `location.reload()` calls end in one load). FIX: none.
