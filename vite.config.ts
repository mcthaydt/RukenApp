import { dirname, resolve } from "node:path";
import cloudflareAdapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Prisma's Workers client imports its WebAssembly as `./query_compiler_fast_bg.wasm?module`. Vite cannot load
// that (it reads `?module` as part of the file name) and Wrangler's own bundler can, so this leaves that one
// import untouched, for Wrangler. The path is absolute because the build and the deploy run in the same folder
// (on the runner and in Workers Builds). It touches no other import.
const workersWasm: Plugin = {
  name: "workers-wasm",
  enforce: "pre",
  resolveId(id, importer) {
    if (!id.endsWith(".wasm?module") || importer === undefined) return null;
    return { id: resolve(dirname(importer), id), external: "absolute" };
  },
};

// SvelteKit 3 takes its options here, not in svelte.config.js.
// Ruken runs on Cloudflare Workers (design 7.3). The adapter's Vite plugin starts Wrangler's local stand-in in
// every Vite server, Vitest's included, and that stand-in refuses the Hyperdrive binding without a local
// database. The tests never build the site, so they do without the adapter.
export default defineConfig({
  plugins: [workersWasm, sveltekit(process.env.VITEST === "true" ? {} : { adapter: cloudflareAdapter() })],
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
