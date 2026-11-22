import { fail } from "@sveltejs/kit";
import {
  answerSignIn,
  COMPUTER_WORDS,
  lookAtSignIn,
  placeWarning,
  signedInOnly,
  authServices,
} from "../../../features/accounts/accounts.ts";
import { platform } from "../../../lib/server/platform.ts";
import type { Actions, PageServerLoad } from "./$types";

// "Let this computer use your Ruken?": the one screen where a maker presses Yes after typing `npx ruken sign-in`. Signed
// out, `signedInOnly` sends them to sign in and back here with the code still in the address. The facts beside the
// button (where it was asked from, when, what the computer calls itself) come from Ruken's own side, never from the
// computer's say-so about where it is.

/** Plain words for a code that cannot be answered. */
const NOT_ASKABLE = {
  wrong: COMPUTER_WORDS.wrongCode,
  ran_out: COMPUTER_WORDS.codeRanOut,
  answered: "That code has already been answered. Run `npx ruken sign-in` again.",
  too_many_wrong: COMPUTER_WORDS.tooManyWrongCodes,
} as const;

/** How long ago, in words a person says. */
function agoWords(seconds: number): string {
  if (seconds < 60) return `${String(seconds)} second${seconds === 1 ? "" : "s"} ago`;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)} minute${minutes === 1 ? "" : "s"} ago`;
}

export const load: PageServerLoad = async ({ locals, url, request, getClientAddress }) => {
  signedInOnly(locals.caller, url);
  const typed = url.searchParams.get("code") ?? "";
  if (typed === "") return { stage: "type" as const };

  const looked = await lookAtSignIn(authServices().computerDeps, typed, getClientAddress());
  if (!looked.found) return { stage: "type" as const, typed, problem: NOT_ASKABLE[looked.reason] };

  const { asked } = looked;
  const here = platform().placeOf(request);
  return {
    stage: "ask" as const,
    code: asked.code,
    name: asked.name,
    from: asked.startedFrom.country === null && asked.startedFrom.city === null ? null : asked.startedFrom,
    fromWords: [asked.startedFrom.city, asked.startedFrom.country].filter(Boolean).join(", "),
    ago: agoWords(asked.secondsAgo),
    // Set only when the computer asked from another place than this browser is in.
    warning: placeWarning(asked.startedFrom, here),
  };
};

/** The words for an answer that did not take. */
const REFUSED = {
  wrong: COMPUTER_WORDS.wrongCode,
  ran_out: COMPUTER_WORDS.codeRanOut,
  answered: NOT_ASKABLE.answered,
  too_many_computers: COMPUTER_WORDS.tooManyComputers,
  limited: COMPUTER_WORDS.tooManyYes,
} as const;

async function answer(event: Parameters<Actions[string]>[0], yes: boolean) {
  const { userId } = signedInOnly(event.locals.caller, event.url);
  const code = (await event.request.formData()).get("code");
  const result = await answerSignIn(authServices().computerDeps, {
    code: typeof code === "string" ? code : "",
    userId,
    yes,
  });
  if (result === "yes" || result === "no") return { answered: result };
  return fail(400, { problem: REFUSED[result], tooMany: result === "too_many_computers" });
}

export const actions: Actions = {
  yes: (event) => answer(event, true),
  no: (event) => answer(event, false),
};
