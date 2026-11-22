**8e0d129 FAIL: 1 red**

# Real buttons, not underlined words: lane 2 review, round 1

- Commit examined: `8e0d129` on `claude/project-thread-p6zxug` (base `c3c4d68`, main). An earlier pass at `bd9ee9a` was paused when the owner widened the rule; its five notes were checked again here.
- Reviewer: a fresh session, Opus 5.5, medium. Lane 2 (`src/lib/look.css`, `src/lib/icon.svelte`).
- Brief: the owner, 2026-11-22 17:02, 18:02 and 18:04 UTC, as the coordinator passed them on. Every action that stands on its own is a real button: no underline, a fill or an edge, and at least 44px tall. Nothing anywhere is underlined. A link inside a sentence is shown by its colour and weight. Back, Change, Up, Down, Show, Hide, Remove and Close are icons, each with its words as its accessible name and a target of 44px or more. Only existing tokens are used. Roles and the focus ring are unchanged.

## What ran, at 8e0d129

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors in 2034 files. The first try counted build output that my own earlier browser run left in `.svelte-kit/`. After that was cleared it passed. |
| `pnpm test` | 129 files, 1929 tests passed |
| `pnpm test:browser --project=tablet --project=computer` | 1144 passed, 114 skipped, 6 failed in 24.9 min. All 6 are `money-job.test.ts:48`, `money-job.test.ts:54` and `purge-job.test.ts:39`, once on each device. See "The six job failures" below. |
| The same two job files on a fresh database at 8e0d129 | tablet 9 passed, computer 9 passed |
| Phone (WebKit) | Not run here. WebKit runs in CI only. |

### The six job failures are not this change

- These files touch no screen, and the diff touches no job code.
- The full run used a database that a run I stopped early had already written to. The money job then said "collecting Stripe's fee report" failed.
- On a fresh database, 8e0d129 passes both files on tablet and on computer (above).
- `main` (`c876bfe`) behaves the same way. On a fresh database it passed 9 of 9 on tablet. Run again on the same database, it failed `money-job.test.ts:54` and 2 more.
- So this is test set-up state carried between local runs. It is not a defect of this change, and not a flaky test in CI, where each run gets a fresh database.

## The earlier notes, from bd9ee9a

