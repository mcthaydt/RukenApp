import netlifyAdapter from "@sveltejs/adapter-netlify";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

// SvelteKit 3 takes its options here, not in svelte.config.js.
// Ruken runs on Netlify (design 7.3). Node functions, not edge: the server code will need Node's database driver.
export default defineConfig({
  plugins: [sveltekit({ adapter: netlifyAdapter({ edge: false }) })],
  test: {
    environment: "node",
    // Tests live only in tests/, mirroring src/ (CLAUDE.md). Browser journeys are Playwright's, not Vitest's.
    // Two projects: `unit` needs nothing running; `postgres` (`*.pg.test.ts`) needs the server named by
    // TEST_DATABASE_URL, which only CI's postgres job has.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/browser/**", "**/*.pg.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "postgres",
          include: ["tests/**/*.pg.test.ts"],
          // Making and migrating a database takes a while on a shared runner.
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
