import { generateKeyPairSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// The Ruken GitHub App's private key, made here each time the config loads and never written to a file. GitHub hands
// out an app's key as PKCS#1, so the stand-in's journeys use that form too.
const GITHUB_APP_PRIVATE_KEY = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
}).privateKey;

// Browser journeys (design section 8) run against the built app, served by `wrangler dev`: the Workers runtime
// the real site runs in.
// CI runs them on GitHub's runners only (CLAUDE.md: no session runs tests itself).
export default defineConfig({
  testDir: "tests/browser",
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // A missing page or field fails in 5 seconds, not after the whole 30-second test timeout, so a
  // journey that cannot find its form says so quickly.
  use: { baseURL: "http://localhost:4173", trace: "off", actionTimeout: 5_000 },
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
      // A stand-in for Stripe's API and its hosted pages (tests/browser/support/fake-stripe-server.ts), so the
      // journeys can pay and cancel with no network. It is ready when it answers /ready.
      command: "node tests/browser/support/fake-stripe-server.ts",
      url: "http://127.0.0.1:12111/ready",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // The app reads a database, so the migrations run before the build, as the deploy command does.
      command:
        "pnpm exec prisma migrate deploy && pnpm build && pnpm exec wrangler dev cloudflare/worker.js --port 4173 --test-scheduled --persist-to .wrangler/state",
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
        // No journey uses this address, so the journeys send no mail and need no mail server.
        RESEND_API_KEY: "re_test_fake",
        MAIL_ALLOWLIST: "nobody@ruken.test",
        MAIL_FROM: "Ruken <hello@ruken.test>",
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
        // So `wrangler dev` gives the gate the settings above (there is no .dev.vars file).
        CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
      },
    },
  ],
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "computer", use: { ...devices["Desktop Chrome"] } },
  ],
});
