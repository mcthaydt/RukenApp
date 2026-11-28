# A name and an address for every account

- Written 2026-11-28 08:38 UTC, against `main` at `04689e5`. Revised after plan audit 1 (FAIL, 5 red, at `ba9b12d`; `docs/superpowers/audits/2026-11-28-name-and-friend-address-at-sign-up-1-plan-audit.md` on `claude/project-thread-jjoshl`).
- Lane: 3 (one migration). Staged path: this spec, its plan audit, the build, an implementation audit, then the owner's approval of the finished result.
- Blocks: #459 (hide making your own page until slice 4 Pages) stays a draft until this merges.

## Why

Today a person can be followed, be someone's friend, get a game sent to them and show as a friend's face only through their page (`MakerPage`): follows and sends find people by its address, and friends' faces and Your turn show its name. The page editor (`/make/page`) is the only place a page is made, and #459 closes it until slice 4 on the owner's word (2026-11-28 06:46 UTC). Its review (audit 1 of #459, red 1) found that after it, nobody new could be followed or sent a game.

The owner's choices (decision cards relayed by the coordinator):

- 08:33 UTC, "Give one automatically": every account gets an address with nothing to fill in, editable in slice 4.
- 08:35 UTC, "Ask a name at sign-up": one more short step, "What should friends call you?", and the address is made from it. Existing accounts without a page need a way in too.
- The coordinator's call on the same card: these pages stay unlisted, with no public page at `ruken.io/<address>` until slice 4.

## What it does

1. **One question after the code.** Sign-up is unchanged up to the code screen. When the code is right and the account is made, the next screen asks "What should friends call you?": one text field and one blue button, Save. Saving makes the account's page: the name is what they typed, and the address is made from it (below). Then they go on to where they were going (`next`), as today.
2. **Existing accounts are asked once.** A signed-in person with no page is sent to the same question before any people screen: the feed (`/`, `/followed`, `/your-turn`), `/search`, a game's page, `/me` (the Your account screen itself) and `/me/saved`, `/me/reposts`, `/make` and its screens, and `/settings`. The screens that must work without it stay open: the question itself (`/me/name`), sign-in, `/sign-out`, forgot password, the account's own safety screens (`/me/delete`, `/me/password`, `/me/computers`), the legal pages (`/legal`, `/terms`, `/privacy`, `/cookies`), `/about`, `/help`, `/goodbye`, the play screen of a game already open, and every endpoint (`/api`, `/jobs`, `/webhooks`, `/healthz`). There is no data backfill: nobody's name is known until they say it, so nothing is written for anyone who does not come back.
   - **A way out.** The question screen has, below Save, a quiet → link "Sign out" (a secondary action, per the house rule) and a → link "Delete my account" to `/me/delete`. Both are reached by keyboard and gamepad. Someone who will not give a name can leave or delete, and is never stuck.
3. **The address.** Made by code from the name, never typed, and always within the address rules (`src/features/pages/handle.ts`: letters and digits in runs joined by single hyphens, 3 to `HANDLE_MAX` (30) characters, not a reserved word; the database checks the same, `prisma/migrations/20261114120000_pages/migration.sql`):
   - The base: the name lowered (accents dropped), every run of other characters turned into one hyphen, hyphens trimmed from both ends.
   - First try: the base cut to 30 characters, then any hyphen left at the end dropped.
   - When that is taken, reserved or shorter than 3: the base is cut to 23 characters (30, less 7 for a hyphen and 6 digits), any end hyphen dropped, and a hyphen and 4 random digits go on; tried up to 5 times, then with 6 digits up to 5 more times. A base shorter than 3 after cutting (a one-letter name, or a script with no Latin letters) is `friend`.
   - Two people saving the same name at the same moment both get one: the unique key on the address settles it, and the loser tries the next address.
   - **Safe to press twice.** Saving for an account that already has a page (a double tap, a second tab, Back then Save) makes nothing new: it keeps the page it has and goes on. The unique key on the account settles two saves at the same moment, and the one that loses finds the page the other made.
4. **Unlisted.** A page made this way is marked unlisted (a new column, `listed`, false). An unlisted page's address is the missing page for everyone, its maker included; a page made in the editor before #459 stays listed and public as today. Everywhere else an unlisted page works as a page does today: it can be followed, it counts for friends, it gets sends, its name and its address show as a friend's face and on Your turn, and a maker's clip shows their name and the follow plus. On a clip and on a game's page ("Made by"), an unlisted maker's name is words, not a link, since its page is not there.
5. **Your name on Your account.** `/me` gets a → link, "Your name", that opens the same question with the name filled in, Save. Changing the name changes the name only, never the address (the address is how friends' sends and follows already find them; slice 4 decides changing it). This is the update of the name's create, read, update and delete; delete is deleting the account, which already removes the page (`src/features/accounts/deletion.ts`).
6. **The privacy page** says, in the part about what we keep: the name you give when you join, shown to people who follow you, your friends and anyone who sees your games; the address made from it; that your page is not public yet; and, for under-18s, that we ask them to use a nickname. Its "Last updated" date moves.
7. **Search.** An unlisted maker never shows in the makers part of search, and their address is not a search word; their live games still show, with the maker's name as words. A listed maker is unchanged.

## Words

- Heading: "What should friends call you?"
- Under it, for an adult: "Friends see this when you send them a game."
- Under it, for anyone not known to be 18 or over (`isAdult` in `src/features/accounts/age.ts` false or unknown; Ruken is for 13 and up): "Use a nickname, not your full name. Friends see it."
- Below Save: "Sign out" (→ link), "Delete my account" (→ link).
- Field label: "Your name". Button: "Save".
- A problem: "Type a name." (empty), "A name can be up to 40 characters." (too long; the page's own limit, `NAME_MAX`).
- On `/me`: "Your name" (→ link). After saving there: "Saved."

## Acceptance criteria

1. A new person who signs up is asked "What should friends call you?" right after the code; saving makes one page for their account with that name, an address that meets the address rules, and `listed` false; then they land where `next` pointed (the feed by default).
2. A signed-in account with no page that opens any people screen in item 2 lands on the question first, and after saving lands on the screen it asked for; the open screens in item 2 (the question itself included) never send it there. From the question, "Sign out" (keyboard and gamepad) signs the person out, and "Delete my account" opens the delete screen.
3. Two accounts that save the same name both get a page, with different addresses; a name whose address would be a reserved word, too short or not Latin gets a valid address; a property test is not added (no new dependency), but a unit test runs the address maker over a fixed list of hard names (empty after cleaning, all digits, 30+ characters, a 30+ character name that is taken, a name that cuts to end in a hyphen, emoji, Cyrillic, every reserved word) and checks every answer against `HANDLE`, 3 to 30 characters and `RESERVED_HANDLES`. Saving twice from one account, one after the other and at the same moment, leaves one page and shows no error (`service.pg.test.ts`).
4. An unlisted page's address answers the missing page (404), for a visitor and for its own maker; a listed page is unchanged. Searching an unlisted maker's name or address finds no maker row and no link to their address; their live game still shows.
5. Following, friends, sends and share faces work between two accounts that only signed up (no page given by a test helper): A follows B from B's clip or game page, B follows A back, A sees B's face in the share sheet and sends a game, and B finds it on Your turn under A's name. This journey makes no page with `givePage`.
6. `/me` → "Your name" changes the name shown on Your turn and on the share sheet's face, and leaves the address alone.
7. Deleting the account removes the page (today's journey, run with a page made by sign-up).
8. The privacy page lists the name and the address and says the page is not public; `tests/routes/privacy/` stays green.
9. An account not known to be 18 or over (a 15 year old signing up) sees the nickname line; an adult does not.
10. Every screen this adds or changes passes the overlap journey at 320×568, 375×667 and 667×375, the keyboard and gamepad reach the field and the button, and focus is always visible.
11. The migration adds `listed` with default true, so every existing page stays listed; it runs forward on a copy of `main`'s schema in `pnpm test:pg`.

## Boundaries

- No new dependency, tool, environment or spend.
- No backfill script and no write to anyone's data except by that person saving the question.
- Not in this change: changing the address, making a page listed, the page editor (slice 4); a name for staff screens.
- Expected build: 4 hours of one session, plus the audits.

## Plan

One pull request, units in this order on its branch.

| Unit | Waits on | Files it owns | Output | Check |
|---|---|---|---|---|
| A. `listed` column | none | `prisma/schema/pages.prisma`, one migration in `prisma/migrations/` | the column, default true | `tests/features/pages/schema.pg.test.ts` gains: existing rows are listed; a new row may be unlisted |
| B. The address maker | A | `src/features/pages/address.ts` (new), `src/features/pages/service.ts` (`makeUnlistedPage(userId, name)`, which returns the page an account already has; `renamePage(userId, name)`; `makersOf` returns `listed`), `src/features/pages/pages.ts` | a page for an account from a name, with retries on a taken address, safe to call twice | `tests/features/pages/address.test.ts` (criterion 3), `tests/features/pages/service.pg.test.ts` (two accounts at once, one account twice, criterion 3) |
| C. The question | B | `src/routes/me/name/` (new: `+page.server.ts`, `+page.svelte`, with the nickname line by age and the two ways out), `src/routes/+layout.server.ts` (send an account with no page to it, with the open list in item 2), the sign-up finish (`src/features/accounts/forms.ts` `finishSignUp`, which today sends to `safeNextPath(form.next)`: it goes through the question, carrying `next`), `src/routes/me/+page.svelte` (the → link), and the journeys listed below | the screen, the redirect, the link | journeys: criteria 1, 2, 6, 9 and 10 in `tests/browser/your-name.test.ts` (new) |
| D. Unlisted | A, B | `src/routes/[handle=handle]/+page.server.ts`, the maker credit in `src/features/feed/Feed.svelte`, `src/routes/g/[game]/+page.svelte` ("Made by": words, not a link, when unlisted), `src/features/feed/search.ts` and `src/features/feed/Search.svelte` (no maker row for an unlisted page, its address not a search word) | the missing page, no dead links, nothing unlisted in search | criterion 4 in `tests/browser/your-name.test.ts` (address and search); `tests/features/feed/search.test.ts` (unlisted maker, by name and by address); `controls-overlap.test.ts` adds a clip and a game page whose maker's page is unlisted |
| E. Friends with no ready-made page | C, D | `tests/browser/friends-from-sign-up.test.ts` (new) | criterion 5 and 7 | the journey itself, with no `givePage` |
| F. Privacy | C | `src/routes/privacy/+page.svelte` (the name, the address, not public yet, the nickname ask for under-18s) | criterion 8 | `tests/routes/privacy/` |

### The journeys the new step changes

Every journey that finishes sign-up now meets the question right after the code. They change like this (the build names each one in its pull request body, as `build` asks):

- Through the helpers, no file changes: `signUp` and `finishSignUpForm` in `tests/browser/support/account.ts` answer the question with a fresh name, so every journey that signs up through them lands on `next` as before. `finishSignUpForm` is used directly by `follow-a-maker`, `join`, `loading`, `pay`, `play`, `sign-up` and `wishlist`.
- Journeys that press "Join Ruken" on the code screen by hand or look at the screen right after it, each read and changed only where it asserts that next screen: `sign-up.test.ts` (asserts the question, then `next`), `follow-a-maker.test.ts` (the signed-out plus: the question comes before the maker's clip again), `adults-only.test.ts`, `fits-the-screen.test.ts`, `gamepad.test.ts` (and the question screen joins its screen list), `help-guide.test.ts`, `join.test.ts`, `join-and-help-look.test.ts`, `legal-pages.test.ts`, `loading.test.ts`, `look-layout.test.ts`, `look.test.ts`, `membership.test.ts`, `play.test.ts`, `rejoin.test.ts`, and `support/look.ts`. Where "Join Ruken" is only the paywall's or a price card's button, not the code screen's, the file does not change.
- New screens in the standing journeys: `/me/name` joins `controls-overlap.test.ts`'s signed-in screens (for an account with a page, opened from Your name) and `fits-the-screen`.
- No golden in `tests/golden/` shows a screen right after sign-up (checked: none are named for it); if the build finds one, it names it with before and after.

`givePage` stays for journeys about listed pages made in the editor.

## Open decisions

None. Noted, not decided here: whether a teen's address should be `friend-<digits>` rather than made from the nickname would change the owner's "address made from the name", so it is left as it is. The name step, the unlisted pages and "asked once on the next visit" for existing accounts are the owner's and the coordinator's calls above. The "Your name" link on `/me` (item 5) is the builder's reading of "editable" and of the rule that a person can change everything they make; it changes only the name.
