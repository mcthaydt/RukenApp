# Ruken, restarted: Instagram Reels meets Linktree for games

Date: 2026-11-13. Status: approved by the Owner on 2026-11-13. Launch: Monday 30 November 2026, 11:00 CT.

The Owner's answers with the approval, 2026-11-13:

- Where it runs (7.3): Netlify, Neon and Cloudflare, as proposed. Owner, 2026-11-13: Cloudflare instead of Netlify. The app runs on Cloudflare too; Neon stays.
- Money after launch (6): yes. On 30 November Ruken takes payments and records play; the pool, statements and payouts land after launch and before 10 December.
- The first game (11): FloorFifty only, one game live on launch day.

Revised by the Owner on 2026-11-13; the sections that changed say so.

Lines marked **Owner** are the Owner's words or decisions from the 2026-11-13 conversation. Lines marked **Call** are the coordinator's choices; the Owner can overrule any of them. Nothing marked Call was agreed.

## 1. Why

Owner: "we strayed from our vision - instagram reels meets linktree for games, that's it."

The old repository grew to about 100,000 lines in 22 workspaces: a desktop app, a boot image, a store, cloud saves, translation, embeds, streams, collections, a game SDK. Little of it is in that sentence, and nothing was deployed. It is renamed RukenAppFailed and archived. A new public RukenApp starts empty and builds only the sentence.

## 2. What Ruken is

Two screens and a paywall.

- **The feed.** Ruken opens straight into full-screen clips of games, one per swipe, like Instagram Reels. Watching is free and needs no account.
- **Play.** Every clip has a Play button. A member goes straight into the game. Anyone else sees the price, pays, and lands in the game they tapped.
- **The maker's page.** Every maker has one short address, like a Linktree page: their games on Ruken, then their links to anywhere, in colours chosen from Sanzo Wada's A Dictionary of Color Combinations.

Behind those: makers submit a game on one form, as simply as on itch.io, and Ruken pulls the game's files from their GitHub repository. Staff accept games and moderate in an admin portal. The admin rules stay as they were; the membership and the split were revised on 2026-11-13 (section 6).

### Goals

- A stranger on a phone is watching a game clip within a second of opening Ruken, and is playing within a minute of deciding to pay.
- A maker with a working web game and a GitHub repository has it submitted in one sitting, with no tool to install and nothing to read first.
- Makers are paid by what members actually played, and by who brought them, by the rules in section 6.
- Launched on 30 November.

### Not in the first version

Comments, day passes, tips, the store, cloud saves, a game SDK, the desktop app, the boot image, translation, embeds, streams, collections, teams and contributor splits, search, notifications, a learned feed ranking. Each is a later spec if the Owner asks for it.

### What would make it a failure even if it works

- It grows past the sentence again. Anything not in section 2 needs the Owner's words before it starts.
- A game's files can be played without paying.
- A number about money or play is typed by a person, or is wrong.
- A tired, distracted person cannot work out what to do on a screen.

## 3. Constraints

- Owner: the new RukenApp repository is public, so its checks run on GitHub's own runners.
- Owner: no tests run locally. Every test runs on GitHub's runners, through the pull request.
  - Call: this replaces the pasted workflow's lines about tests on another machine and in a session's own container, and drops its "one in CI at a time" limit, which was for the Owner's own machines. A session pushes and reads the result.
  - A failing test is still written first and seen to fail for the right reason. It is seen failing in CI, on the branch, before the code that passes it is pushed.
- Owner: the launch date holds, and nothing is overengineered to make it.
- Owner: the workflow pasted on 2026-11-13 (stages, sessions, reporting, staying on the rails, rules, feature folders, tests only in tests/) governs the new repository. It becomes the new CLAUDE.md.
- Public repository. No history from the old repository is carried. No secret, private plan, customer data or real address goes in. Anything copied from the old repository is copied on purpose, file by file.
- Rules that carry over into the new AGENTS.md, because they are still true:
  - money is whole cents (bigint), and the split is worked out only by pure, tested functions;
  - ledger facts are only ever added, never changed;
  - nobody types a fact: every amount and count comes from an API, a webhook or a measurement;
  - games are untrusted: a game never sees a player's sign-in, and never runs on Ruken's own address;
  - time comes from an injected clock, and money dates are America/Chicago;
  - the copy is quiet and human, never claims a game is "AI-free", and never invents a business fact;
  - the drunk grandma test, on every screen and message;
  - do not overengineer, and write code a junior developer can follow.
