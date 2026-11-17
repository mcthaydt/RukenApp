# Plan audit: the apps' slice map, and slice A (the test copy and the live copy)

Date: 2026-11-14. Stage 3 (plan audit).

- Spec: `docs/superpowers/specs/2026-11-14-apps-and-player-features-design.md` (approved, #107, on `main` at `5a28504`).
- Plans: `docs/superpowers/plans/2026-11-14-apps-slices.md` and `docs/superpowers/plans/2026-11-14-apps-a-test-copy.md`, as pushed to `claude/project-thread-g6mes3` at `12c89dc` (#108).
- Read beside them: `CLAUDE.md`, `AGENTS.md`, `docs/superpowers/progress.md`, the makers' sales spec as on #106 (`3be9b8d`; its plan is not pushed yet, so the seams were checked against the spec and the slice map only), the main design's "One build, one Worker", slice 1's plan (S-steps and Workers Builds), and on `main`: `wrangler.jsonc`, `cloudflare/games/wrangler.jsonc`, `cloudflare/worker.js`, `src/hooks.server.ts`, `src/lib/server/db.ts`, `src/lib/server/mail.ts`, `src/features/launch/now.ts`, `src/features/membership/services.ts`, `prisma.config.ts`, `prisma/schema/pages.prisma`, the wishlist migration, `playwright.config.ts`, `tsconfig.json`, `package.json`, `.github/workflows/ci.yml`, `tests/architecture.test.ts`, `tests/wrangler.test.ts`, `tests/features/membership/services.test.ts`, `tests/browser/support/database.ts`.
- Read outside the repository: Apple's `JWSTransactionDecodedPayload` page and a developer-forum thread on per-transaction commission (search results only); Cloudflare's changelog, "Workers Builds: Node.js 24" (2026-07-30).
- No test ran: this is a plan audit, and no session runs tests (CLAUDE.md). No code was written.

Line numbers are those of the plans before the fixes below.

## Counts

| Rank | Found | Fixed in the plans here | Left |
|---|---|---|---|
| Blocks execution | 1 | 1 | 0 (one new Owner step, T0) |
| Should fix | 5 | 5 | 1 open fact (S5), and Q3 for the Owner |
| Note | 4 | 3 | 1 |

## Blocks execution

### B1. The live build never runs `pnpm run deploy`, so Task 4 would take the live site down

- Slice A, Tasks 3 and 4 (lines 249 to 339), and "Tasks 3 and 4 merge together" (line 113).
- The plan puts the claim in `package.json`'s `deploy` and relies on the live build running it. It does not. Since 2026-11-14 the `ruken` Worker's Deploy command in Workers Builds is the two steps written out, `pnpm exec prisma migrate deploy && pnpm exec wrangler deploy cloudflare/worker.js` (main design, "One build, one Worker"; `progress.md`, "The site's deploy only", #64). So after branch 1 merges, the live build migrates, skips the claim, and deploys the guard onto an unstamped database: every live page answers 503. Task 4 step 5 would not catch it, because it takes the build's success as proof of the stamp.
- **Fixed (slice A):** a new Owner step, T0, before branch 1 is marked ready: set the live Deploy command to `pnpm run deploy`. Task 4 step 4 waits for the Owner's "done" to T0. Step 5's pass is now the live `/healthz` answering `ok`, with what to run if it answers the 503 line. The stop rules name both.

## Should fix

### S1. The "every binding" test checks two kinds of binding

- Slice A, Task 7 (line 417) and Review Focus 2 (line 140).
- Review Focus 2 promises CI fails when a binding is added to the live copy and forgotten in `test`. The test compares only `hyperdrive`, `r2_buckets` and `vars`. A KV namespace, queue, service or Durable Object added later would slip through, and Wrangler carries none of them into an environment.
- **Fixed (slice A):** the test walks a written list of every key Wrangler does not carry into an environment, read from Wrangler's page when the test is written. A second case fails on any top-level key that is in neither that list nor the list of keys Wrangler does carry.

### S2. The spec's "database branch" against the plan's empty database

- Slice A, Call 1 (line 35); slice map, "Found while planning" 2.
- The departure is right in substance: a Neon branch starts as a copy of its parent, so it would carry live accounts into the test copy, which the same paragraph of the spec forbids. A separate project also gets its own password. But it changes the approved spec's words, and CLAUDE.md wants the Owner's words for that.
- **Fixed (slice A):** a third Owner question, Q3, with the empty database recommended. T1 waits for the answer. Nothing in branch 1 does.

### S3. Screens could ship before their feature switches exist

- Slice map, the slices table and line 69.
- The spec says "Each new screen ships behind a switch". The slice map put switches on new screens only "once S is on `main`", and S waits for slice 4's admin portal. So F, Q, B, P, V and K could put screens out with no switch.
- **Fixed (slice map):** S is now in "Must be on `main` first" for F, Q, B, P, V and K, with a paragraph saying only work with no screen of its own goes before S.

### S4. The seams with the sales plan break the layer rule as written

- Slice map, "What is shared with the makers' sales plan".
- `FEATURE_ORDER` on `main` is `accounts, membership, games, launch, play, money, pages, …`, and sales puts `extras` between `launch` and `play`. Sales looks a person up by handle for a split, and handles live in `pages` today (`MakerPage.handle`), which is above `extras`. Sales also asks "may A reach B" (slice B), and beta invites in `games` must too. The map did not say where either lives, and `tests/architecture.test.ts` refuses an import going up.
- **Fixed (slice map):** the handle lookup lives in `accounts`, which H moves the handle down to; "may A reach B" lives in a new feature, `people`, directly above `accounts`. **The sales plan thread has to agree to this.** The coordinator passes it on.

### S5. A store sale's fee may not be known when the sale is recorded (open)

- Slice map, the seam row for `ExtraPurchase`; the apps spec, "Buying in each app"; the sales spec, line 197.
- The seam fixes `feeCents` on the purchase row. Apple's transaction data carries the price, and this audit found nothing in it that carries Apple's commission; Google's notifications carry only a token. If the fee comes only from the stores' later reports, it has to be a fact added later, with the game's share held until then, or someone types a rate, which `AGENTS.md` forbids. This is not slice A's, and it was not confirmed against each store's full pages here.
- **Written into the slice map** as a seam row marked "Not settled", to check before the sales plan fixes `ExtraPurchase`'s shape.

## Notes

- **N1 (fixed).** T8 step 1 wrote out the gate's deploy instead of running `deploy:games:test`, the script Task 7 tests. It now runs the script with `--route` added.
- **N2 (fixed).** The T4 PowerShell line left the database password set in the window. It now clears it. `/healthz` now depends on the database and the stamp. That is intended, and the plan now says so (Call 9) and keeps the hooks comment true. `MAIL_ALLOWLIST` is now a stated choice (Call 8: left unset).
- **N3 (fixed).** The slice map's seam rows named `frame-messages.ts` and `ruken-hooks.browser.js` as if they were on `main`. Now marked as new, made by sales.
- **N4 (left).** The spec's "Coming soon" launch (slice L) will replace `LAUNCH_MS`. Task 5 builds on today's launch switch, so slice L's plan has to carry the test copy's rule across.

## Checked and found right

- The measures: 10 screens, 20 server files and 11 forms under `src/routes/` at `31cc54b`. No code changed on `main` between `31cc54b` and `5a28504`.
- The names the tasks change: `createLaunchNow(settings, clock)` and its exact error line; `readLiveSetting` and the order of checks in `createMembershipServices`; the test `build()` has no `STRIPE_API_BASE`, so Task 6's live-copy case does not throw; `prisma()` in `db.ts`; `reject_append_only_change` in the wishlist migration; the test "holds no variables and no route" in `tests/wrangler.test.ts`.
- The journeys' site gets `DIRECT_DATABASE_URL` from `playwright.config.ts`, so the claim works there. CI already runs `.ts` files with plain `node` (the fake servers), and `tsconfig.json` allows `.ts` imports and erasable syntax only. Workers Builds uses Node 24 by default (Cloudflare, 2026-07-30).
- The daily job goes through `site.fetch` (`cloudflare/worker.js`), so the guard covers it too.
- T5 lists every setting the code requires (`requireEnv`), and T8 covers the gate's two (`SITE_ORIGIN`, `PLAY_PASS_SECRET`). The test Hyperdrive is made with caching turned off, as the live one was (slice 1, Call 3).
- The seams against the sales spec: an extra carries its game's rating; a split adds people by handle only; a blocked person cannot be added; the store price rule gives $1.09 for $0.99, as the sales spec's example says; the reviews sit on the game's page.
- The drunk-grandma test: the one new line a visitor can see (Task 4's 503) and Q2's line are short, plain, and say what to do or what is true.

## Second pass: what was added in `293e1c9`

Date: 2026-11-14. Only what `d60a611` and `293e1c9` added: slice A's Tasks 9 to 11 and the changes around them, the slice map's "Signing the apps", and the two seam rows the plan threads agreed. Read beside them on `main` (`5a28504`): `src/routes/+layout.server.ts`, `src/routes/+layout.svelte`, `src/lib/look.css` (`.panel`), `src/lib/server/mail.ts`, `src/lib/server/job-secret.ts`, `src/features/pages/links.ts` and `handle.ts`, `src/features/games/clips.ts`, `prisma/schema/games.prisma`, `tests/fixtures/tiny-game/`, `tests/browser/support/look.ts`, `playwright.config.ts`. No test ran.

Nothing found blocks execution. The names the tasks use are on `main`: `MAX_LINKS` (30, exported through `pages.ts`), `looksLikeVideo`, `hasJobSecret`, `showTheOwner`, the `.panel` class, the six `GameState` values and two `GamePlaysOn` values, `tests/fixtures/tiny-game/`, and the journeys' `JOBS_SECRET`. The seams for the store fee and for `proposeSplit` agree with the first pass's S4 and S5. Branch 3 going before branch 2, so that the ten-minute timer never meets a Worker that runs the whole daily job on it, is right.

| Rank | Found | Fixed in the plans here |
|---|---|---|
| Blocks execution | 0 | — |
| Should fix | 3 | 3 |
| Note | 4 | 3 (N8 left) |

### S6. The banner's words cannot reach the layout as planned

- Task 9: `TEST_COPY_WORDS` lives in `src/lib/server/copy.ts`, and the line is drawn in `+layout.svelte`. That file is also built for the browser, and SvelteKit refuses to build a browser file that imports anything under `src/lib/server/`.
- **Fixed:** the layout's data carries `testCopyLine: string | null`, the words or nothing, and the layout imports nothing new.

### S7. "No mail server answers" a `.test` address, but Resend is still asked

- Task 10, Review Focus 7, Call 8. The made-up accounts' addresses end in `.test`, and nothing kept them from the mailer. Any flow that mails an account would hand one to Resend: a statement to a made-up maker from the test copy's money job, or, later, a friend request to a made-up player. Resend either refuses it, so that flow fails, or accepts it and it bounces. A bounce counts against the sending address the test copy shares with the live one (Call 8).
- **Fixed:** `src/lib/server/mail.ts` never sends to a `.test` address and answers `false`, as it does for the allowlist. This is tested first in `tests/lib/server/mail.test.ts`, as part of Task 10.

### S8. A handle a tester took would stop the seed for good

- Task 10. The test copy is open, so a tester can take a handle or slug before a later `content.json` adds it. The unique index would then fail the seed's one transaction every ten minutes, and nothing new would ever be written.
- **Fixed:** the seed looks each handle and slug up first, leaves out a maker whose handle a real person holds, with that maker's games, and names it in a new `skipped` field of the answer. It has its own database case.

### Notes

- **N5 (fixed).** The run is keyed on the content's hash only, so a change to the seed's code alone would never run. Now `content.json` carries a `version`, and any change to `write.ts` adds one to it.
- **N6 (fixed).** On the test copy, the banner pushes full-screen screens (slice 3's feed) down by its height. Task 9 now says so, so those slices' screen reviews expect it.
- **N7 (fixed, slice map).** Provisioning profiles expire after a year, as certificates do. Now both are tracked. The push key (A7) is made on the developer site's Keys page, not A3's Identifiers page. If Ruken's own download updates itself through Tauri's updater, that needs a key pair of its own, so slice 3's plan now has to say.
- **N8 (left).** The Signing section's facts (which certificate signs which app; that only the account holder can make a Developer ID certificate; that Play App Signing re-signs Android builds; that the Microsoft Store and Flathub sign their own packages) match what this auditor knows. They were not checked against Apple's, Google's or Microsoft's pages in this pass, and slices 1 and 3 read them from those pages, as the section says.
