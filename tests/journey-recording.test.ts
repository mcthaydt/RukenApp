import { describe, expect, it } from "vitest";
import config from "../playwright.config.ts";

// A journey that fails once and passes on its rerun leaves only its last words and a page snapshot, and the 15-second
// "press with no answer" failures (progress.md, Flaky tests) could not be told apart from those: did the browser send
// the post, and did anything come back? So a failed journey keeps a recording of its actions and its network, which
// CI uploads in the browser report. Playwright records the network only with its page snapshots (a recording made with
// them off holds an empty network file), so they stay on; the running screenshots, which cost the busy runner the
// most, stay off.
describe("what a failed journey leaves behind", () => {
  it("keeps a recording of a failed journey's actions and network, without running screenshots", () => {
    expect(config.use?.trace).toEqual({
      mode: "retain-on-failure",
      screenshots: false,
      snapshots: true,
      sources: false,
    });
  });
});
