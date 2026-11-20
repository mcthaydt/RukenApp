# A game's page and playing it

Date: 2026-11-17. Status: the Owner picked the layouts on 2026-11-17 (section 0); written for the Owner's review of this file. Nothing here is built.

This amends the main design (`2026-11-13-ruken-reels-linktree-design.md`), sections 5.2 (Play and the paywall) and 5.7 (the line shown the first time in a game), and adds to the maker's Live screen (`2026-11-14-maker-screens-redesign-design.md`, 5c) one switch. It also ends the main design's computer-only Call in 5.2 ("This one needs a computer") and its submit question "Plays on": every game plays on phones and computers (Owner, 2026-11-17 06:25 UTC; the plan's Unit R takes the question out). Everything else in them stands: the colours, type and button rules of 5.8 and the redesign's sections 1 and 15.1, "the felt asks one thing and paper is what you touch", and the drunk-grandma test.

Lines marked **Owner** are the Owner's words or choices. Lines marked **Call** are this design's choices; the Owner can overrule any of them. Lines marked **Pending** wait for the Owner and are not built until the answer comes.

> **Amended 2026-11-20 (the Owner picked "Bento for the game page, Store sheet for playing, menu open").** Where 3.3 describes the page as a two-column watch page, and 4.3 and its sketch describe the old panel and a three-line tab, read these instead. The game's page is one grid of tiles: one column on a phone held upright, two from 520px wide, four from 1000px. The clip carries the name and the one line on a dark band (under the clip, with no script). Beside it: one blue tile holding Play, what it costs with Join as the last word of the cost for someone who is not a member, and Share; then tiles for the age, where it plays, how long people sit, the two clips, who made it, and more from the maker. Reviews, news, extras, friends, pictures, messages, achievements, settings, saves, the maker's other websites, "On Ruken since" and Report this game are not built; each waits for its own spec or its data. The menu is a Store sheet, always a sheet on the right (from the bottom on an upright phone): the name on one line with the maker under it, Keep playing as the one blue button, then rows with an icon, a bold name, a small help line and a pale line between them (Full screen, Start again "Use this if the game is stuck.", Leave game). It is one list at every size and fits a 320-tall window. The tab says RKN.

## 0. The Owner's direction and choices

- **Owner, 2026-11-17:** "The games page should be basically steams game page, but elegant and tasteful in an above in beyond way like how we did we the game submissions; the in-game shell should do the same, but for Xbox game pass in-game shell".
- **Owner, 2026-11-17:** "In terms of functionality yes, match them, but I'd like you to really think about how we can innovative the formula to make it even more human and tasteful; like think about how we can solve the problem from first principals, and you can ask questions along the way".
- **Owner, 2026-11-17:** "Try to do 3 sketches each, and I'll pick the one I like the most - they should solve the problem in different ways; and I need the sketches to be phone portrait and tablet landscape". The sketches: https://claude.ai/artifact/X6WbtpdYTp67wvAvwtMfGV (private to the Owner until shared).
- **Owner, on a card:** "Now: what Ruken has; rest drawn". Slice 2 builds only what Ruken already holds. Reviews, the wishlist, achievements and extras each get a place on the page in the slice that builds them (section 6).
- **Owner, on a card:** "Opens a menu (like Game Pass)". While playing, the corner button opens a menu; a stray tap never ends the game.
- **Owner, on a card:** "Show sitting length and player count". Then, in words: "Show player count should be an option set by the maker".
- **Owner, on a card:** "Yes, one quiet line". People who are not members see the price under Play.
- **Owner, 2026-11-17:** "Non-members should be paywalled when they press play; either they pay on the landing page or they get hit with it when they try to play". As 5.2 says: Play takes a non-member to the price card, and after paying they are in the game they chose. Nothing plays without paying except a free game.
- **Owner, 2026-11-17, on the first sketches:** "Not quite what I was looking for - players see the game on a reels like interface like this, but I'd prefer the bar be on the bottom like YouTube; we go to the game page when we click on the game, but not play". Pressing a game in the feed opens its page; Play is pressed on the page. Ruken's bar floats at the bottom (3.3). The sketches were redrawn from the feed (version 2).
- **Owner, on a card:** "Home and You only, for now". The bar's two buttons (3.3).
- **Owner, 2026-11-17 06:25 UTC:** "All games must be playable on computer and mobile". There is no computer-only game: every page says the game plays on the device in hand, and nothing sends a person away for their device. Taking the maker's "Where does it play?" question out of submitting is the plan's Unit R.
- **Owner, 2026-11-17, the pick:** "1. A, easily" (the game's page: the watch page, 3.3) and "2. I'd prefer if it's a small semi transparent tab, that can be moved up and down, or dragged to either side if the screen, but when it opens A" (playing: a small see-through tab the person can move, which opens the menu of sketch A, 4.1 to 4.3).
- **Owner, 2026-11-17, on the game's page:** "when we click on the game that's when we see game page specific details, which should have basically everything steam has, but trimmed". Read with the first card ("Now: what Ruken has; rest drawn"): the page has a trimmed set of a store page's sections (section 2.1, the rows marked Now and Later); each section whose data Ruken does not have yet is not drawn until its slice builds it (section 6). The Owner's notes on the feed itself are kept for slice 3 in section 6.

## 1. From first principles: what a person needs

The two screens are judged by what the person in front of them needs, in the order they need it. Steam and Game Pass were read for what they do (section 2); this is what Ruken does with it.

**Before pressing Play**, a person wants to know five things, and the page answers each in a plain sentence, never in a table of specs:

1. **What is it like?** Watching it is the answer. The clip is the biggest thing on the page and plays at once, without sound; a press gives it sound and full size.
2. **Will it work on what I'm holding?** Every game on Ruken plays on phones, tablets and computers (Owner, section 0), and the page knows the device, so it says so directly: "Plays on this phone. Nothing to install." A store's system requirements become one line about the device in the person's hand.
3. **Is it for me?** Who it is for, in the rating chip and its own plain line ("12+ · Real-looking fighting, or scary bits."), and how long a sitting is, measured from real play, never claimed ("Most people play about 12 minutes at a time."). The maker's own facts (genre, tags, languages) join these once the submission spec that asks for them lands (section 6).
4. **Who made it?** A person, not a company link: the maker's photo, name and their own one line, from their page. Then their other games.
5. **What does pressing Play cost me?** Said before the press, in one quiet line, and personal: a member reads "Included with your membership."; a free game reads "Free to play. No account needed."; anyone else reads "Members play every game. $9.99 a month." with "Tax is added where it applies." under it (5.8's money rule).

Then one blue button: Play.

**While playing**, a person wants the game and nothing else, until they want out:

1. **The game on the whole screen.** Ruken's one control is a small "Menu" tab in a corner (Owner's card).
2. **A way out a stray tap can't trigger.** Menu first, then "Leave game".
3. **Help when the game is stuck,** without hunting: "Start again" reloads the game, and one line says when to use it.
4. **Full screen where the device allows it.**
5. **Honesty.** Ruken cannot pause a game (there is nothing for a game to call), so nothing says "Paused". The menu dims the game and says nothing false about it.

**What Ruken does that the two products don't**, each from something only Ruken has:

- The device line speaks to the device in hand, not to a minimum spec.
- The play facts are measured by Ruken's own play time (main design 5.2), so they cannot be inflated.
- The maker is a person with a face and their own words, because every maker has a Linktree-style page (5.3).
- The price is said before the press, and differently to each person, because the page knows who is looking.
- The game page and the maker's Live screen show the same clip, name, line and rating, so a maker sees on Live what players see on the page. Only Live has the blurred video behind it (redesign 5c); the game's page keeps the plain felt (3.1).

## 2. Matching the two products, feature by feature

Owner: "In terms of functionality yes, match them". Every feature of the two is listed with what Ruken does about it. **Now** is built in slice 2. **Later** has a place drawn and waits for the slice named (the roadmap, and the Owner's card). **No** is left out, with the reason.

### 2.1 A store's game page

| Feature | Ruken | Where |
|---|---|---|
| Big media at the top, with a strip to switch between videos | Now: the clip of the window's shape, playing; two small tiles under it switch between the upright and wide clips; a press opens it full size with sound and the browser's own controls | 3.1 |
| Name and short description | Now: the name and the one line | 3.1 |
| Price and the buy button | Now: Play, with the personal line about cost (1, item 5) | 3.1 |
| Age rating and content description | Now: the chip and its plain line; an 18+ game's marks in the chip, as `ratingWords` gives them | 3.1 |
| System requirements | Now: "Plays on this phone/tablet/computer. Nothing to install." | 3.1 |
| Developer and publisher | Now: the maker as a person (photo, name, their line) when they have a page | 3.2 |
| More from this developer | Now: their other live games, as paper tiles | 3.2 |
| Share | Now: "Share", a quiet outline | 3.1 |
| Tags and genres | Now: how long a sitting is, and, if the maker turns it on, how many people played this week. Later: the maker's genre and tags, from the submission spec (section 6) | 3.1, 5, 6 |
| Release date | No: Ruken keeps no first-live date, and a date says little about a game. Added only if the Owner asks | |
| Long "About this game" text | No, for now: a maker writes one line. A longer text needs a new question for makers and staff review. Pending, item 2 in section 9 | |
| User reviews and their summary | Later, slice 3 and after (apps spec, "Reviews"): "Mostly liked (84% of 212)" sits under the play facts; the reviews list sits under the maker | 6 |
| Wishlist and follow | Later (wishlist spec; follow, apps spec): a quiet outline beside Share | 6 |
| Achievements | Later (apps spec, Ruken hooks): a row under the play facts, "12 achievements" | 6 |
| Extras (DLC) | Later (sales spec): a row of paper tiles under the maker | 6 |
| Languages, controller support | Later: languages come with the submission spec (section 6). Controller support is in that spec's scope, not this one | 6 |
| News, community hub, curators, awards | No: not in Ruken's sentence (main design 2) | |
| "Is this game relevant to you?" | Answered by the device line and the play facts | |
| Report | Later, slice 4 (moderation, 5.5): a small link at the foot | 6 |

### 2.2 An in-game shell

| Feature | Ruken | Where |
|---|---|---|
| A button that opens the guide over the game | Now: the Menu tab | 4.1 |
| The game's name in the guide | Now: the name, and "by" the maker's name when they have a page | 4.2 |
| Return to the game | Now: "Keep playing", blue, the main button | 4.2 |
| Quit the game | Now: "Leave game", green (the way back), to the game's page | 4.2 |
| Full screen | Now, where the browser allows it on the page itself; not offered where it doesn't (iPhone) | 4.2 |
| Restart when stuck, and help | Now: "Start again" and its one line | 4.2 |
| Loading screen | Now: the game's name on the felt while the game starts, and words if it is slow | 4.4 |
| Touch controls, controller layout, stream quality, microphone, parties, screenshots, achievement pop-ups | No: Ruken's games are plain web games that run on the device, not streams; they bring their own controls, and a game learns nothing about the player (main design 5.2). Achievement pop-ups come with achievements, later | |

## 3. A game's page (`/g/<game>`)

### 3.1 The pieces, top to bottom

- **The ground** is the plain felt. The clip at the top carries the game's colours; the page under it is calm (3.3). Where a video may not move by itself (reduced motion, Save-Data, a small device), `quietVideo` shows its first frame, as on Live.
- **The way back.** "← Ruken" over the top left of the clip, a link home; from slice 3, "← Back to the feed" (3.3).
- **Amended later** by `2026-11-17-game-facts-design.md`, section 6: with its Unit V, the clip and its two tiles become one carousel of every video and screenshot. Unit F builds what this section says.
- **The clip.** The upright clip on an upright window, the wide clip on a wide one, sharp, 20px corners, playing without sound where a video may move. Under it, two small tiles, one per clip at its own shape; the one showing has the blue edge of a picked choice. Pressing a tile shows that clip in the same box (an upright clip in a wide box stands in the middle, with the blurred ground either side). Pressing the clip opens it full size with sound and the browser's own controls; Escape or the browser's close returns. Each tile's name: "Watch the upright video", "Watch the wide video".
- **The name**, `h1`, Young Serif at the section heading size (64px wide, 36px on a phone).
- **The one line**, at the statement size.
- **The play facts**, plain sentences in ink on one paper card (3.3), each its own line:
  - the rating chip, then its plain line in sage: the same words the maker's age question shows today: 3+ "Fine for anyone.", 7+ "Cartoon fighting, or a little scary.", 12+ "Real-looking fighting, or scary bits.", 16+ "More violence or strong words.", 18+ "Only for adults." (one list, moved to `laid-out.ts` so the question and the page share it);
  - the device line: "Plays on this phone. Nothing to install.", "…on this tablet…", "…on this computer…". The server knows a phone by its `User-Agent`; the page's script says "tablet" where the pointer is coarse (an iPad sends a Mac's `User-Agent`); without script a tablet reads "…on this computer…";
  - the sitting line, once a game has 20 counted plays: "Most people play about 12 minutes at a time." (section 5);
  - the player line, only when the maker has turned it on: "214 people played it this week." (section 5).
- **Play**, blue, the one main button. A link to `/g/<slug>/play`, so it works with no script.
- **The cost line**, under Play and Share, small, sage (1, item 5). On the price card nothing changes: the card says the price again, as 5.2 has it.
- **Share**, a quiet blue outline: the device's share sheet, or the link copied, with "Link copied." under it, or, if neither works, "Copy the address from the bar at the top."
- **Made by** (3.2) and **More from** (3.2).
- The page's title is `<name> · Ruken`.

### 3.2 The maker and their other games

- **Made by.** Shown when the maker has saved a page (`MakerPage`): their photo (round, as people's photos are) or none, "Made by" and the page's name, and their one line in their own words, in quotes. Until maker pages have their own address (slice 3) it links nowhere; from then the whole block links to `/<handle>`. A maker with no page: the block is not drawn, and nothing says why.
- **More from <name>.** Their other live games, newest accepted first, at most 6, each a paper tile (the wide clip's still frame, the name in Young Serif) that links to its own page. Not drawn when there are none, or when the maker has no page (then there is no name to head it with).

### 3.3 Layout: the watch page (the Owner's pick, A)

Owner, 2026-11-17: "A, easily", on the second set of sketches, where the page opens from the feed and Ruken's bar floats at the bottom. The idea: the clip a person pressed keeps playing at the top, and the page unrolls under it in a watch page's order: the name, the one line, the maker, one row with Play and Share, the facts together on one paper card, then more from the maker.

**The bar.** Owner, on a card: "Home and You only, for now". Ruken's bar floats at the bottom of every screen, like a video app's, and stays on the game's page; it goes away only while playing. Its two buttons are Home (the feed) and You (`/me`). **The bar comes with the feed in slice 3.** Until then the page has no bar, and its way back is "← Ruken" over the top left of the clip, a link home; from slice 3 the same place reads "← Back to the feed". The layouts below leave the bar's room at the foot so nothing moves when it arrives.

Phone, upright (390 × 844). The upright clip runs edge to edge at the top (no corners, no gutter), its height 46% of the window. The page scrolls under it; the clip scrolls away with it.

```
┌──────────────────────────┐
│← Ruken                   │  over the clip
│                          │
│   upright clip,          │
│   edge to edge, playing  │
│                          │
│ [▮] [▬▬]                 │  the two clip tiles, over its foot
├──────────────────────────┤
│ Floor Fifty              │  h1, 36px
│ Climb. Fall. Climb again.│
│ (photo) Snek · "I make…" │  Made by
│ [   Play    ] [ Share ]  │  blue, quiet outline
│ Members play every game. │  the cost line
│ ┌──────────────────────┐ │
│ │[12+] Real-looking…   │ │  paper: the facts
│ │✓ Plays on this phone.│ │
│ │Most people play about│ │
│ │12 minutes at a time. │ │
│ └──────────────────────┘ │
│ More from Snek           │
│ [tile] [tile]            │
│      ( Home · You )      │  the bar, from slice 3
└──────────────────────────┘
```

Phone, sideways (852 × 393), tablet sideways (1180 × 820) and computer (1280 × 800): two columns, as a watch page on a wide screen. On the left, about three fifths: the wide clip (20px corners), its tiles, the name, the maker with Play and Share on the same line, and the paper card with the one line and the facts. On the right: More from the maker as a list (a still and the name and rating chip each), then the cost line. On a sideways phone the clip is the window's height less 120, so the name and Play show without scrolling beside it.

```
┌──────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────┐  More from Snek     │
│ │← Ruken                           │  [still] Tiny Tower │
│ │   wide clip, playing             │          7+         │
│ │                                  │  [still] Ladder Day │
│ └──────────────────────────────────┘          3+         │
│ [▬▬] [▮]                                                 │
│ Floor Fifty                           Members play every │
│ (photo) Snek  "I make…"   [ Play ] [Share]  game. $9.99… │
│ ┌──────────────────────────────────┐                     │
│ │ Climb. Fall. Climb again.        │                     │
│ │ [12+] Real-looking… · ✓ Plays on │                     │
│ │ this tablet · About 12 minutes   │                     │
│ └──────────────────────────────────┘                     │
│                 ( Home · You )                           │
└──────────────────────────────────────────────────────────┘
```

Tablet, upright (820 × 1180): the phone's order in one column 640 wide, centred, the upright clip at the top with 20px corners, its height 52% of the window.

On a computer a mouse can hover a tile; nothing depends on hover. Play is in the content, not pinned: on a phone it is in view without scrolling, under the clip and the name, and it scrolls away only once the person scrolls down to read.

### 3.4 Who sees what

| Who | The cost line | Play goes to |
|---|---|---|
| Signed out, or signed in and not a member | "Members play every game. $9.99 a month." and "Tax is added where it applies.", with a quiet outline **Join** beside it | the price card (`/join?next=…`), then the game |
| A member | "Included with your membership." | the game |
| Anyone, on a free game | "Free to play. No account needed." | the game |
| The game's own maker | "This is your game. Playing it here doesn't count toward its play time." | the game |
| Staff who check games | "You can play this to check it. It doesn't count toward its play time." | the game |

The price comes from `PREMIUM_PRICES_CENTS` in `plans.ts`, formatted, never typed into the page.

**Join.** Owner, 2026-11-17: "either they pay on the landing page or they get hit with it when they try to play". So a person who is not a member can pay from the game's page without pressing Play: a quiet blue outline, "Join", beside the cost line, going to `/join?next=/g/<slug>`, so after paying they are back on the game's page, which then reads "Included with your membership." Play stays the one blue button, and Play still goes to the price card. Owner, 2026-11-17, on a card: "Yes, a quiet Join beside the price".

### 3.5 What moves

As the redesign (4.6) and 5.8 allow: a button pressed scales to 0.97; the clip swaps with a 250ms tone change. With reduced motion nothing moves and no video plays by itself.

## 4. Playing (`/g/<game>/play`)

### 4.1 Playing

- The game fills the window: a `<main>` the window's size (`100dvh`, no gutter), `felt-deep`, holding the frame and the Menu tab. The frame is as the plan has it (sandbox, `allow`, no referrer, no name, nothing of the player in its address).
- **The Menu tab.** Owner: "a small semi transparent tab, that can be moved up and down, or dragged to either side if the screen, but when it opens A".
  - **How it looks.** A small tab against the edge of the screen, 48 wide and 56 tall, `felt-deep` at 72% (the game shows faintly through it), with "RKN", the logo, in chalk in the wordmark's face (`--font-display`, 18px; the Owner, 2026-11-20 08:33 UTC: "use RKN in the correct font, RKN is our logo"; its accessible name stays "Menu. Use the arrow keys to move it.", and the menu it opens is the Store sheet), 12px corners on the side away from the edge. It rests at 72%; while it is pressed, dragged or has focus it is solid. Chalk on `felt-deep` at 72% over a pure white game is 7.48:1 (worked out from the tokens: the layer over white is `#545556`); over anything darker it is more. This amends 5.8's "no glass" for this one control, in the Owner's words.
  - **Where it rests.** The first time, at the left edge, a quarter of the way down, clear of the notch and the home indicator. Wherever the person leaves it, it stays there on that device (`rk_menu_tab` in `localStorage`: the side and the height as a share of the window), and comes back there in every game.
  - **Moving it.** A press that moves more than 8px drags the tab (touch, pen or mouse, by pointer events). Let go, and it glides to the nearer side, at the height it was let go, kept clear of the top and bottom insets; 200ms on the redesign's curve, none with reduced motion. A press that moves less than 8px is a press: it opens the menu. With the keyboard, the tab has focus and the arrow keys move it: up and down by a tenth of the window, left and right to that side. Its name for a screen reader is "Menu. Use the arrow keys to move it."
  - **No script.** It is a `<details>`' summary at the left, a quarter of the way down, solid, and does not move; the menu opens and Leave game works (4.2).
- **No line beside the tab.** The first-time line ("Choose Menu to leave the game. You can move it.") is removed (the Owner, 2026-11-20 07:49 UTC): it covered the game's own buttons and text on a sideways phone. The tab is its own signpost, and 5.7's "Tap ← to go back to the feed" is gone with it.

### 4.2 The menu

Open: the game stays in view behind a `felt-deep` layer at 62% (dimmed, as the paywall dims the clip, 5.2), and a panel holds, top to bottom:

```
Floor Fifty                    card title, 32px
by Snek                        sage; only when the maker has a page
[ Keep playing ]               blue, the main button
[ Full screen ]                outline; only where the page can go full screen;
                               "Leave full screen" while it is
[ Start again ]                outline; reloads the game's frame
[ Leave game ]                 green, a link to /g/<slug>
Not working? Choose Start again.   sage
```

- **Keep playing** closes the menu and puts focus in the game's frame: the person's own press, so the play-time rule (Task 22, "never focuses the frame by itself") is kept.
- **Escape** closes the menu when focus is in it. Focus stays inside the menu while it is open, and returns to the tab on close.
- **Start again** reloads the frame with the same address: the pass lasts a day, so it needs no new pass. It does not ask first: the line under it says what it is for, and a game that saves keeps its save.
- **Leave game** goes to the game's page. Leaving removes the frame, so the game stops.
- Nothing says "Paused". The words never claim the game stopped.
- Play time keeps its rules: while the menu is open the frame does not have focus, so the time is not counted as attentive.

### 4.3 Layout: the menu of sketch A (the Owner's pick)

Phone, upright: the menu rises from the bottom, under the thumb, full width, 20px corners at the top.

```
┌──────────────────────────┐
│[≡]             Floor 23  │  the tab, at the edge
│▒▒▒▒▒▒ the game, dimmed ▒▒│
│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│┌────────────────────────┐│
││ Floor Fifty            ││
││ by Snek                ││
││ [    Keep playing    ] ││  blue
││ [    Full screen     ] ││  outline (not on iPhone)
││ [    Start again     ] ││  outline
││ [    Leave game      ] ││  green
││ Not working? Choose…   ││
│└────────────────────────┘│
└──────────────────────────┘
```

Phone, sideways, tablet (both ways) and computer: the menu slides in from the left edge as a panel 360 wide (300 on a sideways phone, scrolling inside itself if the window is too short), full height, the game dimmed beside it.

```
┌─────────────┬──────────────────────────────────────┐
│ Floor Fifty │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ by Snek     │▒▒▒▒▒▒▒▒▒ the game, dimmed ▒▒▒▒▒▒▒▒▒▒▒│
│[Keep playing│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│[Full screen]│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│[Start again]│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│[Leave game] │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ Not working?│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
└─────────────┴──────────────────────────────────────┘
```

Closed, on every device: the game and the tab only. The menu always opens from the side the tab is on: on the left, it slides in from the left; on the right, from the right. On an upright phone it rises from the bottom whichever side the tab is on.

### 4.4 Starting, and when it won't start

- Until the frame's `load` fires, the game's name sits in the middle of the `felt-deep` window with "Starting Floor Fifty…" under it, in sage. With no script the frame simply loads.
- After 20 seconds without `load`: "Floor Fifty is taking a while." with Start again (outline) and Leave game (green). The game keeps loading behind it, and the words go if it arrives.
- A game whose pass has run out (a day) shows the gate's own words inside the frame; Menu and Leave game still work.

## 5. The play facts

Both are measured by Ruken's play time (Task 22's beats), worked out by pure functions with tests, and read by the server when the page loads. Nobody types either.

- **How long a sitting is.** The median of the counted time of a game's plays in the last 30 days, counting plays by members and free plays only (staff and a maker's own play never count, as for the pool), and only plays that counted some time: at least one attentive beat, so a counted time above 0 (`countedMs`). Shown once there are at least 20 such plays; before that the line is not drawn and nothing says why. In words: under 2 minutes, "Most people play a minute or two at a time."; up to 15 minutes, to the nearest minute ("about 12 minutes"); up to an hour, to the nearest 5, with 60 minutes reading "about an hour"; beyond an hour, to the nearest half hour ("about 1½ hours", "about 2 hours"). Call: the thresholds and rounding.
- **How many people played this week.** Owner: "Show player count should be an option set by the maker". The number of different accounts with a counted play of the game (a play with at least one attentive beat; members, and signed-in free play) in the last 7 days by the server's clock. Free play by nobody cannot be told apart and is not counted. "1 person played it this week." / "214 people played it this week." Shown only while the maker has turned it on, even when the number is small: it is the maker's choice to show it.
- **The maker's switch.** On the maker's Live screen, under the game laid out: "Show how many people played it" with an On/Off chip (redesign 15.2's switch), and the line "Players see it on Floor Fifty's page." **Owner, 2026-11-17 06:28 UTC: off until the maker turns it on**, so a new game never looks empty without its maker choosing that. It is stored on the game (`Game.showsPlayerCount`, a boolean, false by default), which is a new column and a migration: lane 3 (section 8).

## 6. What waits for a later slice, and where it goes

Owner's card: "rest drawn". Each later feature has its place, so the page does not change shape when it arrives. None is built, drawn on screen or stubbed in slice 2.

- **Genre, tags and languages** (their own submission spec, lane 3). Owner, 2026-11-17 06:27 UTC: "We need to add in the bits to game submission that we don't have like languages and tags/genre, everything steam pages have, we have". That spec asks makers for them and stores them; once it lands, the game page shows them as play facts on the paper card, under the device line ("Puzzle · Calm · Short"; "In English and Spanish"). Nothing here builds, draws or stubs them.
- **Reviews** (apps spec): "Mostly liked (84% of 212)" as a play fact, under the sitting line; the reviews themselves after Made by.
- **Wishlist and follow:** a quiet outline beside Share ("Add to wishlist", "Follow Snek").
- **Achievements:** a play fact, "12 achievements", opening the list.
- **Extras:** "Extras for Floor Fifty", a row of paper tiles under Made by, each with its price.
- **Report:** a small link at the foot of the page.
- **The bar** (slice 3): Home and You, floating at the bottom (3.3).
- **The feed** (slice 3). The Owner's notes, 2026-11-17, kept here for the feed's own design and not built in slice 2, word for word: "not that we're there yet, but I'd like the feed sidebar options to be like, repost, share, comment, save"; "Bottom bar options: play/wishlist and follow with the profile pic, handle, game name, description, and playing audio"; "The feed should be human first rather than game, when we click on the game that's when we see game page specific details". So a clip in the feed leads with the person who made it (their photo, handle and Follow) and the game's name, line and audio; its side has Repost, Share, Comment and Save; Play (or Wishlist, for a game not out yet) sits with them; pressing the game opens this page. Main design 5.1 is amended by the feed's own spec, not by this file.

## 7. Approaches considered

For each screen, three, drawn in the sketches:

- **The page.** A, the shop window: a store's order, made calm (recommended: the most familiar, and it holds every later feature without changing shape). B, watch first: the clip is the whole screen and the facts wait in a sheet (the most like the feed, but the facts that decide are a step away). C, four plain answers: the page written as the four questions, in big sentences (the most human, less room for the clip, and it must be rewritten when reviews arrive).
- **Playing.** A, corner tab: one tab, a menu over the dimmed game (recommended: every pixel to the game, one place to look). B, quiet bar: a strip always above the game (never covers the game, costs a strip of screen, most on a sideways phone). C, a proper break: the menu is a whole calm screen with the time played (the clearest, but hides the game).

## 8. Lanes and what the plan changes

- Unit F (Tasks 20 to 23) stays lane 2: routes, `look.css`, the games, pages and play services, `tests/support/`. No migration. The play facts' sitting line is in F; the player line reads the switch only once it exists.
- **The player count switch is its own unit, lane 3** (a migration): the column, the switch on Live, and the player line. Lane 3 needs the plan audit before building, the implementation audit after, and the Owner's approval (or a standing permission covering the migration) before merging; merging applies the migration to the test site's database, because the site's deploy command runs `prisma migrate deploy` first on every merge to `main`. So the Owner's lane 3 approval is for that merge. Undoing it is a second migration (`DROP COLUMN`), not a revert. It waits on F.
- F's expected time grows from five hours to eight: the page has more pieces (the maker, More from, the play facts, the full-size clip, the menu, starting). The switch unit: three hours, plus its audits.

## 9. Open decisions

1. **Settled:** the picks (section 0).
2. **A longer "About this game".** Recommended: not now. One line and the clips say what a game is; a longer text is a new question for every maker and more for staff to check. If wanted later, it is its own small spec.
3. **Settled, Owner 2026-11-17 06:28 UTC:** the player count starts off and shows only once the maker turns it on (section 5).
4. **Genre, tags and languages** are a separate submission spec (section 6); this spec only says where the page shows them.

## 10. Acceptance criteria

Unit F is judged on these. The carousel that replaces the two clip tiles is judged by `2026-11-17-game-facts-design.md`, section 9, with its Unit V.

These are folded into the plan's Unit F and the switch unit; the plan's tests check them.

- `/g/<game>` shows a live game's clip of the window's shape, its two clip tiles, name, one line, rating chip and line, device line, Play and the cost line for the viewer (3.4). A game that is not live, or not there, is the missing page with its way back.
- Someone who is not a member sees Join beside the cost line, going to `/join?next=/g/<slug>`; nobody else sees it.
- The sitting line shows only with 20 or more counted plays in 30 days, in the words of section 5; the player line only when the maker turned it on.
- Made by and More from show only as 3.2 says.
- The device line names the device in hand (phone, tablet or computer), for every game; nothing on either screen sends a person away for their device.
- Play takes a non-member to the price card and then into the game they chose; a member, the maker, staff and anyone on a free game go straight in.
- The play screen is the game and the Menu tab only. Menu opens the menu; Keep playing returns to the game with focus in it; Start again reloads it; Leave game goes to the page; Escape closes the menu; Full screen appears only where it works. With no script, Menu then Leave game still leaves.
- No line shows beside the tab, on a first visit or after.
- The Menu tab is see-through at rest and solid when pressed or focused; it can be dragged up and down and to either side by touch and mouse, and moved by the arrow keys; a press that does not move it opens the menu; where it was left is where it is next time, in any game.
- Starting shows the game's name; after 20 seconds without the game, "Floor Fifty is taking a while." with Start again and Leave game.
- Everything works by keyboard alone with focus visible, nothing scrolls sideways, every target is at least 44 by 44, and nothing on either screen is red.
- Each layout matches its sketch in section 3.3 and 4.3 on the five devices (phone upright and sideways, tablet upright and sideways, computer), or the pull request names the difference and why.
- The words in this file are the words shipped.

## 11. At the slice's end

The design review rounds and screens page run as `visual-check` says, on the five devices. For the blind judge (step 4) the preparer pairs the game's page with public screenshots of a Steam store page, and the play screen with public screenshots of Xbox Cloud Gaming's in-game guide, at the closest sizes, covering their names and logos. Ruken takes only their structure and ideas, never their branding, art or look.
