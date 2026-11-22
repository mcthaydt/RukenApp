import { howToBack } from "../back-link.ts";
import type { PageServerLoad } from "./$types";

// The step-by-step guide to getting a game on Ruken. It needs no account: a maker reads it before they have one. The
// way back is the page that sent them (see `howToBack`), and the how-tos it links to come back here.
export const load: PageServerLoad = ({ url }) => ({ back: howToBack(url) });
