# Learned feed: plan audit 2

Audited: RukenApp `claude/learned-feed-spec` at `7809fb0` (the spec, the copied audit 1 and one `progress.md` line, three files changed since `main` `c556cc0`), against RukenPrivate `strategy/2026-11-15-feed-design.md`, the public page draft, RukenPrivate #18 at its head (`feed/settings.json`, `feed/settings.md`), the cookie consent spec at `origin/claude/project-thread-rnuc8p` (`docs/superpowers/specs/2026-11-22-cookie-consent-design.md`) and the Owner's card answers in the thread "Spec the learned feed". Code read on `main`. Written 2026-11-22 17:18 UTC by the session that wrote audit 1 (Opus 5.5, medium, `review` skill); it wrote nothing in the spec. Audit only. Like audit 1, it names keys and never a value from `feed/settings.json`.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 5 red, 9 notes.** Fourteen of audit 1's fifteen reds are fixed and one is fixed in part. The new parts have four gaps: the consent interface names a file and a rule the consent spec does not have, the dependency table and section 9 disagree, a link points at a page built later, and several of section 10's promises have no step.

## Audit 1's reds

| Red | Fixed? | Evidence at `7809fb0` |
|---|---|---|
| R1, private values in the public spec | Yes | Sections 0, 1 and 3 and 4.3 now name keys or say "now and then". A script read every line added by the 8 commits since `c556cc0` for the private values, as digits and in words: none. `263719d` and `0078048` are not ancestors. The copied audit 1 is identical to `8e78fc9`'s. |
| R2, defaults equal to private values | Yes | Section 5 **Call** and J2 (1): the check fails when a private value equals its public default. |
| R3, numbers without keys | In part | Five keys added to section 5 and to `settings.json` (key names match both ways, by script). `settings.md` has no source line for four of them: see red R5 below. |
| R4, gating on Opens 1 and 2 | Yes, by the answers | The Owner answered on cards at 16:24 UTC: "Yes, all three", "Build now, switches on", "Text the parent a code" (checked in the thread). K's tiers and L's "liking" follow from them; L waits on G. |
| R5, signals after `at` | Yes | 4.6 "What a later page reads after `at`", put-in keys, `ask`; B4 and B6 rewritten; quick no and More/Less act from the next open. |
| R6, catalogue changes between pages | Yes | 4.6 first bullet; A7 covers a game going live and one taken down; the never-twice-in-a-row rule holds with `spacing` off (4.5, A6). |
| R7, empty round 0 | Yes | 4.6 "The first page"; A7's played-everything and one-unplayed cases. |
| R8, shared files in parallel | Yes, with red R2 below | `signals/` modules owned one per unit; the shared files are named and their units serialised. |
| R9, rows pointing at removed makers or games | Yes | "For every unit": cascading foreign keys, `FeedTaste` holds ids, the purge test shows another player's chip for a deleted maker is gone. |
| R10, free watchers' phone | Yes | 4.2 and B3, with a test. |
| R11, `/healthz` format | Yes | `/healthz/feed`, plain text; `/healthz` and its test unchanged (A8). |
| R12, checklists and K's tests | Yes, with red R4 below | Every unit has steps; K has tests for the endpoint, the earned mark, the tiers, the cap, own games and the money boundary. |
| R13, hand-run command in `settings.md` | Yes | `settings.md` says nobody loads it by hand; the workflow does. |
| R14, J2 on an unchecked route | Yes | J2 waits on a hook covering RukenPrivate pull requests (table, section 8 item 7). |
| R15, live file | Yes | No file under `docs/superpowers/live/` at `7809fb0`. |

Audit 1's notes were all taken (••• is a **Call**, old-form and other-viewer cursors start fresh, `clipSlot` 1, `crons.js`, the CLI and agent prompt, the five-day estimate, the parent link's end, the shorter journey, `fewPlayTapShare`).

## Section 10 and the consent dependency: what holds

