import { membershipServices } from "../../../features/membership/membership.ts";
import type { RequestHandler } from "./$types";

// Where Stripe tells the site what happened (a payment, a cancellation). Anyone can post here, so nothing is
// believed until its signature checks out, and a delivery that does not check out is stored nowhere.
//
// SvelteKit's cross-site check (`is_csrf_forbidden`, read in @sveltejs/kit 3.0.0's runtime/server/csrf.js) stops a
// POST that has no content type or a form's, whose Origin is not the site's. Stripe sends `application/json`,
// so this route is not a form post and the check does not apply to it.
export const POST: RequestHandler = async ({ request }) => {
  // The signature covers these exact bytes, so the body is read as text and never parsed first.
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const membership = membershipServices();

  let event;
  try {
    if (signature === null) throw new Error("no signature");
    event = await membership.verify(payload, signature);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  try {
    await membership.receive(event);
  } catch (error) {
    // Answered 500 so Stripe sends the event again; the inbox kept it, and handling it twice does no harm.
    console.error(
      `stripe event ${event.id} not handled: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return new Response("Not handled yet", { status: 500 });
  }
  return new Response(null, { status: 200 });
};