- Rules that do not carry over: contract freezes, lanes and worktrees, the master delivery plan and continuation prompt (replaced by docs/superpowers/progress.md), self-hosted and rented runners, and both Figma files as sources of truth. The look now follows Instagram Reels and Linktree. Ruken's own screens wear the Card Table design (5.8, Owner, 2026-11-13).

## 4. Approaches

| | Approach | Trade-off |
|---|---|---|
| A | Copy the old repository and delete down | Something runs on day one. But everything carried must be understood, scrubbed for a public repository and audited, and its checks are wired to the Owner's machines. This is how the old one grew. |
| B | Start empty, build the new parts, carry only the proven hard parts | The feed, the page, the submit form and acceptance are new and small. The money maths, the Stripe code, sign-in and the game gate are copied in with their tests. Costs a careful copy of each carried part. |
| C | Start empty and rewrite everything | The cleanest. But rewriting tested money code in 17 days is the one place a mistake costs real money. |

Picked: B. The Owner handed over how it is built ("Make it happen"), so this is a Call.

## 5. The screens

Each screen says how it passes the drunk grandma test: one obvious next step, words a person says out loud, and a plain way back.

### 5.1 The feed (/)

Owner: "Match the UI/UX of Instagram reels primarily"; TikTok only where Reels is silent. Owner: "we have vertical video for vertical screens, horizontal video for horizontal screens."

```
┌─────────────────────┐
│ For you · Following │
│                     │
│   the game's clip,  │  ♥  like, with count
│   full screen,      │  ➤  share
│   looping           │  ⚑  save
│                     │  ⋯  report
│ @maker  [Follow]    │
│ Game name · one line│
│ [      ▶ Play     ] │
└─────────────────────┘
   swipe up: next game
```

- One game per screen. Swiping (or the arrow keys, or the wheel) snaps to the next.
- An upright screen plays the game's vertical clip; a wide screen plays its horizontal clip. Both fill the screen.
- Call: a clip starts without sound and a tap turns sound on, which then stays on. Browsers do not let a page start with sound.
- Call (revised 2026-11-13): share is in at launch. Like, save, follow and the "For you" and "Following" tabs come later; the sketch above shows where they go. Share uses the phone's own share sheet, or copies the link.
- Call (revised 2026-11-13): one feed, newly accepted games first, then the rest by how much members played them in the last seven days. The order is worked out by a pure function with a fixed seed, so it can be tested.
- Every game has its own address (/g/&lt;game&gt;), which opens the feed at that clip. That is what Share sends.
- Grandma: the only button with words on it is Play.

### 5.2 Play and the paywall

Owner: "paywall when they try to play."

- Tapping Play as a member opens the game full screen, with one Ruken control: a way back to the feed.
- Tapping Play as anyone else shows one card: the price, a monthly and a yearly choice, and one button. It asks for sign-in only at that point. After paying, the person lands in the game they tapped.
- Owner (revised 2026-11-13): the membership is $9.99 a month or $99 a year, no trials. Stripe adds tax where it applies (6).
- Call: a game marked "computer only" shows "This one needs a computer" on a phone instead of Play, with a button that shares its link.
- Call: games are plain web games. There is no Ruken SDK and nothing for a game to call. Ruken shows the game in a locked-down frame served from a different address than Ruken's, and the game never receives anything about the player.
- Call: a game's files are reachable only through a play pass that lasts a day (Call, 2026-11-14, coordinator), which Ruken gives a member when they press Play. Without a pass the files do not load.
- Play time is what the pool is split by. Call: Ruken's own page measures it: time counts while the game is on screen, the tab is showing and the game has the person's attention (the frame has focus), reported every few seconds and recorded by the server's clock. The game is not asked.
- Call: staff, and a maker on their own game, can play without paying, so a game can be checked. That play never counts for the pool.
- Owner, 2026-11-13: FloorFifty is free to play on launch day, for everyone, with no account. Every other game stays behind the paywall. Free play never counts for the pool. A game is free only when staff mark it so in the admin portal, with a reason, recorded like any staff action.
- Grandma: the paywall says what it costs and what happens next, in two short lines.

