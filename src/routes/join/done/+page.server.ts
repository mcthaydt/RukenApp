import { redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { membershipServices } from "../../../features/membership/membership.ts";
import type { PageServerLoad } from "./$types";

// Where Stripe sends a person after paying (`/join/done?checkout=<ref>`). Usually Stripe's news has reached the
// site before the browser has, and the person never sees this page: they go straight on to where they were
// going. If it has not, the page waits for it (+page.svelte asks again every two seconds, which runs this again).
export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const ref = url.searchParams.get("checkout");
  // No ref, a ref that is not this person's, or a checkout that ran out: back to the card.
  if (ref === null) redirect(303, "/join");
  const checkout = await membershipServices().service.checkoutState({ ref, userId });
  if (checkout === null || checkout.state === "expired") redirect(303, "/join");
  // A checkout is marked completed only after the membership exists, so "completed" means they are a member.
  if (checkout.state === "completed") redirect(303, checkout.returnTo);
  return {};
};
