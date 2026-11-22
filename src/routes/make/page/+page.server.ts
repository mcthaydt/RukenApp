import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { cleanHandle, linksWords, pagesServices, timesWords } from "../../../features/pages/pages.ts";
import { savedThenRooms, savedWords, refused } from "./page-words.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// Your page (spec 5.5): the rooms, each a question of its own. A maker with no page yet meets the address question
// first; saving it makes the page. Signed out, to sign-in and back.

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const page = await pagesServices().service.pageOf(userId);
  const saved = savedWords(cookies);
  if (page === null) return { rooms: null, saved, host: url.host };
  return {
    host: url.host,
    saved,
    rooms: {
      handle: page.handle,
      address: `${url.host}/${page.handle}`,
      name: page.name,
      oneLine: page.oneLine,
      photo: page.photoKey === null ? "Not yet" : "Added",
      colours: page.themeId === 0 ? "Ruken's own colours" : `Colours ${String(page.themeId)}`,
      links: linksWords(page.links.length),
      opened: `Opened ${timesWords(page.views)}.`,
    },
  };
};

export const actions: Actions = {
  // The first answer makes the page: its name is its address until the maker changes it.
  make: async ({ locals, request, url, cookies }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const raw = (await request.formData()).get("handle");
    const handle = typeof raw === "string" ? raw : "";
    const { service } = pagesServices();
    // A page that exists already (a second tab, a reload) is not made again: the rooms are where this goes.
    if ((await service.pageOf(userId)) !== null) savedThenRooms(cookies, "Saved.");
    try {
      await service.savePage(userId, { handle, name: cleanHandle(handle), oneLine: "" });
    } catch (problem) {
      return refused(problem, { handle });
    }
    savedThenRooms(cookies, "Saved. Your page is live.");
  },
};
