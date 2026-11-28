import { error, redirect } from "@sveltejs/kit";
import { MAX_LINKS, PageError, pagesServices, timesWords } from "../../../../features/pages/pages.ts";
import { ownPage } from "../own-page.server";
import type { Actions, PageServerLoad } from "./$types";

// Your links (spec 5.5, I8): each as it will appear, with how often it was tapped, and what a maker can do to it. Every
// action works on the signed-in maker's own links: an id that is not hers is the missing page and nothing changes.

export const load: PageServerLoad = async (event) => {
  const { page } = await ownPage(event);
  return {
    full: page.links.length >= MAX_LINKS,
    most: MAX_LINKS,
    links: page.links.map((link, index) => ({
      id: link.id,
      title: link.title,
      elsewhere: link.kind === "game_elsewhere",
      icon: link.kind === "social",
      hidden: link.hidden,
      taps: `Tapped ${timesWords(link.taps)}`,
      first: index === 0,
      last: index === page.links.length - 1,
    })),
  };
};

/** Runs one thing on one of the maker's own links, then shows the list again. */
async function onLink(
  event: Parameters<NonNullable<Actions[string]>>[0],
  act: (service: ReturnType<typeof pagesServices>["service"], userId: string, id: string) => Promise<void>,
): Promise<never> {
  const { userId } = await ownPage(event);
  const id = (await event.request.formData()).get("link");
  try {
    await act(pagesServices().service, userId, typeof id === "string" ? id : "");
  } catch (problem) {
    if (problem instanceof PageError && problem.code === "NOT_FOUND") error(404, "Not found");
    throw problem;
  }
  redirect(303, "/make/page/links");
}

export const actions: Actions = {
  up: (event) => onLink(event, (service, userId, id) => service.moveLinkOf(userId, id, "up")),
  down: (event) => onLink(event, (service, userId, id) => service.moveLinkOf(userId, id, "down")),
  hide: (event) => onLink(event, (service, userId, id) => service.setHidden(userId, id, true)),
  show: (event) => onLink(event, (service, userId, id) => service.setHidden(userId, id, false)),
  remove: (event) => onLink(event, (service, userId, id) => service.removeLink(userId, id)),
};
