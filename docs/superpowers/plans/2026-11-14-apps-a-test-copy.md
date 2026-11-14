# Test Copy and Live Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second, separate copy of Ruken, the test copy, runs beside the live one with its own Worker, database, bucket and games address, and neither copy can be pointed at the other's data by mistake.

**Architecture:** One repository and one build serve both copies. `wrangler.jsonc` says which copy a Worker is with one variable, `RUKEN_COPY`, and gives the test copy its own bindings in a Wrangler environment named `test`. Each database carries a one-row stamp saying which copy owns it: the deploy command writes it once, and the running site refuses to answer when the stamp and its own `RUKEN_COPY` disagree. No screen changes.

**Tech Stack:** as on `main` (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Wrangler 4.156.0, `pg` 8.23.1). **No new package and no new secret.** One new variable in `wrangler.jsonc`.

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
- No screen is added or changed, so there are no new words for a person to read, except one line a visitor sees if a copy is wired wrong (Task 4). It is written there and passes the drunk-grandma test: one short sentence, and what to do.

## The Calls in this plan

Each is the plan writer's choice, shown here so the Owner or the coordinator can overrule it.

1. **An empty database, not a branch of the live one.** The spec says "database branch". A Neon branch starts as a full copy of its parent (Neon's own pages), so it would carry every live account into the test copy, and the same sentence of the spec forbids that. The test copy gets a new, empty Neon project named `ruken-test`. This is the one place the plan departs from the spec's words, to keep the spec's rule.
2. **A Stripe sandbox for the test copy.** The live copy itself runs in Stripe's test mode until the Owner opens live payments. A sandbox keeps the test copy's customers and webhooks apart from it.
3. **`RUKEN_COPY` is a variable in `wrangler.jsonc`, not a secret typed in Cloudflare.** It is not secret, and written in the file it cannot be typed wrong on one Worker. `tests/wrangler.test.ts` today says the file "holds no variables"; Task 1 changes that test to "holds exactly one".
4. **The stamp and the guard.** Nothing else stops a wrong database id in the config from sending test sales into the live ledger. The cost is one small query the first time each Worker instance wakes.
5. **Migrate, then claim, then deploy.** The claim needs the table a migration makes. A deploy pointed at the wrong database therefore runs the migrations there before the claim refuses. That is safe: both copies follow `main`, so those are migrations that database was about to get anyway, and no code is deployed.
6. **The test copy is open whatever the date.** The spec's test purchases need a site that is open. The journeys already have a setting for this, `LAUNCH_TEST_SWITCH=on`, refused anywhere but this machine. Task 5 also allows it on the test copy, and nowhere else.
7. **One Wrangler file with an environment, not a second file.** Cloudflare's own pages give this shape for a lasting second Worker: an `env` block, `wrangler deploy --env test`, and the repository connected to both Workers.
8. **The test copy sends real mail and runs the daily job**, as the live one does, so what is tested is what runs. Its mail comes from "Ruken Test". `MAIL_ALLOWLIST` (which `src/lib/server/mail.ts` has for a test environment) is left unset: the test copy's database starts empty, so it holds only accounts testers made themselves, and an allowlist would need a new setting for every tester.
9. **`/healthz` now asks the database.** It answered without the database before. With the guard (Task 4) in front of everything, it answers `ok` only when the database is reachable and stamped for this copy, which is what T0 and T9 check.

## Questions for the Owner

Nothing in branch 1 waits for these. Q3 is needed before T1, and Q1 before T8.

**Q1. Where do the test copy's games run?** Each game needs its own name under a games domain, and a free `workers.dev` address has no names under it.
- a) A second, separate domain used only for the test copy's games. Costs that domain's yearly price. **Recommended**: it is the spec's "its own games address", and a test game can never share an address with a live one.
- b) Names under the live games domain, as `<game>.test.<games domain>`. Needs Cloudflare's paid Advanced Certificate Manager on that domain, a monthly fee.
- c) No games on the test copy for now. Everything else works there, but nothing can be played or bought inside a game until a) or b) is chosen.

**Q2. Should the test copy say that it is the test copy?**
- a) Yes: one thin line at the top of every screen on the test copy only, "Test copy. Nothing here is real." **Recommended**, because a tester with both installed can otherwise mistake one for the other. A yes adds one small task to this plan.
- b) No. The two look the same.

