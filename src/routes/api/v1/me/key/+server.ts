import { authServices } from "../../../../../features/accounts/accounts.ts";
import { api, maker } from "../../api.server.ts";
import type { RequestHandler } from "./$types";

// Sign out: this computer's key stops working at once.
export const DELETE: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const { caller } = event.locals;
  if (caller.kind === "computer") {
    await authServices().prisma.computerKey.deleteMany({ where: { id: caller.keyId, userId } });
  }
  return Response.json({ signedOut: true });
});
