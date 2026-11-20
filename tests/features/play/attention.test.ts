import { describe, expect, it } from "vitest";
import { createAttention } from "../../../src/features/play/attention.ts";

const yes = { tabShowing: true, frameOnScreen: true, frameFocused: true };

describe("createAttention", () => {
  it("says no before it has looked at all", () => {
    expect(createAttention().report()).toBe(false);
  });
  it("says yes when every look was attentive", () => {
    const a = createAttention();
    a.look(yes);
    a.look(yes);
    expect(a.report()).toBe(true);
  });
  it.each(["tabShowing", "frameOnScreen", "frameFocused"] as const)(
    "one look without %s breaks the stretch",
    (key) => {
      const a = createAttention();
      a.look(yes);
      a.look({ ...yes, [key]: false });
      a.look(yes);
      expect(a.report()).toBe(false);
    },
  );
  it("keeps a broken stretch until the server has taken a beat", () => {
    const a = createAttention();
    a.look({ ...yes, frameFocused: false });
    a.report();
    a.look(yes);
    expect(a.report()).toBe(false);
    a.taken();
    a.look(yes);
    expect(a.report()).toBe(true);
  });
});