**Q3. Is an empty database all right in place of the spec's "database branch"?** The spec's words are "its own Worker, database branch, bucket and games address", and the same paragraph says the two copies "never share data". A Neon branch starts as a copy of everything in the live database, including every account.
- a) An empty database of its own (Call 1). **Recommended**: no live account ever reaches the test copy, and it has its own password.
- b) A branch of the live database, as written, with the live accounts in it.

Needed before T1.

## Where execution stops and waits for the Owner

The Owner's steps are commands to paste, one line each. They are written for the Owner's Mac; where Windows PowerShell differs, the PowerShell line follows it. `PASTE`, `TEST-ADDRESS` and words in capitals are filled in by the Owner and never typed into the repository or the chat, except the two values the steps ask for by name.

**Before branch 1 is marked ready: T0.** The live Worker's build runs the Deploy command typed in its settings, not `package.json`: since 2026-11-14 that is `pnpm exec prisma migrate deploy && pnpm exec wrangler deploy cloudflare/worker.js`, written out (the design, "One build, one Worker"; `docs/superpowers/progress.md`, "The site's deploy only"). Task 3's claim lives in `pnpm run deploy`, so without T0 the live build would deploy Task 4's guard to an unstamped database, and every live page would answer 503. Send T0 to the coordinator word for word when Task 3 is green.

- **T0.** The live Worker's Deploy command (a website: Workers Builds has no command for its settings). Cloudflare → Workers → `ruken` → Settings → Build → Deploy command: `pnpm run deploy`. Save. Say "done". Branch 1 is not marked ready until then.

**Before branch 2 starts: T1 to T3.** Send them to the coordinator word for word when branch 1's pull request is opened.

