import { error, redirect } from "@sveltejs/kit";
import { hasConsent } from "../../../../features/consent/consent.ts";
import { pagesServices } from "../../../../features/pages/pages.ts";
import type { RequestHandler } from "./$types";

// A tap on a page's link: counted (only for a browser that said yes to cookies), then sent on. The address is read from the database, never from the request, and
// only an address that starts with https:// is ever sent to (the database holds the same rule).

export const GET: RequestHandler = async ({ params, locals, cookies }) => {
  const viewer = locals.caller.kind === "user" ? locals.caller.userId : null;
  const address = await pagesServices().service.tapLink(
    params.handle,
    params.link,
    viewer,
    hasConsent(cookies),
  );
  if (address === null || !address.startsWith("https://")) error(404);
  // A maker's link leads to another site on purpose; SvelteKit asks for that to be said.
  redirect(303, address, { external: [new URL(address).origin] });
};
