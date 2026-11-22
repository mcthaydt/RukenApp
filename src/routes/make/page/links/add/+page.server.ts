import { fail, redirect } from "@sveltejs/kit";
import { LINK_KIND_CHOICES, LINK_TITLE_MAX, linkKindOf } from "../../../../../features/pages/pages.ts";
import { ownPage } from "../../own-page.server";
import type { Actions, PageServerLoad } from "./$types";

// A new link, the first of its two questions: what it says, and what kind it is (a plain link, a game somewhere else or a small icon). The second
// question (where it goes) makes the link.

export const load: PageServerLoad = async (event) => {
  await ownPage(event);
  return { choices: [...LINK_KIND_CHOICES] };
};

export const actions: Actions = {
  words: async (event) => {
    await ownPage(event);
    const data = await event.request.formData();
    const raw = data.get("title");
    const title = typeof raw === "string" ? raw : "";
    const kind = linkKindOf(data.get("kind"));
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
