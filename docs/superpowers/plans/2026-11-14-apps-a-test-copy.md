# Test Copy and Live Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second, separate copy of Ruken, the test copy, runs beside the live one with its own Worker, database, bucket and games address, and neither copy can be pointed at the other's data by mistake. The test copy says that it is the test copy on every page, and it is filled with made-up makers, players and games, so every screen can be seen there before real content exists.

**Architecture:** One repository and one build serve both copies. `wrangler.jsonc` says which copy a Worker is with one variable, `RUKEN_COPY`, and gives the test copy its own bindings in a Wrangler environment named `test`. Each database carries a one-row stamp saying which copy owns it: the deploy command writes it once, and the running site refuses to answer when the stamp and its own `RUKEN_COPY` disagree. One line is added at the top of every page, on the test copy only. The made-up content is written by a job that only the test copy will run.

**Tech Stack:** as on `main` (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Wrangler 4.156.0, `pg` 8.23.1). **No new package and no new secret.** One new variable in `wrangler.jsonc`, and one new feature folder, `seed`.

**Spec:** `docs/superpowers/specs/2026-11-14-apps-and-player-features-design.md`, "Test copy and live copy" (approved by the Owner, 2026-11-14: "Approved"). Owner, 2026-11-14: "we need a dev vs prod setup and the ability to A | B test". Read it with `CLAUDE.md`, `AGENTS.md`, `docs/superpowers/progress.md` and the slice map beside this file (`2026-11-14-apps-slices.md`). This is slice A there.

**Principle served:** "Money is exact" and "Privacy by default": a test purchase can never reach the live ledger, and a live person's account can never reach the test copy.

**Planned against:** `main` at `31cc54b`. Everything this plan touches is on `main` as code.

**Not in this plan** (each is another slice in the slice map): feature switches (slice S), the store builds that point at the test copy (slices 1 to 3), sandbox store purchases (slice $), A/B tests (after launch).

## Global Constraints

