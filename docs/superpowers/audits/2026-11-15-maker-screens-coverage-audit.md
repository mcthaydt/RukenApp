# Maker screens redesign: does it cover every requirement?

Date: 2026-11-15. A review of draft pull request #96 (branch `spec/maker-screens-redesign-2`, commit `02908f0`): its design file `docs/superpowers/specs/2026-11-14-maker-screens-redesign-design.md` and the round 7 board (https://claude.ai/artifact/Wjg2oKxKVSWAXj8sKtDgXL, the same file as `maker-screens/maker-screens-round-7.html`). Read-only: nothing in the repository was changed.

## Conclusion

No, not yet. The redesign covers the submit run, the live game's rooms and the Owner's decisions of 2026-11-15 well. But 37 things the merged specs and plans need are missing (20 on the maker's side, 17 on staff's), and the board draws only 3 of the 9 staff screens the design file lists. On top of that, 8 places in #96 contradict each other or the specs (section 3). The biggest gaps:

1. **Taking a game off Ruken, and a game staff took down.** The design file says this "is not designed here", but it is in the main design (5.4), slice 2 Task 31, slice 4 Task 11, and the sales plan Task 30 (it refunds the last 14 days of extras).
2. **Editing your page after the first game**: links, social icons, the banner, the page's sections, page views and link taps, and a page staff took down.
3. **Connecting your bank** (`/make/bank`), for makers and for people in a split.
4. **Most staff screens**: their sign-in code, who is staff, feature switches, live games (take down, free to play), the payout run, and makers' questions about money.

The drunk-grandma review of the copy waits until these are drawn, as the brief said.

## How this was checked

The design file was read in full, and so was the board's source. Then each maker- or staff-facing item was checked against it in these files on `main`, as merged:

- Specs: the main design (5.3 to 5.7, 6), makers' sales (all of it), apps and player features (all of it), beta builds, the wishlist.
- Plans: makers' sales (Tasks 24 to 32), the apps' slice map, slice 2 (Tasks 27, 28, 30, 31), slice 3 (Tasks 24 to 26), slice 4 (task list, Tasks 10, 11, 17, 18), slice 5 (task list, Tasks 25, 27, 33, 35, 36), beta builds (Tasks 6, 7), wishlist (Task 8).
- The Owner's decisions of 2026-11-15 written into #96 (sections 10 to 12).

