# Makers' sales: extras and splits

Date: 2026-11-14. Status: written for the Owner's approval; not approved yet. Revised the same day with the Owner's answers on the app stores (5.2, 5.5, 5.7, 5.8). The launch date now follows the apps' own spec (9). Builds on the design (`2026-11-13-ruken-reels-linktree-design.md`) and changes it only where this file says so.

Lines marked **Owner** are the Owner's words or decisions. Lines marked **Call** are the spec writer's choices, shown to the Owner, who can overrule any of them. Nothing marked Call was agreed unless it says so.

Principle served: the Ruken vision in the project instructions, "Makers earn from the members' pool by what members actually played, and from their own sales (one-off DLC and battle passes, members only, Ruken keeps 30%), split among the people they choose." It keeps "Money is exact" and "Games are untrusted".

## 1. Why

Owner, 2026-11-14: "developers can have paid DLC/subscriptions ala Xbox Game Pass-like; this should actually be how they primarily make their money".

Owner, 2026-11-14: "I want revenue splitting for developers. They should be able to select members and decide how money in will be split".

## 2. What the Owner decided

Quoted as given, 2026-11-14:

- "24. B": a maker's own sales come before launch, so launch moves past 30 November.
- "25. A": the membership pool stays as it is; a maker's own sales come on top.
- "26. 30%": Ruken's cut of a maker's own sales.
- "27. A": only members can buy.
- "31. B, when I say subscriptions, I mean like battle passes": two kinds of thing for sale, both at launch. A one-off **DLC**, and a **season pass** (a battle pass): a season, bought once, never renewing.
- "32. A": a game's split covers everything the game earns: its share of the membership pool, its DLC and its season passes.
- "4. A, but minimum should be whatever allows us to make a profit after credit card fees, we do not lose money": the maker sets the price, above a floor.
- Card fees, board "2. A": tax and every Stripe fee on the payment come off the top, then what is left is 70% the game's and 30% Ruken's, the same order as the membership. The lowest price is $0.99.
- "1. B, what's the best UX/UI for that?": a player can buy from Ruken's own Extras button while playing, and a game can also open Ruken's buy card at the right moment.
- "By the back arrow? we also need a store inside of ruken itself, like on the game page": every game gets a page of its own in Ruken with its extras on it (5.1).
- "2. A": a season pass has a start and an end date the maker picks. It is sold only during its season. Afterwards buyers keep it, and the game decides what that means.
- "3. A": only the game's maker can change its split. A change counts from that moment on, never backwards. Everyone in the split gets an email saying what changed.
- "a) Yes, check it like a game, including playing to see it unlocks": staff check every new or changed extra before it is sold.
- "5. A": if a maker takes a game off Ruken, everyone who bought one of its extras in the 14 days before gets their money back, paid out of the game's earnings. Older purchases stay sold.

The Owner's answers on the app stores, 2026-11-14, quoted as given (the questions and the stores' rules are in the private repository):

- "Ruken app is for PC, Linux, Mac, Android, and iOS; people using the browser version will be as uncommon as people using TikTok or Instagram on browser; like they do it, but they DEF. prefer to use the apps".
- "1. A, but also upcharge on place that take a cut by 10%": a store's fee comes off the top before the 70/30, like card fees; and where a store takes a cut, the price there is 10% higher.
- "2. Download on our site, but also Steam, Microsoft Store, Apple Store for Mac, and whatever Linux has".
- "3. B": launch waits until the apps are ready.
- "4. A": in the iPhone and Android apps an extra is bought through Apple's or Google's own purchase, and on the website through Ruken's; whatever was bought, wherever, is owned on every device.

This reopens the design's "teams and contributor splits" (section 2, "Not in the first version"), 5.3's "No teams" and section 6's "Not carried: ... the store, ... contributor splits". Those lines are replaced by this file. "One maker is one account with one page" still holds: a split shares money, not the page or the game's settings.

## 3. Goals

- A member buys an extra in one tap, from inside the game, from the Extras button or from the game's page, and is back in the game with it unlocked within a few seconds.
- Nobody who has not bought an extra can load its protected files.
- A maker adds an extra on one short form, and it is on sale once staff accept it.
- A maker names who shares a game's money and in what shares; each person is paid their share of everything the game earns, on the monthly statement.
- Ruken never loses money on a sale, a refund or a dispute.

