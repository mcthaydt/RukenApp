import { howToBack } from "../back-link.ts";
import type { PageServerLoad } from "./$types";

// How the feed picks games, for anyone: it needs no account. The way back is the page that sent the reader, like the
// other help pages (see `howToBack`).
export const load: PageServerLoad = ({ url }) => ({ back: howToBack(url) });
