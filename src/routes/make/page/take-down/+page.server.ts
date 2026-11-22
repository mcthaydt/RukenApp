import { PageError, pagesServices } from "../../../../features/pages/pages.ts";
import { ownPage } from "../own-page.server";
import { savedThenRooms } from "../page-words.server";
import type { Actions, PageServerLoad } from "./$types";

// The last question before a page is taken down. Games and the account stay; the page, its links, its photo and its
// counts go, and its address is free for anyone, the same maker included, to take again.

export const load: PageServerLoad = async (event) => {
  const { page } = await ownPage(event);
  return { name: page.name, handle: page.handle };
};

export const actions: Actions = {
  takeDown: async (event) => {
    const { userId } = await ownPage(event);
    try {
      await pagesServices().service.removePage(userId);
    } catch (problem) {
      // A second press, or a second tab, finds it already gone: that is what was asked for.
      if (!(problem instanceof PageError && problem.code === "NOT_FOUND")) throw problem;
    }
    // A person with no page is asked the first question, which says so and lets her make a new one.
    savedThenRooms(event.cookies, "Your page is down.");
  },
};
