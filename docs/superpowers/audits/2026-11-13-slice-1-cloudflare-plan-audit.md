# Slice 1 plan audit: the Cloudflare revision

Date: 2026-11-13. Stage 3 (plan audit) of slice 1, for the plan's revision from Netlify to Cloudflare.

Audited: the Cloudflare revision of `docs/superpowers/plans/2026-11-13-slice-1-accounts-membership.md` as merged to `main` by pull request #15 (`f8839b9`): the section "Cloudflare instead of Netlify", branch E0 (Tasks 32 to 34), the rewritten Tasks 16 and 20, the Stripe points in Tasks 22, 25, 26 and 28, and S1 and S2. Read against the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`, 7.3), `CLAUDE.md`, `AGENTS.md`, `docs/superpowers/progress.md`, the earlier audit (`docs/superpowers/audits/2026-11-13-slice-1-plan-audit.md`), the code on `main` (branch A, merged as pull request #13), and the archived `mcthaydt/RukenAppFailed` at `188e8a07546ba19c431468ddf2624e3cc4173d4e` (written `OLD/`).

What was run, and where: no test, lint, typecheck or build of this repository ran (CLAUDE.md: checks run only on GitHub's runners). To settle what reading could not, the published packages were downloaded into a scratch folder outside this repository and read: `@sveltejs/adapter-cloudflare` 8.0.2, `wrangler` 4.156.0, `miniflare` 5.20261023.3-beta (the one Wrangler 4.156.0 pins), `@sveltejs/kit` 3.0.0, `@prisma/client` and `prisma` 7.10.0, `stripe` 22.6.2, `better-auth` 1.7.7, `@better-auth/core` and `@better-auth/prisma-adapter` 1.7.7. In that scratch folder, and only there, these ran: `prisma generate` 7.10.0 for a one-table schema with a `workerd` and a `nodejs` generator; `vite build --ssr` 8.3.3 of a file importing the `workerd` client, without and with the plugin Task 34 now has; `wrangler deploy --dry-run` 4.156.0 of the result; `wrangler types` 4.156.0 on the plan's `wrangler.jsonc`; `tsc` 6.0.3 on a file importing `cloudflare:workers`; Wrangler's `getPlatformProxy` on the plan's `wrangler.jsonc`; and Vitest (5.1.0, the version `npx` fetched; 5.0.3 would not install there) with a probe plugin. Web pages were read for Resend's and Cloudflare's current rules. Where a finding rests on one of these, it says so.

Severity: **blocks execution** (the plan as written would stop execution, fail for the wrong reason, or fail on the real site); **should fix** (wrong, missing or unsafe, but execution could get past it); **note** (small, or kept on purpose).

Every finding is fixed in the plan in the same commit as this audit, unless its line says why it stays.

## Counts

| Severity | Found | Fixed in the plan | Stays |
|---|---|---|---|
| Blocks execution | 5 | 5 | 0 |
| Should fix | 9 | 9 | 0 |
| Note | 10 | 4 | 6 |

## Checked and found right

- The package versions and dates: `@sveltejs/adapter-cloudflare` 8.0.2 was published 2026-10-29 and asks for `@sveltejs/kit ^3.0.0-next.0` and `wrangler ^4.118.0`; `wrangler` 4.156.0 was published 2026-10-29. Both as the plan says.
- Adapter 8 gives a request no `platform`: its `files/worker.js` calls `server.respond(req, { getClientAddress })` only and imports `env` from `cloudflare:workers`. It writes the Worker to whatever `main` names in the Wrangler file, reads the assets binding's name from there, and writes `.assetsignore` with `_worker.js`, so the plan's `wrangler.jsonc` and Task 20's "`main` stays the adapter's file" are right.
- `pg` 8.23.1 depends on `pg-cloudflare` (1.4.1 in the lockfile), which it uses on Workers through `cloudflare:sockets`.
- Stripe 22.6.2 has a `workerd` export (its worker build), `Stripe.createFetchHttpClient`, `Stripe.createSubtleCryptoProvider`, `webhooks.constructEventAsync` and `webhooks.generateTestHeaderStringAsync`. Its fetch client keeps the given `fetch` in a local variable, so the global `fetch` is never called as a method. Its pinned API version is `2026-08-26.dahlia` (`esm/apiVersion.js`); this is now written into S2 as what to expect.
- Wrangler 4.156.0: `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>` is the variable `wrangler dev` reads for a Hyperdrive binding; `CLOUDFLARE_INCLUDE_PROCESS_ENV` puts the process's environment into the Worker when there is no `.dev.vars` file; `wrangler dev` and `wrangler deploy` both take a Worker file as an argument; `--test-scheduled` is the flag, and Miniflare answers `/cdn-cgi/local/scheduled` (200 `ok`, or 500 when the handler throws).
- The Cron Trigger wrapper (`cloudflare/worker.js`) matches the adapter's `fetch(req, env)` and adds `scheduled`; the job still only knocks on the site's own address with `JOBS_SECRET`.
- A pull request cannot reach the real database: no Workers build runs for it (preview builds off), the migrations are only in the deploy command, CI holds no Cloudflare login or secret, and the committed Hyperdrive id is useless without the Owner's login. One guard was added (S6 below).
- The Owner's S1 steps are in a workable order: Workers Paid and the domain first, the database and Hyperdrive next, the id into `main`, then mail, the empty Worker, its secrets, its address and only then the connection to the repository. Two gaps are fixed below (S4, S5).
- Every Netlify assumption on `main` has a task that removes it: `vite.config.ts` and `package.json` (Task 34), `env.ts` and `env.test.ts` (Task 32), `background.ts` and `background.test.ts` (Task 33), `db.ts` (Task 34), `mail.ts` and nodemailer (Task 32), `playwright.config.ts` (Tasks 32 and 34). The ignore files, `.env.example` and a comment were only implied; they are now named, and a test checks that no file names Netlify (S2).
- The Workers runtime story: `nodejs_compat` with a compatibility date after 2025-04-01 gives `process.env` and `node:crypto`; one database client per request; `waitUntil` from `cloudflare:workers`; Hyperdrive's cache off; Workers Paid for the CPU of a password check. All as Cloudflare's pages and the packages say.

## Findings

### Blocks execution

**B1. Vite's build cannot load Prisma's WebAssembly import.** Task 34, step 2; "Checked by CI, not by reading", first item.
A client generated by Prisma 7.10.0 with `runtime = "workerd"` loads its query compiler with `await import("./query_compiler_fast_bg.wasm?module")` (`internal/class.ts`). In the scratch folder, `vite build --ssr` 8.3.3 stopped on it: "No such file or directory", because Vite's bundler reads `?module` as part of the file's name. The plan left this as an open risk with a stop rule; it is not open, it fails. Wrangler's own bundler does load `.wasm?module`.
*Fixed:* Task 34 adds a small plugin of its own to `vite.config.ts` (no package) that leaves `*.wasm?module` imports external with their absolute path, for Wrangler to bundle. In the scratch folder this built, and `wrangler deploy --dry-run` 4.156.0 bundled the module (3,744.64 KiB, 1,221.07 KiB gzipped). The stop rule now names this plugin as the one fix, then stop.

**B2. Vitest would start Cloudflare's local stand-in and fail.** Task 34, step 2 (`verify` and `postgres`).
The adapter's Vite plugin calls Wrangler's `getPlatformProxy` from `configureServer` (read in its `index.js`); SvelteKit 3.0.0 adds the adapter's plugins in every Vite server (read in `src/exports/vite/index.js`); and Vitest runs every plugin's `configureServer` before any test (seen with a probe plugin: it ran with `VITEST=true`, and its error stopped Vitest). With the plan's `wrangler.jsonc`, `getPlatformProxy` throws "When developing locally, you should use a local Postgres connection string to emulate Hyperdrive functionality…" (seen). So `pnpm test` and `pnpm test:pg` would fail before running a test.
*Fixed:* Task 34's `vite.config.ts` gives the adapter only when `process.env.VITEST` is not `"true"`, with the reason in a comment; `tests/wrangler.test.ts` checks the guard is there.

**B3. Typecheck and lint could not see `cloudflare:workers`.** Task 34.
`wrangler types` writes `worker-configuration.d.ts` at the root, but `tsconfig.json` includes only `src`, `tests` and three config files, and Task 34 did not touch it. `src/lib/server/cloudflare.ts` would fail svelte-check ("cannot find module") and ESLint's typed rules.
*Fixed:* Task 34 adds the file to `tsconfig.json`'s `include` and lists `tsconfig.json`. The generated file also declares the Workers' own `Request`, `Response` and so on beside the browser's: with `skipLibCheck: true` (as on `main`), `tsc` 6.0.3 accepted a file using `cloudflare:workers`, `Request` and `document` together; with it off, it reported 102 errors inside the declaration files. The plan now says `skipLibCheck` stays on, and why.

**B4. Task 33 would break the carried sign-in tests.** Task 33; Task 9's `auth.pg.test.ts`.
Task 9 keeps the group "mail after the answer" (`OLD/apps/web/src/lib/server/auth/auth.pg.test.ts`, cases at old lines 1123 and 1154). The second case imports `keepBackgroundWorkAlive`, which Task 33 removes, so typecheck would fail; both build better-auth without `runInBackground`, so mail goes through the default `runAfterAnswer` (`OLD/…/auth.ts` line 119), which after Task 33 calls `platform()` and throws "No platform is set". Task 33 named only `platform.test.ts` and `background.test.ts`.
*Fixed:* Task 33 lists `auth.pg.test.ts` and says how the group changes, keeping what each case proves (a platform set in `beforeEach`; the second case hands its mail to a `waitUntil` it can see). The carried "wiring" case of `background.test.ts` is rewritten to check `setPlatform(` in the hook. The expected red names the `postgres` failure too.

**B5. Building the sign-in services outside a request would fail once `prisma()` is per request.** Task 34; Task 11's `services.test.ts`.
`betterAuth()` starts its set-up at once (`createBetterAuth` calls `initFn(options)` in `better-auth` 1.7.7, `dist/auth/base.mjs`), and the Prisma adapter reads `prisma._runtimeDataModel` during that set-up (`@better-auth/prisma-adapter` 1.7.7). Task 34's stand-in `prisma()` throws outside a request, so `createAuthServices` in `services.test.ts` (a unit test, no request) would end in an unhandled rejection, which fails Vitest's run. Inside the site it is fine: the services are first built inside a request. Read in the packages; not run.
*Fixed:* Task 34 has `services.test.ts` build the services inside `databasePerRequest(() => ({}) as PrismaClient)`, with the reason; the expected red names it.

### Should fix

**S1. Resend refuses a request without a `User-Agent`.** Task 32.
Resend's API reference and its "403 error 1010" page say every request must carry a `User-Agent` header and one without it gets 403. Task 32 named only `Authorization` and `Content-Type`. CI would not notice (its `fetch` is a fake); the first real sign-up mail (Task 16 step 5) would.
*Fixed:* the mailer sends `User-Agent: ruken`, with a comment; the first Task 32 test checks it. The same task now also says the chosen `fetch` is called as a plain function, because Workers refuse `fetch` called as a method of another object.

**S2. Some Netlify leftovers had no task, and nothing checked for them.** Task 34.
`.gitignore`, `.prettierignore` and `eslint.config.js` list `.netlify/`; `.env.example` says "Netlify's environment settings" and keeps `DATABASE_URL`, which the site stops reading; `playwright.config.ts` has the comment "as they do on Netlify". Task 34 listed these files but not what changes in them.
*Fixed:* Task 34 says what each loses and gains, what `.env.example` keeps (`DIRECT_DATABASE_URL`, with what reads it; `DATABASE_POOL_MAX`, optional), and `tests/wrangler.test.ts` gains a case: no file the site is built or tested from names Netlify.

**S3. The journeys' database helper would load the Workers client in Node.** Task 29.
`tests/browser/support/database.ts` makes "one Prisma client" from `TEST_DATABASE_URL`. Playwright runs in Node; the app's client is generated for Workers and imports its WebAssembly in a way Node cannot load. The plan did not say which client.
*Fixed:* Task 29 says the Node client from `tests/support/generated/prisma` with `PrismaPg`; the file map lists both generated pieces.

**S4. A Custom Domain is refused while a DNS record for that name exists.** S1 step 8.
A domain moving from Netlify, or one parked at a registrar, often has an A or CNAME record at the site's address; Cloudflare then refuses the Custom Domain ("already has externally managed DNS records"). The redirect template for the other spelling also needs a proxied record for that name.
*Fixed:* step 8 says to delete a record at exactly that name first (leaving Resend's records), and to add the proxied `AAAA 100::` record the redirect template asks for when there is none.

**S5. Connecting the repository may build at once.** S1 steps 9 and 10.
Cloudflare's pages do not say whether connecting a Worker to a repository starts a build. Step 10 assumed the first deploy waits for the next merge.
*Fixed:* step 9 says it comes after steps 6 to 8 (so a build that starts finds the secrets and the address), names the setting by both of its current labels ("Builds for non-production branches", "Enable preview builds"), and step 10 asks the Owner to say whether a build started by itself and how it went. Part one's step 4 says why part two waits for the id.

**S6. Nothing stopped a config change from pointing the journeys at the real Hyperdrive.** Task 34; Review Focus 12.
Wrangler reaches a real Hyperdrive in `wrangler dev` when its binding has `"remote": true` (read in Wrangler 4.156.0). CI has no login, so it would fail there today, but the plan's "a pull request cannot reach the real database" rested on that alone.
*Fixed:* `tests/wrangler.test.ts` refuses a `remote` or `localConnectionString` key on the binding; the plan's point 7 says so.

**S7. The three stop rules were not clear enough to act on.** Task 34 step 3.
They did not say what each failure looks like in the log, what the one fix is, or what to do with a failure that is none of the three. The WebAssembly one said "do not add a plugin", which is now the fix.
*Fixed:* each rule names its signs, its one fix (or none), and "then stop and report to the coordinator"; any other failure of the green push is a stop at once. The visitor's address: Miniflare sets `CF-Connecting-IP` from the caller when a request lacks it (read in its `entry.worker.js`), so it is expected to work; no fix is allowed if it does not. Wrangler's runtime: a warning that pnpm skipped `workerd`'s or `sharp`'s install script is not a failure.

**S8. The Owner's four answers were recorded only as Calls.** Plan, design 7.3, progress.md.
*Fixed:* each is written as "Owner, 2026-11-13" where it applies: the package list approved exactly; mail through Resend with plain `fetch`; the Hyperdrive id committed in `wrangler.jsonc`; Workers Paid at $5 a month. The plan's decisions list has a "Cloudflare" group; branch E0 no longer waits for the list.

**S9. The tracker was out of date.** `docs/superpowers/progress.md`.
It had the Cloudflare revision on a branch and its plan session running, the first plan audit on a branch, branch A not merged, and the package list waiting.
*Fixed:* the revision is merged (pull request #15) and its plan session archived; the first plan audit merged (pull request #12); branch A merged (pull request #13), branch B on pull request #14; the Owner's answers ticked; this audit session added. The branch rows A and B are the execution session's and were not changed.

### Notes

**N1. Fixed.** The unit of Stripe's `receivedAt` was left for execution to look up. It is milliseconds (22.6.2 divides it by 1000 in `validateComputedSignature`), so `verifyStripeWebhook` passes `nowMs` as it is. Task 25 says so.

**N2. Fixed.** Task 20's three checks are answered by the packages (above). The help text of `--test-scheduled` still names `/__scheduled`; the path that works is `/cdn-cgi/local/scheduled`. The wrapper's synthetic request has no `cf-connecting-ip`, so the job route must not need the visitor's address. Task 20 says both.

**N3. Fixed.** The tests' Prisma client is a second generated client with its own error classes. Carried code reads `error.code === "P2002"` by shape, so nothing breaks, but `instanceof` on a Prisma error would pass in the site and fail in the tests. Task 34 says not to use it.

**N4. Fixed.** The "What this changes in tasks already built" table now lists `vite.config.ts` and the ignore files (Task 1), `auth.pg.test.ts` (Task 9) and `services.test.ts` (Task 11).

**N5. Stays.** A new Prisma client per request instantiates the query compiler each time (a few milliseconds of CPU). Workers Paid allows 30 seconds a request; it is the documented way. Measure if the Worker's log ever shows CPU near a limit.

**N6. Stays.** The bundled WebAssembly is about 1.2 MB gzipped (measured above), well inside Workers Paid's 10 MB; it would not fit Workers Free's 3 MB with the rest of the site for long, which is one more reason the paid plan is needed.

**N7. Stays.** `wrangler` 4.156.0 pins `miniflare` `5.20261023.3-beta`, a pre-release label. It is what that Wrangler ships; the lockfile pins it, and CI runs it.

**N8. Stays.** `better-auth` 1.7.7 lists `@sveltejs/kit ^2.0.0` as an optional peer, and this app has 3.0.0. pnpm warns and installs; the plan does not use better-auth's SvelteKit helper (`forward.ts` is its own). Not part of the Cloudflare revision; no change.

**N9. Stays.** With `CLOUDFLARE_INCLUDE_PROCESS_ENV` the whole runner environment becomes the Worker's settings under `wrangler dev`. CI's `browser` job holds no secret, so nothing leaks; a developer running the journeys on their own machine would hand their shell's environment to a local Worker, which never leaves that machine.

**N10. Stays.** Better-auth's set-up runs once, inside the first request that builds the services. For Prisma it does no database work there (its schema check reads the generated data model), so nothing crosses from one request to another. If a later better-auth version starts querying during set-up, that query would run on the first request's connection; Task 34's per-request rule would then need a look.

## What execution should expect

Task 34's first green CI run is still the first proof that the site builds and runs on Workers. This audit settled by reading and scratch builds what could be settled; it did not run this repository's site in `wrangler dev`, and it did not touch a Cloudflare, Neon or Resend account.
