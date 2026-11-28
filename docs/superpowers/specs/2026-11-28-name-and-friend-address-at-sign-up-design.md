# A name and an address for every account

- Written 2026-11-28 08:38 UTC, against `main` at `04689e5`.
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
2. **Existing accounts are asked once.** A signed-in person with no page is sent to the same question before any people screen: the feed (`/`, `/followed`, `/your-turn`), `/search`, a game's page, `/me` and its screens, `/make` and its screens, and `/settings`. The screens that must work without it stay open: sign-in, sign-out, forgot password, the legal pages (`/legal`, `/terms`, `/privacy`, `/cookies`), `/about`, `/help`, `/goodbye`, deleting the account, the play screen of a game already open, and every endpoint (`/api`, `/jobs`, `/webhooks`, `/healthz`). There is no data backfill: nobody's name is known until they say it, so nothing is written for anyone who does not come back.
3. **The address.** Made by code from the name, never typed: the name lowered, every run of other characters turned into one hyphen, trimmed to the address rules (`src/features/pages/handle.ts`: letters and digits in runs joined by single hyphens, 3 to 30 characters, not a reserved word). When that leaves fewer than 3 characters (a name of one letter, or in a script with no Latin letters), the address starts from `friend`. When it is taken or reserved, a hyphen and 4 random digits go on the end, tried again up to 5 times, then 6 digits. Two people saving the same name at the same moment both get one: the unique key settles it, and the loser tries again with digits.
4. **Unlisted.** A page made this way is marked unlisted (a new column, `listed`, false). An unlisted page's address is the missing page for everyone, its maker included; a page made in the editor before #459 stays listed and public as today. Everywhere else an unlisted page works as a page does today: it can be followed, it counts for friends, it gets sends, its name and its address show as a friend's face and on Your turn, and a maker's clip shows their name and the follow plus. On a clip and on a game's page ("Made by"), an unlisted maker's name is words, not a link, since its page is not there.
5. **Your name on Your account.** `/me` gets a → link, "Your name", that opens the same question with the name filled in, Save. Changing the name changes the name only, never the address (the address is how friends' sends and follows already find them; slice 4 decides changing it). This is the update of the name's create, read, update and delete; delete is deleting the account, which already removes the page (`src/features/accounts/deletion.ts`).
6. **The privacy page** says, in the part about what we keep: the name you give when you join, shown to people who follow you, your friends and anyone who sees your games; the address made from it; and that your page is not public yet. Its "Last updated" date moves.

## Words

- Heading: "What should friends call you?"
- Under it: "Friends see this when you send them a game."
- Field label: "Your name". Button: "Save".
- A problem: "Type a name." (empty), "A name can be up to 40 characters." (too long; the page's own limit, `NAME_MAX`).
- On `/me`: "Your name" (→ link). After saving there: "Saved."

## Acceptance criteria

1. A new person who signs up is asked "What should friends call you?" right after the code; saving makes one page for their account with that name, an address that meets the address rules, and `listed` false; then they land where `next` pointed (the feed by default).
2. A signed-in account with no page that opens any people screen in item 2 lands on the question first, and after saving lands on the screen it asked for; the open screens in item 2 never send it there.
3. Two accounts that save the same name both get a page, with different addresses; a name whose address would be a reserved word, too short or not Latin gets a valid address; a property test is not added (no new dependency), but a unit test runs the address maker over a fixed list of hard names (empty after cleaning, all digits, 30+ characters, emoji, Cyrillic, every reserved word) and checks every answer against `HANDLE`, the length and `RESERVED_HANDLES`.
4. An unlisted page's address answers the missing page (404), for a visitor and for its own maker; a listed page is unchanged.
5. Following, friends, sends and share faces work between two accounts that only signed up (no page given by a test helper): A follows B from B's clip or game page, B follows A back, A sees B's face in the share sheet and sends a game, and B finds it on Your turn under A's name. This journey makes no page with `givePage`.
6. `/me` → "Your name" changes the name shown on Your turn and on the share sheet's face, and leaves the address alone.
7. Deleting the account removes the page (today's journey, run with a page made by sign-up).
8. The privacy page lists the name and the address and says the page is not public; `tests/routes/privacy/` stays green.
9. Every screen this adds or changes passes the overlap journey at 320×568, 375×667 and 667×375, the keyboard and gamepad reach the field and the button, and focus is always visible.
10. The migration adds `listed` with default true, so every existing page stays listed; it runs forward on a copy of `main`'s schema in `pnpm test:pg`.

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
| B. The address maker | A | `src/features/pages/address.ts` (new), `src/features/pages/service.ts` (`makeUnlistedPage(userId, name)`, `renamePage(userId, name)`), `src/features/pages/pages.ts` | a page for an account from a name, with retries on a taken address | `tests/features/pages/address.test.ts` (criterion 3), `tests/features/pages/service.pg.test.ts` (two at once, criterion 3) |
| C. The question | B | `src/routes/me/name/` (new: `+page.server.ts`, `+page.svelte`), `src/routes/+layout.server.ts` (send an account with no page to it), the sign-up finish (`src/features/accounts/forms.ts` `finishSignUp`, which today sends to `safeNextPath(form.next)`: it goes through the question, carrying `next`), `src/routes/me/+page.svelte` (the → link) | the screen, the redirect, the link | journeys: criterion 1, 2, 6, 9 in `tests/browser/your-name.test.ts` (new); `tests/browser/support/account.ts` `signUp` answers the question so every other journey still signs up |
| D. Unlisted | A | `src/routes/[handle=handle]/+page.server.ts`, the maker credit in `src/features/feed/Feed.svelte`, `src/routes/g/[game]/+page.svelte` ("Made by": words, not a link, when unlisted) | the missing page, no dead links | criterion 4 in `tests/browser/your-name.test.ts`; `controls-overlap.test.ts` adds a clip and a game page whose maker's page is unlisted |
| E. Friends with no ready-made page | C, D | `tests/browser/friends-from-sign-up.test.ts` (new) | criterion 5 and 7 | the journey itself, with no `givePage` |
| F. Privacy | C | `src/routes/privacy/+page.svelte` | criterion 8 | `tests/routes/privacy/` |

The browser journeys' sign-up helper (`signUp` in `tests/browser/support/account.ts`) answers the question with a fresh name, so the journeys that sign up keep working; `givePage` stays for journeys about listed pages made in the editor.

## Open decisions

None. The name step, the unlisted pages and "asked once on the next visit" for existing accounts are the owner's and the coordinator's calls above. The "Your name" link on `/me` (item 5) is the builder's reading of "editable" and of the rule that a person can change everything they make; it changes only the name.
