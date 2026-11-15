import { howToBack } from "../back-link.ts";
import type { PageServerLoad } from "./$types";

// How to record a screen, for a maker who has never done it. It needs no account: someone reads it before they have
// one. The way back is the page that sent them (see `howToBack`).
export const load: PageServerLoad = ({ url }) => ({ back: howToBack(url) });
