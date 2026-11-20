// Which job addresses each cron trigger knocks on. A cron that is not here throws, so a trigger added to
// wrangler.jsonc without a line here shows as a failed run instead of doing nothing.
const DAILY = "17 9 * * *";
const HOURLY = "0 * * * *";

/** @type {Readonly<Record<string, readonly string[]>>} */
const JOBS = {
  [DAILY]: ["/jobs/purge-accounts", "/jobs/money"],
  // Decision day is noon in New York, so the hour it starts is the hour it goes out.
  [HOURLY]: ["/jobs/decision-day"],
};

/**
 * The job addresses a cron knocks on, or a throw for a cron nobody knows.
 * @param {string | undefined} cron
 * @returns {readonly string[]}
 */
export function jobsFor(cron) {
  const jobs = cron === undefined ? undefined : JOBS[cron];
  if (jobs === undefined) throw new Error(`No job is set for the cron "${String(cron)}".`);
  return jobs;
}