### Not in this

- Renewing subscriptions of any kind. A season pass is bought once (Owner, "31. B").
- Buying for someone else, gifts, codes for extras, bundles, discounts and sales.
- Selling to people who are not members (Owner, "27. A").
- Prices in other currencies. Prices are in US dollars; Stripe adds tax where it applies.
- A split for anyone Stripe cannot pay: under 18, or outside the United States (5.6).
- A game kit or SDK. A game uses one file and one message (5.4).
- Sharing a game's settings, page or maker area with the people in its split.

### What would make it a failure even if it works

- A player is charged and does not get the extra, or gets it twice and is charged twice.
- An extra's protected files load for someone who did not buy it.
- A game learns who the player is, or sees their card.
- A share is worked out by hand, or a split changes money already earned.
- A sale, refund or dispute costs Ruken more than it earned on that sale.
- A tired person cannot tell what they are buying, what it costs, or how to say no.

## 4. Approaches

How a game learns what a player owns. The Owner left how things are built to the spec writer (project instructions: "This codebase is yours"), so the pick is a Call, shown to the Owner on 2026-11-14.

| | Approach | Trade-off |
|---|---|---|
| A | Ruken tells the game what the player owns; the game unlocks it. | Simple. Anyone who edits the game in their browser can unlock without paying. |
| B (picked) | A, and an extra's own files, kept in a folder named for it, load only for a player who owns it. The game gate already checks every file it serves; it adds this one check. A game with its own server also gets a short signed note it can check. | One more check in the gate, and the gate must learn what a pass's player owns. Taking an extra without paying gets much harder. |
| C | The game's own server asks Ruken. | Every maker would need a server; most web games have none. |

## 5. How it works

### 5.1 A game's page

Owner: "we also need a store inside of ruken itself, like on the game page".

Today `/g/<game>` opens the feed at that game's clip, and a game has no page of its own. Call: every live game gets a page. Tapping the game's name in the feed, or its card on the maker's page, opens it. The address is the plan's to choose; `/g/<game>` keeps opening the feed, because that is what Share sends.