1. `make-live-changes.test.ts:535` (Keep the old one inside an 800px window). Fixed: `.asks .keep` now has a 0.75rem margin. It passed on tablet (#317) and computer (#955).
2. The fold-out look reached the play screen's RKN tab and the accepted card. Fixed: the look now applies only to `details:not(.menu, .accepted) > summary`, and the two keep main's base rule.
3. "Add yours to Ruken." lost its full stop. Fixed: the full stop is back, and the three tests that name it are back to main's wording.
4. Goodbye's Sign in was a button inside its sentence. Fixed: it is a link again, blue and heavier with no line under it. The journey holds this (`real-buttons.test.ts:202`).
5. The journey did not visit Join, the fold-out or goodbye. Fixed: `real-buttons.test.ts:202`, `:216` and `:233` now visit them, and all three passed on both devices.

## Changed tests

Each changed test follows the new look and still checks the property it named.

- `look.test.ts:144` checks fill, colour, no underline and 48px height.
- `look-layout.test.ts:137` checks a rem between lines, now measured line box to line box.
- `membership.test.ts:76`: the button's edge lines up with the card's words, and its own lines start together.
- `make-design-pass.test.ts:364` and `make-second-look.test.ts:62` check that the way off is dimmer: sage words where Back has chalk.
- `make-second-look.test.ts:305` still asks for 16px or more.
- `bar.test.ts:45`: the name lost its "←" with the arrow drawing.
- `tests/lib/look.test.ts` checks the quiet picker's fill.
- `real-buttons.test.ts` leaves `nav.bar` out of its check of standalone actions. The bar's tabs are tabs, and another thread is giving them their own look. It is still covered by the no-underline sweep.

## Exploratory checks

I ran a probe, `/mnt/project-files/real-buttons/review-8e0d129/probe.test.ts.txt` (not committed). It visited 21 screens on tablet and computer and listed every link set among words, with its colour and weight against the words around it.

- **Links among words.** Every link in a sentence on a card is Bright Blue (`rgb(0, 110, 184)`) and weight 600, against ink at 400, with no underline. Examples: the guide's "Here's how to put it there", "Join Ruken", "Sign in" and "your page", and "Probe Maker" on a game's page. They read as links at a glance (`computer_help_get-your-game-on-ruken.png`). No visited screen had a link in words on the felt.
- **Icons.** Measured sizes:
  - Back on a game's page: 48×48.
  - Back beside Save: 48×60.
  - Change, Up, Down, Show, Hide and Remove on Your links: 48px tall and 130 to 168px wide (see note N1).
  - Each carries its word as its accessible name, and the journeys reach them by it.
  - The keyboard ring on an icon button is a 3px solid ink outline, as on any button (`computer-links-focus.png`).
  - The arrow, pencil, up and down arrows, bin and cross read at a glance.
- **The eye icons are the exception** (finding R1).
- **CRUD.** The links' create, read, update and delete journeys find the controls by the same names. They passed on both devices.
- **Tokens.** Only `--felt-raised`, `--sage`, `--chalk`, `--ink`, `--pay`, `--radius-button`, `--press-time`, `--press-scale`, `--text-button` and `--size-target` are used. All already exist.

## Findings

### R1

- **UNIT:** `src/routes/make/page/links/+page.svelte`, lines 33 to 36 (Show and Hide).
- **VERDICT:** red.
- **REQUIREMENT:** the owner, 18:04 UTC: "if something can just be an icon **and people will understand**". The repo's own rule (`this-repo`, "An icon where people understand it"): "Where the picture alone could be misread, keep the words." The drunk-grandma test: "nothing that needs explaining".
- **REASON:** a link that players can see shows a crossed-out eye. A crossed-out eye is the usual sign for "this is hidden", so the row reads as the opposite of the truth. A hidden link shows an open eye.
- **EVIDENCE:** `/mnt/project-files/real-buttons/review-8e0d129/computer-links-focus.png`:
  - "My site" (shown, no "Hidden" label) has a crossed-out eye.
  - "My shop" ("Tapped 0 times · Hidden") has an open eye.
  - Only the second row has words saying where it stands, so the first row has nothing but the crossed-out eye to go on.
  - It is the same eye a password box uses to show where the box stands, not what the button does.
- **EXPECTED:** a maker can tell at a glance what the button does to the link.
- **FIX:**
  - Keep the words on these two. Either the eye and its word side by side ("Show" and "Hide"), or the word alone, like `Up`/`Down` before. The `aria-label` stays the same word.
  - Add a check in `tests/browser/real-buttons.test.ts` that the Show and Hide buttons on Your links have visible words.
  - Files: `src/routes/make/page/links/+page.svelte` and `tests/browser/real-buttons.test.ts`. If the rule's list changes, also the "An icon where people understand it" line in `.claude/skills/this-repo/SKILL.md`, named in the pull request body.

### Notes (not blocking)

- **N1.** The `this-repo` line says a button holding only an icon "stays a 48px square". On Your links the five buttons in a row stretch to fill the card (130 to 168px wide, 48px tall). That is a bigger target, which is fine. The line and the screen just don't say the same thing. Either the line or the CSS could be brought into step.
- **N2.** On a white card, a quiet button's Glaucous Green fill is 1.69:1 against the card. The words on it are 11.0:1, so the button is still found by its words. I'm recording it only because a fill this light is easy to lose on a bright phone screen.
- **N3.** On the felt, a link among words would be told from them by weight alone (chalk 600 against chalk 400). No visited screen has one today. The first screen that adds one should be looked at.

## Verdict

**8e0d129 FAIL: 1 red** (R1, the Show and Hide eye icons on Your links). Everything else meets the brief. After the fix, a re-check needs only R1, its new check, and `real-buttons.test.ts` and the links journeys on tablet and computer.
