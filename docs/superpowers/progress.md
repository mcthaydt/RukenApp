# Progress

Last updated: 2026-11-16 19:58 UTC (from `date`). Written by the rules setup session on the coordinator's behalf,
because the coordinator cannot write to the repo.

## Active milestone: slice 2, Games and play

Owner instruction (2026-11-15, roadmap): finish slice 2 only; everything after it is Later.

### Done (merged to `main`)

- #156 play screen rebuilt to Ruken's first look, with 2048 as the test game.
- #157 staff screen design fixes (18 of 19; finding 6 left by design, spec 15.2).
- #138, #150 to #155: staff review, game page, take a game off, rules rewrite.
- #159 old workflow rules removed. #161 reverted the first rules attempt (#160).
- #162 project rules, setup check record and CI gate; `gate` is required on `main`. #166's loading-cover journey fix
  came in with it.

### Now

- End-of-slice retro rule in CLAUDE.md, on branch `claude/project-thread-9ru62m`. Lane 3, on the owner's words.

### Next, in order

1. Slice 2 implementation audit, then its fixes.
2. One design review loop on the play screen and the game page (`visual-check`), screenshots in one artifact.
3. G: the owner's walk on the test site with a real GitHub game.
4. Forms restyle and phone sign-up. Open owner questions: does the phone number replace email at sign-up, and does
   sign-in use the phone number.

### Open pull requests

- #144 (draft): screen rules as browser tests. Check whether #157's sideways fix clears it.
- #147: cut-off text on maker screens, large iPhone sideways. Likely replaced by #157: rebase and run CI, or close.

### Blockers and risks

- `main` had no CI run of its own from #112 (2026-11-15) until #162 added `test-main`; watch its first run on `5f831a2`.
- Flaky tests seen once each on 2026-11-16: `tests/browser/make-after.test.ts:206` (phone-landscape-webkit),
  `tests/browser/make-design-pass.test.ts:293` (phone-landscape), `tests/browser/make-second-look.test.ts:501` (phone,
  second sighting: fix it).

### Decisions made by the owner

- 2026-11-16, "yes to 1–3, keep 12": add a `gate` job and require it; let `main` run CI after a merge; remove
  `--passWithNoTests`; keep 12 browser test pieces. All in #162.
- 2026-11-16, "Let's instead do this after the end of every slice": a retro after each slice closes (the
  self-improving step), not a daily one.

## Owner steps

None open. `gate` was made required on `main` on 2026-11-16.

## Preview

Test site: https://ruken.ruken-beta.workers.dev
