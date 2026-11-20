---
name: this-repo
description: Use before changing anything in RukenApp, for its product rules, layout, CI and outside services.
---

# This repo

Ruken is Instagram Reels meets Linktree for games. Read the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`), the roadmap (`docs/superpowers/roadmap.md`) and `docs/superpowers/progress.md` before choosing work.

The code is under the Functional Source License, FSL-1.1-ALv2 (`LICENSE.md`): anyone may read, change and use it, except to run a competing service; each version becomes Apache 2.0 two years after it is published. Files from others (fonts, colour data) keep their own licences, kept beside them.

This repository is public. No secret, private plan, customer data or real address goes in it, and no strategy or research: market research, critiques, competitors, launch strategy, forecasts, the owner's personal and company details and the reasons behind business decisions go to `mcthaydt/RukenPrivate`. The design here says what Ruken does, not why.

Code from the archived RukenAppFailed is copied on purpose, file by file, with its tests; never its history, plans or secrets.

## Layout

- `src/features/<feature>/` holds each feature (accounts, games, launch, make, membership, money, pages, play); `src/lib/` and `src/lib/server/` hold shared helpers; `src/routes/` is SvelteKit's pages and endpoints.
- `prisma/schema/` is the schema, `prisma/migrations/` the migrations; `cloudflare/` the Workers (the site and the games' own address).
- `tests/` mirrors `src/`; `tests/browser/` holds the Playwright journeys, `tests/support/` the stand-ins and helpers, `tests/architecture.test.ts` the layer rule.

## CI

- `.github/workflows/ci.yml`: `verify` (lint, typecheck, unit tests, build), `postgres` (database tests on Postgres 16), six browser pieces summed up by `browser`, and `gate`, which passes only when all three passed. A draft gets the quick run under names ending "(quick, draft)"; marking it ready starts the full run.
- `.github/workflows/commit-authors.yml`: the identity check, `commit-authors`.
- No program picks the screens a change reaches yet (`visual-check`, "Shoot what the change touches"). The builder lists the screens and sizes in the pull request by hand, and CI still takes the journeys' screenshots of every screen when anything visual changed.
- Branch protection on `main` requires `gate` and `commit-authors`. The repo is owned by a person, not an organization, so it has no GitHub merge queue: the session that merges runs the queue by hand (`release`). Auto-merge is allowed and merged branches are deleted by GitHub.

## Outside the repo

- Test site: https://ruken.ruken-beta.workers.dev. Its database matches `main`.
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
