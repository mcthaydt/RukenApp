import { error, fail, redirect } from "@sveltejs/kit";
import { LINK_TITLE_MAX } from "../../../../../features/pages/pages.ts";
import { ownPage } from "../../own-page.server";
import type { Actions, PageServerLoad } from "./$types";

// Changing a link, the first of its two questions: what it says, and whether it is a game somewhere else. Both are
// filled in with what the link has now. A link that is not the signed-in maker's own is the missing page.

export const load: PageServerLoad = async (event) => {
  const { page } = await ownPage(event);
  const link = page.links.find((candidate) => candidate.id === event.params.link);
  if (link === undefined) error(404, "Not found");
  return { title: link.title, game: link.kind === "game_elsewhere", id: link.id };
};

export const actions: Actions = {
  words: async (event) => {
    const { page } = await ownPage(event);
    const link = page.links.find((candidate) => candidate.id === event.params.link);
    if (link === undefined) error(404, "Not found");
    const data = await event.request.formData();
    const raw = data.get("title");
    const title = typeof raw === "string" ? raw : "";
    const game = data.get("kind") === "game_elsewhere";
    const trimmed = title.trim();
    if (trimmed === "") return fail(400, { problem: "Give the link a name.", title, game });
    if (trimmed.length > LINK_TITLE_MAX) {
      return fail(400, {
        problem: `A link's name can be up to ${String(LINK_TITLE_MAX)} characters.`,
        title,
        game,
      });
    }
    const next = new URLSearchParams({ title: trimmed });
    if (game) next.set("game", "1");
    redirect(303, `/make/page/links/${link.id}/where?${next.toString()}`);
  },
};
