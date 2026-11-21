import { fail } from "@sveltejs/kit";
import { authServices, changePassword, signedInOnly } from "../../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

// "Change password": the current one and a new one. Every other signed-in device is signed out (accounts/credentials.ts).
export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const user = await authServices().prisma.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true },
  });
  // An account made before sign-in moved to phone numbers has none until the attach-phone command gives it one.
  return { hasNumber: user?.phoneNumber != null };
};

export const actions: Actions = {
  default: async (event) => {
    const { userId } = signedInOnly(event.locals.caller, event.url);
    const user = await authServices().prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true },
    });
    // A signed-in account made by phone has a number; one made before that has none yet (the attach-phone command).
    if (user === null || user.phoneNumber === null)
      return fail(400, {
        field: "form" as const,
        error:
          "Your account needs its phone number first. Ruken will add it, then you can change your password.",
      });
    return changePassword(event, authServices().credentialDeps, { userId, number: user.phoneNumber });
  },
};
