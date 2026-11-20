// What Cloudflare runs. The SvelteKit adapter builds the site's `fetch` and no scheduled jobs, so this wraps the built
// site and adds them. It holds no logic: when a cron fires it knocks on that cron's job addresses (cloudflare/crons.js),
// inside this same Worker, and throws unless every answer is 200 and the money job reports no problem, so a failed
// run shows as failed in Cloudflare. The daily purge runs first and is not skipped when the money job fails.
import site from "../.svelte-kit/cloudflare/_worker.js";
import { jobsFor } from "./crons.js";

/** One knock on a job's address with the Worker's secret, and the answer. */
function knock(path, env, ctx) {
  const request = new Request(new URL(path, env.BETTER_AUTH_URL), {
    method: "POST",
    // SvelteKit refuses a POST with no content type and no matching Origin as a forged form post, so the knock
    // says what it sends (nothing; the jobs take no body).
    headers: { authorization: `Bearer ${env.JOBS_SECRET}`, "content-type": "application/json" },
  });
  return site.fetch(request, env, ctx);
}

export default {
  fetch: site.fetch,
  async scheduled(controller, env, ctx) {
    const jobs = jobsFor(controller.cron);
    const failures = [];

    if (jobs.includes("/jobs/purge-accounts")) {
      const purge = await knock("/jobs/purge-accounts", env, ctx);
      if (purge.status !== 200) failures.push(`purge-accounts answered ${purge.status}`);
    }

    if (jobs.includes("/jobs/money")) {
      const money = await knock("/jobs/money", env, ctx);
      if (money.status !== 200) {
        failures.push(`money answered ${money.status}`);
      } else {
        // The route answers 200 whatever the steps did, so a person can read the report; a failed step is read here.
        const { problems } = await money.json();
        if (problems.length > 0) {
          failures.push(
            `the money job reported ${problems.length} problem(s): ${problems.map((p) => p.step).join(", ")}`,
          );
        }
      }
    }

    if (jobs.includes("/jobs/decision-day")) {
      const sent = await knock("/jobs/decision-day", env, ctx);
      if (sent.status !== 200) failures.push(`decision-day answered ${sent.status}`);
    }

    if (failures.length > 0) throw new Error(failures.join("; "));
  },
};
