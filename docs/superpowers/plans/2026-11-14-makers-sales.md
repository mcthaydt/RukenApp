# Makers' Sales (Extras and Splits) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A member buys a game's extra (a DLC or a season pass) in one tap and the game unlocks it; a maker adds extras and names who shares a game's money; every person in a split is paid their share of everything the game earns, on a statement of their own.

**Architecture:** One new feature, `extras`, between `launch` and `play`: the catalog, its review states, orders, ownership, and the small file a game reads. Ownership reaches the game gate as a small object in the games bucket, named by the play pass's id, so a purchase never changes a game's address. The money side goes into the existing `money` feature: a sale is split by one pure function (fees and tax are inputs, so a store's sale is the same call), a game's split is a list of add-only facts, and a statement is already one per person because every line sits on a person's own account. An extra is charged as a one-off Stripe invoice paid with the member's saved card, so Stripe's fee report, refunds and disputes are placed by the code that already places a membership payment's.

**Tech Stack:** as slices 1 to 5 (Node 24, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers and R2, `stripe` 22.6.2, `@js-temporal/polyfill` 0.5.1). New from what is already there: Stripe invoices made by Ruken (`invoices.createPreview`, `invoices.create`, `finalizeInvoice`, `pay`), Checkout in `payment` mode, `refunds.create`; Ed25519 through Web Crypto; one text-module rule in the game gate's `wrangler.jsonc`. **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-14-makers-sales-design.md` (approved by the Owner, 2026-11-14: "Approved"; pull request #106). Read it with `CLAUDE.md`, `AGENTS.md`, the apps' spec (`docs/superpowers/specs/2026-11-14-apps-and-player-features-design.md`), the design (`2026-11-13-ruken-reels-linktree-design.md`, sections 5.2, 5.5, 5.8, 6), slice 5's plan (`docs/superpowers/plans/2026-11-14-slice-5-money.md`: "How a task runs", its Calls, and branches E to K, which this plan re-plans), and `docs/superpowers/progress.md`.

**Planned against:** `main` at `5a28504` (the apps' spec merged; the sales spec was read on its own branch at `d821cbd` and merged to `main` as `c66c731` while this was being written, with no change to its text). Read as code: `src/features/play`, `src/features/money`, `src/features/membership`, `src/features/games`, `src/features/pages`, `cloudflare/games`, `prisma/schema`, `tests/architecture.test.ts`. Not read as code, because they are not on `main`: the play screen and the game frame (slice 2's branch F), the maker's area and the staff queue (slice 2's branches M and S), the feed and the maker's page (slice 3's branches C to J), all of slice 4, slice 5's branches E to K, and everything the apps' spec adds. "What this plan relies on" names each piece; if one is not on `main` as named when its task starts, stop and report.

**Not checked, and why.** No test, lint or typecheck ran in the plan session, and no code was written. The `stripe` package is not installed in the plan session, so the Stripe calls named here were not read against its types: Task 13 reads them first and stops if one is missing. Stripe's prices, Apple's refund window and the stores' price lists were not read from their own pages (the session could search but not open a page); each place that depends on one says so and names who reads it.

## Global Constraints

