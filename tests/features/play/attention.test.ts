import { describe, expect, it } from "vitest";
import { createAttention } from "../../../src/features/play/attention.ts";

// Whether a stretch of play counts as attentive: every look since the server last took a beat saw the tab showing, the
// frame on screen and the frame focused.
const yes = { tabShowing: true, frameOnScreen: true, frameFocused: true };

describe("createAttention", () => {
  it("says no before it has looked at all", () => {
    expect(createAttention().report()).toBe(false);
  });

  it("says yes when every look was attentive", () => {
    const attention = createAttention();
    attention.look(yes);
    attention.look(yes);
    expect(attention.report()).toBe(true);
  });

  it.each(["tabShowing", "frameOnScreen", "frameFocused"] as const)(
    "one look without %s breaks the stretch",
    (key) => {
      const attention = createAttention();
      attention.look(yes);
      attention.look({ ...yes, [key]: false });
      attention.look(yes);
      expect(attention.report()).toBe(false);
    },
  );

  it("keeps a broken stretch until the server has taken a beat", () => {
    const attention = createAttention();
    attention.look({ ...yes, frameFocused: false });
    attention.report();
    attention.look(yes);
    // The beat was lost: the next one still speaks for the whole stretch.
    expect(attention.report()).toBe(false);
    attention.taken();
    attention.look(yes);
    expect(attention.report()).toBe(true);
  });

  it("starts again empty once a beat is taken", () => {
    const attention = createAttention();
    attention.look(yes);
    attention.taken();
    expect(attention.report()).toBe(false);
  });
});