- No session runs tests, lint or typecheck itself. Push, then read CI on the pull request (CLAUDE.md, Owner 2026-11-13).
- Every task is test-first, in two pushes: red (the test, plus stubs that throw `not built yet` so lint and typecheck pass), then green. Open the pull request as a draft at the first push. Mark it ready only when the branch's last task is green.
- No new dependency. `.github/workflows/ci.yml` and `auto-merge.yml` do not change.
- This repository is public. No secret, real address, domain or key goes in. The test copy's Hyperdrive id goes in `wrangler.jsonc` as the live one does (Owner, 2026-11-13: committed here; it is not a credential).
- The spec's words: the test copy has "its own Worker, database branch, bucket and games address"; it "uses Stripe test mode"; "Live builds point only at the live copy, and the two never share data."
- Names, exactly: the variable `RUKEN_COPY` with the values `test` and `live`; the Wrangler environment `test`; the Workers `ruken-test` and `ruken-games-test` (Wrangler's own naming for an environment: `<name>-<environment>`); the bucket `ruken-games-test`; the table `CopyStamp`.
- Time comes from an injected `Clock`. Nothing here needs one: the stamp's only time is the database's own `createdAt`.
- Tests live only in `tests/`, mirroring `src/`. Comments say why, never which plan asked.
- One line is added to every page on the test copy (Task 9), and one line is what a visitor sees if a copy is wired wrong (Task 4). Both are written in their tasks and pass the drunk-grandma test: one short sentence each. No other screen changes.
- The made-up content is plainly made up. It names no real person, game or company, never says a game is "AI-free", and no made-up account can be signed in to or sent mail.

## The Calls in this plan

Each is the plan writer's choice, shown here so the Owner or the coordinator can overrule it.

1. **A database of its own, filled with made-up content, not a branch of the live one.** The spec says "database branch". A Neon branch starts as a full copy of its parent (Neon's own pages), so it would carry every live account into the test copy, and the same sentence of the spec forbids that. Owner, 2026-11-14, when asked: "I'd prefer a mock database so we can see everything actually in the app without being blocked by content". So the test copy gets a new Neon project named `ruken-test`, and Tasks 10 and 11 fill it with made-up makers, players and games.
2. **A Stripe sandbox for the test copy.** The live copy itself runs in Stripe's test mode until the Owner opens live payments. A sandbox keeps the test copy's customers and webhooks apart from it.
3. **`RUKEN_COPY` is a variable in `wrangler.jsonc`, not a secret typed in Cloudflare.** It is not secret, and written in the file it cannot be typed wrong on one Worker. `tests/wrangler.test.ts` today says the file "holds no variables"; Task 1 changes that test to "holds exactly one".
4. **The stamp and the guard.** Nothing else stops a wrong database id in the config from sending test sales into the live ledger. The cost is one small query the first time each Worker instance wakes.
5. **Migrate, then claim, then deploy.** The claim needs the table a migration makes. A deploy pointed at the wrong database therefore runs the migrations there before the claim refuses. That is safe: both copies follow `main`, so those are migrations that database was about to get anyway, and no code is deployed.
6. **The test copy is open whatever the date.** The spec's test purchases need a site that is open. The journeys already have a setting for this, `LAUNCH_TEST_SWITCH=on`, refused anywhere but this machine. Task 5 also allows it on the test copy, and nowhere else.
7. **One Wrangler file with an environment, not a second file.** Cloudflare's own pages give this shape for a lasting second Worker: an `env` block, `wrangler deploy --env test`, and the repository connected to both Workers.
8. **The test copy sends real mail and runs the daily job**, as the live one does, so what is tested is what runs. Its mail comes from "Ruken Test". `MAIL_ALLOWLIST` (which `src/lib/server/mail.ts` has for a test environment) is left unset: the only real addresses in the test copy's database are the ones testers signed up with themselves, an allowlist would need a new setting for every tester, and the made-up accounts are never mailed (Task 10).
9. **`/healthz` now asks the database.** It answered without the database before. With the guard (Task 4) in front of everything, it answers `ok` only when the database is reachable and stamped for this copy, which is what T0 and T9 check.
10. **The made-up content is written by the test copy itself, every ten minutes if it has changed.** The job runs inside the test Worker, which already holds the database and the bucket, so no key leaves Cloudflare and the Owner has no step. It first compares one hash, so a run with nothing new is one small query. The live copy has neither the timer nor a working address for it.
11. **The seed writes rows directly, as the tests' helpers do.** Accepting a game is slice 4's and pulling one needs GitHub, so no service on `main` can make a live game. One test reads everything back through each feature's own service, so it fails when a feature's shape moves.
12. **The made-up games all run the same tiny game, and their clips are plain coloured loops.** Real-looking clips need real files that someone has the right to use. The Owner can swap any of them later by uploading through the maker's screens on the test copy.
13. **A made-up account cannot be signed in to.** This repository is public, so any password written here would open those accounts to anyone who found the test copy's address. Testers sign up with their own address.

## The Owner's answers (2026-11-14)

Quoted as given, to the three questions this plan asked.

- **Q1, where the test copy's games run:** "1.A". A second, separate domain used only for the test copy's games. It is the first step of T8.
- **Q2, whether the test copy says that it is the test copy:** "2. Just use a banner on the top of pages". Task 9.
- **Q3, an empty database in place of the spec's "database branch":** "3. I'd prefer a mock database so we can see everything actually in the app without being blocked by content". Not a branch and not empty: a database of its own, filled with made-up content. Call 1, Tasks 10 and 11.

## Where execution stops and waits for the Owner

The Owner's steps are commands to paste, one line each. They are written for the Owner's Mac; where Windows PowerShell differs, the PowerShell line follows it. `PASTE`, `TEST-ADDRESS` and words in capitals are filled in by the Owner and never typed into the repository or the chat, except the two values the steps ask for by name.

**Before branch 1 is marked ready: T0.** The live Worker's build runs the Deploy command typed in its settings, not `package.json`: since 2026-11-14 that is `pnpm exec prisma migrate deploy && pnpm exec wrangler deploy cloudflare/worker.js`, written out (the design, "One build, one Worker"; `docs/superpowers/progress.md`, "The site's deploy only"). Task 3's claim lives in `pnpm run deploy`, so without T0 the live build would deploy Task 4's guard to an unstamped database, and every live page would answer 503. Send T0 to the coordinator word for word when Task 3 is green.

- **T0.** The live Worker's Deploy command (a website: Workers Builds has no command for its settings). Cloudflare → Workers → `ruken` → Settings → Build → Deploy command: `pnpm run deploy`. Save. Say "done". Branch 1 is not marked ready until then.

**Before branch 2 starts: T1 to T3.** Send them to the coordinator word for word when branch 1's pull request is opened.

- **T1.** A database of its own for the test copy. It starts empty; the test copy fills it with made-up content by itself (Task 11).
  1. `npx -y neonctl@9.5.0 projects list` (signs in the first time; note the live project's region).
  2. `npx -y neonctl@9.5.0 projects create --name ruken-test --pg-version 16 --region-id LIVE-REGION` (Postgres 16 is what CI tests on. It prints a connection address that holds a password. Keep it for T2, T4 and T7; it goes nowhere else.)
- **T2.** Cloudflare's connection pool in front of it: `npx -y wrangler@4.156.0 hyperdrive create ruken-test --connection-string "PASTE" --caching-disabled`. Tell the coordinator the `id` it prints. The id is not a secret.
- **T3.** The test copy's bucket: `npx -y wrangler@4.156.0 r2 bucket create ruken-games-test`.

**After branch 2 is merged and green on `main`: T4 to T10.**

- **T4.** Make the test Worker, from a clone of this repository: `git switch main && git pull && pnpm install && pnpm build && DIRECT_DATABASE_URL="PASTE" pnpm run deploy:test`
  PowerShell: `git switch main; git pull; pnpm install; pnpm build; $env:DIRECT_DATABASE_URL="PASTE"; pnpm run deploy:test; Remove-Item Env:DIRECT_DATABASE_URL` (the last part clears the password from the window)
  It prints the test copy's address, `https://ruken-test.SOMETHING.workers.dev`. That is `TEST-ADDRESS` below. Pages answer errors until T5 is done.
- **T5.** The test Worker's settings. A typed one is `npx -y wrangler@4.156.0 secret put NAME --name ruken-test` (it asks for the value). A random one is `openssl rand -hex 32 | npx -y wrangler@4.156.0 secret put NAME --name ruken-test` (PowerShell: `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ([BitConverter]::ToString($b) -replace '-','') | npx -y wrangler@4.156.0 secret put NAME --name ruken-test`).

  | NAME | Its value |
  |---|---|
  | `BETTER_AUTH_SECRET` | random |
  | `JOBS_SECRET` | random, a different one |
  | `BETTER_AUTH_URL` | `TEST-ADDRESS`, with `https://` and no slash at the end |
  | `RESEND_API_KEY` | a new sending key made for the test copy (Resend's website: no command makes a key without a key) |
  | `MAIL_FROM` | `Ruken Test <THE-LIVE-SENDING-ADDRESS>` |
  | `STRIPE_LIVE` | `false` |
  | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | from T6 |
  | `LAUNCH_TEST_SWITCH` | `on` |
  | `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` | a second GitHub App named "Ruken Test", made with slice 2's G2 step 1 with `TEST-ADDRESS` in place of the site (a website: GitHub has no command for making an app) |
  | `GAME_ADDRESS_PATTERN`, `PLAY_PASS_SECRET` | from T8 |

- **T6.** A Stripe sandbox (a website: Stripe has no command that makes a sandbox). In Stripe, make a sandbox named "Ruken test copy". Inside it, repeat slice 1's S2 with `TEST-ADDRESS`: Stripe Tax, the customer portal, and a webhook to `TEST-ADDRESS/webhooks/stripe`. Its secret key and the webhook's signing secret are T5's two Stripe values.
- **T7.** Connect the repository to the test Worker (a website: Workers Builds has no command for it). `ruken-test` → Settings → Builds → connect this repository, branch `main`, the same build command as the live Worker, deploy command `pnpm run deploy:test`, and one build secret, `DIRECT_DATABASE_URL`, with T1's address. From then on every merge to `main` deploys both copies.
- **T8.** The test copy's game gate. First a website: buy a second domain used only for the test copy's games (Owner, 2026-11-14: "1.A"; no command can buy a domain), put it on this Cloudflare account, and make its `*` record as in slice 2's G3 step 1. That domain is `TEST-GAMES-DOMAIN`. Then:
  1. `pnpm run deploy:games:test -- --route "*.TEST-GAMES-DOMAIN/*"` (the script Task 7 tests, with the route added on the command line)
  2. `s=$(openssl rand -hex 32); printf %s "$s" | npx -y wrangler@4.156.0 secret put PLAY_PASS_SECRET --name ruken-test; printf %s "$s" | npx -y wrangler@4.156.0 secret put PLAY_PASS_SECRET --name ruken-games-test` (one new secret, given to both test Workers; PowerShell as G3 step 3 with the two `--name` endings)
  3. `printf %s "TEST-ADDRESS" | npx -y wrangler@4.156.0 secret put SITE_ORIGIN --name ruken-games-test` (PowerShell: `"TEST-ADDRESS" | npx …`)
  4. `printf %s "https://{name}.TEST-GAMES-DOMAIN" | npx -y wrangler@4.156.0 secret put GAME_ADDRESS_PATTERN --name ruken-test` (type `{name}` as it is)
- **T9.** Check it: `curl -s TEST-ADDRESS/healthz` (PowerShell: `(Invoke-WebRequest -UseBasicParsing "TEST-ADDRESS/healthz").Content`). Expect `ok`.
- **T10.** Look at it. Open `TEST-ADDRESS` in a browser. Expect the line "Test copy. Nothing here is real." at the top of every page, and, within ten minutes of T5, made-up makers at addresses like `TEST-ADDRESS/CONTENT-HANDLE` (the coordinator sends three handles from the seed). Say "done", or say what looks wrong.

**Stop rules, beyond CLAUDE.md's.** Stop and report at once if: the Owner has not said "done" to T0 when branch 1 is otherwise ready; the first live deploy after branch 1 merges does not succeed, or the live `/healthz` does not answer `ok` after it (Task 4, step 5); CI's `browser` job fails anywhere but the step a task names; or `node` cannot load `scripts/claim-copy.ts` on a runner.

## How a task runs

As slice 1's plan ("How a task runs"), word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved.

Both branches are logic and config and run in the cloud.

## Branches

| # | Branch | Tasks | Ends with | Waits for |
|---|---|---|---|---|
| 1 | `apps-a/copy` | 1 to 6, 9 | every Worker knows which copy it is, each database is stamped, a mismatch answers 503, and the test copy says what it is | nothing |
| 3 | `apps-a/fake-content` | 10, 11 | the made-up content, and the job that writes it on the test copy only | branch 1 merged |
| 2 | `apps-a/test-worker` | 7, 8 | the `test` environment for both Workers, and its deploy commands | T1 to T3, and branches 1 and 3 merged |

Branch 2 is last on purpose. Its `test` environment adds a ten-minute timer, and Task 11 is what teaches the Worker that this timer only writes the made-up content. Without Task 11 on `main`, that timer would run the whole daily job every ten minutes.

**Tasks 3 and 4 merge together, in branch 1, and never apart.** Task 3 makes the deploy stamp the database. Task 4 makes the site refuse a database with no stamp. Task 4 on `main` without Task 3 would take the live site down at its next deploy.

## File map

| File | Task | What it is responsible for |
|---|---|---|
| `src/lib/server/copy.ts` (new) | 1, 2 | The `Copy` type; reading `RUKEN_COPY`; reading and claiming a database's stamp. Imports nothing, so plain Node can load it in the deploy command |
| `src/lib/server/copy-guard.ts` (new) | 4 | The request hook that refuses to answer when the Worker's copy and the database's stamp differ |
| `scripts/claim-copy.ts` (new) | 3 | A thin command-line wrapper: `node scripts/claim-copy.ts <test\|live>` |
| `prisma/schema/copy.prisma` (new), `prisma/migrations/<timestamp>_copy_stamp/migration.sql` (new) | 2 | The `CopyStamp` table |
| `src/hooks.server.ts` | 4 | Adds the guard after the database hook |
| `src/features/launch/now.ts` | 5 | Allows the launch test switch on the test copy |
| `src/features/membership/services.ts` | 6 | Refuses live payments on the test copy |
| `wrangler.jsonc`, `cloudflare/games/wrangler.jsonc` | 1, 7 | `RUKEN_COPY`; the `test` environment |
| `package.json` | 3, 7 | `deploy` claims; `deploy:test` and `deploy:games:test` |
| `playwright.config.ts` | 3 | The journeys' database is claimed before the site starts |
| `tsconfig.json` | 3 | Typechecks `scripts/` |
| `.env.example` | 1 | Says where `RUKEN_COPY` comes from |
| `tests/lib/server/copy.test.ts`, `copy.pg.test.ts`, `copy-guard.test.ts` (new) | 1, 2, 4 | |
| `tests/browser/copy.test.ts` (new) | 3, 9 | The journeys' database really is stamped; the live copy shows no test line |
| `src/routes/+layout.server.ts`, `src/routes/+layout.svelte` | 9 | The test copy's line at the top of every page |
| `src/features/seed/seed.ts`, `content.ts`, `write.ts` (new) | 10 | The made-up content: reading it, checking it, writing it once per change |
| `src/features/seed/library/` (new) | 10 | `content.json`, the tiny game's files, two clips, and a README saying how each file was made |
| `prisma/schema/seed.prisma`, `prisma/migrations/<timestamp>_seed_run/migration.sql` (new) | 10 | The `SeedRun` table |
| `src/lib/server/mail.ts` | 10 | Never sends to a `.test` address |
| `src/routes/jobs/seed-test-copy/+server.ts` (new), `cloudflare/worker.js` | 11 | The job's address, and the timer that knocks on it |
| `tests/features/seed/content.test.ts`, `seed.pg.test.ts`, `tests/browser/seed-job.test.ts` (new), `tests/architecture.test.ts` | 10, 11 | |
| `tests/wrangler.test.ts`, `tests/cloudflare/games-worker.test.ts`, `tests/features/launch/now.test.ts`, `tests/features/membership/services.test.ts` | 1, 3, 5, 6, 7 | |

## Review Focus

The ways this is most likely to hurt someone, most likely first. Each has its test in the task that owns the code.

1. **The test Worker's database id is the live one's** (a paste mistake in `wrangler.jsonc`). Expected: every page of the test copy answers 503 and nothing is read or written but the stamp. Task 4 (the mismatch case) and Task 7 (the two ids must differ).
2. **A new binding is added to the live Worker and forgotten in the `test` environment.** Wrangler does not carry bindings into an environment, so the test Worker would deploy without it. Expected: CI fails. Task 7 ("the test copy has every binding the live copy has").
3. **A live Stripe key is typed into the test Worker.** Expected: the site refuses to start its payment services, with a line that says why. Task 6.
4. **The database is briefly down when a Worker instance wakes.** Expected: that request answers 503, nothing is remembered, and the next request checks again. Task 4.
5. **`LAUNCH_TEST_SWITCH=on` is typed into the live Worker.** Expected: as today, every page fails instead of the site opening early. Task 5 keeps the existing refusals and adds the live copy's.

6. **The made-up content reaches the live copy.** Expected: it cannot. The job's address answers 404 on the live copy, the function refuses any copy but `test` before it writes a row, and the live Worker has no ten-minute timer. Tasks 10, 11 and 7.
7. **A made-up account is signed in to, or sent mail.** Expected: neither can happen. It has no password and no sign-in row, and its address ends in `.test`, which the mailer never sends to, whatever flow asks (a statement, a later slice's friend request). Task 10.
8. **The seed overwrites what a tester did.** Expected: it never deletes, and it writes only rows it made itself. Task 10.

---

### Task 1: Which copy this is

**Files:**
- Create: `src/lib/server/copy.ts`, `tests/lib/server/copy.test.ts`
- Modify: `wrangler.jsonc`, `tests/wrangler.test.ts`, `.env.example`

**Interfaces:**
- Produces: `type Copy = "test" | "live"`; `readCopy(source?: Readonly<Record<string, string | undefined>>): Copy`, with `process.env` as the default source.

- [ ] **Step 1 (red): the tests.** Push with `readCopy` a stub that throws `not built yet` and `wrangler.jsonc` unchanged.

`tests/lib/server/copy.test.ts`:

```ts
describe("readCopy", () => {
  it.each(["test", "live"] as const)("answers %s when RUKEN_COPY says so", (copy) => {
    expect(readCopy({ RUKEN_COPY: copy })).toBe(copy);
  });

  it.each([undefined, "", "prod", "Test", "live "])("refuses %j and says where it is set", (value) => {
    expect(() => readCopy({ RUKEN_COPY: value })).toThrow(
      'RUKEN_COPY must be "test" or "live". wrangler.jsonc sets it.',
    );
  });
});
```

`tests/wrangler.test.ts`: add `vars?: Record<string, string>` to `WranglerConfig`. Replace the test "holds no variables and no route: those are the Owner's, set in Cloudflare" with these two:

```ts
// The one variable in this file. It is not a secret, and written here it cannot be typed wrong on one Worker.
it("says it is the live copy, and holds no other variable", () => {
  expect(wrangler().vars).toEqual({ RUKEN_COPY: "live" });
});

it("holds no route: that is the Owner's, set in Cloudflare", () => {
  for (const key of ["route", "routes"]) expect(wrangler()).not.toHaveProperty(key);
});
```

Add to `describe("what runs the site")`:

```ts
// The deploy command loads this file in plain Node, before any build, so it can import nothing.
it("src/lib/server/copy.ts imports nothing", () => {
  expect(read("src/lib/server/copy.ts")).not.toMatch(/^\s*import\s/m);
});
```

Expected: `verify` fails in `copy.test.ts` with `not built yet` and in `wrangler.test.ts` on `vars`. `postgres` and `browser` pass.

- [ ] **Step 2 (green):** write `readCopy`. Add `"vars": { "RUKEN_COPY": "live" }` to `wrangler.jsonc` with a comment saying what it is and that the `test` environment sets its own. In `.env.example` add a comment line: `RUKEN_COPY` is "test" or "live", set in `wrangler.jsonc`, never typed as a secret. Push. Expected: all pass.
- [ ] **Step 3:** commit, tick the tracker, report.

### Task 2: The database's stamp

**Files:**
- Create: `prisma/schema/copy.prisma`, `prisma/migrations/<timestamp>_copy_stamp/migration.sql`, `tests/lib/server/copy.pg.test.ts`
- Modify: `src/lib/server/copy.ts`

**Interfaces:**
- Consumes: `Copy` (Task 1).
- Produces, in `src/lib/server/copy.ts`:
  - `type RunSql = (sql: string, values: readonly string[]) => Promise<readonly Record<string, unknown>[]>`: one SQL statement with its values, answering its rows. Prisma's client and `pg`'s pool can each be wrapped as one, which is why the stamp is read and written through it.
  - `stampedCopy(run: RunSql): Promise<Copy | null>`: the database's stamp, or null when it has none.
  - `claimCopy(run: RunSql, copy: Copy): Promise<void>`: stamps an unstamped database; does nothing when the stamp is already `copy`; throws when it is the other one.

**The table**, in `prisma/schema/copy.prisma`, with a comment saying it is the one table whose id is not a cuid, because it has exactly one row:

```prisma
/// Which copy of Ruken this database belongs to. One row, added by the first deploy and never changed.
/// CHECKs: CopyStamp_one_row, CopyStamp_copy_check. Trigger: CopyStamp_append_only.
model CopyStamp {
  id        Int      @id @default(1)
  copy      String
  createdAt DateTime @default(now()) @db.Timestamptz
}
```

The migration is made with `prisma migrate diff` from `main`'s schema, as earlier migrations were, then by hand at its end: `CHECK ("id" = 1)` named `CopyStamp_one_row`; `CHECK ("copy" IN ('test', 'live'))` named `CopyStamp_copy_check`; and the add-only trigger `CopyStamp_append_only`, written as `WishlistMail_append_only` is in `20261114130000_wishlist`.

**The two statements `claimCopy` runs, in this order** (fixed text; the copy is the only value, passed as `$1`):

```sql
INSERT INTO "CopyStamp" ("id", "copy") VALUES (1, $1) ON CONFLICT ("id") DO NOTHING
SELECT "copy" FROM "CopyStamp" WHERE "id" = 1
```

When the row read is not `copy`, it throws: `This database belongs to the <found> copy of Ruken, and this is the <copy> copy. Nothing was changed.`

- [ ] **Step 1 (red):** `tests/lib/server/copy.pg.test.ts`, in the style of `tests/features/launch/schema.pg.test.ts`, with `run` wrapping the test database's Prisma client as `(sql, values) => prisma.$queryRawUnsafe(sql, ...values)`:
  - a new database has no stamp: `stampedCopy(run)` is `null`;
  - `claimCopy(run, "test")` then `stampedCopy(run)` is `"test"`;
  - claiming `"test"` a second time resolves, and there is still one row;
  - after `"test"` is claimed, `claimCopy(run, "live")` rejects with `This database belongs to the test copy of Ruken, and this is the live copy. Nothing was changed.`, and the stamp still reads `"test"`;
  - two `claimCopy(run, "live")` calls started together on an unstamped database both resolve, with one row;
  - the row cannot be updated or deleted (`CopyStamp_append_only`), a second row with `id` 2 is refused (`CopyStamp_one_row`), and `copy: "prod"` is refused (`CopyStamp_copy_check`).

  Push with both functions as stubs and the schema unchanged. Expected: `postgres` fails in `copy.pg.test.ts` only. `verify` and `browser` pass.
- [ ] **Step 2 (green):** the schema, the migration and the two functions. Push. Expected: all pass, the migrations drift check included.
- [ ] **Step 3:** commit, tick the tracker, report.

### Task 3: The deploy claims the database

**Files:**
- Create: `scripts/claim-copy.ts`, `tests/browser/copy.test.ts`
- Modify: `package.json`, `playwright.config.ts`, `tsconfig.json`, `tests/wrangler.test.ts`

**Interfaces:**
- Consumes: `readCopy`, `claimCopy`, `RunSql` (Tasks 1, 2).
- Produces: `node scripts/claim-copy.ts <test|live>`. It reads the database's address from `DIRECT_DATABASE_URL`, claims it, prints `This database is the <copy> copy's.` and exits 0. On any failure it prints the error's message and exits 1.

- [ ] **Step 1 (red):** push the tests only.

`tests/wrangler.test.ts`, in `describe("deploying")`:

```ts
// Migrate, then claim, then deploy: the claim needs the table a migration makes, and no code goes out to a
// database that belongs to the other copy.
it("the deploy command claims the database for the live copy, after migrating and before deploying", () => {
  const deploy = scripts().deploy ?? "";
  const claim = "node scripts/claim-copy.ts live";
  expect(deploy).toContain(claim);
  expect(deploy.indexOf("prisma migrate deploy")).toBeLessThan(deploy.indexOf(claim));
  expect(deploy.indexOf(claim)).toBeLessThan(deploy.indexOf("wrangler deploy"));
});

it("the journeys' site claims its database the same way, before it starts", () => {
  const config = read("playwright.config.ts");
  const claim = "node scripts/claim-copy.ts live";
  expect(config).toContain(claim);
  expect(config.indexOf("prisma migrate deploy")).toBeLessThan(config.indexOf(claim));
  expect(config.indexOf(claim)).toBeLessThan(config.indexOf("wrangler dev cloudflare/worker.js"));
});

it("typechecking sees scripts/", () => {
  expect((JSON.parse(jsoncText("tsconfig.json")) as { include: string[] }).include).toContain("scripts");
});
```

`tests/browser/copy.test.ts`: one journey, "the journeys' database is stamped as the live copy's", which reads the stamp through a new `copyStamp(): Promise<string | null>` in `tests/browser/support/database.ts` and expects `"live"`. It starts with `test.beforeEach(forgetRateLimits)` like every journey file.

Expected: `verify` fails in the three new `wrangler.test.ts` cases; `browser` fails in `copy.test.ts` only, with `null`.

- [ ] **Step 2 (green):**
  - `scripts/claim-copy.ts`: read the copy with `readCopy({ RUKEN_COPY: process.argv[2] })`; open one `pg` pool of one connection on `DIRECT_DATABASE_URL`; call `claimCopy` with `(sql, values) => pool.query(sql, [...values]).then((result) => result.rows)`; close the pool in every case. A comment says why it uses `pg` and not Prisma's client: the client is generated by the build, and this must also run where nothing has been generated.
  - `package.json`: `"deploy": "pnpm exec prisma migrate deploy && node scripts/claim-copy.ts live && pnpm exec wrangler deploy cloudflare/worker.js"`.
  - `playwright.config.ts`: the site's command becomes `pnpm exec prisma migrate deploy && node scripts/claim-copy.ts live && pnpm build && pnpm exec wrangler dev cloudflare/worker.js --port 4173 --test-scheduled --persist-to .wrangler/state`.
  - `tsconfig.json`: add `"scripts"` to `include`.

  Push. Expected: all pass. The `browser` job passing is the proof that plain Node loads the script on a runner; if it cannot, stop and report.
- [ ] **Step 3:** commit, tick the tracker, report. Do not mark the branch ready: Task 4 goes out with this one.

### Task 4: A Worker pointed at the wrong database answers nothing

**Files:**
- Create: `src/lib/server/copy-guard.ts`, `tests/lib/server/copy-guard.test.ts`
- Modify: `src/hooks.server.ts`

**Interfaces:**
- Consumes: `Copy`, `readCopy`, `stampedCopy` (Tasks 1, 2); `prisma()` from `src/lib/server/db.ts`.
- Produces: `copyGuard(deps: CopyGuardDeps): Handle`, where

```ts
export interface CopyGuardDeps {
  /** Which copy this Worker is. */
  copy(): Copy;
  /** Which copy the database says it belongs to, or null when it has no stamp. */
  stamped(): Promise<Copy | null>;
  /** Tells whoever runs the site what is wrong. The visitor is never told. */
  report(message: string): void;
}
```

**Behaviour.** On a request, if an earlier request on this Worker instance already found the two equal, it resolves the request. Otherwise it asks both. Equal: it remembers and resolves. Anything else (different, no stamp, or either one throwing): it does not resolve the request, remembers nothing, calls `report`, and answers status 503, `content-type: text/plain; charset=utf-8`, `cache-control: no-store`, with the body:

`Ruken is not available right now. Please try again in a few minutes.`

The report lines, exactly: `copy guard: this Worker is the <copy> copy, but its database belongs to the <stamp> copy` (with `no` for a missing stamp), or `copy guard: <the error's message>` when something threw.

- [ ] **Step 1 (red):** `tests/lib/server/copy-guard.test.ts`, calling the handle with a plain `event` and a `resolve` spy, in the style of `tests/features/accounts/handle.test.ts`:
  - equal copies: `resolve` is called and its answer returned; over three requests `stamped` is called once;
  - `copy` is `"test"` and the stamp is `"live"`: status 503, the body above, `resolve` never called, and the report is `copy guard: this Worker is the test copy, but its database belongs to the live copy`;
  - the stamp is `null`: 503, and the report ends `belongs to the no copy`;
  - `stamped` rejects with `new Error("connection refused")`: 503, the report is `copy guard: connection refused`; the next request, with `stamped` now answering the Worker's copy, resolves (nothing was remembered);
  - `copy` throws: 503, and the report carries its message;
  - a refusal carries `cache-control: no-store`.

  Push with `copyGuard` a stub. Expected: `verify` fails in `copy-guard.test.ts` only.
- [ ] **Step 2 (green):** write the guard. In `src/hooks.server.ts` the sequence becomes `databasePerRequest()`, then `copyGuard(...)`, then `createHandle(...)`, with `copy: () => readCopy()`, `stamped: () => stampedCopy((sql, values) => prisma().$queryRawUnsafe(sql, ...values))` and `report: (message) => console.error(message)`. A comment at the guard says why it sits second (it needs this request's database, and must run before anything reads a row); the existing comment's "so /healthz answers without them" is kept true for the sign-in services and gains that `/healthz` does ask the guard, so it answers `ok` only on a stamped database. One at `$queryRawUnsafe` says why it is safe here (the two statements are fixed text in `copy.ts`; the only value is passed apart from them). Push. Expected: all pass, with every existing journey unchanged: `/healthz` still answers `ok`.
- [ ] **Step 3:** commit, tick the tracker, report.
- [ ] **Step 4:** when Tasks 5, 6 and 9 are green too, and the Owner has said "done" to T0, mark the branch's pull request ready. Without T0 the live build skips the claim (see "Where execution stops").
- [ ] **Step 5: the first live deploy.** After the merge, read the check Cloudflare's build puts on the merge commit on `main`. Expected: success. If it failed, the live site is still on its earlier version; stop, and report the build's last lines to the coordinator at once. A successful build alone does not prove the stamp (a build that skipped the claim also succeeds), so then ask the Owner, through the coordinator, for one line: `curl -s LIVE-ADDRESS/healthz` (PowerShell: `(Invoke-WebRequest -UseBasicParsing "LIVE-ADDRESS/healthz").Content`). `ok` is the pass. The 503 line means the live database has no stamp: report at once, and the Owner runs `DIRECT_DATABASE_URL="PASTE" node scripts/claim-copy.ts live` from a clone of `main` (PowerShell: `$env:DIRECT_DATABASE_URL="PASTE"; node scripts/claim-copy.ts live; Remove-Item Env:DIRECT_DATABASE_URL`) with the live database's direct address.

### Task 5: The test copy is open whatever the date

**Files:**
- Modify: `src/features/launch/now.ts`, `tests/features/launch/now.test.ts`

**Interfaces:**
- Changes: `createLaunchNow`'s `settings` gains `RUKEN_COPY?: string | undefined`. `src/features/launch/services.ts` already hands it `process.env`, so it needs no change.

**The rule.** `LAUNCH_TEST_SWITCH=on` is accepted when the site's own address is this machine (as today) **or** `settings.RUKEN_COPY === "test"`. Everything else is as today, with today's error message. The comment above `createLaunchNow` gains the reason: the test copy takes test payments before the live one opens, and its cookie `rk_test_launch=before` still shows a browser the day before.

- [ ] **Step 1 (red):** add to `tests/features/launch/now.test.ts`:
  - with `{ LAUNCH_TEST_SWITCH: "on", BETTER_AUTH_URL: "https://test.ruken.example", RUKEN_COPY: "test" }`, `now(none)` is `LAUNCH_MS + 86_400_000` and `now(before)` is `LAUNCH_MS - 86_400_000`;
  - the same settings with `RUKEN_COPY` as each of `"live"`, `"Test"`, `""` and `undefined` throw `LAUNCH_TEST_SWITCH is for tests on this machine`;
  - the test copy with no switch reads the real clock, whatever cookie comes;
  - the test copy with the switch set to `"true"` throws.

  No stub is needed. Push. Expected: `verify` fails in the first new case only, with the existing error.
- [ ] **Step 2 (green):** the one-line rule and its comment. Push. Expected: all pass.
- [ ] **Step 3:** commit, tick the tracker, report.

### Task 6: The test copy never takes live payments

**Files:**
- Modify: `src/features/membership/services.ts`, `tests/features/membership/services.test.ts`

**The rule.** In `createMembershipServices`, right after `readLiveSetting`: when `live` is true and `source.RUKEN_COPY === "test"`, throw

`This is the test copy of Ruken. It never takes live payments: set STRIPE_LIVE to false and use a Stripe test key.`

It reads the setting directly and does not call `readCopy`, so every existing test that builds the services without `RUKEN_COPY` keeps passing.

- [ ] **Step 1 (red):** add to `tests/features/membership/services.test.ts`, with its own `build`:
  - `build({ RUKEN_COPY: "test", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_LIVE: "true" })` throws the line above;
  - `build({ RUKEN_COPY: "test" })` does not throw (a test key, not live);
  - `build({ RUKEN_COPY: "live", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_LIVE: "true" })` does not throw;
  - `build({ RUKEN_COPY: "test", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_LIVE: "false" })` throws `/live key/` (today's check still catches a live key marked as test).

  Push. Expected: `verify` fails in the first new case only.
- [ ] **Step 2 (green):** the rule, with a comment saying why it is checked here and not left to the Owner's care. Push. Expected: all pass.
- [ ] **Step 3:** commit, tick the tracker, report. Then Task 9, then Task 4's steps 4 and 5.

### Task 7: The `test` environment

Branch 2. **Before any code:** the coordinator has the test Hyperdrive id from T2, and branches 1 and 3 are merged. If not, stop.

The `test` block below also gains `"triggers": { "crons": ["17 9 * * *", "*/10 * * * *"] }`, with a comment saying what the second timer is for and that `cloudflare/worker.js` tells the two apart.

**Files:**
- Modify: `wrangler.jsonc`, `cloudflare/games/wrangler.jsonc`, `package.json`, `tests/wrangler.test.ts`, `tests/cloudflare/games-worker.test.ts`

**Interfaces:**
- Produces: `pnpm run deploy:test` and `pnpm run deploy:games:test`, which the Owner's steps T4, T7 and T8 use.

**`wrangler.jsonc` gains**, with a comment saying that bindings and variables are not carried into an environment, so each is written again, and that the Worker's name is Wrangler's own `ruken-test`:

```jsonc
"env": {
  "test": {
    "vars": { "RUKEN_COPY": "test" },
    "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<the id from T2>" }],
    "r2_buckets": [{ "binding": "GAME_FILES", "bucket_name": "ruken-games-test" }],
  },
},
```

**`cloudflare/games/wrangler.jsonc` gains** `"env": { "test": { "r2_buckets": [{ "binding": "GAME_FILES", "bucket_name": "ruken-games-test" }] } }`.

**`package.json` gains:**
- `"deploy:test": "pnpm exec prisma migrate deploy && node scripts/claim-copy.ts test && pnpm exec wrangler deploy cloudflare/worker.js --env test"`
- `"deploy:games:test": "wrangler deploy --config cloudflare/games/wrangler.jsonc --env test"`

- [ ] **Step 1 (red):** push the tests with the three files unchanged.

`tests/wrangler.test.ts`, a new `describe("the test copy")`, with `const testEnv = () => (wrangler().env as { test?: WranglerConfig } | undefined)?.test`:
  - it says it is the test copy and holds no other variable: `vars` equals `{ RUKEN_COPY: "test" }`;
  - it has no `name`, `route`, `routes` or `main` of its own (the name is Wrangler's `ruken-test`; the rest is the live copy's);
  - its timers are exactly `["17 9 * * *", "*/10 * * * *"]`: the live copy's daily one, and the ten-minute one that writes the made-up content (Task 11). The top level still has only the daily one;
  - its Hyperdrive binding is `HYPERDRIVE`, its id matches `/^[0-9a-f]{32}$/`, is not all zeros, equals the id from T2 written out in the test, **and is not the live copy's id**; it has no `remote` and no `localConnectionString`;
  - its bucket is `[{ binding: "GAME_FILES", bucket_name: "ruken-games-test" }]`;
  - **the test copy has every binding the live copy has:** for each key in a list in the test of every key Wrangler does not carry into an environment (Wrangler's own page on environments, read when the test is written: `vars`, `hyperdrive`, `r2_buckets`, `kv_namespaces`, `d1_databases`, `services`, `queues`, `durable_objects` and the rest it names), the top level and the environment either both lack it or both have the same `binding` names (for `vars`, the same keys). A second case: every top-level key of `wrangler.jsonc` is in that list or in a second list of the keys Wrangler does carry, so a key of a new kind fails CI until someone says which it is. A comment says what they catch: a binding added to the live copy and forgotten here;
  - `deploy:test` migrates, then runs `node scripts/claim-copy.ts test`, then `wrangler deploy cloudflare/worker.js --env test`, in that order, with one `wrangler deploy` in it;
  - `deploy` contains no `--env` and no `claim-copy.ts test`.

`tests/cloudflare/games-worker.test.ts`:
  - the test gate reads `ruken-games-test` and nothing else, and has no `name`, variable, route or database of its own;
  - `deploy:games:test` is exactly `wrangler deploy --config cloudflare/games/wrangler.jsonc --env test`.

Expected: `verify` fails in the new cases only.

- [ ] **Step 2 (green):** the three files. Push. Expected: all pass.
- [ ] **Step 3:** commit, tick the tracker, report. Mark the pull request ready.

### Task 9: The test copy says what it is

Branch 1. Owner, 2026-11-14: "Just use a banner on the top of pages".

**Files:**
- Modify: `src/lib/server/copy.ts`, `src/routes/+layout.server.ts`, `src/routes/+layout.svelte`, `tests/lib/server/copy.test.ts`, `tests/browser/copy.test.ts`

**Interfaces:**
- Produces: `TEST_COPY_WORDS = "Test copy. Nothing here is real."` in `src/lib/server/copy.ts`; the layout's data gains `testCopyLine: string | null` (the words on the test copy, `null` on the live one). The words travel in the data because `+layout.svelte` is also built for the browser, and SvelteKit refuses to build a browser file that imports anything under `src/lib/server/`.

**The line.** On the test copy only, the first thing on every page, above the wordmark: a `<p role="note">` with the look's existing `panel` class, holding `TEST_COPY_WORDS`. No new class and no `<style>`. If `panel` cannot sit at the top of the page without a change to `src/lib/look.css`, stop and report: a change to the look is the Owner's to see. Grandma: five words that say what this place is; nothing to press. The feed (slice 3) and any other full-screen screen still to come sit inside this layout, so the line pushes them down by its height on the test copy only; those slices' screen reviews on the test copy see it. It is not behind a feature switch (slice S): it is tied to the copy, never shows on the live copy, and the Owner asked for it by name.

- [ ] **Step 1 (red):** in `tests/lib/server/copy.test.ts`, `TEST_COPY_WORDS` is exactly `Test copy. Nothing here is real.` (push with it exported as an empty string). In `tests/browser/copy.test.ts`, a journey "the live copy shows no test line": on `/` and on `/sign-in`, `page.getByText("Test copy")` has count 0, and each screen is attached with `showTheOwner`. Expected: `verify` fails in the words case only; the journey passes already, and stays as the guard against the line ever showing on the live copy.
- [ ] **Step 2 (green):** the constant; `testCopyLine: readCopy() === "test" ? TEST_COPY_WORDS : null` in the layout's `load`; in the layout, `{#if data.testCopyLine}` around the line, which shows `data.testCopyLine`. The layout imports nothing new. Push. Expected: all pass.
- [ ] **Step 3:** commit, tick the tracker, report. What no check covers, said plainly in the report: the journeys' site is the live copy, so nothing in CI sees the line showing. The Owner's look at T10 is that check.

### Task 10: The made-up content

Branch 3. Owner, 2026-11-14: "I'd prefer a mock database so we can see everything actually in the app without being blocked by content".

**Files:**
- Create: `src/features/seed/seed.ts`, `content.ts`, `write.ts`, `src/features/seed/library/content.json`, `library/README.md`, `library/tiny-game/` (the three files of `tests/fixtures/tiny-game/`, copied), `library/clips/upright.mp4`, `library/clips/wide.mp4`, `prisma/schema/seed.prisma`, `prisma/migrations/<timestamp>_seed_run/migration.sql`, `tests/features/seed/content.test.ts`, `tests/features/seed/seed.pg.test.ts`
- Modify: `src/lib/server/mail.ts`, `tests/lib/server/mail.test.ts` (no mail to a `.test` address), `tests/architecture.test.ts` (`"seed"` is added last in `FEATURE_ORDER`, above `admin`: it writes every feature's tables, and nothing imports it but its job's route)

**Interfaces:**
- Consumes: `Copy` (Task 1); `PrismaClient`; `FileStore` from `src/lib/files/store.ts`; `Clock`.
- Produces, from `src/features/seed/seed.ts`:
  - `seedContent(): SeedContent`, where `SeedContent` is `{ makers: SeedMaker[]; players: SeedPlayer[]; games: SeedGame[] }`, read from `library/content.json` and checked.
  - `contentHash(): Promise<string>`: SHA-256, in hex, over `content.json` and every file in `library/tiny-game/` and `library/clips/`, through Web Crypto.
  - `seedTestCopy(deps: { prisma: PrismaClient; files: FileStore; clock: Clock; copy: Copy }): Promise<{ ran: boolean; contentHash: string; skipped: string[] }>`.

**What `content.json` holds, at least.** Every name is plainly made up.
- 8 makers, each with a handle, a name, one line, one of the look's themes and its links. Between them: every theme at least once, one maker with no games, one page with the most links a page may have (`MAX_LINKS`), and one whose name and one line are the longest the forms allow, so a screen's worst case can be seen.
- 30 players, each with a name.
- 20 games, each with a slug, a name, one line, its maker's handle, what it plays on and whether it is free to play. Between them: at least 14 live, at least one in every other `GameState` (`draft`, `waiting`, `sent_back`, `taken_off`, `taken_down`), every `GamePlaysOn` value, at least one free game, and one whose name and one line are the longest the forms allow.
- Every account's address is `<handle or player-n>@seed.ruken.test`. The `.test` ending is kept for names that never resolve, so no mail can reach anyone.
- **The mailer never tries such an address.** Handing one to Resend would not be silent: it is either refused, so the flow that sent it fails, or accepted and bounced, which counts against the live copy's sending address (Call 8 shares it). So `src/lib/server/mail.ts` gains one rule, beside `MAIL_ALLOWLIST`: an address whose domain ends in `.test` is not sent, and `send` answers `false`, as it does for an address the allowlist keeps out. Test first, in `tests/lib/server/mail.test.ts`: `someone@seed.ruken.test` is not sent and answers `false`, with no call to Resend; `someone@example.com` is sent as today. This is in Step 1 and Step 2 below, and `src/lib/server/mail.ts` and its test join this task's files.

**The files.** The tiny game is what every made-up game runs. The two clips are two-second loops of one flat colour, upright (360 by 640) and wide (640 by 360), made once with `ffmpeg` in the session. `library/README.md` records the exact command for each, each file's size and SHA-256 as measured, and that they were made for Ruken. If the session has no `ffmpeg`, stop and report. The code reads the text files with Vite's `?raw` and the others with `?inline`. If the Worker build or Vitest cannot load them that way, stop and report.

**`SeedRun`**, in `prisma/schema/seed.prisma`: `contentHash String @id`, `ranAt DateTime @db.Timestamptz`, `createdAt DateTime @default(now()) @db.Timestamptz`. Add-only, with the trigger `SeedRun_append_only` written as `WishlistMail_append_only` is.

**What `seedTestCopy` does, in this order.**
1. If `copy` is not `"test"`, throw `The made-up content is for the test copy only.` before any read or write.
2. Work out `contentHash()`. If a `SeedRun` row has it, answer `{ ran: false, contentHash }`.
3. Write the tiny game's files and the two clips to `files`, under the keys the games feature's own helpers make for a pull and for a clip (export what is needed through `src/features/games/games.ts`; add no second way of making a key).
4. In one transaction: upsert each account (found by its address), each maker's page and links, each game with its pull and clips, then add the `SeedRun` row with `ranAt` from the clock. A live game's `livePullId` points at its pull. Every id that must be fixed is in `content.json`, so a second run finds the same rows.
5. Answer `{ ran: true, contentHash }`.

It never deletes a row, and never changes a row whose account address does not end in `@seed.ruken.test` or whose maker's does not.

**A handle or slug a tester already took.** The test copy is open, so a tester can take a handle or a game's slug before a later change to `content.json` adds it. Before the transaction, the seed looks each one up; one held by an account that is not made up is left out, with that maker's games, and named in the answer, `{ ran, contentHash, skipped: string[] }`. Without this, the unique index would fail the whole transaction every ten minutes, and nothing new would ever be written. The `SeedRun` row is still added, so the next run does not try again until the content changes.

- [ ] **Step 1 (red):** the two test files, with the three functions as stubs, `content.json` as `{ "makers": [], "players": [], "games": [] }`, and no schema change.

  `tests/features/seed/content.test.ts`:
  - the counts and the spread above, each as its own case (8 makers, 30 players, 20 games, 14 live, every `GameState`, every `GamePlaysOn`, every theme, one maker with no games, one page with `MAX_LINKS` links);
  - every handle and every slug is one its own feature's rule accepts, and no two are the same;
  - every game's maker is one of the makers;
  - every address ends in `@seed.ruken.test`;
  - no text in `content.json` contains "AI-free", a web address outside `example.com`, or a `$` amount;
  - each clip starts the way its type must (`looksLikeVideo`) and is under 200,000 bytes;
  - `contentHash()` is 64 hex characters, the same on two calls.

  `tests/features/seed/seed.pg.test.ts`, with `MemoryFileStore` and `TestClock`:
  - with `copy: "live"` it rejects with `The made-up content is for the test copy only.`, and no table has a row and no file is stored;
  - with `copy: "test"` it answers `ran: true`; then, **read back through each feature's own service**: every maker's page is found by its handle with its theme and links, and every live game is found by its slug with its two clips;
  - every file of a live game's pull is in the store under the key the game gate reads;
  - no made-up account has an `Account` row (so none can be signed in to), and a `CaptureMailer` given to the test saw no mail;
  - a second call answers `ran: false`, and no row's `updatedAt` moved;
  - a person who signed up themselves, with a page and a game of their own, is unchanged after a run;
  - with one game's one line changed in the content (the test passes its own content), the next call answers `ran: true`, that game's row has the new line, and there are still 20 games;
  - when a person who signed up themselves already has one maker's handle, the call answers `ran: true` with that handle in `skipped`, their page is unchanged, every other maker is written, and that maker's games are not.

  Expected: `verify` fails in `content.test.ts` and `postgres` fails in `seed.pg.test.ts`, both on the stubs or the empty content. `browser` passes.
- [ ] **Step 2 (green):** the content, the files and their README, the schema and migration, the three functions. Push. Expected: all pass, the migrations drift check and the layer rule included.
- [ ] **Step 3:** commit, tick the tracker, report, with the measured sizes of the two clips.

### Task 11: The test copy writes its own made-up content

Branch 3.

**Files:**
- Create: `src/routes/jobs/seed-test-copy/+server.ts`, `tests/browser/seed-job.test.ts`
- Modify: `cloudflare/worker.js`, `tests/wrangler.test.ts`

**Interfaces:**
- Consumes: `seedTestCopy` (Task 10); `readCopy` (Task 1); `hasJobSecret` from `src/lib/server/job-secret.ts`.
- Produces: `POST /jobs/seed-test-copy`. It answers 404 unless the request has the job secret **and** `readCopy()` is `"test"`. Otherwise it runs `seedTestCopy` and answers its result as JSON.

**The timer.** In `cloudflare/worker.js`, `scheduled` reads `controller.cron`. For `"*/10 * * * *"` it knocks on `/jobs/seed-test-copy` and nothing else, and throws unless the answer is 200. For any other value it does what it does today, unchanged. A comment says why the two are kept apart: the purge and the money job must stay once a day.

- [ ] **Step 1 (red):** push the tests only.

  `tests/browser/seed-job.test.ts`, in the style of `purge-job.test.ts`: on the journeys' site, which is the live copy, `POST /jobs/seed-test-copy` answers 404 with no secret, with a wrong one, **and with the right one**; afterwards no account's address ends in `@seed.ruken.test` (a new `madeUpAccounts(): Promise<number>` in `tests/browser/support/database.ts` answers 0).

  `tests/wrangler.test.ts`, in `describe("the daily job")`:

```ts
// The ten-minute timer exists on the test copy only, and must never run the purge or the money job.
it("tells the ten-minute timer apart, and gives it the made-up content only", () => {
  const text = read("cloudflare/worker.js");
  expect(text).toContain("controller.cron");
  expect(text).toContain('"*/10 * * * *"');
  expect(text).toContain("/jobs/seed-test-copy");
});

it("the live copy has no ten-minute timer", () => {
  expect(wrangler().triggers?.crons).toEqual(["17 9 * * *"]);
});
```

  Expected: `verify` fails in the first new case; `browser` passes in `seed-job.test.ts` already (an address that does not exist answers 404), and stays as the guard.
- [ ] **Step 2 (green):** the route and the timer's branch. Push. Expected: all pass, and the existing journeys that run the daily job through `--test-scheduled` pass unchanged.
- [ ] **Step 3:** commit, tick the tracker, report. Mark branch 3's pull request ready. What no check covers, said plainly: nothing in CI runs the job on a test copy. Task 10's database test covers what it writes, and the Owner's look at T10 covers that it ran.

### Task 8: The test copy, running

This is the last task, after Tasks 9 to 11.

No code unless a check fails. Nothing here is typed into the repository.

- [ ] **Step 1:** when branch 2 is merged and `main` is green, send the coordinator T4 to T10 word for word, with three handles from `content.json` for T10.
- [ ] **Step 2:** when the Owner says "done" to T10, write in `docs/superpowers/progress.md`: which steps are done, on what date, and that the answer to T9 was `ok`. If the answer was the 503 line from Task 4, the stamp and the Worker disagree: ask for the last lines of `npx -y wrangler@4.156.0 tail ruken-test` and report them.
- [ ] **Step 3:** the summary to the coordinator: what ran, what did not and why, and what is open.

## Notes for the plans that follow

- **Every later plan** can ask which copy it is with `readCopy()`, and should need to only at an edge like Tasks 5 and 6. A screen never asks.
- **Slices 1 to 3 (the shells):** a test build of an app points at the test copy's address and goes out through TestFlight, Google Play's internal testing or Microsoft's private audience; a live build points at the live copy's. The address is a build setting of the shell, not `RUKEN_COPY`, which only a Worker has.
- **Slice $ (store purchases):** Apple's and Google's sandbox notifications go to the test copy only. A store notification names its environment; the live copy refuses a sandbox one and the test copy refuses a production one, the same way `STRIPE_LIVE` refuses the other mode's events today.
- **Every slice that adds something a person can see** (a review, a follow, a friend, an achievement, an extra) adds made-up examples of it to `src/features/seed/library/content.json` and to `seedTestCopy`, in its own plan, so the test copy always shows every screen with something in it. The run is keyed on the hash of the content files only, so a change to the seed's code alone never runs again: `content.json` holds a `"version"` number, and any change to `write.ts` adds one to it (a case in `content.test.ts` says so in its name, and checks `version` is a whole number of 1 or more).
- **Slices 1 to 3** also show the test copy's line in a test build of an app. It comes from the server with every page's data today (Task 9); the static build keeps it.
- **Slice S (feature switches):** switches are rows in each copy's own database, so a switch turned on in the test copy changes nothing in the live one.
- **Worth the Owner's eye, left out on purpose:**
  - Nothing copies games or accounts from the live copy into the test copy. A tester signs up there afresh, beside the made-up people.
  - Nobody on the test copy is a paying member until a tester joins with one of Stripe's test cards. The made-up players are not members.
  - The made-up games all run one tiny game and show flat-colour clips (Call 12).
  - The test copy's `workers.dev` address is public to anyone who has it. It has no password in front of it.
  - Cloudflare builds both Workers on every merge, so a merge now starts two builds.