- The Owner's four card answers and the 16:24 instruction ("Make sure we build it in a way that the law will be okay with") match the thread word for word. `sky`, `highTaste`, `parentYes` and `teenPersonal` are on in the private file and off in the public defaults, as 5 and 10.2 say.
- Section 10 does not claim what any law requires; it lists four lawyer questions, each with what it would change, and carries them as risks after the Owner's "No, turn it on anyway" (Open 5). The coordinator's compliance brief (disclosure, children's data, state privacy opt-outs, sky claims, switches with tests) is covered by 10.1 to 10.3.
- The consent spec does say what 4.1 relies on: without `rk_consent` the caller is `none` (its 3.6), the write guard throws `NoConsentWrite` (3.3), `hasConsent(cookies)` exists (3.2), `/jobs/*` is a machine route and `/me/*` gated (3.7), and its sheet has the line "To save this game" (3.4). B, D, G, I and K wait for it.

## Red findings

**R1.** UNIT: section 7 "For every unit" (Consent), B2, K5. VERDICT: red. REQUIREMENT: the brief rests on the consent spec's interface; a builder must be able to follow both. REASON: the spec names a file and a two-way rule the consent spec does not have. EVIDENCE: the spec says every new route is "consent-gated or named in `consent/machine-routes.ts`" and K5 puts `/jobs/high-taste` "on `consent/machine-routes.ts`"; the consent spec 3.7 names every route in `consent/routes.ts` as exactly one of three kinds, Open, Machine or Gated, and already covers `/jobs/*` by pattern. B2 calls `/api/feed/seen` gated yet answers 204 without consent, while the consent spec's gated test expects "the notice, a refusal, or a redirect". EXPECTED: each new route is placed in one of the three kinds in `consent/routes.ts`, with its answer without consent stated so the consent tests pass. FIX: rewrite the rule with the right file and kinds, and place each new route: `/api/feed/seen` (Gated, and say its no-consent answer is the refusal the gated test accepts, or make it Open with the write guard on), `/healthz/feed` (Machine, writes nothing), `/parent/[token]` (Gated), `/me/feed` (Gated by `/me/*`), `/jobs/high-taste` (Machine by `/jobs/*`, nothing to add). Files: the spec.

**R2.** UNIT: section 7 table, section 8 item 6, section 9. VERDICT: red. REQUIREMENT: `staged-path` Splitting ("a unit waits on another when it reads that unit's output, or when the two touch the same file") and the plan's own claims. REASON: the table makes C wait on B with no shared file or output, which pulls the consent wait into C, E, H and L, while section 9 says those go ahead if the consent work slips; and D's waits leave out E although the text runs E before D for `service.ts`. EVIDENCE: table row C "Waits on: B, F" (C owns its migration, `games/questions.ts`, its screens, `/make/<game>` and `signals/mood.ts`, none of B's files); E waits on C, H on C, L on D, E and G; section 9 "A, F, C, E, H and L can go ahead"; row D "Waits on: C, the consent work merged", against "Then E and D one after the other (both touch `service.ts`): E, then D". EXPECTED: the table, the paragraph and section 9 say the same thing. FIX: let C wait on F only (or name what it reads from B), add E to D's waits, and make section 9 list exactly the units that do not wait on consent through any chain (with C on F only: A, F, C, E and H; L waits on G and so on consent). Files: the spec.

**R3.** UNIT: D6, D7, 10.1 ("Plain disclosure"), unit L. VERDICT: red. REQUIREMENT: 10.1 "linked from every clip's ••• sheet"; the drunk-grandma test (nothing broken to tap). REASON: unit D puts **How the feed works** in the ••• sheet (and, without consent, as its only button), but the page is unit L, which waits on D, E and G. EVIDENCE: D6 "The ••• sheet also holds How the feed works"; D7 "pressing ••• shows only How the feed works"; table row L "Waits on: D, E, G". Between D and L the button opens a missing page. EXPECTED: no link before its page exists. FIX: either L adds the ••• link and the Your feed link (L then owns that `Feed.svelte` edit, after G), or D adds them only once L has merged; say which, and give D7's no-consent ••• what it shows before then (nothing, if the sheet is hidden). Files: the spec.

**R4.** UNIT: 10.1, 10.2, units A, D, I, K. VERDICT: red. REQUIREMENT: "Acceptance criteria come first"; every criterion has a check; `staged-path` each unit row owns its files. REASON: four of section 10's promises have no unit step or owner. EVIDENCE: 10.1 promises "a second [architecture test] keeps ranking from reading payments beyond membership status"; no step builds it (K step 6 is only the money side). 10.2's `teenPersonal` test ("a teen with a yes gets the crowd feed and no view is stored") is in no unit's steps (I step 5 tests the yes, not the switch off), and no unit says it adds `teenPersonal` to `settings.ts` (A's step 2 builds the list; say A does). D6's `User.feedPersonal` is a migration missing from D's Owns and D1. EXPECTED: each is a named step in one unit, and each migration is in its unit's row. FIX: add the second architecture test to A (ranking) or K step 6; add the `teenPersonal` off test to I's steps and the key to A's step 2; add `User.feedPersonal` to D1 and D's Owns. Files: the spec.

**R5.** UNIT: RukenPrivate `feed/settings.md` at #18's head. VERDICT: red. REQUIREMENT: J1 ("each with a one-line source in `feed/settings.md`"); audit 1 R3. REASON: four new keys have values in `settings.json` and no source line. EVIDENCE: the table in `settings.md` has no row for `skyElementStep`, `newMoonFirstShowingEvery`, `fullMoonStandingWeight` or `retrogradeIdleDays` (checked by grep). EXPECTED: one row each. FIX: add the four rows; tick J1 step 2 when done. Files: RukenPrivate `feed/settings.md`, the spec's J1 checkbox.

## Notes (not blocking)

- **N1.** G5 says "the same wording pattern for Like and Repost" without the words; section 6 says words are the ones written. Write them (for example "To like this game", "To repost this game").
- **N2.** D6 and 10.1's **Learn from what I do** is a new control, drawn from the Owner's 16:24 instruction rather than the approved design. Mark it **Call**.
- **N3.** The approved public page words (unit L) do not mention Learn from what I do. If disclosure needs it, the new line is the Owner's to approve.
- **N4.** H2 changes first-showing slots, standing's weight and the surprise rate, which A's modules own. Say that A's `signals/` interface exposes those three, so H edits only its module (A has merged by then, so nothing clashes either way).
- **N5.** G's step 5 edits `signals/quiet.ts`, which G's Owns does not list (B owns it; B is merged by then).
- **N6.** 4.6 caps `x` at 20 put-in clips without saying what happens at the cap (no more put-ins, or the oldest dropped).
- **N7.** C and E add writes under `/make/*`. If they merge before the consent work, they cannot carry the "same press without `rk_consent` writes nothing" test; the consent work's gated `/make/*` test covers them then. Say so.
- **N8.** `/healthz/feed` is not skipped by `handle.ts` or `https-only.ts` (both match `/healthz` exactly; `handle.test.ts` has a "/healthz/more" case that checks this). It will resolve a caller and, over http, redirect. J2 asks over https, so it works; say that A8's test goes through the same path.
- **N9.** RukenApp `claude/project-thread-f5vo25` and `claude/project-thread-lcnv5f` were gone at 17:18 UTC (`git ls-remote`), so this audit is pushed to a fresh `claude/project-thread-f5vo25` built on `7809fb0`, with none of the old commits.

## Expected for audit 3

A fix commit on `claude/learned-feed-spec` that clears R1 to R4, and RukenPrivate #18 clearing R5, named to a fresh audit. Notes may be taken or left with a reason.
