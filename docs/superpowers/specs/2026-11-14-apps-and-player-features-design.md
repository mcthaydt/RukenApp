# Ruken apps on every store, and what players get

Date: 2026-11-14. Status: written, waiting for the Owner's approval. Builds on the design (`2026-11-13-ruken-reels-linktree-design.md`), the wishlist design (`2026-11-14-wishlist-before-launch-design.md`), beta builds (`2026-11-14-beta-builds-design.md`) and the makers' sales spec (draft pull request #106). It changes them only where this file says so.

## Why

Owner, 2026-11-14: "Ruken app is for PC, Linux, Mac, Android, and iOS; people using the browser version will be as uncommon as people using TikTok or Instagram on browser; like they do it, but they DEF. prefer to use the apps".

Owner, 2026-11-14: "The app should be a native feeling experience". And, on what else players get: "We should have reviews people can leave for games as well; since we can't add on steam, what player specific things are users expecting".

The approved design leaves out the desktop app, notifications, follow at launch, search and a game SDK. This spec brings those in, as far as the answers below go.

## What the Owner decided (2026-11-14)

Each answer is quoted, with the question it answers.

- Where the apps go: "Download on our site, but also Steam, Microsoft Store, Apple Store for Mac, and whatever Linux has". Then: "We can cut steam". That leaves seven: the App Store (iPhone and iPad), Google Play, the Mac App Store, the Microsoft Store, Linux stores (Flathub and the Snap Store), Ruken's own download for Windows, Mac and Linux, and the website.
- When: "3. B", meaning launch waits for the apps. Then "All eight, with launch set by whichever store approves last", now seven.
- How it feels: "The app should be a native feeling experience". The build: "A", native phone screens and a light native window on computers. Then "I'd prefer not to use React Native and Expo since we're using Svelte for the app", and "Capacitor it is for mobile". So Capacitor on phones and Tauri on computers.
- Store money: "1. A, but also upcharge on place that take a cut by 10%". The store's fee comes off the top before the split, as card fees do, and prices are 10% higher wherever a store takes a cut.
- Where people buy: "4. A". In the app through the store where the store requires it, and on the web, with what someone owns showing everywhere.
- Notifications: "Only ones you turn on yourself, like new DLC for a followed game, a beta invite or a renewal reminder, all off by default".
- Offline: "A". The app shows what it last loaded, and games need a connection.
- Age ratings: "Actually, can we do All Ages, 13+, 16+, and 18+". The maker picks one and the reviewer can change it ("A"). "16. A": All Ages is a label only, and accounts stay 13 and up.
- Blocking: "A, well, that's not true, we have non-makers who have acounts", so block covers any account. Friends: "A, with blocking, muting (you can't see their activity), and restricting (they can't see your activity)".
- Reviews: "11. A, but 15mins". Library: "12. A". Follow at launch: "13. A". Search: "14. A". Friends, achievements and leaderboards at launch: "15. C".
- Player pages: "Players should also have deeply customizable linktree like pages, so B, a banner too".
- Hooks: "we just need ruken hooks (which we should have for analytics anyway) that work like Steam achievements".
- Images: "A", checked automatically before anyone sees them. Links: "A", checked against an unsafe-sites list, and no outside links for under-16s. Under-18 pages: "A", friends only unless the player changes it.
- Launch date: "Show "Coming soon" with no date until the last store approves, then email wishlisters + notification if they opt'd it".
- Hook analytics: "B, but anonymous handles, you can see details though like location, age, device, just relevant information". Small games: "A", so country and age band are shown only as totals of 10 or more players.

## Goals

- Ruken is an app people install from every store above. It opens fast, feels like it belongs on each device, and does the same things as the website.
- One codebase: the same Svelte screens run on the website, in the phone apps and in the computer apps.
- Buying works in every app, by the store's rules, and what someone owns shows on every device.
- Players get reviews, a library, following, search, a customizable page, friends, achievements and leaderboards.
- Every way one account can reach another can be blocked, muted, restricted and reported.

## Not in this

- Steam ("We can cut steam").
- Accounts for under-13s. "All Ages" is a label only.
- Downloading games to play offline.
- Chat, comments and direct messages. Friends see activity but don't talk.
- Notifications nobody asked for, such as recommended clips.
- A game SDK beyond the hooks below. Games still get nothing about the player beyond which of their own extras the player owns.
- Sign in with Apple or Google. It is still after launch, and adding Google will bring Sign in with Apple with it (Apple rule 4.8).

## What would make it a failure even if it works

- A store rejects or removes Ruken over a rule this spec missed.
- A game learns who is playing, or sees anything of the player's account.
- Ruken loses money on a store sale, or a maker is paid for a sale the store refunded.
- A purchase made on one device doesn't show on another.
- An under-18 sees an 18+ game, or a stranger can find an under-18's page.
- Blocking someone still lets them reach you anywhere: beta invites, money-share invites, friend requests, your page or leaderboards.
- It feels like a website in a box: no swipe-back, no system share sheet, no haptics, scrolling that stutters.
- Anything is recorded about someone before they agree to it.

## Approaches

The Owner chose Capacitor on phones and Tauri on computers (2026-11-14).

- **Capacitor on phones, Tauri on computers (chosen).** The same Svelte screens run inside each app, with native pieces added: store purchases, notifications, haptics, the share sheet, swipe-back, biometrics and deep links. Capacitor has the largest set of phone plugins, and Tauri is small and covers Windows, Mac and Linux.
- Tauri everywhere. One tool, but its phone support is newer, and store purchases and notifications there rely on community plugins.
- NativeScript with Svelte. Real native views, but every screen is rewritten and the project is small.
- React Native with Expo. Ruled out by the Owner, because the app is Svelte.

## How it works

### One codebase, three shells

- The website stays as it is: a SvelteKit app on Cloudflare.
- The apps bundle the same screens, built as a static app, and talk to Ruken's server over its existing routes. They load nothing from the network to draw a screen. This keeps them fast, lets them open offline, and keeps them clear of Apple's rule 4.2 against repackaged websites.
- Phones: Capacitor for iOS (iPhone and iPad) and Android. Computers: Tauri for Windows, macOS and Linux.
- Games play exactly as on the web: in the locked-down frame, from the separate games address, with a play pass. The app adds no bridge for games into the phone or computer (Apple rule 4.7.2).
- Signing in works as on the web: email and password, and the session stays signed in.

### Native feel

Each screen follows its platform's habits:

- **iPhone and iPad:** a tab bar at the bottom, swipe from the left edge to go back, haptics on Play, Wishlist, Follow and a finished purchase, Apple's share sheet, Face ID or Touch ID before a purchase, the safe areas, and 120 Hz scrolling where the screen has it.
- **Android:** the system back gesture always goes back, Material motion, Android's share sheet, and grouped notifications.
- **Computers:** a real window that remembers its size, the platform's menus (File, Edit, View, Help), keyboard shortcuts (arrows move through the feed, Space plays, Esc leaves a game), full screen, and game controllers passed through to the game.
- **Everywhere:** links to Ruken open in the app (universal links on Apple, app links on Android, a `ruken://` link on computers), and a cold start shows the feed's first clip within a second on a recent phone.
- **The feed.** Smooth scrolling of full-screen video is the riskiest part inside a web view. The plan builds the feed first and tests it on real phones before anything else. If web video can't hold steady scrolling, the clips switch to the phone's own video player.

### Offline

- The app keeps the screens and the last things it loaded: the feed's last clips, your library, your page and your settings.
- With no connection: "You're offline. Games need a connection." with a Try again button. Play is greyed out.

### Buying in each app

| Where | Membership, DLC and battle passes are bought with | Price |
|---|---|---|
| Website, Ruken's own download, Flathub and the Snap Store | Stripe, as now | the base price |
| iPhone and iPad app, Mac App Store | Apple in-app purchase | 10% higher |
| Android app (Google Play) | Google Play Billing | 10% higher |
| Microsoft Store | Microsoft Store purchases | 10% higher |

- Prices are rounded up to the store's nearest price point. Those points come from each store's own price list (an API), never typed in.
- In the US App Store app, a "Buy on the web" button may also be shown next to Apple's purchase (Apple rule 3.1.1(a)). Outside the US it is not shown.
- Buying is always on a Ruken screen, never inside a game's frame.
- **One fact per purchase.** Each sale, refund and renewal is recorded once in the ledger, from its source: Stripe's webhooks, Apple's App Store Server Notifications, Google's Real-time Developer Notifications, and Microsoft's collections API. Whatever someone owns shows on every device.
- **What comes off the top.** The store's fee (as each store reports it), the tax and the card fees, before the 70/30 split. Ruken never loses money on a store sale.
- **Refunds.** A store refund reverses that sale's split the same way a Stripe refund does in the sales spec.
- **Restoring purchases.** Each store's "Restore purchases" button is on the Account screen, as Apple requires.

### Notifications

- There are three kinds, each off until the person turns it on, in Settings and at the moment it's useful ("Tell me when this game gets new DLC"):
  - new DLC for a game you follow or have wishlisted;
  - a beta invite;
  - your membership renews in three days.
- Launch itself: everyone on a wishlist gets an email. Anyone who turned on notifications also gets one.
- Phones use APNs and FCM through Capacitor. Computers use the system's notifications through Tauri.

### Age ratings

- The maker picks one rating for each game when they submit it: "All Ages", "13+", "16+" or "18+", each with a line in plain words beneath it. Whoever reviews the game can change it before it goes live.
- Accounts stay 13 and up. All Ages is a label meaning "fine for anyone".
- Ruken keeps the date someone turns 16 beside the date they turn 18 (`adultOn`), and still never the birth date itself. It hides games rated above a player's age everywhere: the feed, search, maker pages and links.
- The app's own store ratings come from each store's questionnaire, for a store of other people's games, chat-free.
- Each game has an index entry and a universal link (Apple rule 4.7.4). Maker pages and `/g/<game>` already provide this.

### Player pages

- Every account can have a page at `/<handle>`, like a maker's page: a photo, a banner, a name, one line, links, social icons and a theme, using the same themes as makers' pages. "Deeply customizable" also lets a player arrange sections: their links, the games they've played most, their achievements, their reviews, and the makers they follow. A player hides or reorders each section.
- A maker's page is the same page with their games on it.
- **Who sees it:** pages of players 18 and over are public. Under-18 pages are visible only to friends unless the player changes that.
- **Images:** every photo and banner is checked automatically for nudity and violence before anyone else sees it. A flagged image goes to staff and stays hidden until they decide. It can also be reported.
- **Links:** every link is checked against Google's unsafe-sites list when it's saved, and again from time to time. Under-16s can't add links to other sites, only their own games and achievements.

### Reviews

- Thumbs up or thumbs down, plus optional words of up to 500 characters.
- Only from members who have played that game for at least 15 minutes, measured the way play time already is.
- A review shows "Played 3 hours", never the player's name or page.
- A game shows "Mostly liked (84% of 212)" or "Not enough reviews yet" below 10 reviews.
- Every review can be reported. Makers can't delete or answer reviews. Staff can remove them, with a recorded reason.

### Your library

A "Your games" tab holds Continue (the last game you played), recently played, your hours in each game, the DLC and battle passes you own, and your wishlist. All of this is already recorded.

### Follow

- Follow a maker or a game, from their page, the game card or the feed. "Following" shows the games and makers you follow.
- This pulls "follow" and the "Following" tab, both listed in 5.1 of the design as later, into launch.

### Search

One search box. It finds games by name and makers by name or handle, typo-tolerant and nothing more. Search respects age ratings and blocks.

### Friends

- Add someone by their handle. They have to accept.
- Friends see what you're playing now, what you played recently, and your achievements. Each of these can be turned off in Settings.
- There is no chat.
- **Block:** they can't find your page, send you friend requests, add you as a beta tester or to a money share, or see you on leaderboards. You stop seeing them anywhere. To them, you look like an address that can't be added. They are never told.
- **Mute:** you stop seeing their activity, and they don't know.
- **Restrict:** they stop seeing your activity, and they don't know.
- **Settings → People** lists who you've blocked, muted and restricted, with an undo beside each.
- Report is on every page, review, friend request and leaderboard entry.

### Ruken hooks: achievements, leaderboards and analytics

- A small Ruken script a maker can add to their game. It sends events out of the game's frame to the Ruken page around it, with `postMessage`. The game never receives anything about the player, except which of that game's own extras they own and whether Ruken's buy card is open (makers' sales spec, 5.4). Neither one names the person. The same script also carries a game's request to open the buy card, so makers add one script for both.
- **Achievements**, on the model of Steam's: the maker lists each achievement in the game's settings (a name, a line, an icon, and whether it's hidden until earned). The game reports "unlocked: <id>" and Ruken records it for the signed-in player. Players see their own achievements, and how rare each one is ("12% of players have this").
- **Stats and leaderboards**, on the model of Steam's: the maker names a stat (for example "best score", higher or lower wins). The game reports a value, and Ruken keeps each player's best. Leaderboards show handles. They respect blocks and under-18 privacy, so an under-18 shows as "a player" to anyone who isn't their friend.
- **Analytics.** Owner, 2026-11-14: "B, but anonymous handles, you can see details though like location, age, device, just relevant information". The maker can also report named events, like "level_3_done".
  - The maker sees each player's progress under an anonymous name. That name is random, different in every game, and never linked to the player's handle, page or email, so a maker can't follow a player across games.
  - The details are kept coarse: the country (from the connection, never GPS or a city), an age band ("13–15", "16–17" or "18+", never an exact age or birth date), and the device ("iPhone", "Android tablet", "Windows computer", and so on).
  - Small games (Owner, 2026-11-14: "A"): each player's row shows the anonymous name, their events and the device. Country and age band appear only as group totals, and only where at least 10 players share them.
  - Events are recorded only for players who agreed to analytics in the cookie question. Nothing is recorded for anyone else.
  - Ruken never sells this data, and makers agree not to try to work out who a player is.
- Achievements and stats are part of a player's own account, so they are kept for everyone signed in.
- Anything a game sends is untrusted. Ruken accepts only events the maker listed, at a limited rate, and only from a game that's running with a valid play pass. Since a game can lie about its own scores, each leaderboard says it belongs to the game.
- Makers who don't add the script simply have none of this.

### Launch

- `/join` and the stores' pages show "Coming soon", with no date, until the last store approves. This replaces the wishlist design's "Membership opens 30 November."
- On the day the Owner opens live payments, everyone on a wishlist is emailed, plus a notification for those who turned it on.

### Accounts and the stores' other rules

- Account deletion is in the app (Account → Delete my account), using the existing 14-day delete. Google Play's listing also gets the web address for it.
- The stores' privacy forms ("nutrition labels", Data safety) are filled from what Ruken actually stores.
- Published contact details are in the app (Apple rule 1.2).

### Test copy and live copy

Owner, 2026-11-14: "we need a dev vs prod setup and the ability to A | B test", then "A and A" to the coordinator's two questions.

- This is the first step of the build. A separate test copy of Ruken (its own Worker, database branch, bucket and games address) runs beside the live one. It uses Stripe test mode, Apple's and Google's sandbox purchases, and Microsoft's test flights. The store builds that point at it go out as test builds: TestFlight, Google Play internal testing, and Microsoft's private audience. Live builds point only at the live copy, and the two never share data.
- **Feature switches** are built in with the apps. Each new screen ships behind a switch staff can turn on and off without a new build. Switches are read from Ruken's server and record nothing about anyone.
- **A/B tests come after launch**, as their own small spec, and only for people who agreed to analytics.

### Builds and checks

- All builds run on GitHub's hosted runners: Linux for Android and Linux, Windows for Windows, and macOS for iOS and macOS. Lint, typecheck and the tests run there too, as now.
- The screens stay tested by the Playwright journeys. The apps add a check that each shell builds and opens to the feed.
- Real-device tests are the Owner's, starting with the feed's scrolling.
- Signing keys, store accounts and store releases are the Owner's.

### Stored

Names are left to the plan.

- The date someone turns 16, beside `adultOn`.
- A game's age rating.
- Store purchases: one ledger fact each, with the store, its transaction id and its fee.
- Notification settings, and each device's push token, deleted with the account.
- Follows (account to maker, account to game).
- Reviews: the game, the member, thumbs, words, when, and removal with a reason.
- Player page fields, sections, and image check results.
- Friends and friend requests, blocks, mutes and restricts.
- Achievement and stat definitions for each game. Each player's unlocks and best values. Analytics events under each game's anonymous player names, with country, age band and device.

## Needs, and when

- **The Owner's, in this order:** form the LLC, then get its D-U-N-S number (Apple and Google need it for a company account). Then the Apple Developer Program ($99 a year), the Google Play Console ($25 once), a Microsoft Store developer account, a Windows code-signing certificate, Flathub and Snap Store accounts, and the image-checking and unsafe-sites services' keys. Each comes as a one-line command where one exists, or says it's a website.
- The makers' sales spec (#106) takes the store rows, the 10% and "off the top" from this file.
- Slice 5 (money) gains the store sources.
- Launch is set by the last store to approve. Every store reviews each build, so the plan gets each app into review as early as possible.

## Left to the plan

- How the work splits into slices, and their order. The test copy comes first, then the feed in a phone shell to test scrolling.
- The Capacitor and Tauri plugins for each piece, each with its version and why.
- Which image-checking service to use (it is new, and approved by the Owner's "A").
- The exact words on every new screen, and how each one passes the drunk-grandma test.
- How each store's price points are read, and how "10% higher" rounds.
- The hooks script's messages, limits and checks.
