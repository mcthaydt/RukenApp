import { error, redirect } from "@sveltejs/kit";
import {
  MAX_LINKS,
  PageError,
  pagesServices,
  siteNameOf,
  timesWords,
} from "../../../../features/pages/pages.ts";
import { ownPage, textOf } from "../own-page.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// Your links (spec 5.5): each as it will appear, how often it was tapped, and what the maker can do with it. Every
// change is the signed-in maker's own: a link that is not on their page is a page that is not there.

export const load: PageServerLoad = async (event) => {
  const { page } = await ownPage(event);
  return {
    links: page.links.map((link) => ({
      id: link.id,
      title: link.title,
      site: link.kind === "game_elsewhere" ? siteNameOf(link.url) : null,
      hidden: link.hidden,
      taps: timesWords(link.taps),
    })),
    full: page.links.length >= MAX_LINKS,
    max: MAX_LINKS,
  };
};

/** Runs one change to the maker's link; a link that is not theirs is the missing page and nothing changes. */
async function changeLink(
  event: Parameters<Actions[string]>[0],
  change: (
    service: ReturnType<typeof pagesServices>["service"],
    userId: string,
    linkId: string,
  ) => Promise<void>,
): Promise<never> {
  const { userId } = await ownPage(event);
  const linkId = textOf(await event.request.formData(), "link");
  try {
    await change(pagesServices().service, userId, linkId);
  } catch (problem) {
    if (problem instanceof PageError && problem.code === "NOT_FOUND") error(404, "Not found");
    throw problem;
  }
  return redirect(303, "/make/page/links");
}

export const actions: Actions = {
  up: (event) => changeLink(event, (service, userId, id) => service.moveLinkOf(userId, id, "up")),
  down: (event) => changeLink(event, (service, userId, id) => service.moveLinkOf(userId, id, "down")),
  hide: (event) => changeLink(event, (service, userId, id) => service.setHidden(userId, id, true)),
  show: (event) => changeLink(event, (service, userId, id) => service.setHidden(userId, id, false)),
  remove: (event) => changeLink(event, (service, userId, id) => service.removeLink(userId, id)),
};
