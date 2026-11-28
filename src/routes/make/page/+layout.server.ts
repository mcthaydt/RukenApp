import { error } from "@sveltejs/kit";
import { pageEditorOpen } from "../../../features/pages/pages.ts";
import type { LayoutServerLoad } from "./$types";

// Every screen for making or changing your own page waits for the Pages slice (features/pages/editor-switch.ts): until
// then each is the missing page. A form sent here is refused earlier, by the gate in src/hooks.server.ts.
export const load: LayoutServerLoad = ({ cookies }) => {
  if (!pageEditorOpen(cookies)) error(404, "Not found");
};
