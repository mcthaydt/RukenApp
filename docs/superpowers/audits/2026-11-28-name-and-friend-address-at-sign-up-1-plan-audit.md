# Plan audit 1: a name and an address for every account

- Audited: PR #461, `docs/superpowers/specs/2026-11-28-name-and-friend-address-at-sign-up-design.md` at `ba9b12ddedb750a8b5585eb155454013c8c2644a` (`ba9b12d`), against `main` at `04689e5`.
- Auditor: fresh session, Opus 5.5, medium. Lane 3 plan audit, read-only except this file.
- Written 2026-11-28 08:42 UTC (`date -u`).

## Verdict

**FAIL: 5 red.** The shape is right and follows the owner's calls (name after the code, address made by code, existing accounts asked on their next visit, unlisted until slice 4). The reds are gaps the build would hit or ship: a public listing the plan missed, a screen with no way out, an address maker that can make invalid addresses, nothing for 13 to 17 year olds, and journeys the plan does not own.

## Red

### R1. Search still lists unlisted makers, and links to their missing page
- UNIT: D (Unlisted).
- REQUIREMENT: the coordinator's brief: unlisted means no public `ruken.io/<address>` page and no search or indexing; spec item 4 "no dead links".
- REASON: search finds makers by name and address and links each one to `/<address>`; unit D does not own search.
- EVIDENCE: `src/features/feed/search.ts:127-141` builds `makers` from every live game's maker (`makersOf`), matching `maker.handle` too; `src/features/feed/Search.svelte:122` links each to `` `/${maker.handle}` ``. After this change that link is a 404 for an unlisted maker, and their address can be found by typing a name.
- EXPECTED: an unlisted maker never shows in the makers part of search results (their games still show, with their name as words). Matching games by an unlisted maker's address is dropped too.
- FIX: unit D adds `src/features/feed/search.ts` (and `makersOf` in `src/features/pages/service.ts` returning `listed`); criterion 4 adds a search for an unlisted maker's name and address that finds no maker row. Files: those two, plus the test.

### R2. The question is a dead end for an existing person
- UNIT: C (The question).
- REQUIREMENT: the coordinator's brief: "no dead end for existing users (it must never get you stuck, incl. gamepad)"; spec item 2 keeps sign-out and deleting the account open.
- REASON: the routes stay open, but nothing on the question screen leads to them. The only links to them are on `/me`, which the plan sends to the question.
- EVIDENCE: `src/routes/me/+page.svelte:64-67` holds the only "Sign out" button and "Delete my account" link; spec item 2 sends `/me` and its screens to the question; the Words section gives the screen one field and one button. Someone who does not want to give a name can only Save or type an address by hand, and a gamepad has no way out at all.
- EXPECTED: the question screen has one quiet secondary way out, a blue → link ("Sign out →"), below Save. From there they can sign in later or ask for help. The redirect also never applies to `/me/name` itself (spec item 2 lists "/me and its screens", which as written loops).
- FIX: unit C, `src/routes/me/name/+page.svelte` and the redirect's open list; criterion 9's journey reaches "Sign out →" by keyboard and gamepad and lands signed out. Words gain the link. Files: unit C's own files and `tests/browser/your-name.test.ts`.

### R3. The address maker can make an address the database refuses, and Save can fail on a double press
- UNIT: B (The address maker).
- REQUIREMENT: spec item 3 and criterion 3 (every answer meets `HANDLE` and the length); the drunk-grandma test (a double tap must not break).
- REASON: (a) the name is trimmed to 30 characters first, then "-1234" or "-123456" goes on the end, making 35 or 37 characters; cutting can also leave a hyphen at the end. (b) `MakerPage.userId` is unique, so a second Save from the same account (double tap, two tabs, the back button) throws instead of finding the page it already made.
- EVIDENCE: `src/features/pages/handle.ts:7` `HANDLE_MAX = 30`; `prisma/migrations/20261114120000_pages/migration.sql:59-60` checks 3 to 30; `prisma/schema/pages.prisma` `userId String @unique`. Criterion 3's list has "30+ characters" but never a long name that is taken.
- EXPECTED: (a) the part from the name is cut to leave room for the digits (30 − 7 = 23 characters when digits are needed), then any end hyphen is dropped, and a base shorter than 3 after that starts from `friend`. (b) `makeUnlistedPage` for an account that already has a page returns that page and changes nothing.
- FIX: `src/features/pages/address.ts`, `service.ts`; tests add "a 30+ character name that is taken", "a name that cuts to end in a hyphen", and in `service.pg.test.ts` "the same account saves twice at once: one page, no error". Files: unit B's own.

