# Plan audit: online servers, and a player's birthday and place (cycle 2)

Examined: `docs/superpowers/specs/2026-11-20-online-servers-and-player-place-design.md` at **f3ba869** (PR #203, draft), which answers cycle 1 (`2026-11-20-online-servers-and-player-place-1-plan-audit.md`, at bf987a7). Checked against `main` at **dc96dc9** (code, schema, and branch B in `plans/2026-11-15-texts-not-email.md`), PR #195 at **3d39aba**, PR #204 at **9dd05b7**, and RukenPrivate #15 at **5f03442** (leak check only). Graphify's RukenApp index is at dc96dc9.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**Not ready to merge: 3 red, 6 notes.** Every cycle 1 finding is answered where it was marked. The three reds are new and small: #204's cycle 3 added a rule that Q+ must follow, Y shares files with three other units without a "not alongside" line, and the privacy change Y waits on has no writer.

## Cycle 1, checked

| Finding | Where it landed | Holds |
|---|---|---|
| R1 O and B on `accounts.prisma` | New unit U waits on B on `main`; O keeps only `games.prisma` | yes |
| R2 the date across the code screen | `PendingSignUp.birthDate` in U; `startSignUp` and `finishSignUp` in section 4 and Y's files | yes |
| R3 deletion | Section 4; `deletion.ts` and `purge.pg.test.ts` in Y; section 8 | yes |
| R4 privacy draft | Section 6, "The privacy draft"; section 8 | yes, but see C3 |
| R5 where the place screen goes | `/about-you` after the code, through `aboutYouFirst`; the paywall still lands on the card | yes |
| R6 no place from the connection | `placeOf` with `XX`, `T1`, the missing case, the phone fallback and a test seam | yes |
| R7 which countries, which file | Six countries; `library/places.json`; no new dependency | yes (N3) |
| R8 the area table | Section 5's rule and `places.json` | yes (N4) |
| R9 storage, checks, part, reason | `GameServerArea[]`, two named CHECKs, the `players` part, a reason pair | yes |
| R10 a live game | Section 3's four lines; section 8 | yes |
| R11 file lists, not alongside | Q+ full list and not alongside H and A; Y's full list | Q+ yes; Y see C2 |
| R12 boundaries, time, checks, steps, models | Section 6 | yes |
| R13 older accounts | Section 4, `birthDate` nullable; About you asks; the `adultOn` match | yes |
| N1 to N6 | Each marked in the text | yes |

- **The Owner's cards.** Sections 4 and 7 now give the birthday card as 00:16 UTC, where cycle 1's text said 00:17. The thread's record shows the three choices at 00:16:47, 00:16:58 and 00:17:09 UTC, so 00:16 is right for the second one.
- **The leak check passes again.** The new text, including the area table and `placeOf`, names none of the feed's private rules or numbers. Checked against RukenPrivate #15.

## Red findings

### C1. Q+ writes to a waiting game but does not set `changedAt`

- UNIT: section 6, row Q+, and its step 1. VERDICT: red.
- REQUIREMENT: #204 at 9dd05b7, section 2 (F12): "Every maker write to a waiting game writes `Game.changedAt` in the same write ... #195 also adds maker writes to a waiting game ... whichever of H and K or Q merges second makes each of them set `changedAt`, with a test each that it makes a held decision lapse".
- REASON: the servers answer is a new maker write to a waiting game, and so is clearing it when `online` is taken away. If H is on `main` first, a held yes would survive a change to the servers.
- EVIDENCE: Q+'s Owns names `service.ts` "(saving, clearing with `online`, the one-write live change)" and no `changedAt`. Its step 1 has no lapse test.
- EXPECTED: saving or clearing the servers answer on a waiting game sets `changedAt` in the same write when H is on `main`.
- FIX: Q+'s row and step 1 add "if H is on `main`, saving or clearing `serverAreas` on a waiting game sets `changedAt` in the same write, with a test that it makes a held decision lapse; if H merges after Q+, H does it (#204 F12)". Only the spec.

### C2. Y shares files with Q+, #195's Q and V, and #204's A, with no "not alongside" line

- UNIT: section 6, row Y. VERDICT: red.
- REQUIREMENT: `staged-path`, Splitting: "no two running units own the same file".
- REASON: Y waits on U and B, and Q+ waits on O and Q, so the two can run at the same time.
  - Y and Q+ both own `tests/browser/support/database.ts`.
  - Y owns `src/lib/look.css` and `tests/lib/look.test.ts`, which #195's Q and V own.
  - Y owns helpers in `tests/browser/support/`, which #204's A owns ("the browser helpers in `tests/browser/support/` that make live games").
- EVIDENCE: Y's Owns cell in f3ba869; #195 section 7, rows Q and V; #204 section 7, row A.
- EXPECTED: one line on Y, as Q+ has for H and A.
- FIX: Y's "Waits on" adds "not alongside Q+, #195's Q or V, or #204's A (`tests/browser/support/`, `src/lib/look.css`): whichever starts second waits for the other to merge". Only the spec.

### C3. Y waits on the privacy draft change, but nobody is named to write it

- UNIT: section 6, "The privacy draft", and row Y. VERDICT: red.
- REQUIREMENT: `staged-path`, Splitting: each output has a unit that owns its files; CLAUDE.md "No stalls".
- REASON: Y cannot start until a RukenPrivate change merges, and neither Y's Owns list, its steps nor any other unit writes that change. So Y's start depends on someone noticing.
- EVIDENCE: Y's "Waits on": "the privacy draft change below merged in RukenPrivate". Y's step 2 only "links the merged privacy draft change".
- EXPECTED: one named writer and when it happens.
- FIX: Y's step 0 adds "open a lane 1 pull request in RukenPrivate changing `legal/drafts-from-rukenapp-pr-104/privacy.md` lines 16, 29, 100 and 145 and adding the place line, each marked [LAWYER TO CONFIRM]; merge it on green before Y's pull request is marked ready". Y's "Waits on" becomes "U on `main`" alone, and the privacy change becomes "before Y merges". Only the spec.

## Notes

- **N1. #195 still names the account columns as O's.** #195 section 7's Boundaries (3d39aba) says the multiplayer spec's columns, "a player's birthday and place", go in "Unit O". They are now in U. It does no harm, since #203 is the source, but whoever next edits #195's spec, or the slice's progress record, should say U. It is recorded here, not fixed here.
- **N2. `aboutYouFirst` adds one database read to every signed-in page.** Reading `birthDate` and `country` together with the session's user, if `createHandle` already loads it, would avoid a second query. Also: a signed-in account with no `adultOn` that gives an under-13 date stays on About you for good. Sign-out and `/me/delete` are reachable, so it is not a dead end, but section 4 could say that the refusal offers "Delete my account".
- **N3. Where `places.json` comes from.** ISO's own 3166-2 pages carry ISO's terms. Unicode CLDR's subdivision data has the same codes and English names under a free licence. Step 0 could also confirm that Workers' `Intl.DisplayNames` gives region names, as it confirms `cf`.
- **N4. Three areas are left as "the rest".** The Middle East, South America, and Mexico and Central America are not listed country by country in section 5, so the table test only checks the file against itself for them. Listing them, or reviewing `places.json` in Y's fresh review, closes that.
- **N5. A copy line for the visual check.** "Pick the areas, or Players anywhere, not both." may read better as "Pick areas, or pick Players anywhere. Not both."
- **N6. `User.country` has no format CHECK.** `User_region_check` ties the region to the country, but nothing keeps `country` to two capital letters. `"country" ~ '^[A-Z]{2}$'` in U would match how B checks `phoneNumber`.
