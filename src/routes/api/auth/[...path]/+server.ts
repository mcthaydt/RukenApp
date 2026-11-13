import { authServices, forwardToAuth } from "../../../../features/accounts/accounts.ts";
import type { RequestHandler } from "./$types";

// better-auth's own endpoints (get-session, sign-out, the links in our mails). The pages' forms do
// not go through here: they call better-auth on the server (forms.ts). The sign-up endpoint answers
// 404 here, so an account is only ever made through the sign-up form and its age check.
const handler: RequestHandler = (event) =>
  forwardToAuth(authServices().auth.handler, event.request, event.getClientAddress());

export const GET = handler;
export const POST = handler;
