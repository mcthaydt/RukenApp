# Progress

Last updated: 2026-11-16 18:07 UTC (from `date`). Written by the rules setup session on the coordinator's behalf,
because the coordinator cannot write to the repo.

## Active milestone: slice 2, Games and play

Owner instruction (2026-11-15, roadmap): finish slice 2 only; everything after it is Later.

### Done (merged to `main`)

- #156 play screen rebuilt to Ruken's first look, with 2048 as the test game.
- #157 staff screen design fixes (18 of 19; finding 6 left by design, spec 15.2).
- #138, #150 to #155: staff review, game page, take a game off, rules rewrite.
- #159 old workflow rules removed. #161 reverted the first rules attempt (#160).

### Now

- Rules setup: CLAUDE.md and the `review`, `release` and `visual-check` skills, plus this record, on branch
  `claude/project-thread-9ru62m`. Lane 2 (first-time setup from the owner's rules text).

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

- `main` has had no CI run of its own since #112 (2026-11-15); see Setup in `history.md`.
- Flaky tests seen once each on 2026-11-16: `tests/browser/make-after.test.ts:206` (phone-landscape-webkit),
  `tests/browser/make-design-pass.test.ts:293` (phone-landscape), `tests/browser/make-second-look.test.ts:501` (phone,
  second sighting: fix it).

### Decisions waiting on the owner

- Add one final `gate` job to `ci.yml` and require it (the setup check's missing item).
- Let `main` run CI after a merge (a `workflow_dispatch` trigger, or auto-merge using a token that starts workflows).
- Remove `--passWithNoTests` from the draft quick run.
- Browser test pieces: 6 (CLAUDE.md) or 12 (`ci.yml` today).

## Owner steps

Every step only the owner can run, as one batch. The first needs the owner's quoted words in this thread, because CI
workflow files change only on them; the command runs after the gate job is on `main`.

```sh
# After a "gate" job lands in ci.yml: require it alongside the existing checks (verify, browser, postgres stay).
gh api -X POST repos/mcthaydt/RukenApp/branches/main/protection/required_status_checks/contexts --input - <<< '["gate"]'
# Confirm.
gh api repos/mcthaydt/RukenApp/branches/main/protection --jq '.required_status_checks.contexts'
```

## Preview

Test site: https://ruken.ruken-beta.workers.dev
