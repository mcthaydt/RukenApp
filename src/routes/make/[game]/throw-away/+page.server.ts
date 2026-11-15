import { error } from "@sveltejs/kit";
import { ownGame } from "../../own-game.server.ts";
import type { PageServerLoad } from "./$types";

// The last question before a game is thrown away. Only a draft and a game sent back can be: a game that is waiting, live
// or off Ruken is a 404, as is anyone else's. The throwing away itself is a form that posts to Your games.
export const load: PageServerLoad = async (event) => {
  const { game } = await ownGame(event);
  if (game.state !== "draft" && game.state !== "sent_back") error(404, "Not found");
  return { name: game.name, slug: game.slug };
};
