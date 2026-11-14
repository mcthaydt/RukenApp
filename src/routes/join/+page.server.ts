import { fail, redirect } from "@sveltejs/kit";
import {
  dollars,
  MembershipError,
  membershipServices,
  PREMIUM_PRICES_CENTS,
  type PremiumPlan,
} from "../../features/membership/membership.ts";
import { safeNextPath } from "../../lib/safe-next.ts";
import type { Actions, PageServerLoad } from "./$types";

// The paywall card. Slice 2's Play button sends a person who is not a member here, with `next` set to the game
// they tapped. Nothing on it asks for sign-in until the person presses Continue (design 5.2).

/** A text field of the form, or "" when it is missing or is a file. */
function fieldOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** The plan a person picked, or the monthly one: an unknown value is never trusted. */
function planOf(value: unknown): PremiumPlan {
  return value === "annual" ? "annual" : "monthly";
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const caller = locals.caller;
  return {
    next: safeNextPath(url.searchParams.get("next")),
    plan: planOf(url.searchParams.get("plan")),
    // The prices are the rules' (plans.ts), written out in words here, never typed on the page.
    prices: { monthly: dollars(PREMIUM_PRICES_CENTS.monthly), annual: dollars(PREMIUM_PRICES_CENTS.annual) },
    signedIn: caller.kind === "user",
    // Asked only of someone signed in, so a stranger can read the card before the site has any Stripe settings.
    member: caller.kind === "user" && (await membershipServices().service.isMember(caller.userId)),
  };
};

const RATE_LIMITED = "You've started a lot of checkouts just now. Try again in a minute.";
const WENT_WRONG = "Something went wrong on our side. Try again in a moment.";

export const actions: Actions = {
  join: async ({ locals, request, cookies }) => {
    const form = await request.formData();
    const plan = planOf(fieldOf(form, "plan"));
    const next = safeNextPath(fieldOf(form, "next"));

    // Signed out: sign up (or in) first, and come back to this same card with the plan kept.
    if (locals.caller.kind !== "user") {
      const back = `/join?plan=${plan}&next=${encodeURIComponent(next)}`;
      redirect(303, `/sign-up?next=${encodeURIComponent(back)}`);
    }

    // The arrival is read here, on the server, from the cookie only the server writes: the card has no field for it.
    const { service, arrival } = membershipServices();
    let payAt: string;
    try {
      const started = await service.startCheckout({
        userId: locals.caller.userId,
        plan,
        returnTo: next,
        arrival: arrival.read(cookies),
      });
      payAt = started.url;
    } catch (error) {
      if (error instanceof MembershipError) {
        if (error.code === "ALREADY_MEMBER") redirect(303, next);
        return fail(error.code === "RATE_LIMITED" ? 429 : 400, {
          plan,
          error: error.code === "RATE_LIMITED" ? RATE_LIMITED : WENT_WRONG,
        });
      }
      // Stripe or the database failed. The person is told in words; the site's log keeps the reason.
      console.error(`checkout did not start: ${error instanceof Error ? error.message : "unknown error"}`);
      return fail(500, { plan, error: WENT_WRONG });
    }
    // Stripe's page is another site, which SvelteKit 3's redirect refuses unless told. The address is Stripe's answer to
    // our own call and never anything a person typed; `external: true` still refuses a `javascript:` address.
    redirect(303, payAt, { external: true });
  },
};
