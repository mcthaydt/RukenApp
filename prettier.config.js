// @ts-check
/** @type {import("prettier").Config} */
export default {
  printWidth: 110,
  plugins: ["prettier-plugin-svelte"],
  overrides: [{ files: "*.svelte", options: { parser: "svelte" } }],
};
