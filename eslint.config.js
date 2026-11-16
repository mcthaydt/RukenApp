// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/node_modules/",
    "**/build/",
    "**/.svelte-kit/",
    "**/.wrangler/",
    "**/worker-configuration.d.ts",
    "**/src/lib/server/generated/",
    "**/tests/support/generated/",
    "**/playwright-report/",
    "**/test-results/",
    // 2048, a game by someone else kept byte for byte (tests/fixtures/2048/CREDIT.md).
    "**/tests/fixtures/2048/",
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".svelte"],
      },
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
