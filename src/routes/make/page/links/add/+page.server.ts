import { fail, redirect } from "@sveltejs/kit";
import { LINK_TITLE_MAX } from "../../../../../features/pages/pages.ts";
import { ownPage } from "../../own-page.server";
import { kindOfForm } from "../link-kind.ts";
import type { Actions, PageServerLoad } from "./$types";

// A new link, the first of its two questions: what it says, and whether it is a game somewhere else or a small icon. The second
// question (where it goes) makes the link.

export const load: PageServerLoad = async (event) => {
  await ownPage(event);
  return {};
};

export const actions: Actions = {
  words: async (event) => {
    await ownPage(event);
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
    redirect(303, `/make/page/links/add/where?${next.toString()}`);
  },
};
