# Plan audit: makers' sales (extras and splits)

Date: 2026-11-14. Stage 3 (plan audit).

- Spec: `docs/superpowers/specs/2026-11-14-makers-sales-design.md` (approved, #106, on `main` at `c66c731`).
- Plan: `docs/superpowers/plans/2026-11-14-makers-sales.md`, as pushed to `claude/project-thread-300r65` at `2fa0235` (#109).
- Read beside it: `CLAUDE.md`, `AGENTS.md`, `docs/superpowers/progress.md`, the apps' spec (on `main`), the apps' slice map and its plan audit (#108, `claude/project-thread-g6mes3`), slice 5's plan where this plan leans on it (M1, the fee report's limits).
- Read as code on `main` (`c66c731`): `src/features/play` (all of it), `src/lib/files/safe-path.ts`, `src/lib/safe-next.ts`, `src/features/games/files-check.ts`, `src/features/membership/{checkout,events,service,services,subscription,stripe-port}.ts`, `src/features/money/{fees,fee-report,reversal-posting,payment-posting,pool-posting}.ts`, `src/features/accounts/{age,deletion}.ts`, `src/features/pages/{handle,pages.browser}.ts`, `src/routes/webhooks/stripe/+server.ts`, `prisma/schema/{play,money,accounts}.prisma`, the statements migration, `cloudflare/games/{worker.ts,wrangler.jsonc}`, `wrangler.jsonc`, `tsconfig.json`, `playwright.config.ts`, `tests/architecture.test.ts`. Every name in the plan's "What this plan relies on" that it says is on `main` was looked for there; all are, except `safeNext` (it is `safeNextPath`).
- Read on branches not merged: slice 2's `slice-2/submit` (`/make/[game]` takes a slug; `ClipPicker.svelte` sits beside its screen), `legal/pages` (no support address).
- Read outside the repository, from the packages themselves (downloaded with `npm pack` into a scratch folder, not installed in the repository): `stripe` 22.6.2's type files, and `wrangler` 4.156.0's built source for `r2 bucket lifecycle add`.
- Searched but not opened (the session has no page reader it may use without a subagent): Apple's refund page, Stripe's Invoicing pricing pages.
- No test ran: this is a plan audit, and no session runs tests (CLAUDE.md). No code was written.

Line numbers are those of the plan at `2fa0235`.

## Counts

| Rank | Found | Fixed in the plan here | Left |
|---|---|---|---|
| Blocks execution | 3 | 3 | 0 |
| Should fix | 10 | 9 | 1 (S10, a fact still to read) |
| Note | 7 | 4 | 3 (reported, not this plan's) |

## Blocks execution

### B1. The script tag a maker adds is refused when their game is pulled

- Tasks 10, 11 and 25 (lines 541, 572, 967).
- The plan's one line for makers is `<script src="/__ruken/hooks.js"></script>`. On `main`, `checkGameFiles` refuses any `src` or `href` in `index.html` that starts with one `/` (`TOP_OF_SITE_ADDRESS`, `src/features/games/files-check.ts:58` and `:117`): "index.html loads /__ruken/hooks.js from the top of the site…". So every game that follows the makers' page, the tiny test game included, would be refused at pull, and every journey that adds that game would fail.
- **Fixed (Task 10):** exactly `/__ruken/hooks.js` is allowed; every other top-of-site address is refused as before. Two cases in `files-check.test.ts`.

### B2. A charge would be repeated on the member's next membership renewal

- Task 13, `payNow` (line 636: "an invoice item, an invoice …").
- Made in that order, the item has no invoice. Stripe 22.6.2's own text for `invoiceItems.create`'s `invoice`: "For subscription invoices, when left blank, the invoice item will be added to the next upcoming scheduled invoice. For standalone invoices, the invoice item won't be automatically added unless you pass `pending_invoice_item_behavior: 'include'`", and `pending_invoice_items_behavior` "Defaults to `exclude`". So the extra's invoice would be for $0 (and "paid"), and the extra would be charged again on the membership's next renewal invoice, posted by slice 5 as membership money.
- **Fixed (Task 13):** the invoice first, with `pending_invoice_items_behavior: "exclude"`, then the item on it by id; the idempotency keys in that order. `paidInvoice` refuses `amount_paid` of 0 and a currency other than `usd`, as `readPaidPremiumInvoice` does. A new case in Task 14: no item is left waiting on the customer.

### B3. A second press, or a return from Stripe's page, could cancel a payment that then goes through

- Task 14, `buyExtra` steps 4 and 5 (lines 661 to 662); Task 13, `voidOrder` and `payPage` (lines 637, 639).
- Step 4 voids and cancels any open order Stripe says is not paid yet. Two presses at once: the second can reach step 4 while the first is between `finalizeInvoice` and `pay`, and void it. Step 5's "reads the first one's order and waits on it" says no more than that. And an open order sent to Stripe's page has a Checkout session, not only an invoice: `voidOrder` voided invoices only, and a Checkout page lives 24 hours by default. A buyer who pays on the old page after a later press cancelled the order is charged, and the order's forward-only trigger forbids `cancelled → paid`: charged and no extra, the first failure the spec names.
- **Fixed (Tasks 13 and 14):** an open order under 2 minutes old with no Checkout page is left alone, and the press answers "You're already buying this. Give it a moment."; an older one is closed by `voidOrder`, which now voids the invoice and expires the page (`checkout.sessions.expire`, read in the package) and answers `was_paid` when Stripe says it was paid meanwhile, which settles the order instead. Checkout pages for extras expire after 30 minutes (`expires_at`; the package: "anywhere from 30 minutes to 24 hours"). A paid answer for an order already cancelled is reported, never dropped. Review Focus 1 and Task 14's tests are changed to match, with two new cases.

## Should fix

### S1. The protected-folder check would run on an address that is still encoded

- Task 10 (line 543). `normalizePath` decodes the path (`safe-path.ts`). A check on "a path that starts `ruken-extras/`" made on the raw address lets `ruken%2Dextras/level-pack/secret.txt` through, and the gate would serve it after decoding.
- **Fixed:** every check in the gate runs on the name after `normalizePath`; Review Focus 4 and Task 10 gain the encoded case.

### S2. A refunded buyer keeps the protected files until the end of the day

- Task 10. Game files go out with `cache-control: private, max-age=<the pass's seconds left>` (`gate.ts`), up to 24 hours. After a refund or a lost dispute the browser would serve `ruken-extras/` files from its own cache.
- **Fixed:** protected files go out with `private, no-cache`; the browser revalidates by etag (a 304), and the gate checks ownership each time.

### S3. The script as a `.js` file bundled as text

- Tasks 10, 11, the file map and the tech stack. A `.js` file under `src/` with a Worker text rule raises questions `main` cannot answer without an install: whether the SvelteKit TypeScript setup reads `.js` files (then `window.ruken` fails strict typecheck, and a default import of the file has no default export), and whether lint reads it. `.browser.` also already means "safe for a screen to import" (`src/features/pages/pages.browser.ts`).
- **Fixed:** the script is a string, `HOOKS_SCRIPT`, in `src/features/play/hooks-script.ts`. No Worker config changes. Its test runs it with `new Function` as before, and checks it holds no `${`.

### S4. Someone whose age is unknown would not be asked for the guardian tick

- Task 14 (line 656). `User.adultOn` is nullable, and the schema says "Null means the age is unknown, and every under-18 default applies". "`adultOn` is after today" is false for null.
- **Fixed:** "after today or null", with a test case.

### S5. The confirming email and a staff email name a support address that does not exist

- Tasks 14 and 28 (lines 675 to 679, 1055). "The support address is the one slice 1's mails use": slice 1's mails name none, and the legal pages' branch adds none.
- **Fixed:** a stop. If no support address is on `main` when Task 14 starts, the session asks the coordinator; the address is the Owner's.

### S6. `/make/hooks` would take the page of a game named "Hooks"

- Task 25 (line 959). On slice 2's branch, `/make/[game]` takes a game's slug (`gameForMaker(slug, …)`), and slugs reserve no words. SvelteKit prefers the fixed route, so a game slugged `hooks` would lose its maker page.
- **Fixed:** the page is `/help/hooks`. `help` is in `RESERVED_HANDLES`, so no maker's page can take `/help`. The same problem in slice 2 is N5.

### S7. The buy card in `src/lib/`

- Task 21 (line 829). CLAUDE.md: `src/lib/` is "shared helpers with no feature logic", and there are no screen components outside `src/routes/` on `main`; slice 2 keeps a shared piece beside its screen (`src/routes/make/[game]/ClipPicker.svelte`).
- **Fixed:** `src/routes/g/[game]/BuyCard.svelte`, beside the game's page and the play screen that both show it.

### S8. Staff look a purchase up by a number the buyer never sees

- Task 29 (lines 1072 to 1074). The box asks for "The invoice number on the buyer's Stripe receipt", and `saleForRefund` takes Stripe's invoice id. What a receipt prints is the invoice's `number` (or the charge's `receipt_number`), not its `in_…` id.
- **Fixed:** `ExtraPurchase` keeps `invoiceNumber` and `receiptNumber` (it is new in this plan, so nothing changes an existing table); Task 13's first step reads which one the receipt email prints; the screen finds by it.

### S9. The signing key's commands

- M-S1 (lines 102 to 103). The Mac's own `openssl` is LibreSSL, which may not make Ed25519 keys (not checked here), and the plan itself distrusted the PowerShell line's binary pipe. `OWNED_NOTE_KEY` was also missing from `playwright.config.ts`, where every journey's settings are, so branch D's journeys would not start.
- **Fixed:** one `node -e` line for both computers, writing base64 text; `importOwnedKey` trims spaces and line ends first; Task 9 adds a test-only key to `playwright.config.ts` beside `PLAY_PASS_SECRET`.

### S10. Stripe's fee for an invoice made by Ruken (open)

- M-S2. Stripe has a page titled "Pricing for post-payment invoices for one time purchases via Checkout and Payment Links", beside its Invoicing pricing page, so a one-off invoice (made by the API or by Checkout's `invoice_creation`) very likely carries an Invoicing fee on top of the card and Tax fees. The page was found, not read. Whether that fee names the invoice in Stripe's fee report is exactly what M-S2 reads, and slice 5's M1 asks the same of the membership's Billing fee. M-S2 stays as written. If its stop is hit, one way the Owner could be offered that keeps "off the top" is to charge an extra as a plain payment with the saved card and Stripe Tax's own calculation, with no invoice; that is a redesign of Tasks 13 and 14 and is not made here.

## Notes

- **N1 (fixed).** `proposeSplit` ended a waiting split before checking "Those are the shares already.", so a repeat would cancel the waiting one. The check now comes first.
- **N2 (fixed).** The spec's "only adults in the United States can be in a split" is half enforced: age at the add, country only when the bank is connected (Ruken cannot know it before). The yes-or-no page now says, before the buttons, "To be paid, you need a bank account in the United States."
- **N3 (fixed).** `safeNext` is `safeNextPath`; `ensureProduct` (as `ensurePremiumProduct`, with `tax_behavior: "exclusive"` and the membership's tax code, which the Owner's accountant already checks) and Checkout's `invoice_data.metadata` (so the webhook can tell an extra's invoice) and `adaptive_pricing: { enabled: false }` are now named in Task 13.
- **N4 (fixed).** One pass per person, game and day (`passFor`) means "Play with it" and "Play without it" share a pass; the latest Play decides for every tab on it. Said in the Call.
- **N5 (reported, slice 2).** `/make/new` and `/make/github` on `slice-2/submit` take the place of a game slugged `new` or `github`, for the same reason as S6. Not this plan's to fix.
- **N6 (left).** A sale whose fees are more than its price (Review Focus 6) leaves the game at nothing and Ruken below zero on that sale. The $0.99 floor keeps ordinary fees under the price; a dispute's $15 comes from the people, as the spec says.
- **N7 (left).** Q1 (how long a sale Apple never answers about is held) is still with the Owner. Nothing in this plan builds the hold.

## Facts read for the planner's stops

| What the plan could not check | What was read | Result |
|---|---|---|
| The Stripe calls in Task 13 | `stripe` 22.6.2's `.d.ts` files | All exist as named: `invoices.createPreview` (with `invoice_items` and `customer`), `invoices.create`, `invoiceItems.create` (with `invoice`), `invoices.finalizeInvoice`, `invoices.pay` (`payment_method`, `off_session`), `invoices.voidInvoice`, `refunds.create`, `checkout.sessions.create` (`invoice_creation`, `invoice_data.metadata`, `adaptive_pricing`, `expires_at`), `checkout.sessions.expire`, `subscriptions.retrieve` (`default_payment_method` on the subscription), `paymentMethods.retrieve`. The invoice's tax is `total_taxes` and its payments `payments`, as `readPaidPremiumInvoice` already reads them. |
| M-S3, where the card is | the same types | `Subscription.default_payment_method` exists. Where Checkout actually saves it is still a test-mode read (Task 13, step 0). |
| The wrangler R2 lifecycle line | `wrangler` 4.156.0's source | `r2 bucket lifecycle add` takes `bucket`, `name`, `prefix` as positionals and `--expire-days`; it prompts only for what is missing. The plan's line is right as written. Not run. |
| M-S2, the fee on a one-off invoice | search results only | Open (S10). |
| Apple's 90 days | search results only (Apple's page `support.apple.com/118223` was found, not read) | Open. Q1's option (a) keeps "read from Apple's own page first". |
| The stores' price lists | not read | The plan writes none and builds none; the apps' slice $ reads them. |
| Whether stores' notifications state their cut | the apps' plan audit's S5 | Matches: this plan already takes a store's cut as a later fee with the sale held. |

## Checked and found right

- **The layer rule.** `FEATURE_ORDER` on `main` is `accounts, membership, games, launch, play, money, pages, …`; `extras` between `launch` and `play` lets `play` and `money` import it and lets it import `accounts`, `membership`, `games`, `launch`; it never needs `pages` (the picture checks move to `src/lib/files/`, and handles move to `accounts` with the apps' slice H).
- **The gate.** It reads only the bucket, has no database, and checks the pass on every request; `owned/` keys can never be served as media (the clip and photo patterns) or as game files (`files/`); `/__ruken/` is already the gate's own (`/__ruken/health`); the frame has `allow-same-origin`, so the origin check and the script's `fetch` work.
- **The money arithmetic.** Every worked number in Task 4 was recomputed by hand: 99/0/33 gives 66, 46, 20; 323/24/39 gives 260, 182, 78 and 109, 73 by largest remainder; the 2-cent later fee comes 1 and 1 off the people and leaves Ruken at 78; the full refund gives 133 and 88 (108 + 25, 72 + 16) and adds up to zero. The later fee's lines match how a membership's later fee is posted today (cash and the parts, not `processor_fees`, `payment-posting.ts:141`), and `reversePaymentLines` negates exactly on a full refund.
- **The webhook.** An extra's `invoice.paid` reaches `recordInvoicePaid`, which answers `not_premium` because `readPaidPremiumInvoice` finds no subscription; an extra's Checkout is skipped because its `kind` is not `premium`. Task 14's proof stays.
- **The ledger's shape.** `JournalEntryKind`, `StatementLineSource`, `PoolShare_play_key` (`"period", "gameId" WHERE kind = 'play'`), `FeePosting`, `StripeReversal`, `knownIds` and `placeRow` are as the plan describes them.
- **The seams** with the apps' slice map, row by row: owners, the envelope, reserved folders, the store price rule, the handle in `accounts`, `people` above `accounts`, `wentOnSale` from the staff route, and the store's later fee. They agree.
- **The spec, section by section** (5.1 to 5.10, 6): each line is a task or is named as another plan's, as the plan's self-review says.
- **The drunk-grandma test** on every new line of words: each screen has one blue forward button and a green way out; the new lines added here ("You're already buying this. Give it a moment.", "To be paid, you need a bank account in the United States.", "The number on the buyer's Stripe receipt") are short and say what is true or what to do.
