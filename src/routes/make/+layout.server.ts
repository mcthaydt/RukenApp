import { QUESTIONS } from "../../features/games/games.ts";
import type { LayoutServerLoad } from "./$types";

// The order the questions are asked in, for the layout that tells a step forward from a step back. It comes from the
// server because the layout runs in the browser, which must not load the games feature itself.
export const load: LayoutServerLoad = () => ({ questions: QUESTIONS });
