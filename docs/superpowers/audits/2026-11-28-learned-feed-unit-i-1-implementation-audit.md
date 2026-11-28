# Learned feed, unit I (a parent's yes): implementation audit 1

- Pull request: #457, branch `claude/project-thread-93bazh`, head **46f7347** (`46f734787dd2afe271fcc405b40719930abbc330`), merge base with `main` `19045c3`.
- Lane 3 (a migration, `prisma/migrations/20261128071013_parent_asks`). Reviewer: a fresh session, Opus 5.5, medium. Review only: nothing in the pull request was changed.
- Brief: `docs/superpowers/specs/2026-11-22-learned-feed-design.md`, sections 1, 3, 4.1, 6.2, 6.5, unit I (I1, I2, I4, I5), "For every unit", 10.1 and 10.2.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**46f7347 FAIL: 3 red.** The flow, the token, the migration, the purge, the consent gate and the `teenPersonal` switch are right and well tested. Three things block: a teen can give themselves the yes by typing their own number (R1), a 280 KB generated `.eslintcache` with this machine's paths is committed (R2), and Ask a parent stops fitting the screen as soon as it shows a problem line (R3).

## What ran, on 46f7347

| Check | Result |
|---|---|
| `eslint .` and `prettier --check .` | exit 0 |
| `svelte-check --fail-on-warnings` | 0 errors, 0 warnings, 2402 files |
| `vitest --project unit` | 170 files, 2457 tests passed |
| `vitest --project postgres` `parent-asks.pg.test.ts`, `purge.pg.test.ts` | 34 tests passed |
| Playwright, tablet and computer (Chromium), every new test: `parent-yes.test.ts` (both), the teen tests in `controls-overlap`, `fits-the-screen` and `gamepad` | 9 passed, 1 skipped (the overlap test skips the computer by design: its sizes are phones'), no retries |
| Phone (WebKit) | **not run here**: this container has no WebKit (`/opt/pw-browsers/webkit-2359` missing). CI's draft run 46125030492 on this head, in Playwright's image with WebKit, is green on all six browser pieces, postgres, verify and gate (quick). |
| Probe: the states the overlap test leaves out (parent's page after No; Ask a parent with its problem line) at 320×568, 375×667, 667×375, on tablet's Chromium | no overlaps; the view runs past the window (R3). Probe: `2026-11-28-learned-feed-unit-i-1-probe.test.ts.txt` |

## Against the brief

| Requirement | Where | Status |
|---|---|---|
| 6.5 Ask a parent → number → **Text my parent** | `YourFeed.svelte`, `settings/feed/parent` | PASS. Adds "Your first name", as the spec note the builder added explains (accounts hold no first name). The name is checked to letters (`nameOf`), so no link or number can be put in the text, and is never stored (pg test "keeps neither the number nor the link"). |
| 6.5 text words | `parentText` | PASS, word for word. |
| 6.5 / I2 Yes and No; after Yes, Turn it off; with `teenPersonal` off, "Thanks. We'll turn it on when we can." | `parent/[token]` | PASS (pg tests and the journey). |
| 6.5 / I1 an unanswered ask ends after 5 days | `open()`, `pageOfRow` | PASS (pg test, journey 2). |
| I1 one open ask per teen | `ask()` locks the teen's `User` row, then counts | PASS ("two asks at once text once"). Not a database constraint; the lock is enough, as every write goes through `ask()`. |
| I1 three texts per teen a day | rolling 24h count of rows, cancelled and failed ones included | PASS. |
| I1 fields | `ParentAsk` | PASS: renamed from `ParentYes` for the private-boundary test, recorded in the spec. |
| I2 the teen can cancel | `cancelAsk` | PASS (journey "Delete"). |
| I2 Turn it off returns the calm feed and stops recording | `answer(…, "off")` revokes, deletes the teen's chips and Good pick answers, sets `feedResetAt` | PASS. |
| I5 `/parent/<token>` Gated; no change without consent | `consent/routes.ts` `"/parent"`; journey posts `?/yes` without `rk_consent` and sees 303 to `/cookies` and `answer` still null | PASS. |
| I4 journey CRUD: ask, waiting, yes, full feed, off, ask again, cancel, ended link | `parent-yes.test.ts` | PASS on tablet and computer here; phone in CI. |
| 4.1 / 10.2 a teen with a yes is `full` only while `teenPersonal` is on | `askingOf`, `learnerOf` | PASS (unit and pg tests). No `ClipView` writer exists yet (unit B), so "no view is stored" holds trivially. |
| Section 1: "It has failed … if an under-18 without a parent's yes gets a feed that learns from them" | `ask()` | **RED (R1)** |
| "For every unit": cascade on `teenUserId`, purge covers the new table | migration FK `ON DELETE CASCADE`; `deletion.ts`; purge pg test | PASS. |
| "For every unit": `showTheOwner` on each new screen, `forgetRateLimits` | journey | PASS. |
| 10.1 a parent's phone kept only as a hash | `phoneHash` = HMAC-SHA256 under `BETTER_AUTH_SECRET`, as sign-up's numbers | PASS. |
| Owner rules: no two controls overlap at 320×568, 375×667, 667×375 | new overlap test and the probe | PASS for every state checked. |
| Owner rule: everything reachable by gamepad | new gamepad test on Your feed (teen, waiting), Ask a parent, the parent's page | PASS. |
| Owner rule: screens fit the view, no scrolling inside the app | fits test covers the screens without a problem line | **RED (R3)** |
| Only files the plan needs | `.eslintcache` | **RED (R2)** |
| Privacy page tells the truth | `privacy/+page.svelte` | PASS: name not kept, number scrambled, answer and time kept, a yes holds until turned off. |

Security of the link: 32 random bytes (`randomBytes(32)`, base64url), only its SHA-256 kept, unique index; an unknown token shows the same page as an ended one, so the page does not tell a guess from an old link; Yes and No work only on an open ask, Turn it off only on a holding yes, so a reused link changes nothing else; the answer locks the row (`FOR UPDATE`). Expiry: 5 days for an open ask; a yes's link stays live for Turn it off as the spec asks. Migration: one new enum and one new table, no change to an existing row or column, so it is safe to apply and to roll back by dropping both.

## Red findings

**R1.** UNIT: `src/features/feed/parent-asks.ts` `ask()`. VERDICT: red. REQUIREMENT: spec section 1 ("an under-18 without a parent's yes gets a feed that learns from them" is a failure) and 4.1. REASON: a teen can type their own phone number and say Yes to themselves. EVIDENCE: `ask()` reads only `adultOn` from the teen's row (line 117) and never compares the typed number (line 110) with the teen's own `User.phoneNumber`, which sign-up verified; nothing else refuses it, and no test covers it. EXPECTED: the teen's own number is refused before anything is kept or texted, with plain words such as "Type your parent's number, not yours." FIX: in `ask()`, read `phoneNumber` with `adultOn` and return a new outcome (for example `"own-number"`) when it equals the typed E.164 number; add its words to `PROBLEMS` in `src/routes/settings/feed/parent/+page.server.ts`; add a pg test in `tests/features/feed/parent-asks.pg.test.ts` that the teen's own number keeps no row and sends no text. Files: those three. (A friend's phone still works; that is the spec's open lawyer question 10.3.1, not this finding.)

**R2.** UNIT: `.eslintcache` (added in f097fdf). VERDICT: red. REQUIREMENT: only the files the change needs; nothing machine-specific in the repo. REASON: ESLint's cache file is committed. EVIDENCE: `git diff --stat origin/main...pr457 -- .eslintcache` shows a new 280,112-byte file; it holds absolute paths such as `/home/user/RukenApp/src/features/accounts/computer-keys.ts`; it is not in `.gitignore`; after this audit's lint and test runs it was gone from the work tree (`git status`: ` D .eslintcache`), so tool runs keep showing it changed. EXPECTED: not in the repo. FIX: `git rm --cached .eslintcache` and add `.eslintcache` to `.gitignore`. Files: those two.

**R3.** UNIT: `src/routes/settings/feed/parent/+page.svelte` and `main.card.ask` in `src/lib/look.css`. VERDICT: red. REQUIREMENT: the Owner's rule "screens fit the view" and "no scrollbar inside the app"; the PR's own claim (fits test) that Ask a parent fits. REASON: once a problem line shows (a wrong number, a bad name, too many today, could not text), the screen runs past the window, so Text my parent drops below the fold just when the teen needs to try again. EVIDENCE: the probe pressed Text my parent with "12" as the number, then measured `document.body.scrollHeight - document.body.clientHeight`: 47 px at 375×667 (the phone's size), 138 px at 320×568, 116 px at 667×375; the page itself does not scroll (0) but the view does. The PR's fits test opens the screen only without a problem line. EXPECTED: 0 at the phone's size with a problem line showing, and the button above the bar. FIX: make the screen fit with the problem line (for example, the problem line takes the place of "We'll text your parent a link to say yes." while it shows, or the card closes up further), and add the problem state to the teen test in `tests/browser/fits-the-screen.test.ts`. Files: those three.

## Notes (not blocking, recorded)

- **N1. Texts to strangers.** The only limit is three a day per teen account. `phoneHash` is written but never read, so nothing limits how often one number is texted across accounts, and a parent who said No can be texted again the same day and every day after (pg test "No keeps the calm feed, and the teen may ask again"). Each account needs a phone verified at sign-up, so abuse costs a number per three texts a day, and a parent can reply STOP. A cap per `phoneHash` (and a pause after a No) would close it; it is a product choice beyond the spec's numbers, so it is for the coordinator to raise, not this fix round.
- **N2.** After a parent's No, the teen's Your feed shows Ask a parent again with no word that the parent said no.
- **N3.** The site sends no `Referrer-Policy`, and the token lives in the link. The browser default (`strict-origin-when-cross-origin`) keeps it from other sites, and the parent's page links nowhere off the site, so nothing leaks today.
- **N4.** The overlap and gamepad tests do not open the parent's page after No, after Turn it off or ended, nor Ask a parent with its problem line; the probe checked No and the problem line for overlap and found none.
- **N5.** The spec gained one line from the builder (the table name and the first-name field). It matches the brief the coordinator gave this audit.
