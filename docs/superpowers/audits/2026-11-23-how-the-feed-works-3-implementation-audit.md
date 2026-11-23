# How the feed works: implementation audit, round 3

Reviewed head: f0c5e93f4ed655123605dd1f1a6707ec718ca1ba (PR #350). Lane 2. Previous PASS: 2e00019.
Scope: the PR against the main it merged (c6694d9): 9 files, `git diff c6694d94 f0c5e93f`. The merge itself (5adf4f2d) and
the three changes since 2e00019 were read line by line.

Verdict: PASS, 0 red.

## What changed since 2e00019, checked

1. Help list. `src/routes/help/+page.svelte` keeps #348's three numbered tiles exactly as on main; the only change is the
   header comment and one line under the `<nav>`: `<p><a class="plain-link" href="/help/how-the-feed-works?from=%2Fhelp">`.
   `tests/browser/help-guide.test.ts` is byte-identical to main (`git diff c6694d94 f0c5e93f --quiet` exits 0), so no
   check of the guides was edited. Help still says "Three short guides", which stays true.
2. Consent route. `src/features/consent/routes.ts` adds `/help/how-the-feed-works` to OPEN, beside the other help
   pages. Right kind: the page reads nothing but `?from` and keeps nothing (`+page.server.ts` only calls `howToBack`).
   `tests/features/consent/routes.test.ts` (every route named exactly once) passes.
3. Journey. `tests/browser/how-the-feed-works.test.ts` checks the help link's `text-decoration-line` is `none` before
   clicking it, and every link in the page's main. `a.plain-link` (0,1,1) comes after `a:not(.button, .wordmark)`
   (0,1,1) in `look.css`, so it wins; `plain-link` is added to the shared-class list in `tests/lib/look.test.ts`.

## Ran here, at f0c5e93

- `pnpm test`: 143 files, 2092 tests passed.
- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors.
- `pnpm test:browser tests/browser/how-the-feed-works.test.ts tests/browser/help-guide.test.ts` against local Postgres 16:
  14 passed on computer and tablet. The 7 phone runs could not start here (no WebKit in this container:
  "Executable doesn't exist at /opt/pw-browsers/webkit-2359"); CI at this head ran both feed journeys on phone, tablet and
  computer and all passed (browser shards 1 to 6, quick run, green).
- Looked at /help (375x667, 1280x720) and /privacy (1280x720) in the running app: the link sits under the tiles, white on
  felt on help and ink on paper on privacy, bold, not underlined, 48px tall.

## Notes (not blocking, follow-ups)

- A bold, not-underlined line on its own may not read as something to tap. The owner's no-underline rule makes this the
  current choice; the queued "real buttons" work (#345) is where it would change.
- Other links on /privacy and /terms are still underlined (main's global `a` style). Outside this change; #345 covers it.
- Round 1 notes still standing as follow-ups are unchanged.
