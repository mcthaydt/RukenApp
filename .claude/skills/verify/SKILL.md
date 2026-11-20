---
name: verify
description: Use when a change alters what the product does, before calling it done and before each commit that changes behavior: starts this repo's app or game from a clean checkout and drives it the way a person would.
---

# Verify

Ruken is Instagram Reels meets Linktree for games: makers send in their games, players find them in a feed and play them, and members pay. This skill starts the site, its database, its four stand-ins and the game gate on this machine.

## Start it

From a clean checkout in a cloud container, in order. First pick the Node version (or other runtime) that `engines` in `package.json` asks for. Then install, build, and start every stand-in for an outside service (a database, payments, mail, sign-in), never the real one.

Needs Node 24 (`engines` says `24.x`): `export PATH=/opt/node24/bin:$PATH`. The app reads Postgres 16, which is in the container, and four stand-ins that the browser tests also use. Never the real Stripe, GitHub, Resend or Twilio, and never the test site's database. The values below are the ones `playwright.config.ts` gives its `webServer` entries; where that file and this skill differ, the file wins and this skill is fixed first.

```sh
cd "$(git rev-parse --show-toplevel)"
export PATH=/opt/node24/bin:$PATH
pnpm install --frozen-lockfile
pg_ctlcluster 16 main start || true   # exits 2 when it is already running
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres'\" -c 'DROP DATABASE IF EXISTS verify_ruken' -c 'CREATE DATABASE verify_ruken'"
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/verify_ruken
mkdir -p /tmp/verify-ruken
# the stand-ins: GitHub 12112, Resend 12113, Twilio 12114, Stripe 12111
for n in github mail twilio stripe; do node tests/browser/support/fake-$n-server.ts > /tmp/verify-ruken/$n.log 2>&1 & done
# the app's settings (all plainly fake), as playwright.config.ts gives them
export GITHUB_APP_PRIVATE_KEY="$(node -e 'process.stdout.write(require("node:crypto").generateKeyPairSync("rsa",{modulusLength:2048,publicKeyEncoding:{type:"spki",format:"pem"},privateKeyEncoding:{type:"pkcs1",format:"pem"}}).privateKey)')"
export DIRECT_DATABASE_URL=$TEST_DATABASE_URL CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=$TEST_DATABASE_URL CLOUDFLARE_INCLUDE_PROCESS_ENV=true
export BETTER_AUTH_SECRET=test-only-secret-not-used-anywhere-real BETTER_AUTH_URL=http://localhost:4173
export RESEND_API_KEY=re_test_fake RESEND_API_BASE=http://127.0.0.1:12113 "MAIL_FROM=Ruken <hello@ruken.test>"
export JOBS_SECRET=test-only-jobs-secret STRIPE_SECRET_KEY=sk_test_fake STRIPE_WEBHOOK_SECRET=whsec_test_fake STRIPE_LIVE=false STRIPE_API_BASE=http://127.0.0.1:12111
export PLAY_PASS_SECRET=test-only-play-pass-secret GITHUB_APP_ID=1 GITHUB_APP_SLUG=ruken-test-app GITHUB_APP_CLIENT_ID=test-client GITHUB_APP_CLIENT_SECRET=test-only-client-secret
export GITHUB_API_BASE=http://127.0.0.1:12112 GITHUB_WEB_BASE=http://127.0.0.1:12112 "GAME_ADDRESS_PATTERN=http://{name}.localhost:8788" LAUNCH_TEST_SWITCH=on DECISION_DAYS_TEST_OFF=on
# the app on 4173, then the game gate on 8788, which waits for the app (two Workers opening one storage folder at once fail)
(pnpm exec prisma migrate deploy && pnpm build && exec pnpm exec wrangler dev cloudflare/worker.js --port 4173 --test-scheduled --persist-to .wrangler/state) > /tmp/verify-ruken/app.log 2>&1 &
(env -u GITHUB_APP_PRIVATE_KEY SITE_ORIGIN=http://localhost:4173 PATH_HOST=localhost:8788 sh -c 'node tests/browser/support/when-up.ts http://localhost:4173/healthz && exec pnpm exec wrangler dev --config cloudflare/games/wrangler.jsonc --port 8788 --persist-to .wrangler/state') > /tmp/verify-ruken/gate.log 2>&1 &
# wait up to 4 minutes (120 tries, 2 seconds apart), then fail loudly
tries=0
until [ "$(curl -s -o /dev/null -w '%{http_code}' localhost:4173/healthz)$(curl -s -o /dev/null -w '%{http_code}' localhost:8788/__ruken/health)" = 200200 ]; do
  tries=$((tries+1))
  if [ "$tries" -ge 120 ]; then echo "NOT READY after 4 minutes: read the logs in /tmp/verify-ruken/" >&2; break; fi
  sleep 2
done
[ "$tries" -lt 120 ]   # the block's status: 0 when ready, 1 when it gave up
```

