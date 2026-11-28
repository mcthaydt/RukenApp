import { redirect, type RequestEvent } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { pagesServices } from "../../../features/pages/pages.ts";

/**
 * The signed-in maker and their own page, for every room. A maker with no page yet is sent to the first question, which
 * makes it; so is one whose page sign-up made and is not listed yet, since the first question lists it. Every room works on the signed-in maker's own page and no other, so nobody can change someone else's.
 */
export async function ownPage(event: Pick<RequestEvent, "locals" | "url">) {
  const { userId } = signedInOnly(event.locals.caller, event.url);
  const page = await pagesServices().service.pageOf(userId);
  if (page === null || !page.listed) redirect(303, "/make/page");
  return { userId, page };
}
