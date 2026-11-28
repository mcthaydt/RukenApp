import { feedServices } from "../../../features/feed/feed.ts";
import type { Actions, PageServerLoad } from "./$types";

// A parent's link (learned feed spec 6.5, I2, I5): Yes or No to a teen's ask, and after Yes, Turn it off. No account is
// needed; the link's secret part is the proof. It is gated, so a browser that has not said yes to cookies sees the
// notice first and nothing is kept until it agrees.

export const load: PageServerLoad = async ({ params }) => ({
  page: await feedServices().parentYes.pageOf(params.token),
});

export const actions: Actions = {
  yes: async ({ params }) => ({ page: await feedServices().parentYes.answer(params.token, "yes") }),
  no: async ({ params }) => ({ page: await feedServices().parentYes.answer(params.token, "no") }),
  off: async ({ params }) => ({ page: await feedServices().parentYes.answer(params.token, "off") }),
};
