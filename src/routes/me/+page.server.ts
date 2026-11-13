import { error } from "@sveltejs/kit";
import { authServices, resendVerification, signedInOnly } from "../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

// The signed-in person's own page. Signed out, `signedInOnly` sends them to sign in and back here.
async function accountOf(userId: string): Promise<{ email: string; emailVerified: boolean }> {
  const user = await authServices().prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  // The hook only lets an active account through, so a missing row means it was removed a moment ago.
  if (user === null) error(404);
  return user;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  return accountOf(userId);
};

export const actions: Actions = {
  // The address mailed is read from the database, never from the form: nobody can ask for a
  // confirmation link to be sent to someone else's address.
  resend: async (event) => {
    const { userId } = signedInOnly(event.locals.caller, event.url);
    const { email } = await accountOf(userId);
    return resendVerification(event, authServices().formDeps, email);
  },
};
