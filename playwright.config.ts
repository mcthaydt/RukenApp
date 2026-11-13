import { defineConfig, devices } from "@playwright/test";

// Browser journeys (design section 8) run against the built app, served by `vite preview`.
// CI runs them on GitHub's runners only (CLAUDE.md: no session runs tests itself).
export default defineConfig({
  testDir: "tests/browser",
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:4173", trace: "off" },
  webServer: {
    // The app now reads a database, so the migrations run before the build, as they do on Netlify.
    command: "pnpm exec prisma migrate deploy && pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      DIRECT_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      // The hook now runs on every request, so the sign-in settings must exist. All plainly fake.
      BETTER_AUTH_SECRET: "test-only-secret-not-used-anywhere-real",
      BETTER_AUTH_URL: "http://localhost:4173",
      SMTP_URL: "test:",
      MAIL_FROM: "Ruken <hello@ruken.test>",
    },
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "computer", use: { ...devices["Desktop Chrome"] } },
  ],
});
