import { describe, expect, it } from "vitest";
import {
  askingFor,
  CROWD,
  FEED_PUBLIC_DEFAULTS,
  readFeedPublic,
  type FeedPublic,
  type Person,
} from "../../../src/features/feed/feed-public.ts";

function read(raw: string | undefined) {
  const lines: string[] = [];
  return { settings: readFeedPublic(raw, (line) => lines.push(line)), lines };
}

describe("FEED_PUBLIC", () => {
  it("missing or empty: every setting on its safe side, quietly", () => {
    for (const raw of [undefined, ""]) {
      expect(read(raw)).toEqual({
        settings: { learned: false, teenPersonal: false, windowDays: 7 },
        lines: [],
      });
    }
    expect(FEED_PUBLIC_DEFAULTS).toEqual({ learned: false, teenPersonal: false, windowDays: 7 });
  });

  it("not JSON, or not a list of settings: every setting on its safe side, one line with no value", () => {
    for (const raw of ["{learned:true", "[true]", "true", "null", '"learned"']) {
      const { settings, lines } = read(raw);
      expect(settings).toEqual(FEED_PUBLIC_DEFAULTS);
      expect(lines).toHaveLength(1);
      expect(lines[0]).not.toContain(raw);
    }
  });

  it("whole and good: every setting read", () => {
    expect(read(JSON.stringify({ learned: true, teenPersonal: true, windowDays: 30 }))).toEqual({
      settings: { learned: true, teenPersonal: true, windowDays: 30 },
      lines: [],
    });
  });

  it("a bad or missing setting falls to its safe side alone, and the line names it and not its value", () => {
    const { settings, lines } = read(
      JSON.stringify({ learned: "yes", teenPersonal: true, windowDays: 4321 }),
    );

    expect(settings).toEqual({ learned: false, teenPersonal: true, windowDays: 7 });
    expect(lines).toEqual([
      "feed: FEED_PUBLIC learned is missing or bad; it is on its safe side.",
      "feed: FEED_PUBLIC windowDays is missing or bad; it is on its safe side.",
    ]);
    expect(lines.join(" ")).not.toContain("4321");
    expect(lines.join(" ")).not.toContain("yes");
  });

  it("windowDays must be a whole number of days from 1 to 365", () => {
    for (const bad of [0, -1, 1.5, 366, "30", null]) {
      expect(
        read(JSON.stringify({ learned: true, teenPersonal: false, windowDays: bad })).settings.windowDays,
      ).toBe(7);
    }
    for (const good of [1, 365]) {
      expect(
        read(JSON.stringify({ learned: true, teenPersonal: false, windowDays: good })).settings.windowDays,
      ).toBe(good);
    }
  });
});

describe("who the feed may learn from", () => {
  const ON: FeedPublic = { learned: true, teenPersonal: true, windowDays: 7 };
  const adult: Person = { userId: "user-1", consented: true, adult: true, parentSaidYes: false };

  it("a signed-in adult who said yes to cookies, while learned is on", () => {
    expect(askingFor(ON, adult)).toEqual({ kind: "full", id: "user-1" });
  });

  it("nobody, with FEED_PUBLIC missing or bad", () => {
    expect(askingFor(read(undefined).settings, adult)).toEqual(CROWD);
    expect(askingFor(read("nope").settings, adult)).toEqual(CROWD);
  });

  it("not a browser without a yes to cookies, a visitor, or an under-18 without a parent's yes", () => {
    expect(askingFor(ON, { ...adult, consented: false })).toEqual(CROWD);
    expect(askingFor(ON, { ...adult, userId: null })).toEqual(CROWD);
    expect(askingFor(ON, { ...adult, adult: false })).toEqual(CROWD);
  });

  it("an under-18 with a parent's yes only while teenPersonal is on", () => {
    const teen = { ...adult, adult: false, parentSaidYes: true };
    expect(askingFor(ON, teen)).toEqual({ kind: "full", id: "user-1" });
    expect(askingFor({ ...ON, teenPersonal: false }, teen)).toEqual(CROWD);
  });

  it("nobody while learned is off", () => {
    expect(askingFor({ ...ON, learned: false }, adult)).toEqual(CROWD);
  });
});