```
┌─────────────────────────┐
│   the game's clip       │
│   Floor Fifty           │
│   Climb. Fall. Climb.   │
│   by @snekprty          │
│ [      ▶ Play         ] │
│                         │
│ Extras                  │
│ ┌─────────────────────┐ │
│ │ Season 1 pass       │ │
│ │ Ends 31 January     │ │
│ │ [  Buy for $4.99  ] │ │
│ ├─────────────────────┤ │
│ │ Level pack 2        │ │
│ │ Yours ✓             │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

- The clip, name, one line, maker and Play, then the game's extras on sale: each with its picture, name, one line and price, or "Yours" when the person owns it. A season pass shows when its season ends.
- A game with no extras shows no Extras heading.
- A member's Buy opens the buy card (5.2). Anyone else sees the same list, and the button reads "Join to buy", which opens the paywall card (design 5.2). After joining they come back to this page, not straight into the purchase.
- Grandma: one blue Play at the top; each extra has one button that says what it costs.

### 5.2 The buy card

Owner: "1. B". It looks like the way phones already sell things inside apps.

```
┌─────────────────────────┐
│   (picture of the item) │
│   Level pack 2          │
│   Ten new floors.       │
│                         │
│ [  Buy for $2.99      ] │  blue
│   Card ending 4242      │
│ [  Not now            ] │  green
│ Tax is added where it   │
│ applies. No refunds.    │
└─────────────────────────┘
```

- It is Ruken's own paper card (design 5.8), sliding up from the bottom over the dimmed game or page. It is drawn by Ruken's page, never inside the game's frame, so the game cannot see it, press it or draw over it.
- On the website and in the computer apps downloaded from Ruken's site, one tap pays with the card the member already pays their membership with. The amount with tax is shown before the tap (Stripe Tax works it out). Call: when that card cannot be charged without a check from the bank, or the member has no saved card, the button goes to Stripe's own payment page and comes back to where they were. No new dependency is added for this.
- Owner, "4. A": in the iPhone and Android apps, and in any store's app that requires its own purchase, Buy opens that store's own purchase sheet instead (Apple's, Google's). The card around it is still Ruken's. The price shown is that store's price (5.5).
- Wherever it was bought, it is one purchase in Ruken's ledger, and it is owned on every device the member signs in on.
- Owner (legal answers, 2026-11-14): EU and UK buyers see one tick box before Buy, asking for the extra now and accepting that the 14 days to change their mind end once they have it. Their law requires it. A confirming email follows.
- Owner (legal answers, 2026-11-14): a member aged 13 to 17 ticks "My parent or guardian says yes" before Buy, as for the membership.
- Call: "No refunds." is shown before paying; that is what makes it lawful in the US. Exceptions (a mistaken charge, the law, 5.8) are handled by staff.
- After paying, the card reads "It's yours" for a moment and slides away. The game is told at once (5.4).
- If paying fails, the card says so in one line ("Your bank said no. Try another card.") with a way to try again and "Not now".
- Pressing Buy twice, or two tabs at once, never charges twice: one purchase per member per extra, enforced by the database, and Stripe's idempotency key on the charge.
- Grandma: what it is, what it costs, one blue button to buy, one green button to say no.

### 5.3 The Extras button

Call: a small "Extras" button sits next to the ← back arrow in the game frame (design 5.2: "one Ruken control"; this is the second), shown only when the game has extras on sale. It opens a card with the same list as the game's page; Buy on an item opens the buy card. It pauses nothing itself; the game is told the card opened (5.4).

### 5.4 What a game sees

The design's rule stays: a game never sees a player's sign-in, card or account. What changes: a game can now learn which of its own extras the player has, and ask Ruken to show the buy card. Approach B (section 4).

- **One file.** Under its play address, a game can read a small file listing the ids of its extras this player owns. It names no person. Call: the file also holds a short note signed by Ruken (the extras, the play pass's id and an end time), with Ruken's public key published, so a game with its own server can check the note without asking Ruken. Ed25519 through Web Crypto; no new dependency.
- **One message.** A game asks for the buy card with one message to the page it is in, naming the extra's id. Ruken answers with messages the game can listen for: the card opened, the card closed, and the new list of what is owned. Ruken checks that the message came from the game's own frame, and ignores anything else.
- **Protected files.** A maker may keep an extra's files in a folder named for the extra in their repository. Those files load only under a play pass whose player owns that extra; anyone else gets "not found". Files outside those folders load as today.
- Call: buying an extra must not change the game's play address, so the browser keeps the files it already has (a game can be 90 MB, `src/features/play/pass.ts`). How the gate learns what a pass's player owns without a new address is the plan's to choose.
- Call: the file and the message are written up on one page for makers, linked from the extra form. It is documentation, not a kit to install.
- Owner's to pass along: FloorFifty needs these two small changes to sell anything. That work is in FloorFifty's own repository, on the other account.

### 5.5 Making an extra

In the maker's area, on each game. The look comes from the maker screens redesign (pull request #96), which resumes after this spec and now includes these screens; this section says what they do.

- **Add an extra**: kind (DLC or season pass), name, one line, a picture, a price, and for a season pass its first and last day. The id the game uses is made from the name and shown to the maker to copy into their game.
- **The price** is picked from a fixed list: $0.99, $1.99, $2.99, $3.99, $4.99, $7.99, $9.99, $14.99, $19.99, $29.99, $49.99. Call: a list, because nobody types an amount (AGENTS.md); $0.99 is the floor the Owner chose (board "2. A").
- **Store prices.** Owner: "upcharge on place that take a cut by 10%". Where a store takes a cut (the App Store, Google Play, the Microsoft Store, Steam), the price is the nearest price that store offers at or above the website price plus 10%. Code works it out from each store's price list, so the maker picks one price and never types another. Call: for example, $0.99 on the website is $1.09 in the iPhone app.
- **Season dates** are picked on a calendar, in America/Chicago days. A season starts no earlier than staff accepting it and lasts at least a day. Call: at most 365 days.
- **Send for review**. Staff check it like a game (Owner, "a) Yes, check it like a game"): see the name, picture and price, and play the game to see it unlocks. States in plain words, as for games: "Waiting for review", "On sale", "Sent back: <reason>", "Season over", "Taken off sale".
- **A change** to any of it goes back to review; the accepted version stays on sale until the change is accepted. Call: one rule for every change, so nothing goes on sale unchecked.
- **Take off sale** at once, with no staff step, as for games. Buyers keep it. Putting it back goes through review.
- Call: at most 20 extras on sale per game.
- Grandma: one form, one button; each field says what goes in it; the price is a list to pick from, never a box to type in.

### 5.6 Splits

Owner: "They should be able to select members and decide how money in will be split"; "32. A"; "3. A".

- A game's split is a list of people and their shares, in whole percents adding up to 100. A new game's split is its maker at 100%.
- The maker adds someone by their Ruken handle or email. Call: anyone with a Ruken account, member or not.
- Call: only adults in the United States can be in a split, because Stripe Connect cannot pay anyone else (slice 5: "US only for now", Owner, 2026-11-14). Ruken knows each person's age from sign-up; someone under 18 cannot be added.
- Call: a person must say yes before they are in a split. They get an email with the game, their share and one button. A new or changed split starts once everyone in it has said yes; until then the old one stays. A person who says no is told to the maker, and the maker changes the list.
- Owner, "3. A": only the game's maker changes the split. A change counts from the moment it starts, never backwards. Everyone in the old and new split gets one email saying what changed.
- Call: at most 10 people in a split.
- Call: each person connects their own bank through Stripe Connect on a screen of their own, as a maker does (design 5.4). Until they do, their share waits for them.
- Call: a person in a split who has no game of their own sees a small money page in the maker's area: what they are owed, from which games, and their statements.
- Grandma: a list of names with a share beside each, and one line under it: "Shares must add up to 100%."

### 5.7 Money

Everything in design section 6 stays. What is added:

- **A sale** (Owner, board "2. A", and "1. A" on the stores): from the price paid, tax and every fee on that payment come off the top: Stripe's on the website, the store's on a store's purchase. The fees are read from Stripe's, Apple's and Google's own reports and notifications, never typed. Of what is left, 30% is Ruken's and 70% is the game's. Worked out in whole cents by a pure, tested function; rounding goes the same way every time, and the parts always add up to the whole.
- **The game's part is split** by the split in force at the moment of the sale.
- **The game's pool share** for a month (design 6) is split by the splits in force over that month, each in proportion to the game's counted play minutes while it was in force. Call: that is what "never backwards" means for the pool, which is worked out monthly. A pure, tested function.
- Call: the bring-a-member bonus (design 6) stays with the maker who brought the member, because it is earned by that maker's page and links, not by one game.
- **Statements** become one per person: each game's lines (pool share, sales, refunds, disputes, costs), then their total. Final on the 10th, paid on the 15th, $25 minimum, smaller balances carried, as now. Each person's own payout costs come out of their own payout (design 6).
- Call: a dispute's fee ($15 from Stripe), and a sale's fees that Stripe keeps when a sale is refunded, come out of the game's earnings and are split like the sale. Ruken's 30% of a refunded sale is handed back with it. So a refund or dispute never costs Ruken more than it earned on that sale.
- Call: a balance below zero is carried to the next statement, as the carried chargeback rules do.
- Call: a store's purchase reaches the ledger from that store's own server notifications (Apple's App Store Server Notifications, Google's Real-time Developer Notifications), the same way Stripe's webhooks do for the website.
- Ledger facts are only added. A sale, a refund, a dispute and a split are each their own facts with their times; nothing is changed.

### 5.8 Refunds

- US: no refunds on extras, said before paying (5.2). Owner (legal answers, 2026-11-14): EU and UK buyers waive their 14 days with the tick and get the confirming email.
- Always, as for the membership: a mistaken charge, a minor undoing a purchase, and what the law requires. Staff refund from the admin portal; it is recorded like any staff action and needs a second person, as money actions do (design 5.5).
- Owner, "5. A": when a game leaves Ruken (its maker takes it down, or staff do), every purchase of its extras in the 14 days before is refunded in full, at once, by the system. The refund is paid out of the game's earnings as above. Call: this happens before the 10th's statement, which is at least 10 days after any sale it covers, so the money has not been paid out yet. Older purchases stay sold.
- A store's purchase is refunded by that store, under its own rules. When the store says it refunded one, the extra is no longer owned, and the refund comes off the game's earnings like any other.
- Open for the Owner: Apple does not let an app refund a purchase itself. For a purchase made through Apple in the 14 days before a game leaves Ruken ("5. A"), the spec does not yet say how the money gets back (section 10).
- Call: when an account is deleted, its purchases go with it, with no refund; the delete screen says so.

### 5.9 The admin portal

- **Extras** join the acceptance queue, oldest first, beside games, with Accept and Send back with a reason (design 5.5).
- Reports on an extra go through the game's Report.
- **Money**: sales, refunds and disputes appear with the rest; the staff refund above.

### 5.10 Emails

Added to design 7.1's short list: the EU/UK confirming email (5.2); an extra accepted, sent back or taken off sale; a split's invitation and a split's change (5.6). Stripe sends the receipts.

## 6. What "launched" adds

Each line is checked by a browser test in CI and once by a person on the real site.

- A member buys an extra from the game's page, from the Extras button and from inside the game, and the game sees it owned.
- Someone who has not bought an extra cannot load its protected files.
- A maker adds an extra and a season pass; staff accept them; they are on sale.
- A maker adds a second person to a split; they say yes and connect their bank; the next sale is split between them.
- A maker takes a game down, and a purchase from the last 14 days is refunded.

The first statement that pays a split is checked against the ledger by a person, as slice 5's first statement is.

## 7. What it touches

- **Slice 2 (games and play)**: the game frame (the Extras button, the messages) and the gate (protected files, the owned file).
- **Slice 3 (the feed and the maker's page)**: tapping a game's name opens its page.
- **Slice 4 (submitting and the admin portal)**: the extra form, the split screens and the extras queue. Their look comes from the maker screens redesign (#96), which resumes with these screens in it, then #63.
- **Slice 5 (money)**: sales, splits and statements per person. Its remaining branches are re-planned against this file.
- **The wishlist**: launch moves, so its launch moment moves with it (one constant).
- **Legal**: the terms, refunds page and the maker agreement (version 2, which a lawyer reads before the first payout) cover extras and splits. Their wording is drafted with pull request #104.

## 8. Left to the plan

- The exact tables, routes, file names and the game page's address.
- How the gate learns what a pass's player owns without changing its address.
- The names of the owned file and of the messages, and the makers' page that documents them.
- The exact wording of every screen and email, each passing the drunk grandma test.
- How a season's dates are shown in the buyer's own time while being stored as America/Chicago days.

## 9. Launch

Owner, "24. B": launch moves past 30 November. Owner, "3. B": launch waits until the apps are ready. So the launch date is set by the apps' own spec, which is being written next, not by this one.

What this spec's own work needs, for that date: this spec approved; the maker screens redesign (#96), with these screens in it, with the Owner's "fine"; then about a slice's worth of work through every stage of the workflow. Earlier, before the apps, this was proposed as Monday 14 December; that date no longer stands on its own. The text and chat helper (board "3. C") is not counted here either.

## 10. Open risks

- **The size.** This is as big as a slice. It is planned and built through every stage of the workflow, alongside slices 2 to 5, the wishlist and the beta builds, which are not finished.
- **The maker agreement.** Selling and splitting are new in it. Version 2 needs a lawyer before the first payout.
- **Who is the seller.** Ruken takes the payment and keeps 30%, so Ruken is most likely the seller for tax. Its tax registrations and refund rules cover these sales. An accountant confirms.
- **Apple refunds after a take-down.** Apple does not let an app hand money back itself, so "5. A" has no clear path for a purchase made through Apple. Asked of the Owner.
- **The stores' rules move.** Apple's fee on links to buy on the web, and Google's fees, are changing through the courts in 2026. The rules are checked again before the plan.
- **A game that does not unlock.** Staff check each extra by playing (5.5), but a later game update could break an unlock. Reports and the staff refund (5.8) are the way back.
