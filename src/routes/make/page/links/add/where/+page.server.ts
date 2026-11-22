import { fail, redirect } from "@sveltejs/kit";
import { linkKindOf, PageError, pagesServices } from "../../../../../../features/pages/pages.ts";
import { ownPage } from "../../../own-page.server";
import type { Actions, PageServerLoad } from "./$types";

// A new link, the second of its two questions: where it goes. The words come with the address from the first.

export const load: PageServerLoad = async (event) => {
  await ownPage(event);
  const title = event.url.searchParams.get("title") ?? "";
  // Nothing was said yet, so the first question is the way in.
  if (title.trim() === "") redirect(303, "/make/page/links/add");
  return { title, kind: linkKindOf(event.url.searchParams.get("kind")) };
};

export const actions: Actions = {
  add: async (event) => {
    const { userId } = await ownPage(event);
    const data = await event.request.formData();
    const text = (key: string): string => {
      const value = data.get(key);
      return typeof value === "string" ? value : "";
    };
    const title = text("title");
    const url = text("url");
    const kind = linkKindOf(text("kind"));
    try {
      await pagesServices().service.addLink(userId, {
        kind,
        title,
        url,
      });
    } catch (problem) {
      if (!(problem instanceof PageError)) throw problem;
      return fail(400, { problem: problem.message, title, kind, url });
    }
    redirect(303, "/make/page/links");
  },
};
