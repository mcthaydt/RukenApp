import type { PageServerLoad } from "./$types";

// The Followed tab (src/features/feed/Followed.svelte): whether the person is signed in decides what it says.
export const load: PageServerLoad = ({ locals }) => ({ signedIn: locals.caller.kind === "user" });
