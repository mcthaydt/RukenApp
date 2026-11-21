import { error } from "@sveltejs/kit";
import { authServices, changePassword, signedInOnly } from "../../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

// "Change password": the current one and a new one. Every other signed-in device is signed out (accounts/credentials.ts).
export const load: PageServerLoad = ({ locals, url }) => {
  signedInOnly(locals.caller, url);
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const { userId } = signedInOnly(event.locals.caller, event.url);
    const user = await authServices().prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true },
    });
    // A signed-in account made by phone has a number; one made before that has none yet (the attach-phone command).
    if (user === null || user.phoneNumber === null) error(404);
    return changePassword(event, authServices().credentialDeps, { userId, number: user.phoneNumber });
  },
};
