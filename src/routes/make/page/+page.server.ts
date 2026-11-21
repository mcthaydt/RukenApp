import { fail } from "@sveltejs/kit";
import { linksWords, PageError, pagesServices, timesWords } from "../../../features/pages/pages.ts";
import { makerOf, SAVED_NOTE, savedAndBack, textOf } from "./own-page.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// Your page: the rooms, each one question, once a page exists; before, the one question that makes it (spec 5.5).

export const load: PageServerLoad = async (event) => {
  const userId = makerOf(event);
  const page = await pagesServices().service.pageOf(userId);
  // Said once: the note is gone the moment it is read, so a reload shows the plain rooms.
  const saved = event.cookies.get(SAVED_NOTE) ?? null;
  if (saved !== null) event.cookies.delete(SAVED_NOTE, { path: "/make/page" });
  if (page === null) return { page: null, saved, handle: "", host: event.url.host };
  return {
    page: {
      handle: page.handle,
      name: page.name,
      oneLine: page.oneLine,
      hasPhoto: page.photoKey !== null,
      themeId: page.themeId,
      links: linksWords(page.links.length),
      opened: timesWords(page.views),
    },
    saved,
    handle: page.handle,
    host: event.url.host,
  };
};

export const actions: Actions = {
  // The first question of a maker with no page: a good address makes the page, with the address as its name.
  answer: async (event) => {
    const userId = makerOf(event);
    const service = pagesServices().service;
    const typed = textOf(await event.request.formData(), "handle");
    try {
      await service.startPage(userId, typed);
    } catch (problem) {
      if (problem instanceof PageError) return fail(400, { problem: problem.message, value: typed });
      throw problem;
    }
    return savedAndBack(event, "Saved. Your page is live.");
  },
};
