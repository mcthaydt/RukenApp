import { error } from "@sveltejs/kit";
import { ownGame } from "../../own-game.server.ts";
import type { PageServerLoad } from "./$types";

// The last question before a game is thrown away. A draft, a game sent back, a game waiting for review and a game that is
// off Ruken can be: a live game or one staff took down is a 404, as is anyone else's. The throwing away itself is a form
// that posts to Your games.
export const load: PageServerLoad = async (event) => {
  const { game } = await ownGame(event);
  const may = ["draft", "sent_back", "waiting", "taken_off"];
  if (!may.includes(game.state)) error(404, "Not found");
  return { name: game.name, slug: game.slug };
};
