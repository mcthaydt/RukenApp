import { redirect, type RequestEvent } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { pagesServices, type OwnPage } from "../../../features/pages/pages.ts";

// The maker's own page, for every screen under `/make/page`. Each screen finds it among the signed-in maker's own, so
// another maker's page can never be asked for: there is no address to change but one's own.

/** The one-time note after a save: set by the action that saved, read and cleared by the next look at the rooms. */
export const SAVED_NOTE = "page-saved";

/** The signed-in maker, or to sign-in and back. */
export function makerOf(event: Pick<RequestEvent, "locals" | "url">): string {
  return signedInOnly(event.locals.caller, event.url).userId;
}

/** The maker and their page; a maker with no page yet is sent to the first question, which makes it. */
export async function ownPage(
  event: Pick<RequestEvent, "locals" | "url">,
): Promise<{ userId: string; page: OwnPage }> {
  const userId = makerOf(event);
  const page = await pagesServices().service.pageOf(userId);
  if (page === null) redirect(303, "/make/page");
  return { userId, page };
}

/** A text field of the form, or "" when it is missing or is a file. */
export function textOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Says "Saved." on the rooms, once, and goes there. */
export function savedAndBack(event: Pick<RequestEvent, "cookies">, note: string = "Saved."): never {
  event.cookies.set(SAVED_NOTE, note, { path: "/make/page", httpOnly: true, sameSite: "lax", maxAge: 60 });
  redirect(303, "/make/page");
}
