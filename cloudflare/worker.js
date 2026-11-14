// What Cloudflare runs. The SvelteKit adapter builds the site's `fetch` and no daily job, so this wraps the built
// site and adds one. It holds no logic: once a day it knocks on the site's own job address, inside this same
// Worker, and throws unless the answer is 200, so a failed run shows as failed in Cloudflare.
import site from "../.svelte-kit/cloudflare/_worker.js";

export default {
  fetch: site.fetch,
  async scheduled(_controller, env, ctx) {
    const request = new Request(new URL("/jobs/purge-accounts", env.BETTER_AUTH_URL), {
      method: "POST",
      // SvelteKit refuses a POST with no content type and no matching Origin as a forged form post, so the knock
      // says what it sends (nothing; the job takes no body).
      headers: { authorization: `Bearer ${env.JOBS_SECRET}`, "content-type": "application/json" },
    });
    const response = await site.fetch(request, env, ctx);
    if (response.status !== 200) throw new Error(`purge-accounts answered ${response.status}`);
  },
};