### 5.3 The maker's page (/&lt;handle&gt;)

Owner: "Match whatever linktree does with a slightly game focused twist, use A Dictionary of Color Combinations for the theming available."

```
┌─────────────────────┐
│       (photo)       │
│       @maker        │
│  one line about me  │
│      [ Follow ]     │
│ ┌─────┐ ┌─────┐     │  their games on Ruken:
│ │clip │ │clip │     │  clips that play, with
│ │▶Play│ │▶Play│     │  the same Play button
│ └─────┘ └─────┘     │
│ [  My Steam page  ] │  their links, to anywhere,
│ [  Discord        ] │  in the order they choose
│   ⓧ  ⓨ  ⓘ           │  social icons
│              report │
└─────────────────────┘
```

- From Linktree: a photo, a name, one line of bio, a stack of links (a title and an address each, reordered and hidden by the maker), social icons, a theme, and counts of page views and link taps that the maker can see.
- Call: the game twist is two things. The maker's accepted games sit above the links as playing clips. And a link can be marked "a game somewhere else" (Steam, itch.io), which shows it as a game card instead of a button.
- Themes. The maker picks one of Wada's combinations and the page takes its colours.
  - The colour values are data in the repository, copied from the MIT-licensed dictionary-of-colour-combinations data set (159 colours, 348 combinations), with its source and licence recorded beside it. It is not a dependency.
  - Call: code decides which colour of a combination is the background, the text and the buttons, by picking the arrangement that is easiest to read. Combinations where no arrangement is readable (text contrast under 4.5 to 1) are not offered. A test checks every offered theme.
- Call: a page is live as soon as the maker saves it, as on Linktree. It is moderated after the fact, through Report. Links must be https.
- Call: one maker is one account with one page. No teams.
- Grandma: a visitor sees games, then links. Nothing else.

### 5.4 Submitting a game (/make)

Owner: "we only use the pull request to pull the game, everything else is done on app; submission should be as simple as itch.io."

```
New game
  Name         [ Floor Fifty               ]
  One line     [ Climb. Fall. Climb again. ]
  Game files   [ Connect GitHub ] → pick a repository
  Clips        [ Upright video ] [ Wide video ]
  Plays on     (•) phone and computer  ( ) computer only

  [ Send for review ]
```

- Coordinator's reading: "pull request" here means Ruken pulling the game from the maker's repository. Nobody sends a pull request to RukenApp.
- Call: the repository holds a game that is ready to run in a browser: a folder with an index.html, as with itch.io's HTML upload. The maker picks the repository; the branch and the folder have sensible defaults (the main branch, the top folder) and can be changed. Ruken copies the files as they are. It never runs a maker's build scripts.
- Call: makers connect through a Ruken GitHub App that they install on just the repositories they choose, so private repositories work and Ruken can read nothing else. The Owner creates that app; its keys are the Owner's.
- Call: before a submission is accepted for review, code checks only what code can know: there is an index.html, the files are under a size limit, no file path is unsafe, and both clips are present, are video and are under 30 MB each. Whether the game is any good is a person's call (5.5).
- Updates. The maker presses "Pull the latest". Call: the new files go through acceptance again and the old ones stay live until then.
- A maker accepts the maker agreement once, on their first submission, and connects their bank (Stripe) on a screen of its own. Call: a game can be submitted and accepted before the bank is connected; earnings wait.
- The same area lets the maker edit their page (5.3) and see each game's state in plain words: "Waiting for review", "Live", "Sent back: ", "Taken down: ".
- Owner, 2026-11-14: "They take games down themselves." A maker can take their own game off Ruken at any time from their area, with no staff step; it leaves at once, and putting it back goes through review again.
- Grandma: one form, one button. Each field says what goes in it. A refusal says what to fix.

### 5.5 The admin portal (/admin)

Owner: "we need an admin portal for game acceptance and moderation." Owner: the admin rules stay.

