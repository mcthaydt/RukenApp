import { error, fail, redirect } from "@sveltejs/kit";
import { LINK_TITLE_MAX } from "../../../../../features/pages/pages.ts";
import { ownPage } from "../../own-page.server";
import { kindOfForm } from "../link-kind.ts";
import type { Actions, PageServerLoad } from "./$types";

// Changing a link, the first of its two questions: what it says, and whether it is a game somewhere else or a small
// icon. Both are
// filled in with what the link has now. A link that is not the signed-in maker's own is the missing page.

export const load: PageServerLoad = async (event) => {
  const { page } = await ownPage(event);
  const link = page.links.find((candidate) => candidate.id === event.params.link);
  if (link === undefined) error(404, "Not found");
  return { title: link.title, kind: link.kind, id: link.id };
};

export const actions: Actions = {
  words: async (event) => {
    const { page } = await ownPage(event);
    const link = page.links.find((candidate) => candidate.id === event.params.link);
    if (link === undefined) error(404, "Not found");
    const data = await event.request.formData();
    const raw = data.get("title");
    const title = typeof raw === "string" ? raw : "";
    const kind = kindOfForm(data);
    const trimmed = title.trim();
    if (trimmed === "") return fail(400, { problem: "Give the link a name.", title, kind });
    if (trimmed.length > LINK_TITLE_MAX) {
      return fail(400, {
        problem: `A link's name can be up to ${String(LINK_TITLE_MAX)} characters.`,
        title,
        kind,
      });
    }
    const next = new URLSearchParams({ title: trimmed });
    if (kind !== "link") next.set("kind", kind);
    redirect(303, `/make/page/links/${link.id}/where?${next.toString()}`);
  },
};
