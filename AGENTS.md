# Ruken: notes for coding agents

Ruken is Instagram Reels meets Linktree for games. Read `CLAUDE.md` (the workflow), the design in `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md` and `docs/superpowers/progress.md` before choosing work. Anything not in section 2 of the design needs the Owner's words before it starts.

The code is under the Functional Source License, FSL-1.1-ALv2 (`LICENSE.md`, Owner, 2026-11-13): anyone may read, change and use it, except to run a competing service; each version becomes Apache 2.0 two years after it is published. Files from others (fonts, colour data) keep their own licences, kept beside them.

This repository is public. No secret, private plan, customer data or real address goes in it, and no strategy or research: market research, critiques, competitors, launch strategy, forecasts and the reasons behind business decisions stay out (Owner, 2026-11-13). The design here says what Ruken does, not why. Code from the archived RukenAppFailed is copied on purpose, file by file, with its tests; never its history, plans or secrets.

## Rules

- **Money is whole cents** (`bigint`). The split is worked out only by pure, tested functions.
- **Ledger facts are only ever added**, never changed.
- **Nobody types a fact.** Every amount and count comes from an API, a webhook or a measurement. People only make decisions; no form has a field where a person types an amount or a count.
- **Games are untrusted.** A game never sees a player's sign-in, and never runs on Ruken's own address.
- **Time comes from an injected clock.** Domain code never calls `Date.now()` directly. Money dates are America/Chicago.
- **The copy is quiet and human.** It never claims a game is "AI-free", and never invents a business fact.
- **The drunk grandma test, on every screen and message.** Someone tired and distracted understands every line and finds their way on the first try: short sentences, words a person says out loud, one obvious next step per screen, and a plain way back when something fails. Plans say how each screen passes; audits check it.
- **Do not overengineer.** Build the simplest thing that meets the approved design. No speculative features, extra dependencies or abstractions for later.
- **Write code a junior developer can follow.** Descriptive names, plain control flow, small functions with one job. Where something cannot be simple (security, money, an outside service's quirk), a comment beside it says why.
