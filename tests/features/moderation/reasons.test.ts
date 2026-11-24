import { describe, expect, it } from "vitest";
import {
  NOTE_MAX,
  readReport,
  REASON_WORDS,
  REPORT_REASONS,
} from "../../../src/features/moderation/reasons.ts";

// What a report sends is never believed (report-a-game spec): only a known reason, and a note of 500 characters at most.

describe("readReport", () => {
  it.each(REPORT_REASONS)("reads the reason %s, with words for it", (reason) => {
    expect(readReport({ reason })).toEqual({ reason, note: null });
    expect(REASON_WORDS[reason]).not.toBe("");
  });

  it("puts the owner's three rules first", () => {
    expect(REPORT_REASONS.slice(0, 3)).toEqual(["sexual", "gambling", "ads"]);
  });

  it("shows the nine reasons in order, in plain words", () => {
    expect(REPORT_REASONS.map((reason) => REASON_WORDS[reason])).toEqual([
      "Sexual content",
      "Gambling",
      "Ads",
      "Graphic violence",
      "Hate or bullying",
      "A scam or steals your info",
      "Copied from someone else",
      "It doesn't work",
      "Something else",
    ]);
  });

  it("keeps the note, trimmed, and an empty one as none", () => {
    expect(readReport({ reason: "ads", note: "  Ads every level. " })).toEqual({
      reason: "ads",
      note: "Ads every level.",
    });
    expect(readReport({ reason: "ads", note: "   " })).toEqual({ reason: "ads", note: null });
  });

  it.each([null, "text", [], {}, { reason: "boring" }, { reason: 3 }, { note: "x" }])(
    "asks for a reason when there is none it knows: %j",
    (body) => {
      expect(readReport(body)).toEqual({ problem: "Pick what's wrong." });
    },
  );

  it("refuses a note that is not text, or longer than the most it keeps", () => {
    expect(readReport({ reason: "ads", note: 7 })).toHaveProperty("problem");
    expect(readReport({ reason: "ads", note: "x".repeat(NOTE_MAX) })).toHaveProperty("reason");
    expect(readReport({ reason: "ads", note: "x".repeat(NOTE_MAX + 1) })).toHaveProperty("problem");
  });
});
