import { pageEditorOpen } from "../../../features/pages/pages.ts";
import { howToBack } from "../back-link.ts";
import type { PageServerLoad } from "./$types";

// The step-by-step guide to getting a game on Ruken. It needs no account: a maker reads it before they have one. The
// way back is the page that sent them (see `howToBack`), and the how-tos it links to come back here. Making your page
// waits for the Pages slice (features/pages/editor-switch.ts), so the guide says nothing of it yet.
export const load: PageServerLoad = ({ url, cookies }) => ({
  back: howToBack(url),
  pageEditor: pageEditorOpen(cookies),
});
