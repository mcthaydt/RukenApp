// The screens the pages feature draws, for a route to use. A separate entry from pages.browser.ts because a route matcher
// (src/params/) imports that one and is built by Node, which cannot load a .svelte file.
export { default as MakerPage } from "./MakerPage.svelte";
