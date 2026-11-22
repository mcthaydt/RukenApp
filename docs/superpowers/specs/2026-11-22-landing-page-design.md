# The landing page: what Ruken is, for players and makers

Date: 2026-11-22. Lane 2 (it adds styles to `src/lib/look.css` and edits the `this-repo` skill). Short path with a written plan: the owner's request, this brief and the pull request are the brief.

## The owner's words

- 2026-11-22 14:37 UTC: "Now that we've created the help page, I think we need a landing page; our structure should be inspired by Lyft with a YC-twist (we are not a YC company), just base it off of lyft almost directly, then scrape YC companies of the last year; identify patterns and integrate, then use the GTM data to build out the content, we should be touching on the pain points of both the creator and the player, we'll have to update it as we build out additional features".
- 2026-11-22 14:39 UTC, on a card: "New page, feed stays at /". The page lives at `/about` (already a reserved word, so no maker's page can take it). `/` still opens on the feed.
- 2026-11-22 14:40 UTC: "When can have a link to it on the paywall, when you need to sign in, and from the "you" page".

## What it is

One page at `/about` that says, in plain words, what Ruken is, for the two people it serves: players and makers. Its order follows Lyft's home page section by section (Lyft's own words, pictures and marks are not used). Where last year's YC company pages share a habit, the page takes it. Every word is a fact the product or the maker agreement already states; nothing is invented.

### Where the structure comes from

Lyft's home page, top to bottom (read 2026-11-22), and what each becomes here:

| Lyft | Ruken |
|---|---|
| Header: Get a ride, Driver, Rider, Log in, Sign up | A row of links: For players, For makers, Sign in (signed out only) |
| Promo bar (new-rider offer) | One line: the new step-by-step guide for makers, linked |
| Hero: short headline, one button, big picture | Short headline, one blue button "Watch the feed", the top game's real clip in a phone-shaped frame |
| Driver block: earnings, two buttons | Makers block: their pains and Ruken's answers, two buttons |
| Rider block: app picture, three benefits, two buttons | Players block: three benefits, two buttons |
| Membership cards: four cards, one button | Membership: four cards, the price from the rules, one button |
| Ride types: a list | How Ruken works: three numbered steps |
| Business block | Bring your fans (the bring-a-member rule) |
| Safety block | Safe to play |
| Accessibility block, text only | Makers' pay, in the open, text only |
| App download: two columns, one per audience | Two closing cards, one per audience, each with its button |
| Footer: link columns | Two link columns: players, makers |

Patterns from 14 YC company home pages of W25 to S26 (read 2026-11-22), taken where at least a third share them:

- A headline under eight words (10 of 14): "Watch a game. Then play it."
- A sub-headline that says what the product is in plain words (10 of 13).
- Buttons that start with a verb (9 of 14): Watch, Put, Join, Read.
- A real picture of the product (8 of 14): the top game's real clip, not a mock-up.
- The main button again at the foot (5 of 14): the closing cards.
- Social proof (7 of 14): left out for now. Ruken has no counts worth showing yet, a YC badge would be false, and quotes would be invented. A section for it comes when the numbers exist, from the system, never typed.

### The pains it answers

Makers: a clip gets seen and then there is nowhere to play the game; pay elsewhere is a black box; sending a game is a chore; fans they bring earn them nothing. Players: digging through copycat games; installs and sign-ups before seeing anything; a different price for every game. Each answer on the page is a line from the maker agreement (version 2), the paywall card or the design.

## Layout sketch

Phone (one column):

```
┌─────────────────────────┐
│ Ruken                   │  wordmark (the layout's)
│ For players · For makers│
│ · Sign in               │
│ New: Get your game on   │
│ Ruken, step by step →   │
│ Watch a game.           │
│ Then play it.           │  h1
│ Ruken is a feed of …    │
│ [   Watch the feed    ] │  the one blue button
│ ┌───────────┐           │
│ │ top clip  │           │  phone-shaped frame, muted loop
│ └───────────┘           │
├─────────────────────────┤
│ For makers (card)       │  h2, 4 points, 2 buttons
│ For players (card)      │  h2, 3 points, 2 buttons
│ One price. Every game.  │  4 small cards, Join Ruken
│ How Ruken works 1 2 3   │
│ Bring your fans         │
│ Safe to play            │
│ Makers' pay, in the open│
│ [Want to play?][Made a  │
│  game?]  closing cards  │
│ Players | Makers links  │  footer
└─────────────────────────┘
```

Computer: the hero is two halves (words left, clip right); the makers and players cards sit side by side; the four membership cards are a row of four; the closing cards are side by side. Everything else is one centred column.

## Easy to change

The words live in one file, `src/routes/about/sections.ts`: each section is an entry (its id, heading, lines, points and buttons). The screen draws whatever the file lists. A new feature changes the file, not the screen. The price comes from `PREMIUM_PRICES_CENTS`, never typed.

The `this-repo` skill gains one product rule: when a pull request ships or changes something a player or maker can do, it updates `/about` in the same pull request, or says in its body why the page needs no change.

## Acceptance criteria

1. `/about` answers 200 to anyone, signed in or not, and its title is "What is Ruken? · Ruken".
2. It shows, in this order, the sections in the table above, each with its heading; the hero's one blue button "Watch the feed" goes to `/`.
3. With at least one live game, the hero shows the first clip in the feed's order, muted and looping, with `use:loads`; with none, the hero has no frame and nothing broken.
4. The price on the page is the price on the paywall card (both from `PREMIUM_PRICES_CENTS`).
5. "Put your game on Ruken" goes to `/make` (sign-in first when signed out); "Help for makers" goes to `/help`; "See the price" and "Join Ruken" go to `/join`.
6. `/about` is linked from: the paywall card (`/join`), the sign-in screen, the You page (`/me`), and the Help page. Each link's words are "What is Ruken?".
7. Every link and button is at least 44 by 44; every button can be reached and pressed by keyboard alone, with the focus ring showing.
8. No `<style>` block in any screen; new styles go in `src/lib/look.css` with the look's tokens. No see-through surface (so no glass needed).
9. Nothing on the page overflows sideways at 320 wide, on the small phone, tablet and computer profiles.
10. The words pass the drunk-grandma test: short sentences, no jargon, one main (blue) button.
11. A browser journey reads the page as a person: arrives from each of the four links, reads the sections, follows the hero button to the feed and the makers' button to the help page.
12. `this-repo` carries the "new features update `/about`" rule.
13. The lint, typecheck, unit tests and the journeys the change reaches pass; CI is green.

CRUD: the page makes nothing a person can save, so it adds no create, update or delete journey.

## Plan (ticked as it goes)

- [x] 1. Research Lyft's structure and YC pages; write this brief.
- [ ] 2. Failing journey `tests/browser/about.test.ts` (criteria 1 to 6, 11).
- [ ] 3. `src/routes/about/sections.ts`, `+page.server.ts`, `+page.svelte`.
- [ ] 4. Styles in `look.css`.
- [ ] 5. Links from `/join`, `/sign-in`, `/me`, `/help`.
- [ ] 6. `this-repo` rule.
- [ ] 7. Lint, typecheck, unit tests, the journeys reached; run it like a person (`verify`).
- [ ] 8. Screenshots in one artifact (`visual-check` step 1); fix what it finds.
- [ ] 9. Delete the live-state file; open the pull request; fresh lane 2 review.

Progress: 1 of 9 (11%).
