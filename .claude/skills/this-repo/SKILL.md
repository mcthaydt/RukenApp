---
name: this-repo
description: Use before changing anything in RukenApp, for its product rules, layout, CI and outside services.
---

# This repo

Ruken is Instagram Reels meets Linktree for games. Read the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`), the roadmap (`docs/superpowers/roadmap.md`) and `docs/superpowers/progress.md` before choosing work.

The code is under the Functional Source License, FSL-1.1-ALv2 (`LICENSE.md`): anyone may read, change and use it, except to run a competing service; each version becomes Apache 2.0 two years after it is published. Files from others (fonts, colour data) keep their own licences, kept beside them.

This repository is public. No secret, private plan, customer data or real address goes in it, and no strategy or research: market research, critiques, competitors, launch strategy, forecasts, the owner's personal and company details and the reasons behind business decisions go to the owner's Ruken page in Notion (https://app.notion.com/p/41f9145749a080cdbabfda8caf24cdc6), not to a repo. The design here says what Ruken does, not why.

## Private notes go to Notion

- **Where.** On the Ruken page (the red anchor; not the two Ruken pages under Finance): a decision the owner made goes in **Decisions**, one row with the decision, the date, the area, the owner's own words and where it is written; a note, draft, research, review or reasoning goes in **Library**, one page with its area, status, date and a one-line "In short". Change an existing page rather than adding a second copy. Leave the dashboard, Roadmap and "Was in RukenPrivate at" to the thread that keeps the page up to date.
- **Never in Notion:** a password, key, token, secret or card or bank detail. Those stay where `Outside the repo` says.
- **No Notion tools in this session?** Do not drop the note and do not put it here. Commit it to `mcthaydt/RukenPrivate` under `for-notion/<date>-<topic>.md` (a lane 1 pull request there, merged on green) and say in your report "saved to RukenPrivate for-notion, not in Notion yet". The next session that has Notion moves each file there into Notion and deletes it from `for-notion/` in one pull request.
- `mcthaydt/RukenPrivate` stays as it is: an archive of what was moved, and the fallback above. Nothing new goes in it otherwise.


Code from the archived RukenAppFailed is copied on purpose, file by file, with its tests; never its history, plans or secrets.

## Layout

- `src/features/<feature>/` holds each feature (accounts, games, launch, make, membership, money, pages, play); `src/lib/` and `src/lib/server/` hold shared helpers; `src/routes/` is SvelteKit's pages and endpoints.
- `prisma/schema/` is the schema, `prisma/migrations/` the migrations; `cloudflare/` the Workers (the site and the games' own address).
- `tests/` mirrors `src/`; `tests/browser/` holds the Playwright journeys, `tests/support/` the stand-ins and helpers, `tests/architecture.test.ts` the layer rule.

## CI

- `.github/workflows/ci.yml`: `verify` (lint, typecheck, unit tests, build), `postgres` (database tests on Postgres 16), six browser pieces summed up by `browser`, and `gate`, which passes only when all three passed. A draft gets the quick run under names ending "(quick, draft)"; marking it ready starts the full run.
- `.github/workflows/commit-authors.yml`: the identity check, `commit-authors`.
- Screenshots are picked by a program. The `screens` job (in `ci.yml`) builds the base and the change, and `tests/browser/support/changed-screens.ts` compares what the two builds made (blanking the two per-build stamps) and names the changed client files and the pages that load them. `showTheOwner` (`tests/browser/support/look.ts`) then attaches a `look:` picture only when the page loaded one of them, on every run: draft, full, or `main`. Every journey still runs all its checks; only the picture of a screen the change does not reach is left out. Every screen is shot when the pull request carries the `screenshots` label, when a changed file can change every screen (`SHOOT_EVERYTHING_WHEN` in `ci.yml`: `prisma/`, `cloudflare/`, `tests/fixtures/`, `tests/support/`, `tests/browser/support/`, the lockfile, `package.json`, the Vite, Playwright and Wrangler config, `ci.yml`), when server code that the hooks, an endpoint or nothing else reaches changed, when a route was added, or when either build, the picker or its answer failed. A journey file that changed shoots its own screens. A person running the journeys on their own computer has no answer and gets every picture. A builder who wants a screen or size added says why in the pull request, as `visual-check` says.
- `.github/workflows/pr-rules.yml`: the pull request rules on GitHub, the `pr-rules` status on a pull request's head commit. It runs from `main`'s copy on `pull_request_target` and `issue_comment`, checks the rules the hooks check (lane and criteria in the body, drafts, the open limit of 6, a passing review that names the head commit), and closes a pull request opened over the limit.
- Branch protection on `main` requires `gate` and `commit-authors` (read from `gh api repos/mcthaydt/RukenApp/branches/main/protection`, 2026-11-21); it does not require branches to be up to date. The repo is owned by a person, not an organization, so it has no GitHub merge queue: the session that merges runs the queue by hand (`release`). Auto-merge is allowed and merged branches are deleted by GitHub.

## Outside the repo

- The live site is https://ruken.io, which sends mail from no-reply@ruken.io; https://ruken.dev serves games and media. The old games address is closed. A merge to `main` does not deploy: the owner runs `pnpm run deploy` (and `pnpm run deploy:games`; a bare `pnpm deploy` is pnpm's own deploy command, not this script) for the games Worker).
- This repo is public: R2 stays out of it (no R2 bucket names, keys or upload steps), and nothing for it runs on the owner's computer.
- Secrets are the owner's, typed into Cloudflare with `wrangler secret put`. None is written in the repository or in chat.

## Product rules

- **Money is whole cents** (`bigint`). The split is worked out only by pure, tested functions.
- **Ledger facts are only ever added**, never changed.
- **Nobody types a fact.** Every amount and count comes from an API, a webhook or a measurement. People only make decisions; no form has a field where a person types an amount or a count.
- **Games are untrusted.** A game never sees a player's sign-in, and never runs on Ruken's own address.
- **Time comes from an injected clock.** Domain code never calls `Date.now()` directly. Money dates are America/Chicago.
- **The copy is quiet and human.** It never claims a game is "AI-free", and never invents a business fact.
- **The drunk grandma test, on every screen and message.** Someone tired and distracted understands every line and finds their way on the first try: short sentences, words a person says out loud, one obvious next step per screen, and a plain way back when something fails. Plans say how each screen passes; audits check it.
- **Do not overengineer.** Build the simplest thing that meets the approved design. No speculative features, extra dependencies or abstractions for later.
- **Write code a junior developer can follow.** Descriptive names, plain control flow, small functions with one job. Where something cannot be simple (security, money, an outside service's quirk), a comment beside it says why.
