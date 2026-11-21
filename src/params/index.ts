import { defineParams } from "@sveltejs/kit/params";
import { match as matchHandle } from "./handle.ts";
import { match } from "./question.ts";

// SvelteKit reads its route matchers from here: `[question=question]` is the word a question's address ends in. The
// matcher answers the word when it is one and nothing when it is not, so any other word is a page that does not exist. `[handle=handle]` is a maker's address.
export const params = defineParams({
  question: (param: string) => (match(param) ? param : undefined),
  handle: (param: string) => (matchHandle(param) ? param : undefined),
});
