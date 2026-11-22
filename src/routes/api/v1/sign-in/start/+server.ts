import { authServices, COMPUTER_WORDS, startSignIn } from "../../../../../features/accounts/accounts.ts";
import { platform } from "../../../../../lib/server/platform.ts";
import { api, problem, readJson } from "../../api.server.ts";
import type { RequestHandler } from "./$types";

// A computer asks to be let in. It gets a code to show the maker and a secret to keep to itself; no key yet. Where the
// ask came from is read from the request here, never from what the computer says, and shown to the maker beside Yes.
export const POST: RequestHandler = api(async ({ request, url, getClientAddress }) => {
  const body = await readJson(request);
  const name = typeof body?.name === "string" ? body.name : "";
  const started = await startSignIn(authServices().computerDeps, {
    name,
    startedFrom: platform().placeOf(request),
    clientAddress: getClientAddress(),
  });
  if (!started.ok) return problem(started.status, started.problem);
  return Response.json({
    code: started.code,
    deviceSecret: started.deviceSecret,
    // Where the maker presses Yes, with the code already in it.
    link: `${url.origin}/me/link?code=${started.code}`,
    secondsLeft: Math.round((started.expiresAt.getTime() - authServices().clock.epochMs()) / 1000),
    wait: COMPUTER_WORDS.slowDown,
  });
});
