import { fail, redirect } from "@sveltejs/kit";
import { isKnownAdultCaller, signedInOnly } from "../../../features/accounts/accounts.ts";
import { PageError, pagesServices } from "../../../features/pages/pages.ts";
import type { Actions, PageServerLoad } from "./$types";

// "What should friends call you?": asked once, right after sign-up (and on the next visit for an account made before
// it), and opened again from Your account to change the name. The first Save makes the account's page, with an address
// made from the name; later ones change the name only. It is open to an account with no page, so it never loops.
export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId, next } = signedInOnly(locals.caller, url);
  const page = await pagesServices().service.pageOf(userId);
  return { name: page?.name ?? "", hasPage: page !== null, adult: await isKnownAdultCaller(locals.caller), next };
};

export const actions: Actions = {
  default: async ({ locals, url, request }) => {
    const { userId, next } = signedInOnly(locals.caller, url);
    const raw = (await request.formData()).get("name");
    const name = typeof raw === "string" ? raw : "";
    const service = pagesServices().service;
    try {
      if (await service.hasPage(userId)) {
        await service.renamePage(userId, name);
        return { saved: true, name };
      }
      await service.makeUnlistedPage(userId, name);
    } catch (cause) {
      if (cause instanceof PageError) return fail(400, { error: cause.message, name });
      throw cause;
    }
    redirect(303, next);
  },
};
