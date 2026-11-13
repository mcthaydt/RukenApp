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
    command: "pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "computer", use: { ...devices["Desktop Chrome"] } },
  ],
});
