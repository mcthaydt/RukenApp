# Plan audit 2: a name and an address for every account

- Audited: PR #461, `docs/superpowers/specs/2026-11-28-name-and-friend-address-at-sign-up-design.md` at `25180d0b6ea9e842d977fd2eee5961d266238138` (`25180d0`), against `main` at `04689e5`.
- Auditor: fresh session, Opus 5.5, medium. Lane 3 plan audit, round 2, read-only except this file.
- Written 2026-11-28 08:48 UTC (`date -u`).

## Verdict

**FAIL: 1 red.** All five reds of audit 1 are fixed in the spec. One new gap: once sign-up gives every account a page, the test helpers and journeys that assume a signed-up account has no page break, and the page editor (still live until #459) meets a page it did not make. The plan does not own them.

## Audit 1's reds

| Red | Fixed? | Where |
|---|---|---|
| R1 search lists unlisted makers | Yes | Item 7; unit D owns `search.ts` and `Search.svelte`; criterion 4 and `search.test.ts` check name and address. |
| R2 no way out | Yes | Item 2 "A way out" (Sign out, Delete my account); `/me/name` and `/me/delete` in the open list; criterion 2 by keyboard and gamepad. |
| R3 address overflow, double Save | Yes | Item 3: 23 + hyphen + up to 6 digits = 30; end hyphen dropped; `friend` under 3; accents dropped; "Safe to press twice" returns the existing page; criterion 3 lists the hard names and the two saves. |
| R4 nothing for teens | Yes | Words: nickname line for anyone not known to be 18+; item 6 privacy line; criterion 9 with a 15 year old. |
| R5 journeys not named | Yes, for the sign-up screen | "The journeys the new step changes" names every file that presses "Join Ruken" or calls `finishSignUpForm`. The knock-on effect is R6 below. |

## Red

### R6. Sign-up now makes a page, and the helpers, journeys and editor that assume it does not are not in the plan
- UNIT: C and E ("Files it owns", "The journeys the new step changes").
- REQUIREMENT: CLAUDE.md "the diff touches only files in the plan"; `review`: a change that edits an existing test names each one and why; spec item 4 "no dead links".
- REASON: after this change `signUp` and `finishSignUpForm` answer the question, so every account they make already has an (unlisted) page. Three things built on "a signed-up account has no page" break, and the plan names none of them.
- EVIDENCE:
  - (a) `givePage` in `tests/browser/support/database.ts:482-513` calls `makerPage.create` with the account's `userId`, which is unique (`prisma/schema/pages.prisma`). It is called 40 times in 19 journey files (`grep -rn "givePage(" tests/browser`), nearly all on accounts made by `signUp`/`signUpInItsOwnContext` (for example `maker-page.test.ts:121`, `controls-overlap.test.ts:255`, `gamepad.test.ts:308,417`, `sent-to-you.test.ts:62`, and game makers in `feed.test.ts:29`, `adults-only.test.ts:40`, `cookie-consent.test.ts:21`). Each would throw on the unique key. The spec says only "`givePage` stays".
  - (b) Journeys that check a maker with no page: `feed.test.ts:154` "a maker with no page has no maker line" (expects 2 links on the clip) and `play.test.ts:120` ("Made on Ruken" because the maker has no page; `PlayScreen.svelte:380`). Game makers sign up through `signUp` (`tests/browser/support/game.ts`), so they now have an unlisted page: the clip gains the maker's name and the follow plus (spec item 4), and the play menu says "by <name>". Every feed clip in other journeys gains those controls too, which moves focus order (`gamepad.test.ts`) and what `controls-overlap.test.ts` measures.
  - (c) The page editor `/make/page` is live until #459, which waits on this PR. `service.ts:116-117` creates a page only when the account has none, so after sign-up the editor never makes one: it edits the unlisted page, and "See your page" (`src/routes/make/page/+page.svelte:54`) opens the 404. `edit-page.test.ts:87` ("a maker makes her page ... ") and the `goto(`/${address}`)` steps after it (lines 128-334, 475) would fail, and a real person using the editor in that window meets a dead link. Spec item 4 says a page "made in the editor before #459 stays listed", but not what the editor does with a page sign-up made.
- EXPECTED: the plan names each of these and says how it changes, and no user-facing link leads to the missing page.
- FIX (spec only; the build then owns the files it names):
  - (a) Add `tests/browser/support/database.ts` to unit C or E: `givePage` updates the account's existing page when there is one (its name, address, line, links and `listed` true), else creates it as today; `personWithPage` is unchanged. Say that the 19 files that call it do not change.
  - (b) Name `feed.test.ts` (the no-page test becomes "an unlisted maker's name is words, not a link", or uses a maker made in the database with no page) and `play.test.ts:120` (what the menu says for an unlisted maker), and say `gamepad.test.ts` and `controls-overlap.test.ts` are re-run for the extra maker controls on every clip.
  - (c) Decide what the editor does until #459 merges, and name `src/features/pages/service.ts` `savePage` and `edit-page.test.ts`. The smallest choice that keeps today's editor whole is: saving in the editor marks the page listed (the editor has always made a public page, and #459 closes it next). The other is hiding "See your page" while the page is unlisted and moving `edit-page.test.ts` to `givePage`. Either is the spec writer's call within the owner's decisions; it does not need the owner.

## Notes (not blocking)

- N9. Words say "Sign out (→ link)", but `/sign-out` takes only a POST (`src/routes/sign-out/+page.server.ts`). Build it as `/me` does: a form with a quiet button styled as the link (`src/routes/me/+page.svelte:64-66`).
- N10. Item 2 and the Words cite `isAdult` in `age.ts`; the functions are `isAdultOn` and `isKnownAdult` (`src/features/accounts/age.ts:103-113`).
- N11. Item 3 does not say what happens after the tenth taken address (10^6 six-digit endings make it very unlikely). Say it shows a plain "Try again." rather than an error page.
- N12. Audit 1's N1 still stands: `src/routes/+layout.server.ts` reads only `cookies` today, so a redirect there does not run again on a tap from `/help` to the feed unless the load reads `url.pathname`. Criterion 2's journey should reach one people screen by a tap from an open screen.
- N13. Audit 1's N2 still stands, wider: `/join`, `/sign-up`, `/me/link`, `/me/press`, `/followed`'s and `/settings`'s sub-screens and someone else's page (`/<address>`) are in neither list by name. Placing them (or a unit test that fails on a route folder in neither list) stops the builder guessing.
- N14. N5 of audit 1 (invisible characters counted as a name) is not in the spec. Trim zero-width characters before the "Type a name." check.

## What holds

- The owner's choices are kept: the question right after the code with the owner's words, the address made by code from the name, existing accounts asked once on their next visit with no backfill, unlisted with no public page until slice 4, the address unchanged by a rename.
- CRUD for the name: create (the question, criterion 1), read (Your turn and the share sheet, criteria 5 and 6), update (`/me` → Your name, criterion 6), delete (account deletion, criterion 7; `src/features/accounts/deletion.ts` removes the page).
- Never stuck, gamepad included: Sign out and Delete my account on the question, both open, both by keyboard and gamepad (criterion 2, criterion 10).
- Minors: the nickname line for anyone not known to be 18+, the privacy page says so, tested with a 15 year old.
- Overlap at 320×568, 375×667 and 667×375, visible focus: criterion 10; `/me/name` joins `controls-overlap` and `fits-the-screen`.
- Unlisted: the 404 lives in `[handle=handle]/+page.server.ts` (not `pageByHandle`, which follows need), clip and "Made by" credits become words, search shows no unlisted maker. These are the only places that link to `/<address>` today besides the editor (`grep -rn 'href={`/${' src`).
- Migration: `listed` default true keeps every existing page listed; runs forward in `pnpm test:pg` (criterion 11). No new dependency, tool or spend.
