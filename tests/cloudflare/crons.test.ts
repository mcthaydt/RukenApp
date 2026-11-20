import { describe, expect, it } from "vitest";
import { jobsFor } from "../../cloudflare/crons.js";

describe("which jobs each cron knocks on", () => {
  it("knocks on the purge and the money job once a day, as it always did", () => {
    expect(jobsFor("17 9 * * *")).toEqual(["/jobs/purge-accounts", "/jobs/money"]);
  });

  it("knocks on decision day's job and nothing else every hour", () => {
    expect(jobsFor("0 * * * *")).toEqual(["/jobs/decision-day"]);
  });

  it("throws for a cron it does not know, so a trigger added without a line here shows as a failed run", () => {
    expect(() => jobsFor("5 4 * * *")).toThrow(/No job is set/);
    expect(() => jobsFor(undefined)).toThrow(/No job is set/);
  });
});