It is ready when both `localhost:4173/healthz` (the app) and `localhost:8788/__ruken/health` (the game gate) answer 200, and each stand-in answers 200 at `127.0.0.1:PORT/ready` (PORT is 12111, 12112, 12113 or 12114). The wait gives up after 4 minutes, prints "NOT READY" and exits non-zero; then read the logs in `/tmp/verify-ruken/`. Last clean start, timed with `date` before and after: 21.3 to 21.7 seconds with the pnpm store already warm, measured on commit fce4668, and about 42 seconds cold (install, migrations, build and all six servers), on commit 8d6ac68.

## Drive it

Open it in a real browser: the Chromium and Playwright the container already has (`require('playwright')`, then `chromium.launch()`), at the sizes the change affects (see "Shoot what the change touches" in `visual-check`). Tap, click, type and press keys the way a person would, and find things by their label or role. Take a screenshot at deviceScaleFactor 1 for your own check, and save it in the scratchpad, never in the repo. The main screen, what it shows and how to use it:

The main screen today is the home page at `http://localhost:4173/`: "Ruken", "Games, one swipe at a time. Coming soon." and one big "Sign in" button (there is no feed yet; when it lands, this line is updated in the same pull request). Run the driver script below from the repo root; it runs on any `node` once `NODE_PATH=/opt/node-tools/node_modules` is set, and it opens a phone-sized window (412 by 915, the Pixel 7 size in `playwright.config.ts`); for the tablet and the computer, change `viewport` to 1024 by 768 and 1280 by 720. It looks for headings and labels, and exits 1 at the first thing it cannot find.

```sh
: "${SHOTS:?set SHOTS to a scratchpad folder, outside the repo}"
mkdir -p "$SHOTS"
NODE_PATH=/opt/node-tools/node_modules node - "$SHOTS" <<'JS'
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.goto('http://localhost:4173/');
  await p.getByRole('heading', { name: 'Ruken' }).first().waitFor();
  await p.getByRole('link', { name: 'Sign in' }).waitFor();
  await p.screenshot({ path: process.argv[2] + '/main.png' });
  await p.goto('http://localhost:4173/sign-up?next=/me');
  await p.getByRole('heading', { name: 'Create your account' }).waitFor();
  await p.getByLabel('Email').fill(`verify-${Date.now()}@example.test`);
  await p.getByLabel('Password').fill('a long enough password');
  await p.getByLabel('Month').fill('1'); await p.getByLabel('Day').fill('1'); await p.getByLabel('Year').fill('1990');
  await p.getByRole('button', { name: 'Create account' }).click();
  await p.waitForURL('**/me');
  await p.screenshot({ path: process.argv[2] + '/me.png' });
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
JS
```

The first screenshot is the main screen. The script also walks the sign-up journey below; its second screenshot is the signed-in page.

## The journeys

One line each, from a person's side: where it starts, the steps, and what they see at the end.

- Home: open `/`. See "Ruken", "Games, one swipe at a time. Coming soon." and a "Sign in" button.
- Sign up: open `/sign-up?next=/me`. Fill Email, Password (10 to 128 characters), and Month, Day and Year of birth (someone under 13 is told to come back). Press "Create account". You land on `/me`, signed in. More journeys, each with its stand-in (mail, texts, payment), are the tests in `tests/browser/`; run the one that matches the change by reading its steps and doing them the same way.

## Stop it

Stop every server it started and clear what it wrote, so the next run starts clean.

```sh
pkill -f 'wrangler|workerd|fake-.*-server|when-up'
su postgres -c "psql -c 'DROP DATABASE IF EXISTS verify_ruken'"
pg_ctlcluster 16 main stop
rm -rf /tmp/verify-ruken .wrangler cloudflare/games/.wrangler
git status --short --ignored   # only ignored build files (node_modules, .svelte-kit, generated folders); no .wrangler, nothing untracked
```

## When it breaks

A step that breaks or flakes is fixed in this skill first. Each known way a start or a step fails, what it looks like, and the fix:

- Harmless, ignore them: pnpm's "Ignored build scripts" warning during install, and wrangler's "Proxy environment variables detected" line in the app and gate logs.
- `pg_ctlcluster` says the cluster is already running (it exits 2): fine, the line ends with `|| true` for that.
- `prisma migrate deploy` cannot reach the database: `TEST_DATABASE_URL` is not exported in this shell, or the `verify_ruken` database was not made; run the `su postgres` line again.
- The wait prints "NOT READY": read `/tmp/verify-ruken/app.log` and `gate.log`; if one says a port is in use, a run before this one was not stopped, so run "Stop it" and start again.
- The game gate log says "database is locked": the gate started before the app; the `when-up.ts` step in front of it prevents that, so keep it.
- `require('playwright')` is not found: `NODE_PATH=/opt/node-tools/node_modules` was left off; set it as shown (it works under Node 24 too).
- A sign-up says "too many tries": the site limits each address; wait a minute, or stop and start again.
