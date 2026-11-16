# Progress

Last updated: 2026-11-16 17:50 UTC (from `date`).

Written by the rules setup session on the coordinator's behalf, because the coordinator cannot write to the repo
(CLAUDE.md, "Writing"). Taken from the owner's handoff of 2026-11-16.

## Active milestone: slice 2, Games and play

Built and merged except two pieces: the slice 2 audit with its design review loop, and the owner's real-GitHub walk
(G). `main` was at `b706f58` (#157) at the handoff; #159 (rules removal) has merged on top of it since.

### Now

- Rules re-added from the owner's text (CLAUDE.md and the `review`, `release` and `visual-check` skills), with the
  setup check from `release`. Lane 2 (first-time setup from the owner's own rules text).

### Completed in this milestone

- #156: the play screen, rebuilt to look like Ruken's first version, with 2048 as the test game.
- #157: staff screen design fixes, 18 of 19 findings. Finding 6 (digits use the text face) is left by design
  (spec 15.2).
- #138 staff review, #150 to #155 (game page, take a game off, rules rewrite).
- #159: the old workflow rules and process docs removed (owner: "When we finish with the slice here - remove all
  workflow stuff and claude.md"). Git history keeps every removed file.

### Remaining, in order

1. **Slice 2 audit, then its fixes.** An implementation audit of slice 2 on `main`. Not started.
2. **One design review loop over every slice 2 screen not yet through one** (`visual-check`). The staff screens had
   theirs (#157). The play screen and the game page need one. Game page (owner, 2026-11-16): it needs a review pass
   to fit the new design, mainly the colours; its layout and behaviour are mostly fine. Every ask for the owner's look
   carries the screenshots (owner: "you have to show me things if you want me to sign off on it").
3. **G: the owner's walk on the test site with a real GitHub game.** Code is done and tested against stand-ins. The
   cloud container cannot pull from GitHub (tarball hosts answer 403 through the proxy), so the first real pull is
   the owner's. A real-GitHub pull is also what puts 2048 on the test site. Walk:
   `/mnt/project-files/owner-steps/2026-11-16-g-walk.md`; status: `/mnt/project-files/handoff/g-status.md`. Part 0
   (redeploy the gate) comes first. After the walk: three address checks, the tracker lines, and the risks to watch
   (Worker CPU or memory limit on a pull; whether GitHub sends the person back to Ruken after repo changes).
4. **Forms restyle to the maker style, and phone sign-up (better-auth and Twilio).** Not committed anywhere. Notes:
   `/mnt/project-files/handoff/forms-and-phone-signup.md`. Saved patch:
   `/mnt/project-files/handoff/forms-restyle-work/forms-restyle-working-tree.patch` (applies on `c8e8726`; expect
   conflicts on today's `main`). Rough shots: `/mnt/project-files/forms-restyle/`.

### Open pull requests

- **#144 (draft):** the automatic screen checks (no sideways scroll, no cut-off text, 44px taps, real links, a way
  back), across 11 windows. Found cut-off text on three maker screens on a large iPhone held sideways. Stays red until
  `main` passes; check whether #157's sideways fix (W4) clears it.
- **#147 (open, no checks on its last commit):** fix cut-off text on maker screens on a large iPhone held sideways.
  Likely overlaps #157's W4 fix. To decide: rebase and run CI, or close as replaced.

### Blockers and waiting on the owner

- The owner's answer on the forms rough shots.
- Open owner questions: does the phone number replace email at sign-up, and does sign-in use the phone number.
- Twilio keys are typed by the owner into Cloudflare.
- G needs the owner's walk (above).
- Setup check, open owner decisions (each needs a workflow change, so the owner's quoted words):
  - No aggregate gate job: `ci.yml` requires `verify`, `postgres` and `browser` separately, with no final job that
    passes only when every applicable check ran and passed. Once one exists, branch protection adds it with
    `gh api -X PATCH repos/mcthaydt/RukenApp/branches/main/protection/required_status_checks -F strict=true
    -f 'contexts[]=verify' -f 'contexts[]=postgres' -f 'contexts[]=browser' -f 'contexts[]=gate'`.
  - `--passWithNoTests` in the draft quick run (`ci.yml:122`, `ci.yml:173`), against CLAUDE.md "Tests": "No
    `--pass-with-no-tests` or similar flag that lets an empty suite pass in CI".
  - `auto-merge.yml` turns on auto-merge for every non-draft PR, so marking a PR ready merges it once its checks pass,
    lane 3 included, with no owner approval in between. Whether to keep it as is, limit it, or remove it.

### Tests to watch

- **Main CI gap:** the last CI run on a push to `main` is from 2026-11-15 (`3da364c`). Merges made by the
  auto-merge workflow's token start no CI on `main`. Pull requests ran full CI before merging.
- **Flaky, seen once each on 2026-11-16 (a test that fails once and passes on retry is a defect):**
  - `tests/browser/make-after.test.ts:206`, phone-landscape-webkit, `goto` timeout.
  - `tests/browser/make-design-pass.test.ts:293`, phone-landscape.
  - `tests/browser/make-second-look.test.ts:501`, phone (second sighting: fix it).
- **Local runs:** `rejoin.test.ts` and the payment journeys fail locally on a reused journeys database. Drop the
  schema before a local run.

### Previews

- Test site: https://ruken.ruken-beta.workers.dev
- Boards: app screens https://claude.ai/artifact/Bjf1edBq3XJmMZBrwj75yx; maker
  https://claude.ai/artifact/Wjg2oKxKVSWAXj8sKtDgXL; submission https://claude.ai/artifact/WpGNfEL7AxdRgz1q2RuWFE;
  owner board https://claude.ai/artifact/BLoxXKRPxtxxm7otBUGdWV.

### Material decisions

- Agent-selected, until the owner decides on `auto-merge.yml`: marking a PR ready merges it, so lane 2 and lane 3 PRs
  stay drafts until their review (lane 2) or the owner's approval or a standing permission (lane 3).

- Owner instruction: remove the old workflow rules once the slice's work there was done, and re-add rules from the
  owner's new text as the fresh project's first step.
- Agent-selected: the wide and hard-to-undo paths in CLAUDE.md's Risk section, read from the repo's layout. The owner
  can change them.
- Unresolved: CLAUDE.md Settings says 6 browser test pieces in CI; the CI workflow runs 12 (owner, 2026-11-16: "Use
  12"). The text is kept as the owner gave it; the owner decides which number stands.