### R4. Nothing is done for 13 to 17 year olds
- UNIT: C (The question), with B.
- REQUIREMENT: the coordinator's brief: "minors' names handled carefully"; Ruken is for 13 and up (`src/features/accounts/age.ts:6`), so teens reach this screen.
- REASON: the question invites a real name, and spec item 5 freezes the address made from it until slice 4. A 14 year old who types their full name gets an address like `emma-johnson`, shown to friends on Your turn and the share sheet and not changeable. The spec never mentions age.
- EVIDENCE: spec items 3-5 and Words; `isAdult`/`adultOn` in `src/features/accounts/age.ts:103-113` already tells the app who is under 18 (or of unknown age).
- EXPECTED: for an account not known to be 18 or over, the line under the heading says to use a nickname, not a full name (for example "Use a nickname, not your full name. Friends see it."). The privacy page's new part says the same. This keeps the owner's "address made from the name". Whether a teen's address should instead be `friend-<digits>` is a change to the owner's choice, so it is a note below, not part of this fix.
- FIX: `src/routes/me/name/+page.server.ts` and `+page.svelte` (the line by age), `src/routes/privacy/+page.svelte`; `tests/browser/your-name.test.ts` signs up a 15 year old and sees the nickname line, and an adult does not. Files: units C and F.

### R5. The plan does not own the journeys the new step breaks
- UNIT: C, the "Files it owns" column.
- REQUIREMENT: CLAUDE.md "the diff touches only files in the plan"; `review`: a change that edits an existing test names each one and why.
- REASON: the plan says only `signUp` in `tests/browser/support/account.ts` changes "so every other journey still signs up". But many journeys press "Join Ruken" through `finishSignUpForm` or by hand and expect to land on `next`, which will now be the question.
- EVIDENCE: `finishSignUpForm` is called directly by `follow-a-maker`, `join`, `loading`, `pay`, `play`, `sign-up` and `wishlist` journeys; "Join Ruken" is pressed in `adults-only`, `fits-the-screen`, `gamepad`, `help-guide`, `join-and-help-look`, `legal-pages`, `look-layout`, `look`, `membership`, `rejoin` and `support/look.ts` too (`grep -rln "Join Ruken\|finishSignUpForm" tests/browser`).
- EXPECTED: the plan lists every journey file that signs up without `signUp` and says how it changes (most: `finishSignUpForm` answers the question, so the files may not change at all; the ones that check the screen right after the code, such as `sign-up` and `follow-a-maker`'s signed-out plus, assert the question then `next`). Any golden of a screen right after sign-up is named too.
- FIX: the spec's unit C row and its PR body. Files: the spec only.

## Notes (not blocking)

- N1. The redirect in `src/routes/+layout.server.ts` only runs again on a page change in the browser if the load reads `url`; otherwise a person who opens `/help` first and then taps the feed is never asked. Read `url.pathname` there (or do it in `hooks.server.ts`, lane 2), and add one journey step that reaches the feed by a tap from an open screen.
- N2. Spec item 2 does not place `/join` or someone else's page (`/<address>`). Say which list each is in. A unit test that reads `src/routes/` and fails on a folder in neither list (as the `RESERVED_HANDLES` test does) keeps it whole.
- N3. `pageByHandle` is used by the follow endpoint (`src/routes/[handle=handle]/follow/+server.ts:32,58`). The 404 for unlisted pages belongs in `[handle=handle]/+page.server.ts` only. If it goes in `pageByHandle`, follows break.
- N4. Until #459 merges, `/make/page` shows "See your page" (`src/routes/make/page/+page.svelte:54`) to a person whose page is unlisted, and that link is a 404. Saving there should keep `listed` false. This is short-lived, since #459 waits on this.
- N5. Unicode: fold accents before cutting (NFKD, then drop combining marks), so "José" becomes `jose`, not `jos`. Also trim invisible characters (zero-width and the like) before the "Type a name." check, so a blank-looking name is refused.
- N6. Profanity: nothing in the repo filters names today (the page editor doesn't either), and unlisted pages are seen only by followers, friends and people who see your games. Reports exist only on game pages. Not a regression; a matter for slice 4 or the moderation work.
- N7. Teens' addresses: R4 keeps the owner's "address made from the name". If the coordinator thinks a teen's address should not come from their name (`friend-<digits>` instead), that changes an owner choice and goes to the owner once, with these facts.
- N8. The migration (`ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT true`) is a metadata-only change in Postgres 16 and is safe on a live table. Add it to the `pages.prisma` doc comment so the schema says why it exists.

## What holds

- The owner's choices are followed as recorded: one question right after the code, the address made by code, existing accounts asked on their next visit with no backfill, unlisted until slice 4, the address frozen on rename.
- CRUD: the name is created (the question), read (Your turn, the share sheet), updated (`/me` → "Your name") and deleted (account deletion, `src/features/accounts/deletion.ts:195` deletes every `MakerPage` for the account). Criteria 1, 5, 6 and 7 cover them in journeys.
- Tests without ready-made pages: criterion 5 bans `givePage`.
- Overlap rule at 320×568, 375×667 and 667×375, keyboard and gamepad reach, and visible focus: criterion 9.
- Privacy page: item 6 and criterion 8.
- Migration safety: default true keeps every existing page listed; it runs forward in `pnpm test:pg` (criterion 10).
- No new dependency, tool or spend.
