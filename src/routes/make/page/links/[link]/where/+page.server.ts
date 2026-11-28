import { error, fail, redirect } from "@sveltejs/kit";
import { PageError, pagesServices } from "../../../../../../features/pages/pages.ts";
import { ownPage } from "../../../own-page.server";
import { kindOfParam } from "../../link-kind.ts";
import type { Actions, PageServerLoad } from "./$types";

// Changing a link, the second of its two questions: where it goes, filled in with where it goes now. Saving keeps the
// link's place, its tap count and whether it is hidden.

export const load: PageServerLoad = async (event) => {
  const { page } = await ownPage(event);
  const link = page.links.find((candidate) => candidate.id === event.params.link);
  if (link === undefined) error(404, "Not found");
  const title = event.url.searchParams.get("title") ?? "";
  // Nothing was said yet, so the first question is the way in.
  if (title.trim() === "") redirect(303, `/make/page/links/${link.id}`);
  return { id: link.id, title, kind: kindOfParam(event.url.searchParams.get("kind")), url: link.url };
};

export const actions: Actions = {
  save: async (event) => {
    const { userId } = await ownPage(event);
    const data = await event.request.formData();
    const text = (key: string): string => {
      const value = data.get(key);
      return typeof value === "string" ? value : "";
    };
    const title = event.url.searchParams.get("title") ?? text("title");
    const url = text("url");
    const kind = kindOfParam(event.url.searchParams.get("kind") ?? text("kind"));
    try {
      await pagesServices().service.updateLink(userId, event.params.link, {
        kind,
        title,
        url,
      });
    } catch (problem) {
      if (!(problem instanceof PageError)) throw problem;
      if (problem.code === "NOT_FOUND") error(404, "Not found");
      return fail(400, { problem: problem.message, title, kind, url });
    }
    redirect(303, "/make/page/links");
  },
};
