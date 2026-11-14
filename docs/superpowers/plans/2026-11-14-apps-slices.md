# Apps and player features: the slices and their order

**Spec:** `docs/superpowers/specs/2026-11-14-apps-and-player-features-design.md` (approved by the Owner, 2026-11-14: "Approved"; pull request #107). Read it with `CLAUDE.md`, `AGENTS.md`, the makers' sales spec (`2026-11-14-makers-sales-design.md`, pull request #106) and `docs/superpowers/progress.md`.

**What this file is.** The spec leaves to the plan "how the work splits into slices, and their order". This file is that answer, and nothing else. It holds no tasks. Each slice below gets its own plan, plan audit, execution, implementation audit and fixes, as `CLAUDE.md` says. The first slice's plan is beside this file: `2026-11-14-apps-a-test-copy.md`.

**Planned against:** `main` at `31cc54b`. Measured there: 10 screens under `src/routes/`, 20 server files beside them, 11 forms. No Capacitor, no Tauri, no `scripts/` folder, no feed on `main` yet (slice 3 is at tasks 1 to 8 of 27).

## The order, in one picture

```
A  test copy and live copy
│
├─ the website track (no phone or computer needed; every check runs in CI)
│    H  handles for every account
│    R  age ratings, and the day someone turns 16
│    S  feature switches
│    F  follow, Following, and Your games
│    Q  search
│    B  block, mute, restrict, report, and friends
│    P  player pages
│    V  reviews
│    K  hooks: achievements, leaderboards and analytics
│
└─ the apps track (the riskiest work first)
     1  one static build of the screens, and the feed in a phone shell
     2  native feel on phones, and offline
     3  the computer app
     N  notifications
     $  buying through each store
     L  launch: "Coming soon", the stores' forms, each app sent for review
```

The two tracks run side by side after A. The website track is ordinary slice work. The apps track is where a store can say no, so it starts as early as its needs allow.

## Why this order

- **A first.** The spec says so: "This is the first step of the build."
- **Handles (H) next on the website track.** The makers' sales plan adds people to a split by handle, and today only makers have one. Its plan thread asked for handles before its split screens (2026-11-14).
- **The static build and the feed in a phone shell (1) first on the apps track.** The spec says the feed's scrolling is the riskiest part and is built and tested on real phones "before anything else". Planning found a second risk of the same size, below ("Found while planning", 1), and it is settled in the same slice.
- **Buying through each store ($) before any app is sent for review.** Apple and Google refuse an app that sells a membership without their own purchase. So the first build a store reviews must already have it.
- **Launch (L) last.** "Launch is set by the last store to approve."

## The slices

Each row names what the slice builds from the spec, what must be on `main` before its plan is written, and what it needs from the Owner. "Needs" that are not on `main` when a slice's plan starts are a stop, reported to the coordinator.

| Slice | Builds (the spec's heading) | Must be on `main` first | Needs from the Owner |
|---|---|---|---|
| **A** Test copy and live copy | "Test copy and live copy", except feature switches and A/B tests | nothing | a second database, bucket, Worker and Stripe sandbox (steps T1 to T9 in A's plan); one answer (Q1 there) |
| **H** Handles for every account | The handle half of "Player pages": every account has a handle, not only makers. How a person picks one is that plan's to say | A; slice 3's `pages` feature (it owns handles today, for makers) | nothing |
| **R** Age ratings | "Age ratings": the four ratings on a game, the reviewer's change, the 16th-birthday date beside `adultOn`, hiding games above a player's age in the feed, maker pages and links | slice 2's submit (branch M) and slice 4's review screens | nothing |
| **S** Feature switches | "Feature switches": a table, one `isOn(name)` read on the server, a staff screen to turn each on and off | slice 4's admin portal frame | nothing |
| **F** Follow and Your games | "Follow", "Your library" | slice 3's feed and maker page; the wishlist; S | nothing |
| **Q** Search | "Search" | R (search respects ratings); slice 3's feed; S | nothing |
| **B** Blocking and friends | "Friends": requests, block, mute, restrict, Settings → People, Report on each new thing | H; slice 4's reports; S | nothing |
| **P** Player pages | The rest of "Player pages": photo, banner, sections, who sees it, image checks, link checks | H, B, F; slice 3's themes and maker page; S | the image-checking service's key and the unsafe-sites key; one choice of image-checking service (that plan's question) |
| **V** Reviews | "Reviews" | the sales plan's game page; slice 2's play time; slice 4's reports; S | nothing |
| **K** Hooks | "Ruken hooks": achievements, stats and leaderboards, analytics | the sales plan's hooks script and message reader; B (leaderboards respect blocks); the cookie question (pull request #104); S | nothing |
| **1** Static build and the feed in a phone shell | "One codebase, three shells" for phones; the feed test from "Native feel" | A; slice 3's feed | a real-phone test of the feed (theirs by rule); for iPhone, the Apple Developer account |
| **2** Native feel on phones, and offline | "Native feel" (iPhone, iPad, Android, everywhere), "Offline" | 1 | real-phone tests |
| **3** The computer app | "Native feel" (computers); Ruken's own download; the packages for the Microsoft Store, the Mac App Store, Flathub and the Snap Store | 1 (the static build) | a Windows code-signing certificate; the Microsoft, Flathub and Snap accounts; Apple's for the Mac |
| **N** Notifications | "Notifications" | 2 and 3; F; the sales plan's "this extra went on sale"; beta builds' invite | push keys from Apple and Google |
| **$** Buying through each store | "Buying in each app": price points, each store's purchase, the stores' notifications, restore; the membership through a store | 2 and 3; the sales plan's `ExtraPurchase` and `splitSale`; slice 5's ledger | the store accounts, each store's server keys, and each store's products made by command where one exists |
| **L** Launch | "Launch", "Accounts and the stores' other rules": "Coming soon", the launch email and notification, the stores' privacy forms, deletion and contact in the app, each app sent for review | everything above | each store's listing and its release (theirs by rule) |

Every slice that adds a screen also carries, in its own plan: the exact words on that screen and how it passes the drunk-grandma test; the screen behind a feature switch; and the every-view screen review before its audit.

**S comes before any slice that adds a screen.** The spec: "Each new screen ships behind a switch". So S is in "Must be on `main` first" for every slice above that adds or changes a screen (F, Q, B, P, V, K, and H if its plan adds a screen for picking a handle). Only work with no screen of its own (A, the data half of H, R's hiding rule) may go before S. If slice 4's admin portal frame is late, S's plan says so as a stop, rather than a screen going out without its switch.

## What the spec left to the plan, and which slice's plan answers it

| Left to the plan | Answered in |
|---|---|
| How the work splits into slices, and their order | this file |
| The test copy comes first | A's plan |
| The feed in a phone shell to test scrolling | 1's plan |
| The Capacitor and Tauri plugins for each piece, each with its version and why | 1 (the shell itself), 2 (haptics, share, back, biometrics, links, offline), 3 (Tauri and its plugins), N (push), $ (purchases). Versions are read from the registry when that plan is written, never from memory |
| Which image-checking service | P's plan, as a question to the Owner with one recommended |
| The exact words on every new screen, and how each passes the drunk-grandma test | each screen's own slice |
| How each store's price points are read, and how "10% higher" rounds | $'s plan. The rounding rule is already settled with the sales plan, below |
| The hooks script's messages, limits and checks | K's plan, on the sales plan's script and envelope, below |

## What is shared with the makers' sales plan

Agreed between the two plan threads on 2026-11-14. The sales plan's file is the record of its side; if the two files ever disagree, the session that meets the difference stops and reports.

| Piece | Whose | The seam |
|---|---|---|
| Extras, the buy card, ownership, the owned file | sales | A new feature `extras`, between `launch` and `play` in `FEATURE_ORDER` |
| A purchase | sales | `ExtraPurchase` carries `source` (`stripe`, `apple`, `google`, `microsoft`), `sourceId` (unique with `source`), `grossCents`, `taxCents`, `feeCents` |
| The sale's split | sales | `splitSale({ gross, tax, fees }, shares)` in `money`. Fee and tax are inputs, so a store sale is the same call |
| The store sources: price points, purchase sheets, the stores' notifications, restore | apps, slice $ | adds rows with a store `source`; calls `splitSale`; changes nothing in `extras` beyond what its plan says |
| The store price | settled by sales, built by apps | the smallest price point of that store that is not below the website price times 1.10, compared in whole numbers with no rounding first; a store with no fixed points uses that amount rounded up to a cent; no point high enough means the extra is not sold in that store, and staff are told |
| The membership bought through a store | apps, slice $ | changes slice 1's `membership`, not `extras` |
| The hooks script | sales makes it; apps adds to it, slice K | `src/features/play/ruken-hooks.browser.js` (new, not on `main` yet), served by the game gate at `/__ruken/hooks.js`. Envelope both ways: `{ ruken: 1, type: "<area>.<name>", ...fields }`. `readGameMessage(data): GameMessage \| null` and the frame check live in `src/features/play/frame-messages.ts` (new, made by sales). Sales owns `extras.*`; apps adds `achievements.*`, `stats.*`, `events.*` to the same union and script |
| Reserved folders in a game | sales | `__ruken/` and `ruken-extras/` |
| The game's page | sales | apps adds the reviews summary and list, slice V |
| Handles for every account | apps, slice H | sales looks a person up by handle for a split. H comes first on the website track for this. The lookup lives in `accounts` (its entry), not `pages`: `extras` sits below `pages` in `FEATURE_ORDER`, so by the layer rule (`tests/architecture.test.ts`) it cannot import `pages`. H moves the handle from `MakerPage` down to the account |
| "May A reach B" | apps, slice B | sales asks it before a split invite. If B is not on `main` when that task starts, the sales task stops and reports. It lives in a new feature, `people`, placed directly above `accounts` in `FEATURE_ORDER`, so every feature that offers a way to reach someone (beta invites in `games`, splits in `extras`, pages, leaderboards in `play`) can import it |
| A game's rating | apps, slice R | an extra carries its game's rating; sales reads it through the feature's entry |
| "This extra went on sale" | apps, slice N | called from the staff accept route, not from `extras`: `acceptExtra` answers `{ wentOnSale: boolean }` and the route calls the apps' function |
| The Apple hold after a take-down | sales | a question to the Owner in the sales plan |
| A store sale's fee | sales shapes it, apps fills it, slice $ | Not settled. `ExtraPurchase.feeCents` assumes the fee is known when the purchase is recorded. Apple's transaction data carries the price, and the plan audit found nothing in it that carries Apple's commission; Google's notifications carry a token. If a store's fee arrives only later (its sales or earnings reports), it has to be a fact added later, and the game's share held until it arrives. To be checked against each store's own pages before the sales plan fixes `ExtraPurchase`'s shape |

## Found while planning

Each is a fact from `main` or from a service's own pages, with the slice that deals with it.

1. **Every screen today is drawn by the server.** The spec says the apps "bundle the same screens, built as a static app" and "load nothing from the network to draw a screen". On `main`, each of the 10 screens reads its data in a server file, and its forms post back to the server, with the sign-in kept in a cookie for Ruken's own address. A bundled app runs on an address of its own, so that cookie and those server files do not reach it as they are. How one set of Svelte screens serves both (the website drawn by the server, the apps drawn on the device and asking the server for data) is the first thing slice 1 proves, before the feed's scrolling, with its own stop rule: if two attempts do not give one set of screens that passes the existing journeys unchanged, the session stops and the Owner hears the options. **Slice 1.**
2. **A database branch copies the people in it.** The spec gives the test copy its own "database branch". A Neon branch starts as a full copy of its parent, so a branch of the live database would put every live account into the test copy, which the same paragraph forbids ("the two never share data"). A's plan uses an empty database of its own instead, and says so as a Call. **Slice A.**
3. **Stripe's test mode is one shared space.** The live copy runs in Stripe's test mode until the Owner opens live payments. If the test copy used the same test mode, the two would share customers and webhooks. A's plan gives the test copy a Stripe sandbox of its own. **Slice A.**
4. **A wildcard games address needs a domain.** Each game runs on its own name under the games' domain. A `workers.dev` address has no names under it, so the test copy's games need a domain too. That costs money, so it is the Owner's choice (Q1 in A's plan). **Slice A.**
5. **Building for iPhone, Mac and Windows needs new CI jobs.** The spec says the builds run on GitHub's macOS and Windows runners. `CLAUDE.md` says the CI workflow changes only on the Owner's words, quoted in the commit. The plans for slices 1 and 3 ask for those words before they touch the workflow. **Slices 1 and 3.**
6. **Much of what the apps show is not on `main` yet.** The feed (slice 3), the maker's submit screens (slice 2, branch M) and the admin portal (slice 4) are still being built. The "must be on `main` first" column above is the real gate on each slice, not this file's order alone.
7. **The longest wait is not code.** The store accounts need the company and its D-U-N-S number first (the spec, "Needs, and when"). Slices $ and L cannot finish without them, and an iPhone test build needs the Apple account. Nothing on the website track waits for any of it.

## Not in any slice

As the spec's "Not in this": Steam, accounts for under-13s, games downloaded for offline play, chat, comments, direct messages, notifications nobody asked for, a game SDK beyond the hooks, and Sign in with Apple or Google. A/B tests come after launch, as their own small spec.
