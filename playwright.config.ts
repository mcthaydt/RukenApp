import { generateKeyPairSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { CONSENTED_STATE } from "./tests/browser/support/consent.ts";
import { journeyClientHeaders } from "./tests/browser/support/rate-limits.ts";
import { exactly, pieceFromEnv } from "./tests/browser/support/shard-plan.ts";

// The Ruken GitHub App's private key, made here each time the config loads and never written to a file. GitHub hands
// out an app's key as PKCS#1, so the stand-in's journeys use that form too.
const GITHUB_APP_PRIVATE_KEY = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
}).privateKey;

const TEST_DIR = resolve(import.meta.dirname, "tests/browser");
// In CI each browser piece runs the files the planner gives it (tests/browser/support/shard-plan.ts), filled by main's
// recorded times. If the times cannot be read, the piece takes Playwright's own split by count instead. Outside CI's
// pieces the config is as it always was.
const piece = pieceFromEnv(process.env, TEST_DIR, ["phone", "tablet", "computer"]);
const planned = (project: string) =>
  piece && "files" in piece ? { testMatch: exactly(TEST_DIR, piece.files[project] ?? []) } : {};

// Browser journeys (design section 8) run against the built app, served by `wrangler dev`: the Workers runtime
// the real site runs in.
export default defineConfig({
  testDir: TEST_DIR,
  // Draws one page in Safari's engine once the site is up, so no journey pays for a fresh machine's drawing cache
  // (tests/browser/support/warm-webkit.ts).
  globalSetup: "./tests/browser/support/warm-webkit.ts",
  ...(piece && "shard" in piece ? { shard: piece.shard } : {}),
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // An action on a missing button or field fails in 5 seconds, not after the whole 30-second test timeout, so a
  // journey that cannot find its form says so quickly. A wait for the site's answer gets longer (below).
  // Each worker reaches the site from its own client address, so side-by-side journeys never share the site's
  // per-address limits (tests/browser/support/rate-limits.ts).
  // A wait for the site's answer (a new address, a saved answer on screen) gets 15 seconds. The site in a journey is
  // one `wrangler dev` process on a four-core runner shared with two browsers, so while another worker's journey keeps
  // it busy a single answer can take over 5 seconds: run 44835171025 saw a sign-up land after the 5-second wait ended,
  // and an answer still "Saving…" when it did, both correct and both refused only for the time. The real site answers
  // each visitor in its own Worker.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:4173",
    // Every journey's browser has said yes to cookies, except the one about the notice (support/consent.ts).
    storageState: CONSENTED_STATE,
    // A failed journey keeps a recording of its actions and network, so a press that got no answer shows whether the
    // post left the browser and what came back (progress.md, Flaky tests). Playwright records the network only with
    // its page snapshots, so those stay on; the running screenshots, which cost the busy runner the most, stay off.
    trace: { mode: "retain-on-failure", screenshots: false, snapshots: true, sources: false },
    actionTimeout: 5_000,
    extraHTTPHeaders: journeyClientHeaders(),
  },
  webServer: [
    {
      // A stand-in for GitHub (tests/browser/support/fake-github-server.ts): the sign-in and installation pages, the
      // lists of a person's installations and repositories, and the app's own calls, so the journeys can connect a
      // maker's GitHub and pull a game with no network. It is ready when it answers /ready.
      command: "node tests/browser/support/fake-github-server.ts",
      url: "http://127.0.0.1:12112/ready",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // A stand-in for Resend (tests/browser/support/fake-mail-server.ts): it keeps every mail the site sends, so a journey
      // can read it and open its link. It is ready when it answers /ready.
      command: "node tests/browser/support/fake-mail-server.ts",
      url: "http://127.0.0.1:12113/ready",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // A stand-in for Twilio (tests/browser/support/fake-twilio-server.ts): it keeps every text and sign-in code the
      // site sends, so a journey can read them. It is ready when it answers /ready.
      command: "node tests/browser/support/fake-twilio-server.ts",
      url: "http://127.0.0.1:12114/ready",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // A stand-in for Stripe's API and its hosted pages (tests/browser/support/fake-stripe-server.ts), so the
      // journeys can pay and cancel with no network. It is ready when it answers /ready.
      command: "node tests/browser/support/fake-stripe-server.ts",
      url: "http://127.0.0.1:12111/ready",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // The app reads a database, so the migrations run before the build, as the deploy command does. `--local` keeps
      // Cloudflare's media tool (which makes video stills, and has no local copy) from reaching for a Cloudflare login.
      // Under `--local` the binding is there but every call throws ("needs to be run remotely"), so the site answers no
      // still, marks it as failed and never asks again: the journeys run without stills, as a copy of the app does.
      command:
        "pnpm exec prisma migrate deploy && pnpm build && pnpm exec wrangler dev cloudflare/worker.js --local --port 4173 --test-scheduled --persist-to .wrangler/state",
      url: "http://localhost:4173",
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DIRECT_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
        // Where `wrangler dev` points the Worker's Hyperdrive binding: the journeys' own database, and no other.
        CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: process.env.TEST_DATABASE_URL ?? "",
        // So `wrangler dev` gives the Worker the settings below (there is no .dev.vars file).
        CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
        // The hook now runs on every request, so the sign-in settings must exist. All plainly fake.
        BETTER_AUTH_SECRET: "test-only-secret-not-used-anywhere-real",
        BETTER_AUTH_URL: "http://localhost:4173",
        // Mail goes to the stand-in Resend, which keeps it for the journeys to read, and to no one else. There is no
        // allowlist: every journey's address is new, and nothing leaves this machine (the site refuses a mail address
        // that is not on it).
        RESEND_API_KEY: "re_test_fake",
        RESEND_API_BASE: "http://127.0.0.1:12113",
        MAIL_FROM: "Ruken <hello@ruken.test>",
        // Texts and sign-in codes go to the stand-in Twilio, which keeps them for the journeys to read, and to no one
        // else. The line names are what the stand-in reports a text's line as. All plainly fake.
        TWILIO_ACCOUNT_SID: "AC_test_fake",
        TWILIO_API_KEY: "SK_test_fake",
        TWILIO_API_SECRET: "test-only-twilio-secret",
        TWILIO_ACCOUNT_SERVICE: "MG-account",
        TWILIO_NEWS_SERVICE: "MG-news",
        TWILIO_VERIFY_SERVICE: "VA_test_fake",
        TWILIO_API_BASE: "http://127.0.0.1:12114",
        // The feed's public switches: nobody's order is learned (the journeys run on the open order), and a parent's yes
        // turns a teen's learning on, so the parent's-yes journey sees it start. The public defaults otherwise.
        FEED_PUBLIC: '{"learned":false,"teenPersonal":true,"windowDays":7}',
        // The daily job's secret, so the journeys can knock on it. Plainly fake.
        JOBS_SECRET: "test-only-jobs-secret",
        // Money goes through the stand-in Stripe, never the real one. All plainly fake.
        STRIPE_SECRET_KEY: "sk_test_fake",
        STRIPE_WEBHOOK_SECRET: "whsec_test_fake",
        STRIPE_LIVE: "false",
        STRIPE_API_BASE: "http://127.0.0.1:12111",
        // The secret the app signs play passes with, which the game gate checks them with. Plainly fake.
        PLAY_PASS_SECRET: "test-only-play-pass-secret",
        // Games come from the maker's GitHub, which is the stand-in on this machine. All plainly fake.
        GITHUB_APP_ID: "1",
        GITHUB_APP_SLUG: "ruken-test-app",
        GITHUB_APP_CLIENT_ID: "test-client",
        GITHUB_APP_CLIENT_SECRET: "test-only-client-secret",
        GITHUB_APP_PRIVATE_KEY,
        GITHUB_API_BASE: "http://127.0.0.1:12112",
        GITHUB_WEB_BASE: "http://127.0.0.1:12112",
        // A game's address in the journeys: `*.localhost` names reach this machine, so a browser can open them.
        GAME_ADDRESS_PATTERN: "http://{name}.localhost:8788",
        // The journeys' site is open whatever the date, so every journey that presses Play keeps passing after the
        // 30th as before it. A cookie makes one browser see the day before. The site refuses this setting unless its
        // own address is this machine, and the real site never has it.
        LAUNCH_TEST_SWITCH: "on",
        // Decision day is off in the journeys, so a game the Owner lets in goes live at once, whatever day it runs.
        // The site refuses this setting unless its own address is this machine.
        DECISION_DAYS_TEST_OFF: "on",
      },
    },
    {
      // The game gate, a second Worker (cloudflare/games) on its own port, reading the app's local bucket from the
      // same folder. It starts only once the app answers: two local Workers that open the same storage folder at
      // the same moment stop with "database is locked". Its timeout is the app's plus a minute for it to start.
      command:
        "node tests/browser/support/when-up.ts http://localhost:4173/healthz && pnpm exec wrangler dev --config cloudflare/games/wrangler.jsonc --port 8788 --persist-to .wrangler/state",
      url: "http://localhost:8788/__ruken/health",
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        PLAY_PASS_SECRET: "test-only-play-pass-secret",
        SITE_ORIGIN: "http://localhost:4173",
        // The one host on which a game is in the path, as on the test site's free address.
        PATH_HOST: "localhost:8788",
        // So `wrangler dev` gives the gate the settings above (there is no .dev.vars file).
        CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
      },
    },
  ],
  // The Owner, 2026-11-14: "tablet is first class supported, and mobile landscape", and "Also run the browser tests in
  // Safari's engine (WebKit) on tablet and phone". Sideways phones and tablets are windows their own journeys set.
  // The three devices the owner chose (2026-11-21): a small iPhone in Safari's engine, an iPad in Chrome's, and a
  // computer. The small iPhone is today's iPhone SE (375 wide); the old 320-wide iPhone SE is a window the journeys
  // written for it set themselves. Both engines stay checked, and each journey runs three times, not nine. A journey that needs another
  // window, such as a phone held sideways, sets that window itself.
  projects: [
    { name: "phone", ...planned("phone"), use: { ...devices["iPhone SE (3rd gen)"] } },
    {
      name: "tablet",
      ...planned("tablet"),
      use: { ...devices["iPad (gen 7)"], defaultBrowserType: "chromium" },
    },
    { name: "computer", ...planned("computer"), use: { ...devices["Desktop Chrome"] } },
  ],
});
