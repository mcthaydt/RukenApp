# Rules setup: implementation audit, round 1

Pull request #162, commit `75b2991` on `claude/project-thread-9ru62m`. Lane 2 (first-time setup from the owner's
rules text): one fresh review of the change. Written 2026-11-16 18:11 UTC (from `date`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was checked

- **Kit text verbatim.** Each block of the owner's kit (`claude-md-apps-kit.md`) was cut out and diffed against the
  committed file. `review`, `release` and `visual-check` match byte for byte. `CLAUDE.md` differs only on the
  placeholder lines (title, what it is for, stack and the five commands, identity, owner name, lane 2 and lane 3
  paths), plus the rewrap those lines need. No `[PLACEHOLDER]` is left in any file.
- **Placeholders against the repo.** Stack and versions match `package.json` (`@sveltejs/kit` 3.0.0, `svelte` 5.57.1,
  Prisma 7.10.0, better-auth, Stripe, Vitest, Playwright, adapter-cloudflare, Wrangler, `pnpm@10.34.6`, `engines.node`
  24.x, `.nvmrc` 24.22.1). `lint`, `typecheck`, `test`, `test:pg`, `test:browser` and `build` are all real scripts.
  Identity matches the recorded git identity; the commit is authored by it with no AI credit lines.
- **Named risk paths exist.** Every lane 2 and lane 3 path the fill added exists at `75b2991` (checked with `test -e`).
  `tests/golden/` does not exist, but it is the kit's own text, not a fill.
- **Setup-check record.** Checked against the repo and GitHub: `ci.yml` triggers include `ready_for_review` and push to
  `main`; the `changes` job exists; there is no aggregate gate job and no `workflow_dispatch`; `--passWithNoTests` is at
  `ci.yml` lines 122 and 173; branch protection requires `verify`, `browser`, `postgres`, strict, force-push off; the
  last push run on `main` is `3da364c` (#112, 2026-11-15, success); Superpowers is 7.0.2; CLAUDE.md Settings says 6
  browser pieces; `progress.md` names the right branch. All accurate. The unit test count was not re-run here; the
  draft quick run on `75b2991` passed `verify`, `postgres` and `browser`.

## Findings

UNIT: `CLAUDE.md`, Risk, lane 3 paths.
VERDICT: red.
REQUIREMENT: CLAUDE.md Risk, lane 3 ("money"); the PR's criterion "placeholders filled from the repo".
REASON: the Stripe membership code is not named, so a change to it would read as lane 1 or 2.
EVIDENCE: `src/features/membership/` holds `checkout.ts`, `subscription.ts`, `payments.ts`, `stripe-client.ts`,
`stripe-port.ts`, `webhook.ts`, `inbox.ts` and `sync.ts`; ten of its files use Stripe. Lane 3 names only
`src/features/money/` and `src/routes/webhooks/`.
EXPECTED: lane 3 names `src/features/membership/` beside `src/features/money/`.
FIX: add `` `src/features/membership/` `` to the lane 3 list. Only `CLAUDE.md`.

UNIT: `CLAUDE.md`, Risk, lane 3 paths.
VERDICT: red.
REQUIREMENT: CLAUDE.md Risk, lane 3 ("credentials").
REASON: the sign-in and session code is not named in any lane.
EVIDENCE: `src/features/accounts/` holds the better-auth setup (`auth.ts`), `cookies.ts`, `sign-in-guards.ts`,
`auth-limits-plugin.ts` and `sign-in-pause-plugin.ts`; `src/routes/api/auth/[...path]/+server.ts` serves better-auth.
Neither path is in lane 2 or lane 3.
EXPECTED: lane 3 names both, since a mistake there leaks or locks out accounts.
FIX: add `` `src/features/accounts/` `` and `` `src/routes/api/auth/` `` to the lane 3 list. Only `CLAUDE.md`.

UNIT: `CLAUDE.md`, Risk, lane 2 paths.
VERDICT: red (low).
REQUIREMENT: CLAUDE.md Risk, lane 2 ("shared code many callers use").
REASON: the shared browser-test support folder is missing while `tests/support/` is listed.
EVIDENCE: `tests/browser/support/` (`database.ts`, `game.ts`, `account.ts`, `check.ts`, `fake-stripe-server.ts`,
`fake-github-server.ts` and others) is imported by the browser tests; lane 2 names `tests/support/` only.
EXPECTED: lane 2 names `tests/browser/support/`.
FIX: add `` `tests/browser/support/` `` after `` `tests/support/` `` in the lane 2 list. Only `CLAUDE.md`.

UNIT: `CLAUDE.md` line 105, Identity.
VERDICT: note.
REQUIREMENT: none; the kit wraps at 120 columns and the lane lines were rewrapped.
REASON: the filled identity line is 155 columns and was not rewrapped. Prettier ignores `*.md`, so no check fails.
EXPECTED: wrap it like the lane lines.
FIX: rewrap lines 105 to 108 only. Only `CLAUDE.md`.

UNIT: `docs/superpowers/progress.md`, Owner steps.
VERDICT: note.
REQUIREMENT: none; the command is owner-only and could not be run here.
REASON: the batch posts a bare JSON array, while GitHub's documented body for this endpoint is `{"contexts": [...]}`.
EVIDENCE: `gh api -X POST .../required_status_checks/contexts --input - <<< '["gate"]'`.
EXPECTED: the documented form, so the owner's one run works the first time.
FIX: use `gh api -X POST repos/mcthaydt/RukenApp/branches/main/protection/required_status_checks/contexts -f 'contexts[]=gate'`. Only `progress.md`.

## Result

Three red findings, all one-line additions to the risk paths in `CLAUDE.md`, and two notes. The kit text, the other
placeholders and the setup-check record are correct. Not ready to mark ready until the three reds are fixed and
checked.
