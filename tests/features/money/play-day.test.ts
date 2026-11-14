import { describe, expect, it } from "vitest";
import { countedMs } from "../../../src/features/play/play.ts";
import { countedIntervals, playSecondsOnDay } from "../../../src/features/money/play-day.ts";

const at = (text: string) => Date.parse(text);
/** `count` attentive beats, 15 seconds apart, the first 15 seconds after `start`. */
const beats = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ atMs: start + 15_000 * (i + 1), attentive: true }));

describe("countedIntervals", () => {
  it("counts what slice 2 counts, as stretches", () => {
    const session = {
      startedAtMs: 0,
      beats: [
        { atMs: 15_000, attentive: true },
        { atMs: 30_000, attentive: false },
        { atMs: 600_000, attentive: true },
      ],
    };
    expect(countedIntervals(session)).toEqual([
      { fromMs: 0, toMs: 15_000 },
      { fromMs: 555_000, toMs: 600_000 },
    ]);
    expect(countedIntervals(session).reduce((sum, part) => sum + part.toMs - part.fromMs, 0)).toBe(
      countedMs(0, session.beats),
    );
  });

  it("reads the beats in time order, whatever order they arrive in", () => {
    const session = {
      startedAtMs: 0,
      beats: [
        { atMs: 30_000, attentive: true },
        { atMs: 15_000, attentive: true },
      ],
    };
    expect(countedIntervals(session)).toEqual([
      { fromMs: 0, toMs: 15_000 },
      { fromMs: 15_000, toMs: 30_000 },
    ]);
  });

  it("counts nothing for a session with no beats", () => {
    expect(countedIntervals({ startedAtMs: 0, beats: [] })).toEqual([]);
  });

  it("always adds up to what slice 2 counts, for a spread of beat patterns", () => {
    // A fixed sweep, in place of random cases, so a failure replays exactly.
    for (const gap of [1_000, 15_000, 44_000, 45_000, 46_000, 120_000]) {
      for (const lookAway of [0, 2, 3]) {
        const session = {
          startedAtMs: 5_000,
          beats: Array.from({ length: 30 }, (_, i) => ({
            atMs: 5_000 + gap * (i + 1),
            attentive: lookAway === 0 || i % (lookAway + 1) !== 0,
          })),
        };
        const stretches = countedIntervals(session);
        expect(stretches.reduce((sum, part) => sum + part.toMs - part.fromMs, 0)).toBe(
          countedMs(session.startedAtMs, session.beats),
        );
      }
    }
  });
});

describe("playSecondsOnDay", () => {
  it("counts a moment once when two tabs are open", () => {
    // Review Focus 6
    const start = at("2026-12-05T18:00:00Z");
    const one = { startedAtMs: start, beats: beats(start, 40) }; // ten minutes
    const two = { startedAtMs: start + 300_000, beats: beats(start + 300_000, 40) }; // ten minutes, starting five in
    expect(playSecondsOnDay([one, two], "2026-12-05")).toBe(900);
  });

  it("cuts a session at Chicago midnight", () => {
    const start = at("2026-12-06T05:55:00Z"); // 23:55 on the 5th
    const session = { startedAtMs: start, beats: beats(start, 40) };
    expect(playSecondsOnDay([session], "2026-12-05")).toBe(300);
    expect(playSecondsOnDay([session], "2026-12-06")).toBe(300);
  });

  it("stops at three hours a day", () => {
    const start = at("2026-12-05T18:00:00Z"); // 12:00 in Chicago
    const session = { startedAtMs: start, beats: beats(start, 800) }; // 3 hours 20 minutes
    expect(playSecondsOnDay([session], "2026-12-05")).toBe(10_800);
  });

  it("treats the 23-hour and the 25-hour day as whole days", () => {
    // Review Focus 6. On 14 March 2027 the clocks go forward at 02:00: 01:30 local is 07:30 UTC and 03:30 local is
    // 08:30 UTC, so a session "from 01:30 to 03:30" is one real hour.
    const springStart = at("2027-03-14T07:30:00Z");
    const spring = { startedAtMs: springStart, beats: beats(springStart, 240) };
    expect(playSecondsOnDay([spring], "2027-03-14")).toBe(3_600);

    // On 7 November 2027 the clocks go back at 02:00: the hour 01:00 to 02:00 happens twice. Two tabs across it,
    // 06:30 to 07:30 UTC and 07:00 to 08:00 UTC, cover 06:30 to 08:00 UTC: 5,400 real seconds, each counted once.
    const fallStart = at("2027-11-07T06:30:00Z");
    const first = { startedAtMs: fallStart, beats: beats(fallStart, 240) };
    const second = { startedAtMs: fallStart + 1_800_000, beats: beats(fallStart + 1_800_000, 240) };
    expect(playSecondsOnDay([first, second], "2027-11-07")).toBe(5_400);
  });

  it("counts play after the clocks went back on the day it happened", () => {
    // 08:00 UTC on 7 November 2027 is 02:00 local, after the clocks went back; play there is on the 7th.
    const start = at("2027-11-07T08:00:00Z");
    const session = { startedAtMs: start, beats: beats(start, 40) };
    expect(playSecondsOnDay([session], "2027-11-07")).toBe(600);
    expect(playSecondsOnDay([session], "2027-11-08")).toBe(0);
  });

  it("counts nothing with no sessions, and nothing for a day the sessions do not touch", () => {
    expect(playSecondsOnDay([], "2026-12-05")).toBe(0);
    const start = at("2026-12-05T18:00:00Z");
    expect(playSecondsOnDay([{ startedAtMs: start, beats: beats(start, 40) }], "2026-12-07")).toBe(0);
  });

  it("rounds down to whole seconds", () => {
    const start = at("2026-12-05T18:00:00Z");
    expect(
      playSecondsOnDay(
        [{ startedAtMs: start, beats: [{ atMs: start + 1_500, attentive: true }] }],
        "2026-12-05",
      ),
    ).toBe(1);
  });
});