- **Acceptance.** A queue of submissions, oldest first. Staff watch both clips, play the game, and press Accept or Send back, with a reason the maker sees. A person always decides. Adult games are not accepted, and Ruken is for people 13 and up, as before.
- **Moderation.** A queue of reports. Every clip and every maker page has a Report button with a short list of reasons. Staff can take down a game, take down a page, or suspend an account, each with a reason that is recorded and sent to the maker.
- **Money.** The pool, statements, payouts and disputes, as in the old admin, for the money features that are kept (section 6).
- **Authority.** The old rules stay: a staff role sets what someone may do; money actions need a second person and a fresh code from an authenticator app; there are at least two superadmins.
- Every staff action is recorded with who did it and when, by the system.

### 5.6 The person's own page (/me)

Call: sign-in is by email and password, as the old app did it; the carried code is used as it stands.

Small: their membership and a way to cancel it (Stripe's own portal), what they saved, who they follow, sign out, and delete my account.

### 5.7 Onboarding

Owner, 2026-11-13: "Onboarding is one of the most important things for any app", then yes to designing it here and building it in slices 3 and 4, where its screens are.

Onboarding is the screens themselves doing the teaching, the way Reels does. There is no tour, no carousel of welcome slides, and no step a person must click through before they can watch.

- **A viewer's first open.** The feed plays at once. Call: on the first clip only, two short hints sit over it and fade after the first swipe or tap: "Swipe up for the next game" and "Tap for sound". They never show again on that device. A person who never swipes still sees Play.
- **From Play to playing.** The paywall card (5.2): the price, monthly or yearly, one button. Signed out, the button goes to one short sign-up (email, password, date of birth) and straight back to the card with their choice kept, then Stripe, then the game they tapped, full screen. No email confirmation stands between paying and playing; the confirmation mail can be answered later. (Slice 1 builds this path; slice 2 adds the last step into the game.)
- **The first time in a game.** Call: one line at the top for a few seconds, "Tap ← to go back to the feed", then it hides.
- **A new maker** (Owner: "submission should be as simple as itch.io"). Call: /make walks a maker through three steps, one screen each, with a "Step 1 of 3" line and a way back on each:
  1. Pick your short address (ruken.../yourname). It says at once whether the name is free.
  2. Your page: photo, one line about you, a theme. Each can be skipped and changed later; the page is live as soon as they save.
  3. Your first game: the form in 5.4.
  After step 3 the maker lands on their area, where the game reads "Waiting for review" and one line says what happens next: "We'll email you when it's live, usually within a day." Call: "usually within a day" is shown only if staff can meet it; otherwise the line ends at "when it's live".
- **What onboarding never does.** It never asks for anything the next step does not need, never sends more than the mails in 7.1, and never hides the way back.
- Grandma: each hint is one short line, says what to do, and goes away by itself.

Built in slice 3 (the viewer's hints, the in-game line) and slice 4 (the maker's three steps).

### 5.8 The look of Ruken's own screens

Owner, 2026-11-13: "We can use the design present in the previous version as well", then yes to the Card Table design on Ruken's own screens.

Ruken's own screens wear the Card Table design: the paywall card, sign-up, sign-in and password reset, the person's own page (/me), deleting an account, the maker's area (/make), the admin portal, and the placeholder home page until the feed replaces it. The feed (5.1) stays full-screen clips with Reels' controls, and a maker's page (5.3) keeps the Wada colours its maker picked. The source is the Owner's "Ruken Card Table" design system (approved 2026-10-27); these are its values.

The idea: the page is quiet green felt, and what a person picks up or acts on is a white paper card on it. Red appears only where a card would have a pip: the one paid action. No casino imagery, no chips, no gold.

- **Colours** (one theme, dark by choice; no gradients):

  | Token | Value | Used for |
  | --- | --- | --- |
  | `felt` | `#1c3a2f` | the page |
  | `felt-deep` | `#142c23` | panels on the felt, the footer |
  | `felt-raised` | `#25483a` | secondary buttons, tracks |
  | `chalk` | `#eef2ec` | all text on felt (10.9:1 on felt) |
  | `sage` | `#a8bfb2` | notes on felt only (6.3:1), never running text |
  | `paper` | `#f1efe9` | cards; the primary button on felt |
  | `ink` | `#191b1a` | all text on paper (15.1:1) |
  | `ink-soft` | `#4a504c` | notes on paper (7.2:1) |
  | `pip` | `#c43b26` | the one paid action ("Continue to payment") and small markers; paper text on it is 4.57:1; never a field. Call, 2026-11-13: one step darker than the design sheet's `#c63c26`, which measures 4.48:1 with paper text. |

  Surfaces are told apart by a tone step, never by a line or a shadow.
- **Type.** Young Serif (400) for headings and card titles; Schibsted Grotesk, 400 for text and 600 for buttons. Both are under the SIL Open Font License and are served from Ruken's own address with their licences beside them; the site makes no request to a font service. Sizes: section heading 64px (36px on a phone), card title 32px, statement 24px, body 18px at 1.55 leading, small 14px for notes only. Sentence case; left aligned.
- **Shape.** Cards and panels 20px corners, every button a full pill. No borders or hairline rules except on real form fields; no shadow at rest.
- **Motion.** Pressing a button scales it to 0.97; nothing else moves. With reduced motion, nothing moves at all.
- **Never.** Eyebrow labels, tiny uppercase labels, gradients, glass, shadows at rest, emoji, icons on feature cards, index numbers.
- **Its copy rules hold too.** Every money line carries its qualifier ("Tax is added where it applies."), labels take no full stop, sentences do, and nothing claims a fact Ruken does not have. Prices and product words come from this design, not from the old pages ($9.99 and "membership", not $7.99 and "Premium").
- Grandma: one paper card per screen holds the one thing to do; the pip-red button appears only where money is spent.

## 6. Money

Revised by the Owner on 2026-11-13. Ruken never loses money on a member.

- **What players buy** (Owner): a membership to every game, $9.99 a month or $99 a year. No trials, no day or week passes, no buying single games. Stripe adds tax where it applies.
- **What comes off the top** (Owner): the tax, and every fee Stripe charges on that payment (card, Billing, Tax), before any split.
- **The split** (Owner): what is left is half Ruken, half makers. A yearly fee is spread across its twelve months. Ruken's half is never reduced to pay makers.
- **Bringing a member** (Owner): for a member's first 12 months, half of that member's makers' share goes to the maker who brought them, however the member plays. A member is brought by a maker when their last arrival before paying was through that maker's page or one of that maker's game links. It is a fact from the link, never typed, recorded from launch day. With no bringing maker, or after 12 months, there is no bonus.
  - Owner, 2026-11-13: an arrival has no time limit. The last arrival before paying counts, however long ago it was; its time is still recorded.
  - Owner, 2026-11-13: only the first join counts. The bonus covers a person's first 12 months on Ruken, once, for the maker who brought their first membership. Joining again later through another maker starts nothing new.
  - Owner, 2026-11-13: no bonus on yourself. A maker who arrives through their own link and pays gets no bonus on their own membership, the same as playing their own game.
- **The rest of the makers' share** (Owner): divided among the games that member played that month, by play time, counting at most 180 minutes per member, per game, per day. Call: the day is the America/Chicago day, like every money date. A member who played nothing that month: their makers' share follows everyone else's play that month, as in the carried code.
- **What never counts toward pay** (Owner): free play (FloorFifty on launch day, play on a free code), staff play, and a maker playing their own game. Free play is still counted in Ruken's own numbers.
- **Payouts**: statements are final on the 10th and paid on the 15th (the next business day if that is a weekend or holiday), through Stripe Connect. The minimum is $25 (Owner); smaller balances carry forward. The cost of sending a payout (Stripe Connect's monthly fee for an active account, plus its per-payout fee) comes out of that maker's payout and is shown on their statement (Owner). Ruken pays none of it.
- Chargebacks and refunds follow the carried rules.
- **Free-play codes** (Owner): codes are 1 day; members get 3 a month, up to 12 total. A code gives a day of every game, with no card. Ruken can also give codes out. Call: codes are built after launch, since on 30 November the only game is free.
- Call (revised 2026-11-13): a public page shows the split with a worked example, and after each statement the pool, the number of members and what makers received in total, all read from the ledger.
- Call: the first statement is 10 December and the first payout is 15 December. On 30 November Ruken must take payments, record play and record which maker brought each member. The code that works out the pool, statements and payouts lands after launch and before 10 December.
- Not carried: tips, the store, the ad pool, contributor splits.

## 7. How it is built

All of this section is Call, except where it says Owner.

### 7.1 One app, in feature folders

One SvelteKit app, laid out as the workflow's rules say (src/features/&lt;feature&gt;/, tests only in tests/, imports only go down). It uses what the old repository used, at the versions pinned there: Node 24, pnpm, SvelteKit 3 and Svelte 5, Postgres 16 with Prisma, Stripe, better-auth, Vitest, Testing Library and Playwright. No dependency is added that the old repository did not already pin, without the Owner's words.

The features, lowest first. The plan may adjust the names, not the rule.

| Feature | Its job |
|---|---|
| accounts | sign-in, sessions, staff roles, delete my account |
| membership | the subscription: checkout, Stripe webhooks, "is this person a member" |
| games | a game, its clips, its files, pulling from GitHub, its state (waiting, live, sent back, taken down) |
| play | the game frame, the play pass, play time |
| money | the pool, statements, payouts, Stripe Connect |
| pages | the maker's page, links, themes, view and tap counts |
| feed | the feed order, likes, saves, follows, share |
| make | the submit form and the maker's area |
| moderation | reports, take-downs, suspensions |
| admin | the portal's screens over the features above |

The game gate (5.2) is the one piece that runs somewhere else, because a game must not be served from Ruken's own address.

Ruken sends few emails: confirming an address, and telling a maker their game was accepted, sent back or taken down. Stripe sends receipts. The mail service is one of the Owner's accounts (section 9).

### 7.2 What is carried from the old repository

Copied file by file, with tests, into the new layout. Each is trimmed to what the new product uses; code for a cut feature is not copied.

| From | What | Why carry it |
|---|---|---|
| packages/ledger | the Premium pool, postings, statements, payout plan and ID, chargebacks, arithmetic, periods | tested money maths |
| packages/billing | Premium plans, Stripe checkout, webhook, Connect | tested, and Stripe's quirks are already handled |
| apps/web and packages/core/identity | sign-in and sessions | security code |
| apps/game-host | serving a game's files from another address, behind a pass | the security boundary |
| packages/core/catalog/card-video.ts | upright and wide clips, 30 MB each | already exactly this |
| apps/admin and packages/core/admin | staff roles, second-person approval, step-up codes, the money screens | "the admin stuff stays" |
| legal text | terms, privacy, the maker agreement | already written; reviewed for what changed |

Not carried: the SDK and protocol packages, the manifest and validation packages, the ruken command-line tool, the worker's virus scan and headless boot check, the desktop and boot apps, localization, telemetry beyond play time, and n8n.

### 7.3 Where it runs

Owner, 2026-11-13: Cloudflare instead of Netlify. ("Thoughts on switching to Cloudflare and Cloudflare Pages instead of Netlify, that's what we're going with for the AutomataFramework", then "Cloudflare now" when told the cost.) This replaces the first answer, which had Netlify for the app.

- **The app**: one Cloudflare Worker with static assets, built by SvelteKit's Cloudflare adapter. Cloudflare's Workers Builds builds and deploys `main` after each merge and runs the database migrations in its deploy command, which runs only for `main`; nothing is built from a pull request. Call: a Worker with static assets and not Cloudflare Pages, because the daily job (a Cron Trigger) and the build that deploys only `main` are Workers features, and SvelteKit's and Cloudflare's own guides deploy this way.
- **Postgres**: Neon, reached through Cloudflare's Hyperdrive (its connection pool), with Hyperdrive's query cache off. Owner, 2026-11-13: the Hyperdrive configuration's id is committed in the Worker's settings file in the repository; it names a setting in the Owner's account and is not a credential.
- **Game files and clips**: Cloudflare, a Worker and R2 storage, as first proposed.
- **Mail**: Owner, 2026-11-13: Resend's HTTP API, called with plain `fetch` (no SDK). A Worker cannot send over SMTP. Cloudflare's own Email Sending is in beta today; moving to it later is one file.
- **The daily job** (deleting accounts after their 14 days): a Cron Trigger on the app's Worker.
- **Settings and secrets**: typed by the Owner into the Worker's settings in Cloudflare, never into the repository.

There is no server to look after. It needs Cloudflare's Workers Paid plan (Owner, 2026-11-13: $5 a month is OK). Owner, 2026-11-13: the packages for this are approved exactly: add `@sveltejs/adapter-cloudflare` 8.0.2 and `wrangler` 4.156.0; remove `@sveltejs/adapter-netlify` 7.0.1, `nodemailer` 10.0.13 and `@types/nodemailer` 8.0.2. The Hetzner setup in the old repository was never provisioned and is not carried.

### 7.4 Checks

Owner: "we don't run local tests, we do it all in gh cloud runners."

One CI workflow on GitHub-hosted Ubuntu runners: lint, typecheck, unit tests, tests against a real Postgres, and Playwright in a real browser for the journeys in section 8. CI workflow files change only on the Owner's words, quoted in the commit; the first workflow quotes the line above. Forked pull requests get no secrets.

### 7.5 The order of work

Each slice is one cycle of the workflow (plan, plan audit, execution, implementation audit, fixes), on its own small branches. A slice starts only when the one before it is merged and green.

| # | Slice | Ends with |
|---|---|---|
| 0 | Start. The coordinator sets up the new repository: CLAUDE.md, AGENTS.md, this spec, progress.md, the app skeleton and the CI workflow | an empty app, green on main |
| 1 | Accounts and membership. Sign-in, the subscription, the paywall card, deployed to a real address | a stranger can sign up, pay and cancel |
| 2 | Games and play. A game and its clips, the GitHub pull, the game gate, the play pass, play time | a member can play a pulled game, and the time is recorded |
| 3 | The feed and the maker's page. Sections 5.1, 5.3 and 5.6, and the viewer's onboarding (5.7) | the two screens, with real games in them |
| 4 | Submitting and the admin portal. Sections 5.4 and 5.5, without the money screens, and the maker's onboarding (5.7) | a maker submits; staff accept, send back and take down |
| 5 | Money. The pool, statements, payouts and the admin money screens. After launch, before 10 December | the first statement is right |

## 8. What "launched" means on 30 November

Each line is checked by a browser test in CI and once by a person on the real site.

- The site opens straight into the feed, on a phone and on a computer, with the right clip for the screen.
- A stranger signs up, pays with a real card, and is in the game they tapped.
- That member's play time is recorded against that game.
- A member can cancel.
- Someone who has not paid cannot load a game's files.
- A maker signs up, connects GitHub, submits a game, and sees it "Waiting for review".
- Staff accept it, and it appears in the feed and on the maker's page. Staff can send one back and take one down.
- A maker's page shows their games, their links and their chosen colours, at its own short address.
- A report reaches the admin portal.
- Anyone can play FloorFifty without an account.
- A member's sign-up records the maker's link they came through.

## 9. The Owner's own tasks

These are credentials, money and approvals, which are the Owner's.

- Hosting accounts, the mail service and the site's address (7.3).
- Stripe in live mode, and the Connect setup.
- Create the Ruken GitHub App (5.4).
- The first game or games, each with an upright and a wide clip, live on launch day.
- Two superadmin accounts with authenticator apps.

## 10. Left to the plans

- The exact tables, routes and file names, within the layout and the layers of 7.1.
- How the play pass is made and checked, building on the old game host.
- The size limit for a game's files, measured against real games, not guessed.
- How often play time is reported, and the longest gap that still counts, building on the carried rules.
- The rules for a handle, and the words it cannot be (admin, make, me, g and the like).
- The exact list of report reasons and the wording of every screen, each passing the drunk grandma test.
- Which of Wada's combinations pass the readability rule: the code and its test decide.
- Whether the first game runs without the old SDK, checked before slice 2 is planned (section 11).

## 11. Open risks

- **The first game and the SDK.** FloorFifty was built against the old Ruken SDK. This design has no SDK. Whether FloorFifty runs as a plain web game has not been checked.
- **The date.** Slices 1 to 4 in 17 days, each through five stage sessions, is tight. If a slice takes twice what was expected, the stop rule applies and the Owner decides what moves.
- **Tests only in CI.** Every red-then-green round is two pushes and two waits. Plans keep tasks small so a round stays short.
- **The colour data.** The data set is MIT-licensed, and Wada's book dates from 1933 to 1934. The status of the book's plates themselves has not been checked by a lawyer.

