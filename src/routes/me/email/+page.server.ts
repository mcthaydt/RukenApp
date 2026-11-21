import { error } from "@sveltejs/kit";
import { authServices, changeEmail, signedInOnly } from "../../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

// "Change email". Asking mails a link to the new address; the address changes when it is opened (accounts/credentials.ts).
async function emailOf(userId: string): Promise<string> {
  const user = await authServices().prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  // The hook only lets an active account through, so a missing row means it was removed a moment ago.
  if (user === null) error(404);
  return user.email;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const email = await emailOf(userId);
  // A member's Stripe customer keeps the address it was made with, so their receipts keep going to it (slice 5 changes that).
  const member = (await authServices().prisma.billingCustomer.findUnique({ where: { userId } })) !== null;
  return { email, member };
};

export const actions: Actions = {
  default: async (event) => {
    const { userId } = signedInOnly(event.locals.caller, event.url);
    return changeEmail(event, authServices().credentialDeps, { userId, email: await emailOf(userId) });
  },
};
