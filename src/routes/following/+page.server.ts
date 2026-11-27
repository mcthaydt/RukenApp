import type { PageServerLoad } from "./$types";

// The Following tab (src/features/feed/Following.svelte): whether the person is signed in decides what it says.
export const load: PageServerLoad = ({ locals }) => ({ signedIn: locals.caller.kind === "user" });
