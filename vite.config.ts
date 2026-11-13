import netlifyAdapter from "@sveltejs/adapter-netlify";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

// SvelteKit 3 takes its options here, not in svelte.config.js.
// Ruken runs on Netlify (design 7.3). Node functions, not edge: the server code will need Node's database driver.
export default defineConfig({
  plugins: [sveltekit({ adapter: netlifyAdapter({ edge: false }) })],
  test: {
    // Tests live only in tests/, mirroring src/ (CLAUDE.md). Browser journeys are Playwright's, not Vitest's.
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/browser/**"],
    environment: "node",
  },
});
