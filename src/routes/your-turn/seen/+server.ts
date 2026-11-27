import { sendsServices } from "../../../features/sends/sends.ts";
import type { RequestHandler } from "./$types";

// Marks the person's Your turn list seen, so the tab's dot goes. The list page posts here once it is on screen: the page
// itself only reads, because it opens before the cookie yes (plan audit 3), and this route is gated.
export const POST: RequestHandler = async ({ locals }) => {
  if (locals.caller.kind !== "user") return new Response(null, { status: 401 });
  await sendsServices().markSeen(locals.caller.userId);
  return new Response(null, { status: 204 });
};