- **T1.** An empty database for the test copy.
  1. `npx -y neonctl@9.5.0 projects list` (signs in the first time; note the live project's region).
  2. `npx -y neonctl@9.5.0 projects create --name ruken-test --pg-version 16 --region-id LIVE-REGION` (Postgres 16 is what CI tests on. It prints a connection address that holds a password. Keep it for T2, T4 and T7; it goes nowhere else.)
- **T2.** Cloudflare's connection pool in front of it: `npx -y wrangler@4.156.0 hyperdrive create ruken-test --connection-string "PASTE" --caching-disabled`. Tell the coordinator the `id` it prints. The id is not a secret.
- **T3.** The test copy's bucket: `npx -y wrangler@4.156.0 r2 bucket create ruken-games-test`.

**After branch 2 is merged and green on `main`: T4 to T9.**

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
- **T8.** The test copy's game gate, once Q1 is answered. With `TEST-GAMES-DOMAIN` on this Cloudflare account and its `*` record made as in slice 2's G3 step 1:
  1. `pnpm run deploy:games:test -- --route "*.TEST-GAMES-DOMAIN/*"` (the script Task 7 tests, with the route added on the command line)
  2. `s=$(openssl rand -hex 32); printf %s "$s" | npx -y wrangler@4.156.0 secret put PLAY_PASS_SECRET --name ruken-test; printf %s "$s" | npx -y wrangler@4.156.0 secret put PLAY_PASS_SECRET --name ruken-games-test` (one new secret, given to both test Workers; PowerShell as G3 step 3 with the two `--name` endings)
  3. `printf %s "TEST-ADDRESS" | npx -y wrangler@4.156.0 secret put SITE_ORIGIN --name ruken-games-test` (PowerShell: `"TEST-ADDRESS" | npx …`)
  4. `printf %s "https://{name}.TEST-GAMES-DOMAIN" | npx -y wrangler@4.156.0 secret put GAME_ADDRESS_PATTERN --name ruken-test` (type `{name}` as it is)
- **T9.** Check it: `curl -s TEST-ADDRESS/healthz` (PowerShell: `(Invoke-WebRequest -UseBasicParsing "TEST-ADDRESS/healthz").Content`). Expect `ok`. Say "done".

**Stop rules, beyond CLAUDE.md's.** Stop and report at once if: the Owner has not said "done" to T0 when branch 1 is otherwise ready; the first live deploy after branch 1 merges does not succeed, or the live `/healthz` does not answer `ok` after it (Task 4, step 5); CI's `browser` job fails anywhere but the step a task names; or `node` cannot load `scripts/claim-copy.ts` on a runner.

## How a task runs

As slice 1's plan ("How a task runs"), word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved.

Both branches are logic and config and run in the cloud.

## Branches

| # | Branch | Tasks | Ends with | Waits for |
|---|---|---|---|---|
| 1 | `apps-a/copy` | 1 to 6 | every Worker knows which copy it is, each database is stamped, and a mismatch answers 503 | nothing |
| 2 | `apps-a/test-worker` | 7, 8 | the `test` environment for both Workers, and its deploy commands | T1 to T3, and branch 1 merged |

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
| `tests/browser/copy.test.ts` (new) | 3 | The journeys' database really is stamped |
| `tests/wrangler.test.ts`, `tests/cloudflare/games-worker.test.ts`, `tests/features/launch/now.test.ts`, `tests/features/membership/services.test.ts` | 1, 3, 5, 6, 7 | |

## Review Focus

The ways this is most likely to hurt someone, most likely first. Each has its test in the task that owns the code.

1. **The test Worker's database id is the live one's** (a paste mistake in `wrangler.jsonc`). Expected: every page of the test copy answers 503 and nothing is read or written but the stamp. Task 4 (the mismatch case) and Task 7 (the two ids must differ).
2. **A new binding is added to the live Worker and forgotten in the `test` environment.** Wrangler does not carry bindings into an environment, so the test Worker would deploy without it. Expected: CI fails. Task 7 ("the test copy has every binding the live copy has").
3. **A live Stripe key is typed into the test Worker.** Expected: the site refuses to start its payment services, with a line that says why. Task 6.
4. **The database is briefly down when a Worker instance wakes.** Expected: that request answers 503, nothing is remembered, and the next request checks again. Task 4.
5. **`LAUNCH_TEST_SWITCH=on` is typed into the live Worker.** Expected: as today, every page fails instead of the site opening early. Task 5 keeps the existing refusals and adds the live copy's.

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
- [ ] **Step 4:** when Tasks 5 and 6 are green too, and the Owner has said "done" to T0, mark the branch's pull request ready. Without T0 the live build skips the claim (see "Where execution stops").
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
- [ ] **Step 3:** commit, tick the tracker, report. Then Task 4's steps 4 and 5.

### Task 7: The `test` environment

Branch 2. **Before any code:** the coordinator has the test Hyperdrive id from T2. If not, stop.

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
  - it has no `name`, `route`, `routes`, `main` or `triggers` of its own (the name is Wrangler's `ruken-test`; the rest is the live copy's);
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

### Task 8: The test copy, running

No code unless a check fails. Nothing here is typed into the repository.

- [ ] **Step 1:** when branch 2 is merged and `main` is green, send the coordinator T4 to T9 word for word, with Q1 and Q2 if they are still open.
- [ ] **Step 2:** when the Owner says "done" to T9, write in `docs/superpowers/progress.md`: which steps are done, on what date, and that the answer to T9 was `ok`. If the answer was the 503 line from Task 4, the stamp and the Worker disagree: ask for the last lines of `npx -y wrangler@4.156.0 tail ruken-test` and report them.
- [ ] **Step 3:** the summary to the coordinator: what ran, what did not and why, and what is open (T8 if Q1 is not answered).

## Notes for the plans that follow

- **Every later plan** can ask which copy it is with `readCopy()`, and should need to only at an edge like Tasks 5 and 6. A screen never asks.
- **Slices 1 to 3 (the shells):** a test build of an app points at the test copy's address and goes out through TestFlight, Google Play's internal testing or Microsoft's private audience; a live build points at the live copy's. The address is a build setting of the shell, not `RUKEN_COPY`, which only a Worker has.
- **Slice $ (store purchases):** Apple's and Google's sandbox notifications go to the test copy only. A store notification names its environment; the live copy refuses a sandbox one and the test copy refuses a production one, the same way `STRIPE_LIVE` refuses the other mode's events today.
- **Slice S (feature switches):** switches are rows in each copy's own database, so a switch turned on in the test copy changes nothing in the live one.
- **Worth the Owner's eye, left out on purpose:**
  - Nothing copies games or accounts from the live copy into the test copy. A tester signs up there afresh.
  - The test copy's `workers.dev` address is public to anyone who has it. It has no password in front of it.
  - Cloudflare builds both Workers on every merge, so a merge now starts two builds.