Not checked: the screens that run on the website today (slice 2's `slice-2/submit` branch), WebKit, and any screen moving. I did not walk the screens as a user to see if someone gets stuck; that is the Fable review that comes next.

## 1. Maker screens that are missing

| # | What's missing | Where it is required | How it shows in #96 |
|---|---|---|---|
| M1 | **Take my game off Ruken**: the button, the "are you sure" screen (it should say that people who bought extras in the last 14 days get their money back, and Apple buyers get Apple's refund link), and the state after. | Main design 5.4 ("They take games down themselves"); slice 2 Task 31; sales spec 5.8 and plan Task 30 | Section 5 says "not on this branch and is not designed here". The rooms list has no way to do it. |
| M2 | **Put it back**, for a game the maker took off. | Slice 2 Task 31 | Missing. |
| M3 | **Taken down by staff**: "Taken down: <reason>" and "Send it again". | Main design 5.4; slice 4 Task 11 | The state words are listed, but there's no screen. Section 5 says "A game that was taken down cannot be changed", which needs squaring with slice 4's "Send it again". |
| M4 | **Your page, after setup**: change the address, photo, line and colours; links (a title and an address, reorder, hide, "a game somewhere else"); social icons. | Main design 5.3 and 5.4 ("The same area lets the maker edit their page"); slice 3 Tasks 24 to 26 | Only the first-game questions (address, photo, line, colours). Nothing for links or icons, and no way back into the page later. |
| M5 | **Banner and page sections** (arrange or hide links, most played, achievements, reviews, following). A maker's page "is the same page with their games on it". | Apps spec, "Player pages" | Missing. |
| M6 | **Page views and link taps**, the counts a maker sees. | Main design 5.3 | Missing. Players room covers games only. |
| M7 | **Your page was taken down**, with "I've fixed it. Look again." | Slice 4 Task 17 | Missing. |
| M8 | **What a suspended maker sees.** | Slice 4 Task 18 | Missing. |
| M9 | **Connect your bank**, before and after, and how the share "waits" until it's done. Also the "Connect your bank" step after saying yes to a split. | Main design 5.4; sales 5.6; slice 5 Task 25 | Only named in a board note ("After yes: You're in. and Connect your bank"). No screen. |
| M10 | **One month's statement**, and **Ask about this line** with its answer. | Slice 5 Tasks 27 and 35 | "Your money" shows a total and "Older statements", but not a statement page or the question screen. |
| M11 | **The agreement again when it changes.** Version 2 (extras and splits) must be agreed before the first extra goes out; makers who agreed to version 1 need to see it. | Sales plan Task 24; sales spec 7 | The agreement is "first game only". There's no "the agreement changed" screen. |
| M12 | **Add an extra, the missing questions**: its name, its one line and its picture, then its own Check and send. Also: changing an extra ("A change is waiting for review"), and "Remove" for a draft never on sale. | Sales spec 5.5; plan Task 24 | The board draws only "What is it", price and days. Change and Remove aren't drawn. |
| M13 | **A split that's waiting**: "Waiting for @drummer to say yes", "Cancel this change" (red), "(left Ruken)", "Each person connects their own bank to be paid", and shares that don't add up. Also the line on Your account: "@snekprty asked you to share what Floor Fifty earns." | Sales plan Tasks 26 and 27 | The board shows only the happy state, "They add up to 100%". |
| M14 | **How a game uses extras** (`/help/hooks`), the page the extra screen links to. The apps add achievements, scores and events to it. | Sales plan Task 25; apps slice map (K) | Linked from "One extra", but not drawn. |
| M15 | **Named events for analytics.** A maker lists the events a game may send (like "level_3_done"); Ruken refuses any not listed. | Apps spec, "Ruken hooks" ("Ruken accepts only events the maker listed") | The Achievements and scores room has achievements and scores only. There's no place to list events. |
| M16 | **Add an achievement and Add a score, the other questions**: name, line, icon (and the picture check refusing one), the score's name and "Which wins?". | Redesign 10.4 itself | The board draws only "hidden?". |
| M17 | **One player's events**, when the maker taps a player in the Players room. | Redesign 10.5 itself | Described, not drawn. |
| M18 | **Empty and early states**: each room with nothing yet; Reviews under 10 ("Not enough reviews yet"); before launch (wishlists only, "Opens …"). | Redesign 10.3; apps spec "Reviews"; wishlist spec | Words in notes only. |
| M19 | **A store-version pull that was sent back**, and the "Pull both for review" step on each new release. | Redesign 12.0a itself | Store version room shows "Ready" only. "Send my newest version for review" doesn't say it will ask for both. |
| M20 | **An extra a store can't sell.** When no store price is high enough, the extra isn't sold in that store and staff are told; the maker isn't. | Apps slice map, "The store price" | Missing. Worth one line on the extra. |

## 2. Staff screens that are missing

The design file lists 9 staff screens (11.1). The board draws 3: the queue, checking a game, and a refund's second yes. Everything staff do must work fully on an iPad (Owner, 2026-11-15).

| # | What's missing | Where it is required | How it shows in #96 |
|---|---|---|---|
| S1 | **Checking an extra**, with the game playing and "Play with it" / "Play without it", and a change shown beside the live version. | Sales plan Task 28; redesign 11.1 #3 | Listed, not drawn. |
| S2 | **Checking an achievement or a score.** | Redesign 11.1 #4 | Listed, not drawn. |
| S3 | **Reports**, and the "take down" and "suspend" screens with their reason. | Main design 5.5; slice 4 Tasks 19, 20 | Listed, not drawn. |
| S4 | **Pictures held back.** | Apps spec, "Player pages" | Listed, not drawn. |
| S5 | **The staff money month**, with the Extras block, refunds, disputes, Apple holds. | Sales plan Task 32; slice 5 Task 32 | Listed, not drawn. Only the second yes is drawn. |
| S6 | **Find a purchase and ask for a refund** (by the number on the buyer's receipt, and the three reasons). | Sales plan Task 29 | Only the second person's screen is drawn. |
| S7 | **What staff did.** | Main design 5.5; redesign 11.1 #9 | Listed, not drawn. |
| S8 | **Staff's own sign-in code**: setting up an authenticator, and entering a fresh code before a money action. | Main design 5.5 ("a fresh code from an authenticator app"); slice 4 Tasks 1 to 4 | The code box sits on the refund screen; setting it up isn't designed. |
| S9 | **Who is staff**: roles, adding and removing staff, at least two superadmins. | Main design 5.5; slice 4 Task 7 | Missing. |
| S10 | **Feature switches**: turn each new screen on and off. | Apps spec, "Test copy and live copy"; apps slice map (S) | Missing. |
| S11 | **Live games**: take a game down without a report, and "Free to play" on and off. | Slice 4 Tasks 10 and 12 | Missing. Take down appears only under Reports. |
| S12 | **Take an extra off sale** (staff), with a reason. | Sales plan Task 28 | Missing. |
| S13 | **The payout run**: checked and approved by two people. | Main design 5.5; slice 5 Task 33 | Missing. |
| S14 | **Makers' questions about money**, and Send answer. | Slice 5 Task 36 | Missing. |
| S15 | **The content marks and the bar** on checking a game: Sex or nudity, Gore and Drugs, which staff can add or remove; the reasons "It's pornography.", "It goes past what we allow." and "Gambling isn't allowed on Ruken."; and "It's random." for an extra. | Redesign 12, 12.0 | The "Checking a game" board screen has the age rating but no marks, and none of these reasons. |
| S16 | **Store version on the queue and on the check.** The queue's kinds don't include "Store version". The check has the Full / Store switch, but the parts list doesn't show the store version's files. | Redesign 12.0a | Partly drawn. |
| S17 | **A report on a leaderboard entry or a friend request**: what can staff do? A score can't be taken down. | Apps spec, "Friends" (Report on every leaderboard entry) | 11.1 #6 lists only take down a game, page or review, or suspend. |

## 3. Things in #96 that disagree with themselves or the specs

1. **Two marks or three.** Section 12 says staff see "these two marks"; 12.0 added Drugs, so it's three.
2. **Which games get a Store version room.** 12.0a says "a game with a content mark", and the board says "sex, nudity or gore". 12.0 says drugs alone don't hide a game from the store apps, so the board is right and 12.0a should say so.
3. **The 18+ hint promises too much for Drugs.** "Players only see it if they turn it on" and "Some store apps hide it" are both said whatever is picked. If drugs alone don't hide a game from stores, the hint should change with the choice.
4. **The board's summary is out of date.** It says "18+ games may have sex, nudity or gore". It leaves out drugs, the Cyberpunk 2077 bar, no gambling, and the censored store version.
5. **Taken down.** Section 5 says a taken-down game "cannot be changed". Slice 4 Task 11 lets the maker fix it and "Send it again". One of them needs to change.
6. **The age rating is the last question.** The submit table in section 3 still ends at 6 questions ("of 6"). Section 10.5 makes it 7 (8 for 18+). The table and section 6 should be brought in line.
7. **Beta testers.** The beta spec adds testers by email or handle (the board does too), while splits are by handle only "so the form never tells a maker whether an email has an account". The beta refusal ("Only members can test games.") tells the maker that the email or handle exists and isn't a member. That may be fine, but it should be decided, not left by accident.
8. **Staff on an iPad and a "computer only" game.** The Owner wants every staff step on an iPad, including playing the game. A game marked "computer only" may need a keyboard. Either the iPad needs a keyboard for those, or the plan says how staff check them. That's a question for the Owner.

## 4. What is covered well

The 10 or 11 question submit run with the age rating; the 18+ follow-up question and the "no pornography, no gambling" hint; the live game's rooms (Extras, Who shares the money, Beta testers, Achievements and scores, Players, Reviews, Store version); prices and shares picked, never typed; the season calendar; Take off sale; saying yes to a split, with the US bank line before Yes; Your money as one page per person; Players with anonymous names and totals only where 10 or more share them; Reviews with no delete and no answer; blocking with no screen of its own ("We can't add that person."); one staff queue; tick a part and pick a reason; Accept and Send back as one Blue button; the age rating staff can change; Play with every extra or none; the refund's second person with a fresh code; the staff layout for an iPad held either way.

## 5. Next

Draw M1 to M20 and S1 to S17 (or tell the Owner which can wait until after launch), fix the 8 points in section 3, then run the drunk-grandma copy review on every screen. After that comes the Fable review of how it looks and whether anyone gets stuck.