- No session runs tests, lint or typecheck itself. Push, then read CI on the pull request (CLAUDE.md, Owner 2026-11-13).
- Every task is test-first, in two pushes, as slice 1's "How a task runs" says: red (the test and stubs that throw `not built yet`), then green. A pull request opens as a draft at the first push and is marked ready only when its branch's last task is green.
- No new dependency. Anything that seems to need a package is a stop: report it with the exact name and version, for the Owner's yes.
- `.github/workflows/ci.yml` does not change.
- This repository is public. No secret, real address, Stripe id or key goes in; test values are plainly fake. Nothing here says why a business rule is what it is. The reasons behind this plan's choices are in the private repository (`strategy/2026-11-14-makers-sales-plan.md`).
- **Money is whole cents, as `bigint`.** A share is a whole percent from 1 to 100. Nothing is a fraction or a `number`.
- **A sale is split only by pure functions** in `src/features/money/`, each with its tests. A file that reads or writes the database holds no arithmetic beyond adding up what a pure function returned.
- **Ledger facts are only ever added.** `ExtraVersion`, `ExtraPurchase`, `GameSplit`, `GameSplitShare`, `GameSplitAnswer`, `GameSplitStart`, `GameSplitEnd`, `SalePosting`, `SaleShare`, `SaleRefundRequest`, `SaleRefundApproval`, `SaleTakeDown` and every journal row refuse `UPDATE` and `DELETE` with slice 1's `reject_append_only_change('<Table>')`. A wrong fact is corrected by a new one.
- **Nobody types a fact.** A price is picked from a fixed list, a share from a list of whole percents, a season's days on a calendar. No form in this plan has a box where a person types an amount, a count or a rate.
- **Ruken never loses money on a sale, a refund or a dispute**: what Stripe keeps on a refund, and a dispute's fee, come out of the game's earnings (spec 5.7). Task 4's tests check it for every worked case.
- **Games are untrusted.** A game never sees a sign-in, a card, an account id or a handle. It learns only which of its own extras this play's player owns, and whether Ruken's buy card is open. The buy card is drawn by Ruken's page, never inside the game's frame.
- Time comes from an injected `Clock`. Feature code never calls `Date.now()` or `new Date()` with no argument. A season's days and every money date are America/Chicago days, through `CALENDAR_ZONE`.
- Layers: `extras` may import `accounts`, `membership`, `games` and `launch` (and the apps' plan's `people`, once it exists, which sits directly above `accounts`), only through their entry files; nothing in this plan imports `pages`; `play` and `money` import `extras` through `extras.ts`. Tests live only in `tests/`, mirroring `src/`.
- Comments say why, never which plan asked.
- Every screen and message passes the drunk grandma test. The words in this plan are the words to ship; a change to them is a deviation to report. Buttons follow the Owner's rule: the main forward action is blue, the safe way out (Not now, Back, Keep) is green, taking something away is red.
- Ruken's own screens wear the look from `src/lib/look.css` and only its classes. The maker's screens (branches I and J) take their look from the maker screens redesign (pull request #96) once the Owner has said "fine" to it; this plan says what is on each screen, not how it looks.
- Every journey file starts with `test.beforeEach(forgetRateLimits)`, and every new screen is attached with `showTheOwner` for the Owner to see before its branch is marked ready.

## What this plan relies on

| Piece | From | Used for |
|---|---|---|
| `checkPass`, `makePass`, `PassClaims`, `passFor`, `startPlay`, `PlayBasis`, `handleGameRequest`, `GateDeps` | slice 2 (on `main`) | the owned file and protected folders |
| `FileStore` (`head`, `get`, `put`, `delete`), `r2FileStore`, `MemoryFileStore`, `normalizePath` | slice 2 (on `main`) | the owned object in the bucket |
| `Game`, `LiveGame`, `gamesServices()`, `checkGameFiles`, the tiny game fixture | slice 2 (on `main`) | whose extra it is; reserved folders |
| `premiumAccess`, `membershipServices()` (`stripe`, `verify`, `receive`), `BillingCustomer`, `PremiumMembership`, `dollars`, `longDate`, the webhook inbox | slice 1 (on `main`) | who may buy; the one Stripe client |
| `User.adultOn`, `Caller`, `signedInOnly`, `staffRolesOf`, `purgeDueAccounts`, `Mailer`, `createRateLimiter` | slice 1 (on `main`) | minors, sign-in, mails, limits |
| `lrr`, `postEntry`, `lockLedger`, `postingPeriod`, `reversePaymentLines`, `reverseOpenedEntry`, `readReversals`, `postReversals`, `postFeeRows`, `placeFee`, `sharePool`, `postPoolShares`, `writeStatements`, `buildStatement`, `runMoneyJob`, `PlayDay` | slice 5, branches A to D (on `main`) | everything the ledger does with a sale |
| `photoProblem`, `looksLikePhoto`, the media address's `PHOTO_KEY` rule in the gate | slice 3, branch G (on `main`) | an extra's picture |
| The play screen `/g/<game>/play`, the game frame and its ← control, `tests/browser/support/game.ts` (`addGame`) | slice 2, branch F (not on `main`) | the Extras button, the messages, every journey that plays |
| `/make`, `/make/<game>`, the maker agreement (`src/features/make/`) | slice 2, branch M (on branch `slice-2/submit`) | where the extra form and the split screen hang |
| `staffOnly`, `/admin/games`, the waiting list, a game's review page, taking a game off Ruken | slice 2, branch S; slice 4, branches B, D and L (not on `main`) | the extras queue; a game that leaves |
| `freshCodeOnly`, the finance role, two owners | slice 4, branches A and B (not on `main`) | the staff refund |
| The feed, a game's card, `/<handle>` | slice 3, branches D and H (not on `main`) | the way to a game's page |
| A handle for every account and "account by handle", in `accounts`; "may A reach B" (blocking), in the new feature `people`, directly above `accounts`; a game's rating and "may this person see this game"; "an extra went on sale" (the opt-in notification); the reviews summary and list | the apps' plan (`docs/superpowers/plans/2026-11-14-apps-slices.md`; seams agreed with its plan thread, and placed by its plan audit, 2026-11-14) | split invites; hiding extras by age; telling followers; the game's page |
| The maker agreement, version 2, and the refunds page's words | the coordinator, with pull request #104 | what a maker and a person in a split agree to |

## The Owner's decisions, and the Calls in this plan

The Owner's decisions are quoted in the spec, section 2, and are not repeated here. This plan adds none and reopens none.

**Calls** (mine; the Owner can overrule any of them):

- **How the gate learns what a pass's player owns** (spec 8). The site writes a small object into the games bucket at `owned/<pass id>.json` whenever it hands out a pass and whenever that person's ownership of that game changes. The gate, which already reads the bucket and nothing else, reads that object for two things only: the file the game asks for at `/<pass>/__ruken/owned.json`, and any file under `ruken-extras/<extra>/`. A pass's address never changes, so the browser keeps the 90 MB it has. No database, no new binding, no call from the gate to the site.
- **The names** (spec 8). The owned file is `/<pass>/__ruken/owned.json`. An extra's protected folder is `ruken-extras/<the extra's id>/` at the top of the game's folder. The script is at `/__ruken/hooks.js` on every game address. The messages are `extras.buy`, `extras.card` and `extras.owned`. A game's page is `/g/<game>/about`. `__ruken` and `ruken-extras` are folders a game cannot use for anything else.
- **An extra's id** is made from its first name (`level-pack-2`: lower-case letters and digits in runs joined by hyphens, 3 to 40 characters), is unique in its game, and never changes, whatever the extra is renamed to.
- **A change in review.** An extra has a live version and, at most, one version waiting. Buyers see and pay for the live one until staff accept the other.
- **Who owns what while testing.** A game's maker playing their own game, and staff, are handed every extra of that game, so they can see it unlock. Each can also play with none. Neither is a purchase and neither reaches the ledger.
- **A maker cannot buy their own game's extra.** The button reads "Yours ✓".
- **An extra is paid with a Stripe invoice made on the spot.** The amount with tax is read from Stripe before the tap; the tap pays it with the card the membership uses. A card that needs the bank's check, a refusal, or no saved card goes to Stripe's own payment page and comes back.
- **The split of a sale.** What is left after tax and fees is the game's 70%, rounded down, and Ruken's is the rest (Owner, 2026-11-14, on the odd cent of a membership payment: "Ruken"). The game's part is shared among the people in its split by one largest-remainder rounding, so the parts always add up.
- **A later fee, a refund and a dispute are "split like the sale"**: by the percents of the split that was in force at that sale, which are kept with the sale.
- **A split and the pool.** Play is counted by the Chicago day, so a split that starts during a day counts for the pool from that whole day. For a sale it counts from the moment it starts.
- **A split with nobody's row** is the game's maker at 100%. No game needs a row to be made for it.
- **A person in a split says yes on a page of their own**, signed in. The maker who proposes has said yes by proposing. One proposal can wait per game; a new one takes the old one's place.
- **A refund is the whole purchase.** Staff never refund part of an extra. A part refund made by hand in Stripe is still posted, in proportion.
- **A refund or an open dispute takes the extra back**; a dispute that is won gives it back.
- **The 14 days before a game leaves** are 14 times 24 hours before the moment it left.
- **Column names stay.** `makerUserId` on the ledger's tables now means "the person the line belongs to": a maker, or someone in a game's split. Renaming add-only tables would change every trigger and test for no person's benefit.

## Questions for the Owner

**Q1. How long is a sale held when Apple never answers?** (spec 10; asked 2026-11-14.) After a game leaves, people who bought an extra through Apple in the 14 days before are sent to Apple's refund page, and the game's earnings from those sales are held. Apple tells Ruken when it refunds one. It does not always say when nobody asks.

- a) **Recommended.** Hold until Apple says it refunded or refused, or until 97 days after the purchase, whichever comes first. That is Apple's time to ask for a refund (90 days, to be read from Apple's own page before this is built) and a week for its notice to arrive. Then the money is paid on the next statement.
- b) Hold for 60 days. The money comes sooner; a later Apple refund comes off that person's later earnings.
- c) Hold until Apple answers, however long. Money for a sale nobody asked about would never be paid.

The plan's pick is (a). Nothing in this plan builds the hold: no Apple sale can exist before the apps do. "Settled for the apps' plan", below, says exactly what is built then.

## What the Owner holds, outside this plan

- **The maker agreement, version 2**, with selling and splitting in it, read by a lawyer before the first payout (spec 10). Branches I and J stop before they are marked ready if the coordinator has not supplied its text.
- **Who is the seller for tax**, confirmed by an accountant (spec 10). The plan charges tax through Stripe Tax as the membership does.
- **FloorFifty's two small changes** (the script, and unlocking by the owned list), in FloorFifty's own repository on the other account (spec 5.4).
- **One command, before branch D is deployed** (M-S1, below).

## Where execution stops and waits

Each line the Owner pastes is one command, for the Mac first and Windows PowerShell second. Words in CAPITALS are the Owner's own values and are never written in the repository.

**M-S1, before branch D is deployed: the key that signs the owned note.** It is a secret of the site and never of the gate.

- Mac: `openssl genpkey -algorithm ed25519 -outform DER | base64 | tr -d '\n' | pnpm dlx wrangler@4.156.0 secret put OWNED_NOTE_KEY --name ruken`
- Windows PowerShell: `$k = [Convert]::ToBase64String((openssl genpkey -algorithm ed25519 -outform DER)); $k | pnpm dlx wrangler@4.156.0 secret put OWNED_NOTE_KEY --name ruken; Remove-Variable k`

Neither line was run in the plan session. PowerShell can alter binary output passed between programs, so the Windows line is the one to distrust: Task 9's start check refuses a key it cannot read, with the setting's name, and the first deploy is the proof. One more, the same day, so yesterday's owned objects leave the bucket by themselves. It was not run either, and its exact words were not checked against wrangler 4.156.0's own help; execution reads `wrangler r2 bucket lifecycle add --help` in CI's log before the Owner is handed the line, and corrects it here if it differs:

- Mac and Windows: `pnpm dlx wrangler@4.156.0 r2 bucket lifecycle add ruken-games owned-files owned/ --expire-days 2`

**M-S2, before branch E is marked ready: the first real read of a one-off invoice's fees.** In Stripe's test mode, execution pays one extra and reads the invoice's balance transaction. Then, once branch F is on `main` and a live sale exists, the Owner runs slice 5's M1 line again and pastes the answer. What is checked: every fee Stripe charges on that invoice (card, Tax, and any fee for the invoice itself) either sits on the payment's own balance transaction or arrives in the fee report naming the invoice, the charge or the payment intent. **If a fee for these sales arrives naming nothing**, stop: it would not come off the top, and that is the Owner's decision.

**M-S3, before branch E starts: the saved card.** Task 13's first step reads, in Stripe's test mode, where a membership bought through Checkout keeps its card (on the subscription or on the customer), and reports it. The plan assumes the subscription.

## How a task runs

As slice 1's plan, word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers and the progress percentage, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved. A migration is written by hand in Prisma's own style when the session has no Prisma command line; CI's drift check is the proof. A new value of a Postgres enum goes in a migration of its own, before the migration that first uses it.

## Branches

Fourteen branches. Each starts from `main` only after what it needs is merged and green; at most five pull requests are open at once. A to D need only `main` and can start now; A and B can run side by side, and so can C and D.

| # | Branch | Tasks | Needs on `main` | Ends with |
|---|---|---|---|---|
| A | `sales/extras-rules` | 1 to 3 | nothing more | the `extras` feature: its rules, its tables, and an extra's life from draft to on sale |
| B | `sales/sale-rules` | 4 to 6 | nothing more | a sale, a later fee, a refund and a dispute split by pure functions; a pool share split among people; one sale worked through by hand |
| C | `sales/splits` | 7, 8 | nothing more | a game's split as facts: proposed, answered, started, in force at any moment |
| D | `sales/owned` | 9 to 11 | A | the owned object and its signed note; the gate serves the owned file, guards `ruken-extras/`, and serves the script; the script and the message reader (then M-S1) |
| E | `sales/orders` | 12 to 14 | A, D; M-S3 | an order, Stripe's part, and buying: quoted, paid once, owned at once (then M-S2) |
| F | `sales/ledger` | 15 to 19 | B, C, E | sales, their fees, refunds and disputes posted by the daily job; the pool shared by split; statements with a game's sales on them |
| G | `sales/game-page` | 20, 21 | E; slice 2's F; slice 3's D and H | `/g/<game>/about` and the buy card |
| H | `sales/in-game` | 22, 23 | G | the Extras button, and a game that opens the buy card |
| I | `sales/maker-extras` | 24, 25 | A; slice 2's M; #96 with the Owner's "fine" | the extra form, and the page that tells makers how a game uses extras |
| J | `sales/split-screens` | 26, 27 | C; slice 2's M; the apps' plan's handles; #96 | the split screen, the yes-or-no page, the mails |
| K | `sales/staff` | 28, 29 | A, E; slice 2's S; slice 4's A and B | extras in the staff queue; the staff refund |
| L | `sales/take-down` | 30, 31 | F; slice 4's D | a game that leaves refunds its last 14 days; a deleted account's extras |
| M | `sales/money-screens` | 32 | F; slice 5's F and H | a person's money page and the staff month show sales and splits |
| N | `sales/real-site` | 33 | all of the above | the spec's five "launched" lines, in journeys and on the real site |

## File map

```
prisma/schema/extras.prisma              Extra, ExtraVersion (branch A); OwnedFile (branch D); ExtraOrder, ExtraPurchase (branch E)
prisma/schema/money.prisma               GameSplit, GameSplitShare, GameSplitAnswer, GameSplitStart, GameSplitEnd (branch C);
                                         SalePosting, SaleShare, new entry kinds and statement sources (branch F);
                                         SaleRefundRequest, SaleRefundApproval (branch K); SaleTakeDown (branch L)
tests/architecture.test.ts               FEATURE_ORDER gains "extras" after "launch"                  (branch A)
src/lib/files/picture.ts                 looksLikePicture, pictureProblem: moved out of pages/photo.ts (branch A)
cloudflare/games/wrangler.jsonc          one rule: *.browser.js files are bundled as text             (branch D)
cloudflare/games/worker.ts               hands the gate the script's text                              (branch D)
src/features/extras/
  extras.ts              entry
  rules.ts               the price list, the limits, the countries that need the tick
  key.ts                 extraKeyFrom(name): the id a game uses
  season.ts              a season's days: running, over, how they read
  standing.ts            standingOf(extra, today): the one word a maker and a buyer see
  service.ts             add, change, send, take off; accept, send back
  owned-note.ts          signOwnedNote, checkOwnedNote, publicKeyOf
  owned.ts               ownedKeysFor, writeOwned, refreshOwned
  stripe-port.ts         ExtrasStripe: savedCard, quote, payNow, payPage, paidInvoice, voidOrder, refund
  orders.ts              quoteExtra, buyExtra, settleOrder, revokePurchase, restorePurchase
  views.ts               extrasOf(game, viewer): what the game's page and the Extras card read
  mails.ts               the confirming email; accepted, sent back, taken off sale
  services.ts            built once from the settings
src/features/play/
  gate.ts                the owned file, ruken-extras/, /__ruken/hooks.js                              (branch D)
  frame-messages.ts      readGameMessage, isFromGame                                                   (branch D)
  ruken-hooks.browser.js the one script a maker adds to their game                                     (branch D)
  sessions.ts            startPlay writes the pass's owned object                                      (branch D)
src/features/games/files-check.ts        a pull with a top folder `__ruken` is refused                (branch D)
src/features/money/
  rules.ts               SALE_GAME_SHARE_BPS, MAX_SPLIT_PEOPLE, TAKE_DOWN_REFUND_DAYS
  sale-split.ts          splitSale, shareAmong                                                         (branch B)
  sale-posting.ts        postSale, postSaleFee, postSaleRefund, postSaleDisputeOpened, postSaleDisputeWon (branch B)
  pool-people.ts         peopleWeights: a game's pool share among the people of its splits             (branch B)
  split-rules.ts         splitProblem: what is wrong with a list of shares                             (branch C)
  splits.ts              proposeSplit, answerSplit, withdrawSplit, splitInForce, splitsOver, pendingSplit (branch C)
  split-mails.ts         the invitation, the change                                                    (branch C)
  sales.ts               postUnpostedSales                                                             (branch F)
  sale-refunds.ts        requestSaleRefund, approveSaleRefund (branch K); refundSalesOfGameThatLeft, finishTakeDownRefunds (branch L)
  fees.ts, reversals.ts, pool-run.ts, pool-posting.ts, statement.ts, statements.ts, daily.ts          changed (branch F)
src/routes/
  .well-known/ruken-owned-key/+server.ts          the public key a game's server checks the note with (branch D)
  g/[game]/about/                                 a game's page                                        (branch G)
  g/[game]/extras/[extra]/quote, /buy, /back      the buy card's three addresses                       (branch G)
  make/[game]/extras/, make/[game]/add-extra/, make/[game]/extras/[extra]/  a game's extras and the form (branch I)
  make/hooks/                                     how a game uses extras                               (branch I)
  make/[game]/split/                              who shares a game's money                            (branch J)
  me/splits/[split]/                              say yes or no                                        (branch J)
  admin/extras/[extra]/                           staff check an extra                                 (branch K)
  admin/money/refunds/                            the staff refund                                     (branch K)
tests/support/extras.ts                  addExtra, anOwnedExtra, a key pair for the note
tests/support/fake-extras-stripe.ts      an ExtrasStripe in memory
tests/fixtures/tiny-game/                gains the script tag, a button that asks for the buy card, and ruken-extras/level-pack/secret.txt
tests/features/extras/…, tests/features/money/…, tests/features/play/…   mirror src/
tests/browser/buy-extra.test.ts, game-page.test.ts, in-game-extras.test.ts, maker-extras.test.ts, game-split.test.ts, staff-extras.test.ts, take-down-refund.test.ts, sales-launched.test.ts
```

## Review Focus

Each line names an input the spec implies and no ordinary test would meet. Each has its test in the task named.

1. Buy pressed twice, or in two tabs at once: one order, one charge, one purchase (Tasks 12, 14).
2. Stripe took the money and the answer was lost: the next press, the return page or the webhook finds the paid invoice and never charges again (Task 14).
3. A pass made before the purchase: its address is unchanged, the owned file changes within the same request that paid, and `ruken-extras/<extra>/` opens under it (Tasks 10, 14).
4. A pass of game A used to ask for game B's extra, an extra id with `..` or a slash in it, a pass with no owned object at all, and an owned object that is not JSON: "Not found.", never an error and never a file (Task 10).
5. A message that claims to be from the game but comes from another window or another address, a message naming an extra the game does not have, and a game that sends a thousand messages a second: ignored; nothing is charged without the person's own tap on Ruken's card (Tasks 11, 23).
6. A sale whose fees are more than what is left after tax: the game's part is nothing, never less than nothing, and the entry still adds up (Task 4).
7. A split of three at 33, 33 and 34 on a sale that leaves one cent: one person gets the cent, the same person every time, and the parts add up (Task 4).
8. A split that changes between a sale and its refund: the refund comes off the people who were paid for that sale, not the people in the split now (Tasks 4, 17).
9. A refund or dispute larger than a person has earned: their balance goes below zero and carries; nothing is taken from Ruken's part and nobody else's (Tasks 17, 19).
10. A split that changes in the middle of a month, and a game with no split row at all: the pool share follows the play of each split's days, and the game with no row pays its maker exactly what it paid before this plan (Tasks 5, 18).
11. Someone proposes a split with a person who is under 18, deleted, or not on Ruken; with the same person twice; with shares that add up to 99: each refused with words, and the first three with the same words (Tasks 7, 8).
12. A person says no, or never answers: the old split stays in force for every sale meanwhile (Task 8).
13. A season pass on its last day in Chicago, bought at 23:59 there by someone whose own clock says tomorrow: sold. One minute later: not sold, and the press says the season is over (Tasks 1, 14).
14. An extra changed while a buyer has the card open: they pay the price they were shown or are shown the new one first, never a price they did not see (Task 14).
15. A member whose membership ended a minute ago, a member under 18 with no guardian tick, and a buyer in the EU with no tick: refused, and nothing is charged (Task 14).
16. A game that leaves with a purchase 13 days and 23 hours old and one 14 days and 1 hour old: the first is refunded once, however often the job runs; the second stays sold (Task 30).

---

# Branch A: `sales/extras-rules`

### Task 1: The feature, its rules, an extra's id, a season's days, an extra's standing

**Files:**
- Create: `src/features/extras/extras.ts`, `rules.ts`, `key.ts`, `season.ts`, `standing.ts`, `src/lib/files/picture.ts`
- Modify: `tests/architecture.test.ts` (`FEATURE_ORDER`: `"extras"` after `"launch"`), `src/features/pages/photo.ts` (its first-bytes check and size words now call `src/lib/files/picture.ts`; its own tests stay green unchanged)
- Test: `tests/features/extras/rules.test.ts`, `key.test.ts`, `season.test.ts`, `standing.test.ts`, `tests/lib/files/picture.test.ts`

**Interfaces (produces):**
- `rules.ts`: `EXTRA_PRICES_CENTS: readonly bigint[] = [99n, 199n, 299n, 399n, 499n, 799n, 999n, 1499n, 1999n, 2999n, 4999n]` (spec 5.5); `MAX_EXTRAS_ON_SALE = 20`; `MAX_SEASON_DAYS = 365`; `EXTRA_NAME_MAX = 40`; `EXTRA_LINE_MAX = 80`; `WAIVER_COUNTRIES: ReadonlySet<string>` (the 27 countries of the European Union and `GB`, as two-letter codes, with the comment that their law gives a buyer 14 days unless they ask for the thing at once); `isExtraPrice(cents: bigint): boolean`.
- `key.ts`: `extraKeyFrom(name: string): string | null` (lower-case, every run of other characters becomes one hyphen, hyphens trimmed from the ends, cut to 40; null when fewer than 3 characters are left); `isExtraKey(text: string): boolean` (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3 to 40).
- `season.ts`: `type Season = { firstDay: string; lastDay: string }` (`YYYY-MM-DD`, Chicago days); `seasonProblem(season: Season, today: string): string | null`, the first that applies: "Pick the first day." / "Pick the last day." when one is not a real date; "The last day can't be before the first." ; "A season can be up to 365 days."; "The first day can't be in the past."; `seasonIs(season: Season | null, today: string): "none" | "not_yet" | "running" | "over"`; `seasonEndsWords(season: Season): string` ("Ends 31 January", with the year added when it is not this Chicago year); `endsAtMs(season: Season): number` (the first instant of the Chicago day after `lastDay`, for a page that shows the end in the buyer's own time with `<time datetime>`).
- `standing.ts`: `type Standing = "draft" | "waiting" | "on_sale" | "sent_back" | "season_over" | "taken_off"`; `standingOf(extra: { liveVersion: { season: Season | null } | null; takenOffAt: Date | null; pending: { sentBackReason: string | null } | null }, today: string): Standing` (taken off wins; then a live version whose season is over; then live; then a pending version sent back; then pending; else draft); `STANDING_WORDS: Record<Standing, string>` = "Not sent yet", "Waiting for review", "On sale", "Sent back", "Season over", "Taken off sale"; `changeWords(extra): string | null` for a live extra with a version pending: "A change is waiting for review." or "Your change was sent back: <reason>".
- `src/lib/files/picture.ts`: `PICTURE_TYPES`, `looksLikePicture(bytes, contentType)`, `pictureProblem(upload, { maxBytes, noun })`: the bodies now in `pages/photo.ts`, with the noun ("photo", "picture") passed in.

- [ ] **Step 1 (red):**

```ts
it("lists exactly the spec's prices, lowest first", () => {
  expect(EXTRA_PRICES_CENTS).toEqual([99n, 199n, 299n, 399n, 499n, 799n, 999n, 1499n, 1999n, 2999n, 4999n]);
  expect(isExtraPrice(100n)).toBe(false);
});
it("makes the id a game uses from the name", () => {
  expect(extraKeyFrom("Level Pack 2")).toBe("level-pack-2");
  expect(extraKeyFrom("  Season 1: Pass!  ")).toBe("season-1-pass");
  expect(extraKeyFrom("!!")).toBeNull();
  expect(isExtraKey("../secret")).toBe(false);
});
it("sells a season through its last Chicago day and not a minute after", () => {      // Review Focus 13
  const season = { firstDay: "2026-12-01", lastDay: "2027-01-31" };
  expect(seasonIs(season, "2027-01-31")).toBe("running");
  expect(seasonIs(season, "2027-02-01")).toBe("over");
  expect(seasonIs(season, "2026-11-30")).toBe("not_yet");
  expect(seasonEndsWords(season)).toBe("Ends 31 January 2027");
});
it("refuses a season of 366 days and takes one of 365", () => {});
it("says one word for where an extra stands", () => { /* one case per Standing, and both changeWords */ });
it("puts WAIVER_COUNTRIES at 28 codes, with GB and without US", () => {});
```

  Stubs. Push. Expected: `verify` fails in the five new files with `not built yet`; the architecture test passes (the folder is in the order).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, and `tests/features/pages/photo.test.ts` passes unchanged.

### Task 2: The extras tables

**Files:**
- Create: `prisma/schema/extras.prisma`, `prisma/migrations/<timestamp>_extras/migration.sql`
- Modify: `prisma/schema/games.prisma` and `accounts.prisma` (the relation fields only)
- Test: `tests/features/extras/schema.pg.test.ts`

| Model | Columns |
|---|---|
| `Extra` | `id`, `gameId` (a `Game`, `onDelete: Restrict`), `key`, `kind ExtraKind { dlc, season_pass }`, `liveVersionId?` unique, `pendingVersionId?` unique, `pendingReason?` (staff's words when the pending version was sent back), `sentAt?` (when it joined the staff queue; null once decided), `takenOffAt?`, `createdAt`, `updatedAt`; unique on (`gameId`, `key`). It is the maker's and staff's to move, so it is not add-only. |
| `ExtraVersion` | `id`, `extraId`, `name`, `oneLine`, `pictureKey` (`extras/<game public id>/<16 hex>.<jpg\|png\|webp>`), `priceCents BigInt`, `seasonFirstDay? @db.Date`, `seasonLastDay? @db.Date`, `createdAt`. Added and never changed: what staff accepted is what is sold. |

In the SQL, by hand: CHECK `Extra_key_check` (the shape and lengths of `isExtraKey`); `ExtraVersion_price_check` (`"priceCents" IN (99, 199, 299, 399, 499, 799, 999, 1499, 1999, 2999, 4999)`); `ExtraVersion_name_check` (1 to 40 after trimming) and `ExtraVersion_oneLine_check` (1 to 80); `ExtraVersion_season_check` (both days or neither, and the last not before the first); `ExtraVersion_pictureKey_check` (the pattern); the add-only trigger on `ExtraVersion`.

- [ ] **Step 1 (red):** one case per CHECK (a price of 100 rejects, 99 inserts; one season day without the other rejects; a key `../x` rejects); two extras of one game cannot share a key and two games can; an `ExtraVersion` cannot be updated or deleted. Push. Expected: `postgres` fails: the tables do not exist; the drift check fails.
- [ ] **Step 2 (green):** the schema and the migration. Push. Expected: all pass.

### Task 3: An extra's life

**Files:**
- Create: `src/features/extras/service.ts`, `services.ts`, `tests/support/extras.ts`
- Modify: `src/features/extras/extras.ts`, `src/features/play/gate.ts` (the media address also serves a key of the shape `extras/<10>/<16 hex>.<jpg|png|webp>`, by a pattern written out there as the clip's and the photo's are), `tests/features/play/gate.test.ts` (that case, and that the gate's pattern and `extras`' agree)
- Test: `tests/features/extras/service.pg.test.ts`

**Interfaces (produces), from `createExtrasService(deps: { db; clock; files: FileStore })`:**
- `addExtra(input: { gameId; makerUserId; kind; name; oneLine; picture: { contentType: string; bytes: Uint8Array }; priceCents: bigint; season: Season | null }): Promise<{ extraId: string; key: string }>`: the game is this maker's (else `ExtraError("NOT_FOUND")`); the key is `extraKeyFrom(name)`, with `-2` to `-9` added when taken; a season pass has a season and a DLC has none; the picture passes `pictureProblem` (5 MB) and is stored; one `Extra` in draft with its first `ExtraVersion` as `pendingVersionId`. Refusals carry words: "Give it a name.", "Say what it is in one line.", "Pick a price.", the season's and the picture's own.
- `changeExtra(input: { extraId; makerUserId; name; oneLine; picture: … | null; priceCents; season }): Promise<void>`: a new `ExtraVersion` becomes `pendingVersionId` (taking the place of one not yet accepted); the live version is untouched; `pendingReason` is cleared. The kind and the key never change.
- `sendForReview(input: { extraId; makerUserId }): Promise<void>`: the game is live (else "Your game has to be live before its extras can go on sale."); a pending version exists; fewer than `MAX_EXTRAS_ON_SALE` of the game's extras are on sale or waiting (else "A game can have up to 20 extras."). The extra's `pendingReason` is cleared and it joins the queue (`waitingExtras`, below).
- `takeOffSale(input: { extraId; makerUserId }): Promise<void>`: sets `takenOffAt`, at once, no staff step; buyers keep it. `putBack` clears nothing by itself: the maker changes or re-sends it and staff accept it again, which clears `takenOffAt`.
- `acceptExtra(input: { extraId; staffUserId }): Promise<{ wentOnSale: boolean }>`: the pending version becomes the live one; `takenOffAt` is cleared; `wentOnSale` is true when the extra had no live version before or was off sale. A season whose first day has passed while it waited is refused: "The season's first day has passed. Send it back for new dates."
- `sendExtraBack(input: { extraId; staffUserId; reason: string }): Promise<void>`: 1 to 500 characters of reason, kept in `pendingReason`.
- `waitingExtras(): Promise<…[]>`, oldest first: every extra with a pending version, no `pendingReason`, that was sent (`sentAt`, set by `sendForReview` and cleared by a decision); and `extrasOfGame(gameId)` for the maker's list.
- A draft extra that was never on sale can be removed by its maker (`removeDraft`); anything that was ever accepted cannot.

- [ ] **Step 1 (red):** the cases above, each refusal with its words, and: a change to a live extra leaves the live version on sale and sold at its old price until staff accept (spec 5.5); another maker's extra is `NOT_FOUND`; the 21st extra is refused; taking off sale needs no staff and keeps `liveVersionId`; `acceptExtra` answers `wentOnSale: true` the first time and `false` for an accepted change. Stubs. Push. Expected: `postgres` fails in `service.pg.test.ts`; `verify` fails the new gate case.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch A is ready to merge.

---

# Branch B: `sales/sale-rules`

### Task 4: A sale, a later fee, a refund and a dispute

**Files:**
- Create: `src/features/money/sale-split.ts`, `sale-posting.ts`
- Modify: `src/features/money/rules.ts`
- Test: `tests/features/money/sale-split.test.ts`, `sale-posting.test.ts`, `rules.test.ts` (add the new numbers)

**Interfaces (produces):**
- `rules.ts`: `SALE_GAME_SHARE_BPS = 7000` (the spec's "26. 30%" beside it); `MAX_SPLIT_PEOPLE = 10`; `TAKE_DOWN_REFUND_DAYS = 14`.
- `sale-split.ts`:
  - `interface Share { readonly userId: string; readonly percent: number }`.
  - `shareAmong(total: bigint, shares: readonly Share[]): Map<string, bigint>`: `lrr` with the percents as weights and the account ids as keys. Throws unless the percents are whole, each 1 to 100, add up to 100, and no id is there twice.
  - `splitSale(sale: { gross: bigint; tax: bigint; fees: bigint }, shares: readonly Share[]): { left: bigint; game: bigint; ruken: bigint; people: Map<string, bigint> }`: `left` is `gross − tax − fees`, or 0 when that is below 0; `game` is `left × 7000 / 10000`, rounded down; `ruken` is `left − game`; `people` is `shareAmong(game, shares)`.
- `sale-posting.ts`, pure, each answering `PostingLine[]` that add up to zero. Accounts: `platform:stripe_clearing`, `platform:processor_fees`, `platform:tax_payable` (as a membership payment uses them), `platform:revenue:sales` (Ruken's part of sales), and `maker:<userId>:payable`. A sale from a store uses `platform:store_clearing:<source>` for its cash; `cashAccount(source)` picks it, and only `stripe` is posted by this plan.
  - `postSale(sale: { source: PurchaseSource; gross; tax; fees }, shares): PostingLine[]`: cash `gross − fees`; the fees as an expense; the tax held apart; each person their part; Ruken `gross − tax − game`. So Ruken's part after its expense is `ruken`, as a membership payment's half is.
  - `postSaleFee(sale: { source; gross; tax; feesBefore: bigint }, fee: bigint, shares): PostingLine[]`: the game gives up `splitSale(before).game − splitSale(after).game`, shared with `shareAmong`; Ruken's revenue gives up the rest of the fee; cash goes down by the fee.
  - `postSaleRefund(input: { source; saleLines: readonly PostingLine[]; gross: bigint; amount: bigint; feesKept: bigint; shares }): PostingLine[]`: `reversePaymentLines(saleLines, amount, gross)` undoes the sale and its later fees in proportion (Ruken's part and its expense go back; the tax goes back; each person's part goes back); then `feesKept` (what Stripe did not give back, in the same proportion) is taken from the people with `shareAmong`; cash goes down by `amount` less what Stripe returned.
  - `postSaleDisputeOpened(input & { disputeFee: bigint })`: the refund's lines, and the dispute's fee taken from the people the same way.
  - `postSaleDisputeWon(opened: readonly PostingLine[], reinstated: bigint, shares): PostingLine[]`: `reverseOpenedEntry`, with what Stripe did not give back taken from the people.

- [ ] **Step 1 (red):**

```ts
const SIXTY_FORTY = [{ userId: "a", percent: 60 }, { userId: "b", percent: 40 }];

it("takes tax and fees off the top, then 70% to the game and the rest to Ruken", () => {
  expect(splitSale({ gross: 99n, tax: 0n, fees: 33n }, [{ userId: "a", percent: 100 }]))
    .toEqual({ left: 66n, game: 46n, ruken: 20n, people: new Map([["a", 46n]]) });
  const sale = splitSale({ gross: 323n, tax: 24n, fees: 39n }, SIXTY_FORTY);
  expect(sale).toMatchObject({ left: 260n, game: 182n, ruken: 78n });
  expect([...sale.people]).toEqual([["a", 109n], ["b", 73n]]);
});
it("gives the game nothing, never less, when the fees are more than what is left", () => {   // Review Focus 6
  expect(splitSale({ gross: 99n, tax: 0n, fees: 120n }, SIXTY_FORTY)).toMatchObject({ left: 0n, game: 0n, ruken: 0n });
  expect(sum(postSale({ source: "stripe", gross: 99n, tax: 0n, fees: 120n }, SIXTY_FORTY))).toBe(0n);
});
it("gives the one cent to the same person every time", () => {                               // Review Focus 7
  const three = [{ userId: "a", percent: 33 }, { userId: "b", percent: 33 }, { userId: "c", percent: 34 }];
  expect([...shareAmong(1n, three)]).toEqual([["a", 0n], ["b", 0n], ["c", 1n]]);
});
it("always adds up: every price, every tax from 0 to 25%, fees from 0 to the price, splits of 1 to 10", () => {
  /* a fixed sweep, the same cases every run: game + ruken === left; the people's parts add up to game; ruken >= 0; ruken*7 >= game*3 - 7 */ });
it("refuses shares that do not add up to 100, a share of 0, and one person twice", () => {});
it("posts a sale that adds up, with each person's part on their own account", () => {
  expect(byAccount(postSale({ source: "stripe", gross: 323n, tax: 24n, fees: 39n }, SIXTY_FORTY))).toEqual({
    "platform:stripe_clearing": 284n, "platform:processor_fees": 39n, "platform:tax_payable": -24n,
    "platform:revenue:sales": -117n, "maker:a:payable": -109n, "maker:b:payable": -73n });
});
it("takes a later fee of 2 cents from the game and Ruken as if it had been known", () => {
  // left 260 becomes 258; the game's part 182 becomes 180; the 2 cents are shared 1 and 1; Ruken's part stays 78
  expect(byAccount(postSaleFee({ source: "stripe", gross: 323n, tax: 24n, feesBefore: 39n }, 2n, SIXTY_FORTY)))
    .toEqual({ "platform:stripe_clearing": -2n, "maker:a:payable": 1n, "maker:b:payable": 1n });
});
it("refunds in full: Ruken's part goes back, and the game carries what Stripe kept", () => {   // spec 5.7
  const lines = [...postSale(…), ...postSaleFee(…)];                    // the two entries above
  expect(byAccount(postSaleRefund({ source: "stripe", saleLines: lines, gross: 323n, amount: 323n, feesKept: 41n, shares: SIXTY_FORTY })))
    .toEqual({ "platform:stripe_clearing": -323n, "platform:processor_fees": -39n, "platform:tax_payable": 24n,
      "platform:revenue:sales": 117n, "maker:a:payable": 133n, "maker:b:payable": 88n });   // 108 + 25 and 72 + 16
});
it("leaves Ruken at exactly zero on a refunded sale and on a lost dispute, for every case of the sweep", () => {});
it("takes a dispute's $15 fee from the people, and gives back all but what Stripe kept when it is won", () => {});
```

  Stubs. Push. Expected: `verify` fails in the two new files and the new rules case.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 5: A game's pool share among people

**Files:**
- Create: `src/features/money/pool-people.ts`
- Test: `tests/features/money/pool-people.test.ts`

**Interfaces (produces):** `peopleWeights(days: readonly { day: string; seconds: number }[], splitOn: (day: string) => readonly Share[]): { userId: string; weight: bigint }[]`: each person's weight is the sum, over the days, of that day's seconds times their percent that day; in account id order; a person whose weight is 0 is left out. The caller shares the game's amount with `lrr` over these weights, so one rounding makes the parts add up.

- [ ] **Step 1 (red):**

```ts
it("follows each split's own days", () => {                                         // Review Focus 10
  const days = [{ day: "2026-12-05", seconds: 6000 }, { day: "2026-12-20", seconds: 4000 }];
  const splitOn = (day: string) => day < "2026-12-11" ? [{ userId: "maker", percent: 100 }]
    : [{ userId: "maker", percent: 60 }, { userId: "b", percent: 40 }];
  expect(peopleWeights(days, splitOn)).toEqual([{ userId: "b", weight: 160_000n }, { userId: "maker", weight: 840_000n }]);
  // so a share of 1000 cents is 840 and 160
});
it("is one person at any weight above zero when the split never changed", () => {});
it("answers nobody for a game nobody played", () => {});
```

  Stub. Push. Expected: `verify` fails in the new file.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 6: One sale, worked through by hand

**Files:**
- Test: `tests/features/money/worked-sale.test.ts`

No code. One test file whose first comment works a sale through in words and numbers a person can follow with a pencil: a $2.99 extra with 24 cents of tax, Stripe's 39 cents, a later fee of 2 cents, a split of 60 and 40, then a refund in full, then the same sale disputed, lost, and (a second case) won. After each step it lists every account's balance, and asserts: the books add up to zero; Ruken's part of the refunded sale is zero; the two people have given back what they got and carried what Stripe kept; nothing touched `platform:revenue:premium` or any `pool:premium:` account.

- [ ] **Step 1:** write it against Task 4's functions. Push. Expected: all pass. If a hand-worked number differs from the code, stop and report both numbers: one of them is wrong. Branch B is ready to merge.

---

# Branch C: `sales/splits`

### Task 7: The split's tables and what is wrong with a list of shares

**Files:**
- Create: `src/features/money/split-rules.ts`, `prisma/migrations/<timestamp>_game_splits/migration.sql`
- Modify: `prisma/schema/money.prisma`, `games.prisma`, `accounts.prisma`
- Test: `tests/features/money/split-rules.test.ts`, `tests/features/money/schema.pg.test.ts` (add cases)

**The tables**, every one added and never changed:

| Model | Columns |
|---|---|
| `GameSplit` | `id`, `gameId`, `proposedById`, `proposedAt` |
| `GameSplitShare` | `id`, `splitId`, `userId`, `percent Int`; unique on (`splitId`, `userId`) |
| `GameSplitAnswer` | `id`, `splitId`, `userId`, `yes Boolean`, `at`; unique on (`splitId`, `userId`) |
| `GameSplitStart` | `splitId` (the id), `gameId`, `startedAt`; index on (`gameId`, `startedAt`) |
| `GameSplitEnd` | `splitId` (the id), `why SplitEndWhy { withdrawn, declined, replaced }`, `at`: a proposal that will never start |

CHECK `GameSplitShare_percent_check` (1 to 100). A deferred constraint trigger, `GameSplit_adds_up`: when the transaction that adds a split commits, its shares add up to 100 and number 1 to 10. A split cannot have both a start and an end.

**Interfaces (produces):** `splitProblem(shares: readonly Share[]): string | null`, the first that applies: "Add at least one person."; "A game's money can be shared by up to 10 people."; "Each share is a whole number from 1 to 100."; "That person is already on the list."; "Shares must add up to 100%."

- [ ] **Step 1 (red):** one case per sentence, and 33, 33, 34 is fine; the schema cases: shares of 60 and 30 cannot commit; an eleventh share cannot commit; no row of the five can be changed; a started split cannot be ended. Push. Expected: `verify` and `postgres` fail in the new cases.
- [ ] **Step 2 (green):** the code and the migration. Push. Expected: all pass.

### Task 8: Proposing, answering and reading a split

**Files:**
- Create: `src/features/money/splits.ts`, `split-mails.ts`
- Modify: `src/features/money/money.ts`, `services.ts` (`moneyServices()` also answers `splits`, built with the site's `Mailer`)
- Test: `tests/features/money/splits.pg.test.ts`, `split-mails.test.ts`

**Interfaces (produces):**
- `splitInForce(tx, gameId: string, atMs: number): Promise<{ splitId: string | null; shares: Share[] }>`: the shares of the `GameSplitStart` with the latest `startedAt` at or before `atMs`; with none, `{ splitId: null, shares: [{ userId: <the game's maker>, percent: 100 }] }`.
- `splitsOver(tx, gameId: string, days: readonly string[]): Promise<(day: string) => Share[]>`: for Task 5, the split in force at the last instant of each Chicago day.
- `pendingSplit(db, gameId): Promise<{ splitId; shares: (Share & { answered: "yes" | "waiting" })[] } | null>`: the newest split of the game with no start and no end.
- `proposeSplit(deps: { db; clock; mailer; siteOrigin }, input: { gameId; makerUserId; shares: readonly Share[] }): Promise<{ splitId: string; started: boolean }>`:
  - the game is this maker's (else `MoneyError("NOT_FOUND")`); `splitProblem` is null (else `MoneyError("INVALID", <its words>)`);
  - every person but the maker has an account that is `active` and whose `adultOn` is today or earlier in Chicago; anyone else is `MoneyError("INVALID", "We can't add that person.")`, the same words for an account that is not there, is deleted, or is under 18, so the form never says which (spec 5.6);
  - a split waiting for this game is ended as `replaced`;
  - the same shares as the split in force: `MoneyError("INVALID", "Those are the shares already.")`;
  - the split and its shares are added with the maker's own answer, yes; when the maker is the only person left to answer, it starts in the same transaction (`started: true`) and the change mail goes out; otherwise each other person gets the invitation.
- `answerSplit(deps, input: { splitId; userId; yes: boolean }): Promise<"started" | "waiting" | "declined">`: the person is in the split and has not answered, and the split has no start and no end (else `NOT_FOUND`); a yes that completes it adds the `GameSplitStart` at the clock's time, in the same transaction, and mails everyone in the old and the new split; a no ends it as `declined` and mails the maker.
- `withdrawSplit(deps, input: { splitId; makerUserId }): Promise<void>`: ends a waiting split as `withdrawn`.
- `splitsWaitingFor(db, userId)`: the splits a person has been asked about and not answered, for their own page.
- `split-mails.ts`, pure, each answering a `MailMessage`:

  The invitation. Subject: "Share what `<game>` earns on Ruken?"

  ```
  <maker's name> wants to share what <game> earns on Ruken with you.

  Your share would be <percent>%.

  Say yes or no here:
  <site>/me/splits/<split id>

  Nothing changes until everyone on the list has said yes.
  To be paid, you connect your bank through Stripe. For now, Ruken can pay adults with a bank account in the United States.
  ```

  The change. Subject: "The shares for `<game>` changed"

  ```
  From <long date>, what <game> earns on Ruken is shared like this:

  <name>  <percent>%
  <name>  <percent>%

  This counts from now on. Money already earned is not changed.
  ```

  A no, to the maker. Subject: "`<name>` said no to sharing `<game>`": "The shares for `<game>` stay as they were. You can change the list and ask again: `<site>/make/<game>/split`".

  A name in a mail is the person's handle with `@` when they have one, else "Someone on Ruken"; `proposeSplit`'s caller passes the names in, so `money` reads no page.

- [ ] **Step 1 (red):** the cases above with their words, and: a sale's moment before the last yes reads the old split and one after reads the new (Review Focus 12); a no leaves the old split in force; a proposal that never gets its answers changes nothing, however long; a new proposal replaces a waiting one and the replaced one can no longer be answered; removing a person needs no answer from them, and they still get the change mail; an under-18, a deleted account and an unknown id get the same sentence (Review Focus 11); a game with no rows reads as its maker at 100%; the mails' exact words. Stubs. Push. Expected: `postgres` fails in `splits.pg.test.ts`, `verify` in `split-mails.test.ts`.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch C is ready to merge. Blocking ("someone a person has blocked cannot add them", spec 5.6) is not here: it does not exist yet. The apps' plan adds the check to `proposeSplit` with its own test when it builds blocking, with the same sentence, "We can't add that person."

---

# Branch D: `sales/owned`

### Task 9: The owned object and its signed note

**Files:**
- Create: `src/features/extras/owned-note.ts`, `owned.ts`, `prisma/migrations/<timestamp>_owned_files/migration.sql`, `src/routes/.well-known/ruken-owned-key/+server.ts`
- Modify: `prisma/schema/extras.prisma`, `src/features/extras/services.ts`, `extras.ts`, `src/features/play/sessions.ts`, `src/features/play/services.ts`, `tests/support/extras.ts`
- Test: `tests/features/extras/owned-note.test.ts`, `owned.pg.test.ts`, `tests/features/play/sessions.pg.test.ts` (add cases), `tests/features/extras/services.test.ts`

**The table:** `OwnedFile`: `passId` (the id), `userId`, `gameId`, `mode OwnedMode { bought, all, none }`, `expiresAt`, `writtenAt`. It says which passes have an object in the bucket, so a purchase can write them again without `extras` reading the play feature's tables. Not add-only: `writtenAt` and `mode` move.

**Interfaces (produces):**
- `owned-note.ts` (Web Crypto only; imports nothing of the app):
  - `signOwnedNote(claims: { game: string; pass: string; extras: readonly string[]; expiresAtMs: number }, privateKey: CryptoKey): Promise<string>`: `v1.<payload>.<signature>`, both base64url; the payload is JSON `{ g, p, x, exp }` with `x` sorted and `exp` in seconds; the signature is Ed25519 over `ruken-owned-v1:` followed by the payload text.
  - `checkOwnedNote(note: string, publicKey: CryptoKey, nowMs: number): Promise<{ game; pass; extras; expiresAtMs } | null>`: never throws.
  - `importOwnedKey(base64Pkcs8: string): Promise<{ privateKey: CryptoKey; publicJwk: JsonWebKey }>`: throws "OWNED_NOTE_KEY must be an Ed25519 private key (PKCS8, base64)." for anything else.
- `owned.ts`:
  - `OWNED_KEY = (passId: string) => \`owned/${passId}.json\``.
  - `ownedKeysFor(db, input: { userId: string | null; gameId: string; mode: OwnedMode }): Promise<string[]>`: `none`, or nobody signed in: `[]`; `all`: every extra of the game that has any version; `bought`: the keys of this person's paid orders for the game (Task 12; until then, `[]`). Sorted.
  - `writeOwned(deps: { db; files; noteKey; clock }, input: { passId; publicId; gameId; userId; mode; expiresAtMs }): Promise<string[]>`: writes `{ "extras": [...], "note": "<signed note>" }` at `OWNED_KEY(passId)` and upserts the `OwnedFile` row. Answers the keys.
  - `refreshOwned(deps, input: { userId; gameId }): Promise<void>`: `writeOwned` again for each of that person's `OwnedFile` rows of that game that has not run out, keeping each row's mode.
- `startPlay` (play) gains, after the pass is made: `await deps.owned.write({ passId: claims.id, publicId: game.publicId, gameId: game.id, userId: viewer?.userId ?? null, mode, expiresAtMs: claims.expiresAtMs })`, where `mode` is `bought` for a `member` or `free_game` play, and `all` for `own_game` and `staff` unless the input says `ownNothing: true` (Task 28's "Play without it"), which is `none`. `PlayServiceDeps` gains `owned: { write(input): Promise<string[]> }`; `createPlayServices` takes it from `extrasServices()`. `StartedPlay` gains `owned: string[]`. Nobody signed in gets no object: the gate reads a missing one as owning nothing.
- `GET /.well-known/ruken-owned-key`: the public key as a JWK, `cache-control: public, max-age=3600`. The only thing a game's own server needs to check a note.
- Settings: `OWNED_NOTE_KEY` (required; `createExtrasServices` reads it first and fails the start with its name).

- [ ] **Step 1 (red):**

```ts
it("signs a note a game's server can check with the public key alone", async () => {
  const note = await signOwnedNote({ game: "abcdefgh23", pass: PASS_ID, extras: ["b", "a"], expiresAtMs: 2_000_000 }, keys.privateKey);
  expect(await checkOwnedNote(note, keys.publicKey, 1_000_000)).toEqual({ game: "abcdefgh23", pass: PASS_ID, extras: ["a", "b"], expiresAtMs: 2_000_000 });
  expect(await checkOwnedNote(note, keys.publicKey, 2_000_000)).toBeNull();           // run out
  expect(await checkOwnedNote(note.replace("a", "c"), keys.publicKey, 1_000_000)).toBeNull();
  expect(await checkOwnedNote("junk", keys.publicKey, 1_000_000)).toBeNull();
});
it("names no person: the note and the object hold no account id, email or handle", async () => {});
it("writes the object when a play starts, and hands a maker every extra of their own game", async () => {});
it("writes nothing for a play nobody is signed in for", async () => {});
it("refuses to start with an OWNED_NOTE_KEY that is not an Ed25519 key, naming the setting", async () => {});
```

  Stubs. Push. Expected: `verify` and `postgres` fail in the new files and cases.
- [ ] **Step 2 (green):** the code and the migration. Push. Expected: all pass.

### Task 10: The gate: the owned file, protected folders, the script's address

**Files:**
- Modify: `src/features/play/gate.ts`, `cloudflare/games/worker.ts`, `cloudflare/games/wrangler.jsonc` (`"rules": [{ "type": "Text", "globs": ["**/*.browser.js"], "fallthrough": true }]`), `src/features/games/files-check.ts`
- Create: `src/features/play/ruken-hooks.browser.js` (in this task one line, a comment; Task 11 writes it)
- Test: `tests/features/play/gate.test.ts` (add cases), `tests/cloudflare/games-worker.test.ts` (add cases), `tests/features/games/files-check.test.ts` (add a case)

**What changes in `handleGameRequest`** (`GateDeps` gains `hooksScript: string`):
- `GET /__ruken/hooks.js` on any game address, with no pass: the script, `content-type: text/javascript; charset=utf-8`, `cache-control: public, max-age=300`, the common headers. It holds no secret, and its address is the same in every copy of Ruken, so a maker writes one script tag.
- Under a good pass, the path `__ruken/owned.json`: the body of `owned/<claims.id>.json` from the bucket as it is, or `{"extras":[],"note":null}` when there is none; `content-type: application/json`, `cache-control: no-store`, the game file's other headers. Any other path under `__ruken/`: "Not found."
- Under a good pass, a path that starts `ruken-extras/<segment>/`: served only when `<segment>` is one of the `extras` in that pass's owned object; otherwise 404 "Not found.", the same answer as a file that is not there. The object is read with `files.get` on each such request and parsed with a `try`; anything that is not an object with an array of strings counts as owning nothing.
- Everything else is served as before, and no other request reads the owned object.
- `checkGameFiles` refuses a pull with a top folder named `__ruken`: "Your game has a folder called `__ruken`. Ruken uses that name. Call it something else." A folder `ruken-extras` is allowed: that is where protected files go.

- [ ] **Step 1 (red):**

```ts
it("serves a protected file only to a pass whose player owns that extra", async () => {     // Review Focus 3
  files.set("files/abcdefgh23/pull1/ruken-extras/level-pack/secret.txt", "x");
  expect((await get("/PASS/ruken-extras/level-pack/secret.txt")).status).toBe(404);
  files.set(`owned/${PASS_ID}.json`, JSON.stringify({ extras: ["level-pack"], note: "n" }));
  expect((await get("/PASS/ruken-extras/level-pack/secret.txt")).status).toBe(200);          // the same address
  expect((await get("/PASS/ruken-extras/other/secret.txt")).status).toBe(404);
});
it("answers Not found, never an error, for a broken owned object, another game's pass, and a path that climbs", async () => {});   // Review Focus 4
it("gives the game its owned file, never cached, and an empty one when there is none", async () => {
  expect(await (await get("/PASS/__ruken/owned.json")).json()).toEqual({ extras: [], note: null });
});
it("serves the script on every game address with no pass, and nothing else under /__ruken/", async () => {});
it("reads the owned object for no request outside ruken-extras/ and the owned file", async () => { /* a counting store: 0 reads for /PASS/main.js */ });
```

  The Worker test: the config has the text rule and nothing else new (no route, variable, database or binding); `worker.ts` imports the script and passes it. Push. Expected: `verify` fails in the new cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, and the journeys' gate still starts (`browser`).

### Task 11: The script and the message reader

**Files:**
- Create: `src/features/play/frame-messages.ts`
- Modify: `src/features/play/ruken-hooks.browser.js`, `src/features/play/play.ts`, `tests/fixtures/tiny-game/index.html` and `main.js` (the script tag; a button "Buy level pack" that calls `ruken.extras.buy("level-pack")`; a line of text that reads "Level pack: yours" or "Level pack: locked" from `ruken.extras.owned()` and again on every change; a line "Card: open" or "Card: closed"), `tests/fixtures/tiny-game/ruken-extras/level-pack/secret.txt`
- Test: `tests/features/play/frame-messages.test.ts`, `tests/features/play/ruken-hooks.test.ts`

**The envelope**, both ways (agreed with the apps' plan thread, which adds its own areas to the same union and script): `{ ruken: 1, type: "<area>.<name>", ...fields }`.

**Interfaces (produces):**
- `frame-messages.ts`, pure:
  - `type GameMessage = { type: "extras.buy"; extra: string }`.
  - `readGameMessage(data: unknown): GameMessage | null`: an object with `ruken === 1`, a known `type`, and for `extras.buy` an `extra` that passes `isExtraKey`, imported from `extras`' entry file. Anything else is null.
  - `isFromGame(event: { source: unknown; origin: string }, frame: { window: unknown; origin: string }): boolean`: both must match.
  - `cardMessage(open: boolean)` and `ownedMessage(extras: readonly string[])`: the two envelopes Ruken sends, `{ ruken: 1, type: "extras.card", open }` and `{ ruken: 1, type: "extras.owned", extras }`.
- `ruken-hooks.browser.js`: a plain classic script, no build step, no import, that sets `window.ruken` once:
  - `ruken.extras.owned(): Promise<string[]>`: fetches `/<pass>/__ruken/owned.json` (the pass is the first folder of `location.pathname`), `cache: "no-store"`.
  - `ruken.extras.note(): Promise<string | null>`: the signed note from the same file, for a game with its own server.
  - `ruken.extras.buy(extra: string): void`: `window.parent.postMessage({ ruken: 1, type: "extras.buy", extra }, "*")`. The message holds nothing secret, and only Ruken's page can frame a game.
  - `ruken.extras.onChange(listener: (extras: string[]) => void)` and `ruken.extras.onCard(listener: (open: boolean) => void)`: called for `extras.owned` and `extras.card` messages whose `event.source` is `window.parent`. Any other message is ignored.

- [ ] **Step 1 (red):**

```ts
it("reads a buy message and nothing else", () => {                                   // Review Focus 5
  expect(readGameMessage({ ruken: 1, type: "extras.buy", extra: "level-pack" })).toEqual({ type: "extras.buy", extra: "level-pack" });
  for (const junk of [null, "x", { ruken: 2, type: "extras.buy", extra: "a-b" }, { ruken: 1, type: "extras.buy", extra: "../x" }, { ruken: 1, type: "extras.pay" }])
    expect(readGameMessage(junk)).toBeNull();
});
it("believes a message only from the game's own window at the game's own address", () => {});
```

  `ruken-hooks.test.ts` reads the script as text and runs it with `new Function` against a stand-in `window`, `fetch` and `parent`: `buy` posts the envelope; `owned` asks for `/PASS/__ruken/owned.json`; a message from a window that is not the parent calls no listener; running the script twice sets `window.ruken` once. Push. Expected: `verify` fails in both files.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch D is ready to merge after M-S1.

---

# Branch E: `sales/orders`

### Task 12: Orders and purchases

**Files:**
- Create: `prisma/migrations/<timestamp>_extra_orders/migration.sql`
- Modify: `prisma/schema/extras.prisma`, `accounts.prisma`, `src/features/extras/owned.ts` (`bought` now reads paid orders)
- Test: `tests/features/extras/schema.pg.test.ts` (add cases), `owned.pg.test.ts` (add cases)

| Model | Columns |
|---|---|
| `ExtraOrder` | `id`, `userId`, `extraId`, `versionId` (the version and price the buyer was shown), `source PurchaseSource { stripe, apple, google, microsoft }`, `state OrderState { open, paid, cancelled, refunded }` default `open`, `stripeInvoiceId?` unique, `stripeCheckoutSessionId?` unique, `waiverAt?`, `guardianAt?`, `createdAt`, `updatedAt`. It mirrors where a purchase stands, so it moves, forward only: `open → paid` or `cancelled`; `paid → refunded`; `refunded → paid` (a dispute that is won). |
| `ExtraPurchase` | `id`, `orderId` unique, `userId`, `extraId`, `gameId`, `versionId`, `source`, `sourceId` (for Stripe, the invoice's id), `stripeChargeId?` unique, `stripePaymentIntentId?` unique, `balanceTransactionId?` unique, `grossCents`, `taxCents`, `feeCents` (the fee known at the sale: for Stripe, the one on the payment's own balance transaction; later fees are their own facts), `country?` (two letters, as Stripe's tax location says), `boughtAt`, `createdAt`; unique on (`source`, `sourceId`). Added and never changed: the fact the ledger posts. It holds ids and amounts only. |

In the SQL: the partial unique index `ExtraOrder_one_live` on (`userId`, `extraId`) `WHERE "state" IN ('open', 'paid')`, which is what makes a second charge impossible; CHECK `ExtraPurchase_amounts_check` (`"grossCents" > 0 AND "taxCents" >= 0 AND "feeCents" >= 0 AND "taxCents" < "grossCents"`); the add-only trigger on `ExtraPurchase`; the forward-only trigger on `ExtraOrder.state` with the four moves above.

- [ ] **Step 1 (red):** two open orders for one person and extra cannot exist; an open one beside a cancelled one can; a paid order cannot become open; a purchase cannot be changed; (`source`, `sourceId`) is unique; `ownedKeysFor(..., "bought")` lists a paid order's key and not an open, cancelled or refunded one's. Push. Expected: `postgres` fails; the drift check fails.
- [ ] **Step 2 (green):** the schema and the migration. Push. Expected: all pass.

### Task 13: What buying asks of Stripe

**Files:**
- Create: `src/features/extras/stripe-port.ts`, `tests/support/fake-extras-stripe.ts`
- Modify: `tests/browser/support/fake-stripe-server.ts`
- Test: `tests/features/extras/stripe-port.test.ts`

- [ ] **Step 0 (read first; M-S3):** read `stripe` 22.6.2's own types for `invoices.createPreview`, `invoices.create`, `invoiceItems.create`, `invoices.finalizeInvoice`, `invoices.pay`, `invoices.voidInvoice`, `refunds.create`, `checkout.sessions.create` (`mode: "payment"`, `invoice_creation`), `subscriptions.retrieve` (`default_payment_method`) and `paymentMethods.retrieve`. In Stripe's test mode, with a membership bought through Ruken's checkout, read where its card is kept. Report both in one line. If a call below does not exist as named, or the card is on neither the subscription nor the customer, stop and report; do not reach for another way to charge.

**Interfaces (produces):** `interface ExtrasStripe`, bound by `bindExtrasStripe(stripe: Stripe)`, each call with an idempotency key made from the order's id:
- `savedCard(input: { stripeSubscriptionId: string }): Promise<{ paymentMethodId: string; last4: string } | null>`.
- `quote(input: { customerId; priceCents: bigint; name: string }): Promise<{ totalCents: bigint; taxCents: bigint; country: string | null }>`: `invoices.createPreview` for one item of `priceCents` in US dollars, tax worked out by Stripe and added on top, under the one product `ruken_extra` with the membership's tax code. Nothing is created at Stripe.
- `payNow(input: { orderId; customerId; paymentMethodId; priceCents; name; metadata: { kind: "extra"; orderId: string } }): Promise<{ kind: "paid"; stripeInvoiceId: string } | { kind: "needs_page"; stripeInvoiceId: string } | { kind: "declined"; stripeInvoiceId: string }>`: an invoice item, an invoice (`collection_method: "charge_automatically"`, `auto_advance: false`, automatic tax on), finalized, paid with that card. A card that needs the bank's check is `needs_page`; a refusal is `declined`; anything else is thrown.
- `voidOrder(stripeInvoiceId: string): Promise<void>`: voids an invoice that was not paid, so it can never be paid later from Stripe's own page.
- `refund(input: { stripeChargeId: string; key: string }): Promise<{ stripeRefundId: string }>`: `refunds.create` for the whole charge, with `key` as the idempotency key, so asking twice refunds once. Used by the staff refund (Task 29) and a game that leaves (Task 30).
- `payPage(input: { orderId; customerId; priceCents; name; returnUrl: string; cancelUrl: string; metadata }): Promise<{ url: string; checkoutSessionId: string }>`: Checkout in `payment` mode for the same one item, automatic tax on, `invoice_creation` on (so this path too ends in an invoice), cards only.
- `paidInvoice(input: { stripeInvoiceId } | { checkoutSessionId }): Promise<PaidExtraInvoice | null>`: null unless Stripe says it is paid; else `{ stripeInvoiceId, chargeId, paymentIntentId, balanceTransactionId, gross, tax, fee, country, paidAtMs, orderId }`, every amount from Stripe, the fee from the charge's own balance transaction (as `readPaidPremiumInvoice` reads a membership's). A balance transaction that is not there yet throws `NotAtStripeYet`.
- The fakes: `FakeExtrasStripe` in memory with `declineNext()`, `needPageNext()`, `loseNextAnswer()` (the invoice is paid and the call throws) and a tax rate a test sets; the stand-in server answers the same calls and gains a page for the payment-mode checkout with two buttons, "Pay" and "Go back".

- [ ] **Step 1 (red):** the port's cases against a stubbed client: each call's exact parameters and idempotency key (`extra-order:<orderId>:item`, `:invoice`, `:finalize`, `:pay`, `:page`); `quote` creates nothing; `paidInvoice` is null for an open invoice and throws `NotAtStripeYet` before the balance transaction exists; the metadata carries the order's id and no account id or email. Push. Expected: `verify` fails in `stripe-port.test.ts`.
- [ ] **Step 2 (green):** the code and the fakes. Push. Expected: all pass.

### Task 14: Buying

**Files:**
- Create: `src/features/extras/orders.ts`, `views.ts`, `mails.ts`
- Modify: `src/features/extras/services.ts`, `extras.ts`, `src/features/membership/events.ts` (nothing: see below), `src/routes/webhooks/stripe/+server.ts`
- Test: `tests/features/extras/orders.pg.test.ts`, `views.pg.test.ts`, `mails.test.ts`, `tests/browser/stripe-webhook.test.ts` (add a case)

**Interfaces (produces):**
- `views.ts`: `extrasOf(db, input: { gameId; viewer: { userId: string; isMember: boolean; isMaker: boolean } | null; today: string }): Promise<ExtraCard[]>`: the game's extras with a live version, not taken off, whose season (if any) is running, in the order they first went on sale; each `{ key, kind, name, oneLine, pictureKey, priceCents, seasonEnds: string | null, button: "buy" | "join" | "yours" }` (`yours` for a paid order and for the game's own maker; `join` for anyone who is not a member).
- `orders.ts`, from `createOrders(deps: { db; clock; stripe: ExtrasStripe; files; noteKey; mailer; rateLimiter })`:
  - `quoteExtra(input: { userId; gameSlug; extraKey }): Promise<Quote | Refusal>`: `Quote = { versionId; name; oneLine; pictureKey; priceCents; taxCents; totalCents; cardLast4: string | null; needsWaiver: boolean; needsGuardian: boolean }`. `needsWaiver` is whether Stripe's tax country is in `WAIVER_COUNTRIES`; `needsGuardian` is whether `adultOn` is after today. `Refusal = { refused: "not_member" | "not_on_sale" | "season_over" | "yours" | "busy" }`. At most `EXTRA_QUOTES_PER_PERSON` (`{ max: 30, windowMs: 60_000 }`).
  - `buyExtra(input: { userId; gameSlug; extraKey; versionId; waiver: boolean; guardian: boolean; returnUrl: string }): Promise<{ kind: "owned"; extras: string[] } | { kind: "pay_page"; url: string } | { kind: "declined"; payPageUrl: string } | { kind: "changed"; quote: Quote } | { refused: Refusal["refused"] | "tick_needed" }>`, in this order:
    1. the same checks as the quote, at the clock's time (a membership that ended, a season that ended a minute ago, an extra taken off sale: refused, nothing charged);
    2. `versionId` is no longer the live version: `changed`, with the new quote, and nothing is charged (Review Focus 14);
    3. a tick that is needed and missing: `tick_needed`;
    4. this person's live order for this extra, if there is one: a `paid` one answers `owned`; an `open` one is settled first (`settleOrder`), and if Stripe says it was not paid its invoice is voided and it is cancelled;
    5. a new `ExtraOrder`, `open`. The unique index makes a second press at the same moment fail to insert; that press reads the first one's order and waits on it;
    6. with a saved card, `payNow`: `paid` goes to `settleOrder`; `needs_page` and `declined` void that invoice and answer with `payPage`'s address (as `pay_page` or `declined`); with no saved card, `payPage`.
  - `settleOrder(input: { orderId } | { checkoutSessionId } | { stripeInvoiceId }): Promise<"paid" | "not_paid">`: asks Stripe (`paidInvoice`); when paid, in one transaction: the order becomes `paid`, the `ExtraPurchase` is added (a repeat adds nothing), and then `refreshOwned` rewrites that person's owned objects for the game; then, for a buyer in `WAIVER_COUNTRIES`, the confirming email. Safe to run any number of times, from the buy call, the return page and the webhook.
  - `revokePurchase(input: { source; sourceId }): Promise<void>` and `restorePurchase(...)`: the order becomes `refunded` (or `paid` again) and the owned objects are written again. Called by `money` when it reads a refund or a dispute (Task 17).
- The webhook: `src/routes/webhooks/stripe/+server.ts` already keeps and handles every verified event through `membership.receive`. After it, for `invoice.paid` and `checkout.session.completed` whose object's `metadata.kind` is `"extra"`, it calls `extrasServices().orders.settleOrder(...)`. Membership's own handler already ignores a checkout that is not `premium`; Step 1 proves that it also leaves an extra's `invoice.paid` alone (an invoice with no subscription) and, if it does not, this task changes `recordInvoicePaid`'s caller to skip an invoice whose `metadata.kind` is `"extra"`, with that test.
- `mails.ts`: `confirmingMessage(to, input: { name: string; total: string; boughtOn: string })`. Subject: "You bought `<name>` on Ruken".

  ```
  You bought <name> on <long date> for <total>.

  You asked to have it straight away, and it is yours now.
  Because you have it, you agreed that you can't change your mind and get your money back.

  If something is wrong with it, write to us: <support address>
  ```

  The support address is the one slice 1's mails use, passed in.

- [ ] **Step 1 (red):**

```ts
it("charges once however often Buy is pressed, and from two tabs at once", async () => {       // Review Focus 1
  const [one, two] = await Promise.all([orders.buyExtra(input), orders.buyExtra(input)]);
  expect([one.kind, two.kind]).toEqual(["owned", "owned"]);
  expect(stripe.paidInvoices()).toHaveLength(1);
  expect(await prisma.extraPurchase.count()).toBe(1);
});
it("finds the payment when Stripe took the money and the answer was lost", async () => {         // Review Focus 2
  stripe.loseNextAnswer();
  await expect(orders.buyExtra(input)).rejects.toThrow();
  expect(await orders.buyExtra(input)).toMatchObject({ kind: "owned" });
  expect(stripe.paidInvoices()).toHaveLength(1);
});
it("rewrites the owned object of a pass made before the purchase, in the same call", async () => {   // Review Focus 3
  const pass = await aPassFor(member, game);
  await orders.buyExtra(input);
  expect(JSON.parse(files.text(`owned/${pass.id}.json`)).extras).toEqual(["level-pack"]);
});
it("shows the new price instead of charging one the buyer did not see", async () => {});       // Review Focus 14
it("refuses, and charges nothing: a membership that ended, a minor with no guardian tick, an EU buyer with no tick, a season over by a minute", async () => {});   // Review Focus 13, 15
it("sends a card the bank wants to check to Stripe's page, and voids the invoice that was not paid", async () => {});
it("mails the confirmation to a buyer in the EU or the UK, once, and to nobody else", async () => {});
it("answers 'yours' for a maker on their own game, and never makes an order", async () => {});
it("takes the extra back on a refund and gives it back when a dispute is won", async () => {});
```

  The webhook journey: a signed `invoice.paid` for an extra's invoice settles its order, and the same event again changes nothing. Stubs. Push. Expected: `postgres` fails in the new files, `browser` in the new webhook case.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch E is ready to merge after M-S2's first half (the test-mode read).

---

# Branch F: `sales/ledger`

### Task 15: The sale's tables in the ledger

**Files:**
- Create: `prisma/migrations/<timestamp>_sale_kinds/migration.sql` (the enum values alone), `prisma/migrations/<timestamp>_sales/migration.sql`
- Modify: `prisma/schema/money.prisma`, `extras.prisma`
- Test: `tests/features/money/schema.pg.test.ts` (add cases)

- `JournalEntryKind` gains `sale`, `sale_fee`, `sale_refund`, `sale_dispute`. `StatementLineSource` gains `sale`, `sale_cost`, `sale_refund`, `sale_dispute`.
- `SalePosting`: `purchaseId` (the id; an `ExtraPurchase`), `gameId`, `splitId?` (null: the game's maker at 100%), `period` (the month the entry was posted into), `postedAt`. Added and never changed.
- `SaleShare`: `id`, `purchaseId`, `userId`, `percent Int`; unique on (`purchaseId`, `userId`). The split as it stood at the sale, kept with the sale. Added and never changed.
- `FeePosting` and `StripeReversal` keep their column `stripeInvoiceId`: an extra's invoice id goes in it as a membership payment's does. `PoolShare`'s partial unique index `PoolShare_play_key` becomes one play share for a game, a month **and a person**.

- [ ] **Step 1 (red):** a `SalePosting` and a `SaleShare` cannot be changed; one posting per purchase; an entry of each new kind can be posted; two play shares for one game and month for two people insert, and two for the same person do not. Push. Expected: `postgres` fails; the drift check fails.
- [ ] **Step 2 (green):** the two migrations. Push. Expected: all pass.

### Task 16: Posting sales and their later fees

**Files:**
- Create: `src/features/money/sales.ts`
- Modify: `src/features/money/fees.ts`, `daily.ts`, `tests/support/ledger.ts` (`addSale(prisma, setup)`: a paid purchase with its ids)
- Test: `tests/features/money/sales.pg.test.ts`, `fees.pg.test.ts` (add cases), `daily.pg.test.ts` (add a case)

**Interfaces (produces):**
- `postUnpostedSales(deps: { db; clock }): Promise<{ posted: number }>`: every `ExtraPurchase` of source `stripe` with no `SalePosting`, oldest first, each in a transaction of its own under `lockLedger`: `splitInForce(tx, gameId, boughtAt)`; the `SaleShare` rows; one `sale` entry (key `sale:<purchaseId>`, `stripeInvoiceId` the purchase's `sourceId`, `gameId`), posted into `postingPeriod(tx, boughtAt, now)`, with `postSale`'s lines; the `SalePosting`. A purchase from another source is left for the apps' plan's store sources.
- `fees.ts`: `knownIds` also maps each `ExtraPurchase`'s invoice, charge and payment intent to its invoice id, and counts its `balanceTransactionId`. `placeRow`, for a fee placed on an invoice that is a sale's: the same once-per-payment rounding up, then a `sale_fee` entry (key `fee:<feeRowId>`) with `postSaleFee`'s lines from the sale's `SaleShare` rows. Which it is, a membership payment or a sale, is decided by which table holds the invoice id; holding both is a thrown error.
- `runMoneyJob`: a step "posting sales", after "posting payments". `MoneyJobReport` gains `sales: number`.

- [ ] **Step 1 (red):** a sale is posted once, with the split in force at its own moment and not the one in force now (Review Focus 8); a sale in a closed month posts into the open one; a Tax fee row naming the sale's charge posts a `sale_fee` that takes from the people by the sale's own shares, rounded up once across the sale's rows; a fee on the sale's own balance transaction is counted once (slice 5's Review Focus 2, for a sale); the job run twice posts nothing twice; the books balance; `platform:revenue:premium` and every pool account are untouched by a sale. Stubs. Push. Expected: `postgres` fails in the new file and cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 17: Refunds and disputes of a sale

**Files:**
- Modify: `src/features/money/reversals.ts`, `services.ts` (the money job is built with `extrasServices().orders`' `revokePurchase` and `restorePurchase`)
- Test: `tests/features/money/reversals.pg.test.ts` (add cases)

- `readReversals`: the map from a charge to its invoice also holds every sale's. When it stores a refund or an opened dispute of a sale it calls `revokePurchase`; a won dispute, `restorePurchase`. The first run's "oldest payment" is the older of the oldest membership payment and the oldest purchase.
- `postReversal`: for an invoice that is a sale's, the entry is `sale_refund` or `sale_dispute` (key the fact's id, `gameId` set), with `postSaleRefund`, `postSaleDisputeOpened` or `postSaleDisputeWon`, fed the sale's and its fees' lines and the sale's `SaleShare` rows. `feesKept` is the sale's fees so far, in the refund's proportion, less what Stripe returned.

- [ ] **Step 1 (red):** a refund in full gives the worked sale's numbers (Task 6) in the database; the people debited are the sale's, after the split has changed (Review Focus 8); a person with nothing earned ends below zero and Ruken's accounts end where they began (Review Focus 9); an opened dispute takes the $15 from the people and takes the extra back; a won one gives back what Stripe gave back and the extra; a membership payment's refund is posted exactly as before (the existing cases, unchanged, still pass). Stubs where new. Push. Expected: `postgres` fails in the new cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 18: The pool, shared by split

**Files:**
- Modify: `src/features/money/pool-posting.ts`, `pool-run.ts`
- Test: `tests/features/money/pool-posting.test.ts`, `pool-run.pg.test.ts`, `worked-month.test.ts` (unchanged, and must still pass)

- `postPoolShares(period, outcome, peopleOf: ReadonlyMap<string, readonly { userId: string; weight: bigint }[]>)`: one entry per game as now (key `pool:<period>:game:<gameId>`), with one line per person, the game's amount shared by `lrr` over the weights; a game missing from the map still throws.
- `sharePool`: `peopleOf` is built per game from the month's `PlayDay` rows (seconds per day) and `splitsOver` (Task 8), through `peopleWeights` (Task 5). One `PoolShare` row per game and person, each carrying the game's seconds. The bringing bonus is untouched: it stays with the maker who brought the member (spec 5.7).

- [ ] **Step 1 (red):** a game whose split changed on the 11th pays 840 and 160 of a 1000-cent share (Task 5's case, through the database); a game with no split rows posts the same entry, line for line, as before this task (Review Focus 10); the shares of all games still add up to the pool; the worked month is unchanged. Push. Expected: `verify` and `postgres` fail in the new cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 19: A statement with a game's sales on it

**Files:**
- Modify: `src/features/money/statement.ts`, `statements.ts`
- Test: `tests/features/money/statement.test.ts`, `statements.pg.test.ts`

- `StatementLineDoc` gains four shapes, each naming its game: `{ source: "sale"; game; sold: number }`, `{ source: "sale_cost"; game }`, `{ source: "sale_refund"; game; refunds: number }`, `{ source: "sale_dispute"; game; disputes: number }`. A `play` line gains `shared: boolean` (true when the game's pool share that month went to more than this person).
- `buildStatement`'s order (spec 5.7: "each game's lines, then their total"): for each game by name, its `play`, `sale`, `sale_cost`, `sale_refund` and `sale_dispute` lines; then `bringing`; then corrections; then payouts. The totals keep their meaning: `earned` is every line but the payout lines.
- `writeOne` reads the person's lines of the month's `sale`, `sale_fee`, `sale_refund` and `sale_dispute` entries from the journal, added up per game and kind; `sold`, `refunds` and `disputes` are the number of entries. The statement is still written once and never changed, and is still one per person and month: someone in a split with no game of their own gets one because the journal holds lines on their account.

- [ ] **Step 1 (red):** `statement.test.ts`: a person with two games, one with play, three sales, a later fee and a refund, the other with play only, gets the lines in that order and `broughtForward + earned + sent === owed`; the same input gives the same bytes. `statements.pg.test.ts`: after a month with a 60/40 split is made final there are two statements whose lines add up to the game's entries; a person whose only line is a refund gets a statement with `owed` below zero. Push. Expected: `verify` and `postgres` fail in the new cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch F is ready to merge. The second half of M-S2 is asked of the coordinator now.

---

# Branch G: `sales/game-page`

### Task 20: A game's page (`/g/<game>/about`)

**Files:**
- Create: `src/routes/g/[game]/about/+page.server.ts`, `+page.svelte`
- Modify: the feed's game name and the game card on a maker's page (each becomes a link to `/g/<game>/about`; the files are slice 3's, named on `main` when this starts), `tests/browser/support/look.ts` (`CARD_SCREENS`)
- Test: `tests/browser/game-page.test.ts`

The page, for anyone (spec 5.1). `/g/<game>` still opens the feed at that game's clip, because that is what Share sends.

```
(the game's clip)
Floor Fifty
Climb. Fall. Climb.
by @snekprty

[ ▶ Play ]

Extras
(picture)  Season 1 pass
           Ends 31 January
           [ Buy for $4.99 ]
(picture)  Level pack 2
           Ten new floors.
           Yours ✓

Tax is added where it applies. No refunds.
```

- The clip, the name, the one line, "by `<handle>`" (a link to the maker's page) and Play (the feed's own Play: the paywall card for someone who is not a member).
- "Extras" and its list come from `extrasOf`. With none, there is no heading and no last line.
- Each extra has one button: "Buy for `<price>`" (blue) opens the buy card (Task 21); "Join to buy" opens the paywall card and comes back to this page; an owned one reads "Yours ✓" and has no button.
- A season pass shows `seasonEndsWords` in a `<time>` whose `datetime` is `endsAtMs`, so the buyer's own device can show the hour it ends where they are (spec 8).
- A game that is not live is a missing page. A game rated above the viewer's age is a missing page (the apps' plan's rating; when that is not on `main`, nothing is hidden and nothing is built for it here).
- The reviews summary and list are the apps' plan's and go between the maker's line and Play, and below the extras.

Grandma: one blue Play at the top; each extra says what it is and has one button that says what it costs.

- [ ] **Step 1 (red):** a visitor sees the game and its extras with "Join to buy"; a member sees "Buy for $4.99"; an owner sees "Yours ✓"; a game with no extras shows no "Extras"; a season over yesterday is not listed; tapping the game's name in the feed lands here; a game that is not live is 404; `expectOneCard`, `showTheOwner`. Push. Expected: `browser` fails: 404 at `/g/<game>/about`.
- [ ] **Step 2 (green):** the route. Push. Expected: all pass.

### Task 21: The buy card

**Files:**
- Create: `src/routes/g/[game]/extras/[extra]/quote/+server.ts`, `buy/+server.ts`, `back/+server.ts`, `src/lib/BuyCard.svelte`
- Modify: `src/routes/g/[game]/about/+page.svelte`, `tests/browser/support/game.ts` (`addGameWithExtra(browser)`: a live game from the tiny fixture with "Level pack" accepted at $2.99)
- Test: `tests/browser/buy-extra.test.ts`

The card slides up over the dimmed page (design 5.8's paper card). It is one component, used here and in the game frame (Task 22).

```
(picture)
Level pack
Ten new floors.

$2.99
Tax $0.24

[ Buy for $3.23 ]            blue
Card ending 4242
[ Not now ]                  green

No refunds.
```

- Opening it asks `quote` (`GET`, JSON). The "Tax" line is there only when the tax is above zero. With no saved card, "Card ending" reads "You'll pay on Stripe's page and come straight back."
- When `needsWaiver`: a tick box above the button, "I want this now. I know I can't change my mind and get my money back once I have it." When `needsGuardian`: "My parent or guardian says yes." The button stays grey until each box shown is ticked.
- Buy posts to `buy` (JSON, with the quote's `versionId` and the ticks). `owned`: the card reads "It's yours" for a moment and slides away, and the list shows "Yours ✓". `pay_page`: the browser goes to Stripe's page; Stripe sends it to `back`, which settles the order and returns to where the person was (`safeNext`), where the card reads "It's yours" once. `declined`: "Your bank said no. Try another card." with "Try another card" (blue, to Stripe's page) and "Not now". `changed`: the card shows the new price and "The price changed. Have a look before you buy." `refused`: one line each: "Join Ruken to buy extras.", "This isn't on sale any more.", "The season is over.", "Something went wrong on our side. You have not been charged. Try again." (also for a thrown error).
- `quote` and `buy` need a signed-in caller (else 401, and the card shows the paywall's way in); both read the person from the session and nothing about them from the request.
- Before buying, a line under the Extras list says "Tax is added where it applies. No refunds."; on the card the tax is known, so it says "No refunds." (spec 5.2's sketch shows the first; the amount with tax before the tap is what the spec's words ask for).

Grandma: what it is, what it costs, one blue button to buy, one green button to say no.

- [ ] **Step 1 (red):**

```ts
test("a member buys an extra from the game's page and it is theirs", async ({ page }, testInfo) => {
  const game = await addGameWithExtra(browser);
  await payAsNewMember(page);
  await page.goto(`/g/${game.slug}/about`);
  await page.getByRole("button", { name: "Buy for $2.99" }).click();
  await expect(page.getByText("Card ending 4242")).toBeVisible();
  await showTheOwner(page, testInfo, "the buy card");
  await page.getByRole("button", { name: /^Buy for \$\d+\.\d\d$/ }).click();
  await expect(page.getByText("It's yours")).toBeVisible();
  await expect(page.getByText("Yours ✓")).toBeVisible();
});
test("Not now closes the card and charges nothing", async ({ page }) => {});
test("a card the bank wants to check goes to Stripe's page and comes back owned", async ({ page }) => {});
test("a refused card says so and offers another", async ({ page }) => {});
test("a buyer in the EU must tick the box first, and gets the confirming email", async ({ page }) => {});
test("someone who is not a member sees Join to buy, joins, and is back on the game's page", async ({ page }) => {});
test("two quick presses buy once", async ({ page }) => {});
```

  Each journey waits on the card's own words, never on a timer. Push. Expected: `browser` fails in `buy-extra.test.ts`.
- [ ] **Step 2 (green):** the routes and the component. Push. Expected: all pass. Branch G is ready to merge after the Owner has seen its screens and said "fine".

---

# Branch H: `sales/in-game`

### Task 22: The Extras button

**Files:**
- Modify: the play screen and its frame control (slice 2's branch F; `src/routes/g/[game]/play/`), `src/lib/look.css` only if #96 has not given the frame's second control a class (then stop and ask; this plan adds no look of its own)
- Test: `tests/browser/in-game-extras.test.ts`

- A small "Extras" button beside the ← arrow in the game frame, there only when `extrasOf` is not empty (spec 5.3). It opens a card over the dimmed game: "Extras", the same list as the game's page, and "Back to the game" (green). Buy on an item opens the buy card.
- Opening either card sends the game `cardMessage(true)`, closing sends `cardMessage(false)`; the game is not paused by Ruken.
- After a purchase the page sends `ownedMessage(extras)` to the game's frame, at the game's own origin.

- [ ] **Step 1 (red):** a member opens Extras while playing the tiny game, buys "Level pack", and the game's own line changes from "Level pack: locked" to "Level pack: yours" without the frame's address changing (the journey reads the frame's `src` before and after: Review Focus 3); then `ruken-extras/level-pack/secret.txt` loads inside the frame, and for a second member who did not buy it does not; the game's line reads "Card: open" while a card is up; a game with no extras has no button. `showTheOwner` for both cards over the game. Push. Expected: `browser` fails.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 23: A game opens the buy card

**Files:**
- Modify: the play screen (one `message` listener, using `isFromGame` and `readGameMessage`)
- Test: `tests/browser/in-game-extras.test.ts` (add cases)

- A good `extras.buy` from the game's own frame opens the buy card for that extra, exactly as a tap on Extras would. An extra the game does not have on sale, or one already owned, opens nothing and sends the game `ownedMessage` again, so it can put itself right.
- At most one card is open; a message while a card is open is dropped. A game cannot press Buy: the card is Ruken's page, outside the frame.

- [ ] **Step 1 (red):** the tiny game's "Buy level pack" button opens Ruken's card and the purchase unlocks the game; a message posted from the top page itself, or from a second frame, opens nothing (Review Focus 5); a message for `no-such-extra` opens nothing; fifty messages in a row open one card. Push. Expected: `browser` fails in the new cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch H is ready to merge after the Owner's "fine".

---

# Branch I: `sales/maker-extras`

### Task 24: The extra form

**Files:**
- Create: `src/routes/make/[game]/extras/+page.server.ts`, `+page.svelte` (the game's extras), `src/routes/make/[game]/add-extra/+page.server.ts`, `+page.svelte`, `src/routes/make/[game]/extras/[extra]/+page.server.ts`, `+page.svelte`
- Modify: the game's own screen in the maker's area (one link, "Extras", and one, "Who shares the money", which is dead until branch J and is left out until then, with its test)
- Test: `tests/browser/maker-extras.test.ts`

`add-extra` is its own address so that no extra's id can collide with it. The look is #96's; this is what is on each screen (spec 5.5).

**The game's extras** (`/make/<game>/extras`): each extra's name, price and `STANDING_WORDS`, with `changeWords` under it when there is one; "Add an extra" (blue). With none: "No extras yet. An extra is something players can buy in your game."

**Add an extra** (`/make/<game>/add-extra`), one form, one button:

| Field | What it is | Words under it |
|---|---|---|
| What is it? | two choices: "Something to keep" (a DLC), "A season pass" | "A season pass is bought once and has a first and a last day." |
| Name | text, up to 40 | "What players see. Up to 40 letters." |
| One line | text, up to 80 | "Say what they get." |
| Picture | a file | "A JPG, PNG or WebP, up to 5 MB." |
| Price | a list: `EXTRA_PRICES_CENTS`, as dollars | "Tax is added for the buyer where it applies." |
| First day, Last day | two `<input type="date">`, only for a season pass | "Days are counted in Chicago time. Up to 365 days." |

- The button is "Send for review" (blue). It calls `addExtra`, then `sendForReview`. When the second refuses (the game is not live yet), the extra is kept as a draft and the page says why in the service's own words.
- Before the first extra is sent, the maker has agreed to the maker agreement's current version. The check and the agree step are slice 2's branch M's own; this form sends a maker who has not agreed there and brings them back. If the agreement's version 2 text is not in the repository when this task starts, stop and report: the form is not marked ready on version 1.
- Each refusal's words sit beside its own field, and what was typed is kept.

**One extra** (`/make/<game>/extras/<id>`): its standing; the picture, name, line, price and days; then:

```
Your game calls this extra:   level-pack-2   [ Copy ]
How a game uses extras
```

- "How a game uses extras" goes to `/make/hooks` (Task 25).
- "Change it": the same form, filled in, without the kind; its button is "Send the change for review". Under it, for an extra on sale: "Players keep buying it as it is now until we accept the change."
- "Take off sale" (red), then one question on the same page, "Take it off sale? People who bought it keep it." with "Take it off sale" (red) and "Keep it on sale" (green). For a draft that was never on sale, "Remove" (red) instead.
- Another maker's game or extra is a missing page.

Grandma: one form, one button; each field says what goes in it; the price is a list.

- [ ] **Step 1 (red):** a maker adds "Level pack" at $2.99 to a live game and sees "Waiting for review" and the id `level-pack`; a season pass with a last day before its first is refused beside that field and the name typed is still there; the price field is a `<select>` whose options are exactly the eleven prices; no field on the form is a number box; a change to an extra on sale shows "A change is waiting for review." and the game's page still sells the old price; take off sale asks first and then reads "Taken off sale"; a second maker gets 404; `showTheOwner` for the three screens. Push. Expected: `browser` fails: 404 at `/make/<game>/extras`.
- [ ] **Step 2 (green):** the routes. Push. Expected: all pass.

### Task 25: How a game uses extras (`/make/hooks`)

**Files:**
- Create: `src/routes/make/hooks/+page.svelte`, `+page.server.ts`
- Test: `tests/browser/maker-extras.test.ts` (add cases)

One page for makers, signed in or not, in plain words with five short parts, each with the lines to copy:

1. **Add one line to your game.** `<script src="/__ruken/hooks.js"></script>`
2. **See what the player owns.** `const mine = await ruken.extras.owned();` and "It is a list of your extras' ids, like `["level-pack-2"]`. It never says who the player is."
3. **Show the buy card.** `ruken.extras.buy("level-pack-2");` and "Ruken shows the card and takes the payment. Your game never sees a card."
4. **Know when something changed.** `ruken.extras.onChange((mine) => { … });` and `ruken.extras.onCard((open) => { … });` with "Pause your game while the card is open, if you like."
5. **Keep an extra's files safe.** "Put them in a folder called `ruken-extras/<the extra's id>/` at the top of your game. Only players who own the extra can load them." Then, smaller: "Without the script: read `__ruken/owned.json` beside your game's address, and send the message `{ ruken: 1, type: "extras.buy", extra: "<id>" }` to `window.parent`." and "If your game has its own server: `ruken.extras.note()` gives a short signed note. Check it with the key at `<site>/.well-known/ruken-owned-key`."

The apps' plan adds its own parts (achievements, stats, events) to this page.

- [ ] **Step 1 (red):** the page shows the five parts; the script tag on the page is, letter for letter, the one in `tests/fixtures/tiny-game/index.html`, and every `ruken.extras.` call named on the page exists in `ruken-hooks.browser.js` (the journey reads both files, so the page cannot drift from the script); the extra's screen links here. Push. Expected: `browser` fails: 404 at `/make/hooks`.
- [ ] **Step 2 (green):** the page. Push. Expected: all pass. Branch I is ready to merge after the Owner's "fine".

---

# Branch J: `sales/split-screens`

### Task 26: Who shares a game's money (`/make/<game>/split`)

**Files:**
- Create: `src/routes/make/[game]/split/+page.server.ts`, `+page.svelte`
- Test: `tests/browser/game-split.test.ts` (slice 5's public page already owns `split.test.ts`)

```
Who shares what Floor Fifty earns

@snekprty (you)     [ 60% ▾ ]
@drummer            [ 40% ▾ ]   Remove

Add a person:  @[ handle      ]  [ Add ]

Shares must add up to 100%.

[ Ask them ]                         blue
```

- The list is the split in force (`splitInForce`), or the one waiting (`pendingSplit`) when there is one. Each share is a `<select>` of 1% to 100%. A person is added by their handle, through `accounts`' "account by handle" (the apps' plan moves the handle there from the maker's page); a handle that is nobody, and anyone `proposeSplit` refuses, read "We can't add that person."
- The button reads "Ask them" when someone new must say yes, and "Change the shares" when nobody must. It calls `proposeSplit` with each person's handle for the mails.
- While a split waits: "Waiting for @drummer to say yes. Until then the shares stay as they were." and "Cancel this change" (red), which calls `withdrawSplit`.
- Under the list, always: "A change counts from when everyone has said yes. Money already earned is not changed." and "Each person connects their own bank to be paid."
- A person whose account has left Ruken reads "(left Ruken)" with: "Change the shares so their part goes to someone."

Grandma: a list of names with a share beside each, and one line under it.

- [ ] **Step 1 (red):** a maker adds `@drummer` at 40 and sees "Waiting for @drummer to say yes."; shares of 60 and 30 show "Shares must add up to 100%." and ask nobody; an unknown handle and an under-18's handle show the same sentence; "Cancel this change" brings back the old list; no field is a number box; another maker gets 404; `showTheOwner`. Push. Expected: `browser` fails: 404.
- [ ] **Step 2 (green):** the route. Push. Expected: all pass.

### Task 27: Saying yes or no (`/me/splits/<split>`)

**Files:**
- Create: `src/routes/me/splits/[split]/+page.server.ts`, `+page.svelte`
- Modify: `src/routes/me/+page.server.ts`, `+page.svelte` (a line for each of `splitsWaitingFor`: "@snekprty asked you to share what Floor Fifty earns." with "Have a look")
- Test: `tests/browser/game-split.test.ts` (add cases)

```
@snekprty wants to share what Floor Fifty earns on Ruken with you.

Your share would be 40%.

[ Yes, share it ]          blue
[ No thanks ]              green

Nothing changes until everyone on the list has said yes.
```

- Signed out: sign-in, then back here. Someone who is not in this split, or a split that is over, started or already answered by them: a missing page, except their own started split, which reads "You share what Floor Fifty earns. Your share is 40%."
- Yes: "You're in." and, when their bank is not connected, "Connect your bank to be paid" (blue), to slice 5's `/make/bank`; until that branch is on `main` the button is left out, with its test. No: "Okay. Nothing changes."

- [ ] **Step 1 (red):** the launched line, through the database's stand-ins: a maker asks `@drummer`; the invitation's link opens this page; yes starts the split; a sale made before the yes is posted to the maker alone and one made after is posted 60 and 40 (the journey runs the money job through its route and reads both people's balances); a no leaves the maker at 100% and mails them; a stranger gets 404; `showTheOwner` for both screens and the mail's text. Push. Expected: `browser` fails: 404.
- [ ] **Step 2 (green):** the routes. Push. Expected: all pass. Branch J is ready to merge after the Owner's "fine".

---

# Branch K: `sales/staff`

### Task 28: Extras in the staff queue

**Files:**
- Create: `src/routes/admin/extras/[extra]/+page.server.ts`, `+page.svelte`
- Modify: the staff waiting list (slice 2's branch S; extras join it), `src/features/extras/service.ts` (`takeOffSaleByStaff`), `mails.ts`, the play screen's server file (reads `?own=nothing` for the game's maker and staff only, and passes `ownNothing: true` to `startPlay`)
- Test: `tests/features/extras/service.pg.test.ts` (add cases), `mails.test.ts` (add cases), `tests/browser/staff-extras.test.ts`

- **The queue**: games and extras in one list, oldest first by when each was sent. An extra's row reads "Extra: `<name>`, for `<game>`, `<price>`".
- **An extra's page**: picture, name, one line, price, the season's days, the game's rating when the apps' plan has given games one; for a change, the live version beside the new one. "Play with it" and "Play without it" open the game in a new tab (the second with `?own=nothing`). Then "Accept" (blue) and "Send back" (red) with a box for the reason. For an extra on sale: "Take off sale" (red) with a reason.
- `takeOffSaleByStaff(input: { extraId; staffUserId; reason: string }): Promise<void>`: sets `takenOffAt`; 1 to 500 characters of reason.
- Every decision is written to slice 4's record of staff actions, with the staff member, the extra and the reason. The page is for the role that accepts games.
- After `acceptExtra` answers `wentOnSale: true`, the route calls the apps' plan's "an extra went on sale" with the game and the extra. Until that exists on `main`, nothing is called and nothing is built for it here.
- The mails to the maker (`mails.ts`, pure):
  - Accepted. Subject: "`<name>` is on sale". "`<name>` is on sale in `<game>` for `<price>`." For a change: subject "Your change to `<name>` is live", "Players now see the new version."
  - Sent back. Subject: "`<name>` was sent back". "We sent `<name>` back: `<reason>`. Change it and send it again: `<site>/make/<game>/extras/<id>`"
  - Taken off sale by staff. Subject: "`<name>` was taken off sale". "We took `<name>` off sale: `<reason>`. People who bought it keep it. Write to us if you think this is a mistake: `<support address>`"

- [ ] **Step 1 (red):** the launched line: a maker adds an extra and a season pass, staff see both in the queue under the game that was sent before them, play with and without (the tiny game reads "Level pack: yours", then "Level pack: locked"), accept both, and the game's page sells them; "Send back" with no reason is refused; the maker's screen then reads "Sent back: `<reason>`"; a member adding `?own=nothing` or hoping for every extra gets only what they bought; someone who is not staff gets 404; each decision is in the staff record; the three mails' exact words. Push. Expected: `browser` fails; `postgres` and `verify` in the new cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 29: The staff refund

**Files:**
- Create: `src/features/money/sale-refunds.ts`, `prisma/migrations/<timestamp>_sale_refund_requests/migration.sql`, `src/routes/admin/money/refunds/+page.server.ts`, `+page.svelte`
- Modify: `prisma/schema/money.prisma`, `src/features/money/money.ts`, `services.ts`
- Test: `tests/features/money/sale-refunds.pg.test.ts`, `tests/browser/staff-extras.test.ts` (add cases)

**The tables**, both added and never changed: `SaleRefundRequest` (`id`, `purchaseId`, `why SaleRefundWhy { mistaken_charge, minor, the_law }`, `askedById`, `askedAt`; one per purchase) and `SaleRefundApproval` (`requestId` the id, `approvedById`, `stripeRefundId`, `at`). A constraint trigger refuses an approval by the person who asked.

**Interfaces (produces):**
- `requestSaleRefund(deps: { db; clock }, input: { purchaseId; staffUserId; why }): Promise<{ requestId: string }>`: the purchase's order is `paid` and its source is `stripe` (a store's purchase: `MoneyError("INVALID", "This was bought in a store's app. Only that store can refund it.")`).
- `approveSaleRefund(deps: { db; clock; stripe: ExtrasStripe; orders }, input: { requestId; staffUserId }): Promise<void>`: a different person from the asker (else `MoneyError("INVALID", "A second person has to approve this.")`); `stripe.refund({ stripeChargeId, key: "sale-refund:<requestId>" })`, the whole purchase; the approval row; `orders.revokePurchase`. The ledger learns of it as it learns of any refund, from Stripe, on the next daily job (Task 17); nothing is posted here.
- `saleForRefund(db, stripeInvoiceId: string)` and `refundsWaiting(db)`: what the screen reads.

**The screen** (`/admin/money/refunds`, the `finance` role, with `freshCodeOnly` on both actions): a box, "The invoice number on the buyer's Stripe receipt", and "Find". The purchase found shows the extra, the game, the day and the amount, three choices ("A mistaken charge", "A minor's purchase", "The law requires it") and "Ask for a refund" (blue). Below: "Waiting for a second person", each with "Approve the refund" (red, since it takes money back) and "Leave it" (green). The asker sees their own request without the Approve button and the line "Someone else has to approve this."

- [ ] **Step 1 (red):** one person asks and cannot approve, in the function and in the database; a second approves, Stripe's stand-in is asked once however often the button is pressed, and the buyer's owned object no longer lists the extra; the daily job then posts the worked refund (Task 6's numbers); a store's purchase is refused with the words; a second request for one purchase is refused; `curator` gets 404; `showTheOwner`. Stubs. Push. Expected: `postgres` and `browser` fail in the new files and cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch K is ready to merge after the Owner's "fine".

---

# Branch L: `sales/take-down`

### Task 30: A game that leaves refunds its last 14 days

**Files:**
- Create: `prisma/migrations/<timestamp>_sale_take_downs/migration.sql`
- Modify: `src/features/money/sale-refunds.ts`, `daily.ts`, `prisma/schema/money.prisma`, the two places a game leaves (the maker's "take it off Ruken", slice 2's branch M; staff's, slice 4's branch D)
- Test: `tests/features/money/sale-refunds.pg.test.ts` (add cases), `tests/browser/take-down-refund.test.ts`

**The table:** `SaleTakeDown` (`purchaseId` the id, `gameId`, `leftAt`, `createdAt`), added and never changed: this purchase is to be refunded because its game left.

**Interfaces (produces):**
- `refundSalesOfGameThatLeft(deps: { db; clock; stripe; orders }, input: { gameId: string; leftAtMs: number }): Promise<{ refunded: number; waiting: number }>`: in one transaction, a `SaleTakeDown` for every purchase of the game whose order is `paid`, whose source is `stripe`, and whose `boughtAt` is later than `leftAtMs − 14 × 24 hours` (a repeat adds none); then `finishTakeDownRefunds`.
- `finishTakeDownRefunds(deps): Promise<{ refunded: number; waiting: number }>`: for every `SaleTakeDown` whose order is still `paid`: `stripe.refund({ stripeChargeId, key: "takedown:<purchaseId>" })`, then `revokePurchase`. One that Stripe refuses is counted as `waiting` and tried again by the next run; the others go on.
- Both places a game leaves call `refundSalesOfGameThatLeft` after the game's state has changed, with that moment. `runMoneyJob` gains a step, "refunding sales of games that left", before "reading refunds", which calls `finishTakeDownRefunds`; `MoneyJobReport` gains `takeDownRefunds: number`. A step that still has one waiting after a run makes the job's report say so (slice 5's "Needs a person" reads the report).
- A purchase from a store is not refunded here: the apps' plan sends the store's own way ("Settled for the apps' plan").

- [ ] **Step 1 (red):** `sale-refunds.pg.test.ts`: a purchase 13 days and 23 hours before the game left is refunded once, however often the function and the job run; one 14 days and 1 hour before stays sold and owned (Review Focus 16); a purchase already refunded by staff is left alone; Stripe failing for one purchase leaves it waiting and refunds the rest; after the daily job the two people of a 60/40 split carry the refund and what Stripe kept, and Ruken's accounts are where they were before the sale. The journey (the launched line): a member buys, the maker takes the game off Ruken, and the member's Stripe stand-in shows one refund. Stubs. Push. Expected: `postgres` and `browser` fail.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 31: A deleted account's extras

**Files:**
- Modify: `src/features/accounts/deletion.ts` (`purgeDueAccounts`), `src/routes/me/delete/+page.svelte`
- Test: `tests/features/accounts/deletion.pg.test.ts` (add cases), the delete journey (add a case)

- The delete screen gains one line, only for someone with a paid order: "Extras you bought go with your account. They are not refunded."
- `purgeDueAccounts`, in its own transaction as it treats a wishlist: the person's `OwnedFile` rows are deleted and their objects removed from the bucket; an `open` order becomes `cancelled`. `ExtraPurchase` rows stay: they hold ids and amounts, and the ledger posted them.
- A purged person in a game's split stays in its facts. Their share waits unpaid, as slice 5 leaves a closed account's money, until the maker changes the shares (Task 26 shows them as "(left Ruken)").

- [ ] **Step 1 (red):** after the purge the person has no owned object and no open order, and their purchases and the ledger's entries are unchanged; someone with no purchase does not see the line; someone with one does. Push. Expected: `postgres` and `browser` fail in the new cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch L is ready to merge.

---

# Branch M: `sales/money-screens`

### Task 32: Sales on a person's money page and on the staff month

**Files:**
- Modify: `src/features/money/views.ts`, the routes of slice 5's Tasks 27 and 32
- Test: `tests/features/money/views.test.ts`, `views.pg.test.ts`, the two screens' journeys (add cases)

Slice 5's screens are built first, as its plan says with the changes in "Slice 5's remaining branches, re-planned". This task adds what a sale shows.

- **A statement's lines**, added to slice 5's table of words (its Task 26), amounts through `dollars`:

| Line | Words | Example |
|---|---|---|
| `play`, `shared` true | "Your share of play in `<game>`" | $8.40 |
| `sale` | "`<n>` extras sold in `<game>`" ("1 extra sold") | $3.27 |
| `sale_cost` | "Fees that arrived later for `<game>`'s sales" | −$0.02 |
| `sale_refund` | "`<n>` refunds in `<game>`" ("1 refund") | −$1.33 |
| `sale_dispute` | "`<n>` disputes in `<game>`" ("1 dispute") | −$16.33 |

  Each game's lines sit under the game's name, with "`<game>` in all" after them when the game has more than one line (spec 5.7).
- **Under a game with a split**, one line: "You share `<game>` with `<n>` others." (or "1 other"), a link to the split screen for its maker and plain words for anyone else.
- **The staff month** (`monthSoFar`) gains `sales: { sold: number; paid: bigint; tax: bigint; fees: bigint; toGames: bigint; toRuken: bigint; refunded: bigint; disputed: bigint }`, read from the month's sale entries, and the screen gains a block "Extras" with those eight rows in those words: "Sold", "Paid by buyers", "Tax", "Fees", "To games", "To Ruken", "Refunded", "Disputed". `toRuken` is `paid − tax − fees − toGames`, worked out as slice 5 works out Ruken's half.

- [ ] **Step 1 (red):** one case per row of the table with its exact words, singular and plural; the worked sale's month shows the block's eight numbers and `toGames + toRuken + tax + fees === paid`; a person in a split with no game of their own opens their money page and sees their lines and no way into the game's own screens; a month with no sales shows no "Extras" block. Push. Expected: `verify`, `postgres` and `browser` fail in the new cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch M is ready to merge after the Owner's "fine".

---

# Branch N: `sales/real-site`

### Task 33: The five lines, on the real site

**Files:**
- Test: `tests/browser/sales-launched.test.ts`
- Modify: `docs/superpowers/progress.md`

- [ ] **Step 1:** one journey file that names the spec's five lines (section 6) and, for each, the journey that already proves it (Tasks 21, 22 and 23; 22; 28; 27; 30), running each once more end to end in one copy of the site: buy from the page, from the Extras button and from inside the game; a second member is refused the protected file; a maker's extra and season pass are accepted and sold; a second person says yes, and the next sale is split; a game leaves and its last purchase is refunded. Push. Expected: all pass; if one fails, the defect is in its own branch and is fixed there first.
- [ ] **Step 2 (a person, on the real site; the coordinator asks the Owner):** each of the five lines done once by hand, in Stripe's live mode with a real card and a real second account, with FloorFifty or a test game that has the script. The tracker records who did each, when, and the invoice's id from Stripe's own page. Connecting the second person's bank needs slice 5's branch E on the real site.
- [ ] **Step 3 (a person):** the first statement that pays a split is checked against the ledger, line by line, as slice 5's Task 37 checks its first statement: each person's lines add up to the game's entries, the shares are the split's, and the payout matches the statement. Until that is recorded, the tracker reads "built, not launched".

---

## Slice 5's remaining branches, re-planned

Slice 5's plan (`docs/superpowers/plans/2026-11-14-slice-5-money.md`) was written when a statement belonged to a maker and money came only from the pool. Its branches A to D are on `main` and are changed by this plan's branch F. Its branches E to K are not built. They are built from that plan, as written, with these changes. Each change is tested in the task it names, in that plan's own step style.

**Order.** E can be built at any time. F to J start after `sales/ledger` (this plan's branch F) is on `main`, so they are written once, for a person and not for a maker. K runs with this plan's branch N. The dates in that plan's launch notes (the 10th and 15th of December) are no longer promises: launch is set by the apps' plan. The rules they stand for (final on the 10th, paid on the 15th) stay.

| Slice 5's branch | Task | What changes |
|---|---|---|
| E `slice-5/bank` | 24, 25 | **Who may connect a bank**: anyone with a game, or in a split in force, or asked into a waiting one (`splitsWaitingFor`, or any `GameSplitShare` of theirs in a split with no end). Before, only someone with a game. Someone with none of these gets the missing page as before. The screen's words lose "your games": "Connect your bank to be paid." A new case: a person with no game who is in a split can connect. |
| F `slice-5/maker-money` | 26, 27 | **The page is a person's.** `makerMoney(deps, userId)` already reads one person's account and statements; it is shown to anyone with a statement, a balance that is not zero, or a split. For a person with no game, the maker's area shows only this page and the bank's (spec 5.6: "a small money page"): Task 27's journey adds that person, who sees "Your money" and no "Your games". `statementOf` keeps its rule that a person reads only their own. The statement's lines are grouped by game (this plan's Task 19 already orders them); the words for sale lines come with this plan's Task 32. |
| G `slice-5/payouts` | 28 to 31 | **Who is paid**: the candidates are every person with a balance on `maker:<id>:payable`, not every maker with a game. `PayoutCandidate.makerUserId` keeps its name (this plan's Call on column names). `PayoutCandidate` gains `held: bigint`, taken off what can be paid beside the questioned amounts, and always `0n` until the apps' plan fills it for Apple's held sales; Task 28 gains the case "an amount held is not paid and is not lost: it is in next month's `owed`". Each person's payout cost comes out of their own payout, as written. A balance below zero (a refund larger than the month's earnings) is `nothing_owed` and carries, as written. |
| H `slice-5/admin-money` | 32, 33 | Built as written. The "Extras" block comes with this plan's Task 32. "Needs a person" gains two lines, each only when true: "A take-down refund is waiting: Stripe refused it." (this plan's Task 30) and "A refund is waiting for a second person." (Task 29). Task 33's check of a payout run reads people, not makers; its words say "people paid" where they said "makers paid". |
| I `slice-5/split-page` | 34 | The public page `/split` keeps its five sentences about the pool and gains the sales paragraph of the maker agreement's version 2, word for word, and a second worked example from this plan's Task 6 (a $2.99 extra: tax, fees, 70 and 30, a 60/40 split). Its test that the page matches the agreement covers the new paragraph. It waits for the agreement's version 2 text. The page's name stays; "a game's split" in this plan is a different thing, and the page says "how a game's money is shared between people" in one sentence with no link to any game. |
| J `slice-5/questions` | 35, 36 | A person asks about any line of their own statement, a sale line included. The amount a question holds is that line's amount, as written. Nothing else changes. |
| K `slice-5/real-site` | 37 | The first statement checked by a person may be one with a split on it; if the first has none, this plan's Task 33, Step 3, is the check for the first that has. |

What does not change in slice 5: the pool's arithmetic, the bringing bonus, the months, the $25 minimum, the two-person approval, the question's hold. A game with no split rows pays its maker to the cent what slice 5 paid (this plan's Task 18 proves it).

## Settled for the apps' plan

The apps' plan builds the stores. These are decided here so both plans agree; none of it is built by this plan, because no store's purchase can exist before the apps do.

- **A store's price** (spec 5.5). One pure function, in `extras`: `storePriceCents(websiteCents: bigint, points: readonly bigint[] | "any_cent"): bigint | null`. The target is the website price plus 10%, compared in whole numbers (`store × 10 >= website × 11`), never by a rounded figure. With a list of the store's price points, the answer is the smallest point that meets the target; with `"any_cent"`, the smallest whole cent that does; with no point high enough, `null`: the extra is not sold in that store's app, and staff are told. Tests: $0.99 with Apple's list gives the first point at or above $1.089 (the spec's "$1.09" if the list holds it); `"any_cent"` gives 109.
- **The stores' price lists** are data in `src/features/extras/library/`, one JSON file per store, each with where it was read and the day. They are read from each store's own published list by whoever builds that store's source, never from memory; this plan could not open the stores' pages and writes none.
- **A store's sale in the ledger.** The store's source adds an `ExtraOrder` and an `ExtraPurchase` with its `source` and `sourceId` (the store's transaction id), `grossCents` what the buyer paid, `taxCents` the tax the store reports, and `feeCents` the store's cut **only when the store's notification states it**. The apps' plan audit found that Apple's and Google's notifications seem not to carry the cut; this plan could not open their pages to check. The shape holds either way: where the cut is not known at the sale, `feeCents` is 0 and the cut arrives later from the store's own money report as a later fee, posted by `postSaleFee`, which takes it from the game and Ruken "as if it had been known" (Task 4). So a purchase is never changed, and nobody types a rate. Until that report is posted the people's balances are too high by their part of the cut; the store's source therefore posts the report before a month is made final, and a sale whose cut has not arrived is held from that month's payout through `PayoutCandidate.held`. `postUnpostedSales` then posts it with `postSale`, whose cash account is `platform:store_clearing:<source>`; the apps' plan removes the "only `stripe`" filter with that source's test. `settleOrder`, `revokePurchase` and `restorePurchase` are the same calls for every source.
- **A store's refund** arrives by its notification and calls `revokePurchase` and the same `postSaleRefund`, with `feesKept` what the store kept.
- **Apple and a game that left** (spec 5.8; Q1). `refundSalesOfGameThatLeft` leaves Apple's purchases alone. The apps' plan adds: one email to each such buyer with Apple's refund page; `SaleHold` (`purchaseId` the id, `heldAt`, `until`) and `SaleHoldEnd` (`purchaseId` the id, `why { refunded, refused, time }`, `at`), both add-only; `until` is 97 days after the purchase under Q1's answer (a), with the 90 read from Apple's own page first; the people's parts of a held sale, added up per person, are `PayoutCandidate.held`. A hold ends when Apple's notification says refunded or refused, or when `until` passes in the daily job.
- **Blocking** (spec 5.6). The apps' plan adds its "may A reach B" check, from its feature `people`, to `proposeSplit`, both ways, with the sentence already in use: "We can't add that person."
- **A game's rating** (spec 5.5). `extrasOf` takes the apps' plan's "may this person see this game" and answers nothing when they may not; the buy addresses refuse the same way.
- **The hooks.** The apps' plan adds its areas to `GameMessage`, to `ruken-hooks.browser.js` and to `/make/hooks`. The envelope, the origin check and "one script" are this plan's.
- **Test and live copies.** Everything here reads its Stripe keys and bucket from the settings the apps' plan's first step splits in two; `OWNED_NOTE_KEY` is one key per copy.

## Notes for the plans that follow

- **The maker screens redesign (#96)** resumes with these screens in it: the game's extras, add an extra, one extra, who shares the money, saying yes or no, and a person's small money page. Branches I, J and M wait for its "fine".
- **The legal pages (#104)**: the refunds page says "No refunds on extras" with the three exceptions and the 14-day rule for a game that leaves; the terms name the EU and UK tick; the maker agreement's version 2 carries selling, the 70 and 30, splits, and that refunds and disputes come out of a game's earnings.
- **The wishlist**: its launch moment is one constant and moves with the apps' launch; nothing in this plan reads it.
- **FloorFifty** needs the script tag and one check of `ruken.extras.owned()`. That is the Owner's, in its own repository.
- **An extra's reports** go through the game's Report (spec 5.9); nothing is built for it.

## Self-review

- **Spec coverage.** 5.1: Tasks 20, 21. 5.2: Tasks 13, 14, 21; the stores' sheets are the apps' plan's. 5.3: Task 22. 5.4: Tasks 9 to 11, 23, 25. 5.5: Tasks 1 to 3, 24, 28; store prices are settled above and built with the stores. 5.6: Tasks 7, 8, 26, 27; blocking is the apps' plan's; the bank is slice 5's E, re-planned. 5.7: Tasks 4 to 6, 15 to 19. 5.8: Tasks 29, 30, 31; Apple's hold is Q1. 5.9: Tasks 28, 29, 32. 5.10: Tasks 8, 14, 28. Section 6: Task 33. Section 8: the Calls.
- **Not covered here, and where it is:** every store's purchase, price list and notification (the apps' plan); the look of the maker's screens (#96); the agreement's and the refunds page's words (#104).
- **Names.** `Share`, `splitSale`, `shareAmong`, `postSale*`, `splitInForce`, `splitsOver`, `ExtrasStripe`, `settleOrder`, `revokePurchase`, `restorePurchase`, `refreshOwned` and `extrasOf` are used in later tasks as their first task defines them.
