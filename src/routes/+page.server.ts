import type { PageServerLoad } from "./$types";

// Only the placeholder home page reads this: whether to offer "Sign in". The hook has already said who is
// asking, so no lookup happens here.
export const load: PageServerLoad = ({ locals }) => ({ signedIn: locals.caller.kind === "user" });
