import { fail, redirect } from "@sveltejs/kit";
import { linkTitleProblem, PageError, pagesServices } from "../../../../../features/pages/pages.ts";
import { ownPage, savedAndBack, textOf } from "../../own-page.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// Adding a link is two questions, one to a screen: what it should say, then where it goes. The words ride in the
// address between the two, so each screen works without script and a reload keeps them.

export const load: PageServerLoad = async (event) => {
  await ownPage(event);
  const title = event.url.searchParams.get("title");
  const elsewhere = event.url.searchParams.get("elsewhere") === "1";
  // A title that is not good leads back to the first question.
  if (title !== null && linkTitleProblem(title) !== null) redirect(303, "/make/page/links/add");
  return { step: title === null ? ("words" as const) : ("address" as const), title: title ?? "", elsewhere };
};

export const actions: Actions = {
  answer: async (event) => {
    const { userId } = await ownPage(event);
    const form = await event.request.formData();
    const title = textOf(form, "title");
    const elsewhere = textOf(form, "elsewhere") === "1";

    // The first question: the words, and whether it is a game somewhere else.
    if (!form.has("url")) {
      const problem = linkTitleProblem(title);
      if (problem !== null)
        return fail(400, { problem, value: title, elsewhere, title, step: "words" as const });
      const next = new URLSearchParams({ title: title.trim() });
      if (elsewhere) next.set("elsewhere", "1");
      redirect(303, `/make/page/links/add?${next.toString()}`);
    }

    // The second: where it goes.
    const url = textOf(form, "url");
    try {
      await pagesServices().service.addLink(userId, {
        kind: elsewhere ? "game_elsewhere" : "link",
        title,
        url,
      });
    } catch (problem) {
      if (problem instanceof PageError)
        return fail(400, {
          problem: problem.message,
          value: url,
          elsewhere,
          title,
          step: "address" as const,
        });
      throw problem;
    }
    return savedAndBack(event, "Link added.");
  },
};
