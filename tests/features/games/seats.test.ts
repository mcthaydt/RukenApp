import { describe, expect, it } from "vitest";
import schedule from "../../../src/features/games/library/decision-days.json" with { type: "json" };
import {
  addMonths,
  dayWords,
  nextDecisionDay,
  seatsOn,
  type DecisionSchedule,
} from "../../../src/features/games/seats.ts";

// Decision day is every Friday at noon New York time; the seats start at 10 a week and grow by half again every
// 3 months, to 500 at most. The schedule is passed in, so a test names its own first day and the shipped file stays off.

const FIRST = "2026-11-27"; // a Friday
const on = (firstDay: string | null, extra: Partial<DecisionSchedule> = {}): DecisionSchedule => ({
  ...(schedule as DecisionSchedule),
  firstDay,
  ...extra,
});

describe("the shipped schedule", () => {
  it("is off until the first decision day is written", () => {
    expect(schedule.firstDay).toBeNull();
  });

  it("is Friday, noon, New York time, 10 seats growing to 500", () => {
    expect(schedule).toMatchObject({
      weekday: 5,
      hour: 12,
      zone: "America/New_York",
      startSeats: 10,
      maxSeats: 500,
      growsEveryMonths: 3,
    });
  });

  it("names no decision day while it is off", () => {
    expect(nextDecisionDay(new Date("2026-11-20T00:00:00Z"))).toBeNull();
    expect(seatsOn("2026-11-27")).toBe(0);
  });
});

describe("the next decision day", () => {
  const s = on(FIRST);

  it("goes out at noon that day for a decision at 11:59 on a Friday", () => {
    // 11:59:59 in New York in November is 16:59:59 UTC (EST).
    expect(nextDecisionDay(new Date("2026-11-27T16:59:59Z"), s)).toEqual({
      day: "2026-11-27",
      at: new Date("2026-11-27T17:00:00Z"),
      seats: 10,
    });
  });

  it("goes out the next Friday for a decision at 12:00 exactly", () => {
    expect(nextDecisionDay(new Date("2026-11-27T17:00:00Z"), s)).toMatchObject({
      day: "2026-12-04",
      at: new Date("2026-12-04T17:00:00Z"),
    });
  });

  it("goes out the next Friday for a decision on a Saturday", () => {
    expect(nextDecisionDay(new Date("2026-11-28T10:00:00Z"), s)?.day).toBe("2026-12-04");
  });

  it("reads the day in New York, not UTC", () => {
    // 01:00 UTC on Saturday the 28th is 20:00 on Friday the 27th in New York: after that day's noon.
    expect(nextDecisionDay(new Date("2026-11-28T01:00:00Z"), s)?.day).toBe("2026-12-04");
    // 03:00 UTC on Friday the 27th is 22:00 on Thursday the 26th in New York: before it.
    expect(nextDecisionDay(new Date("2026-11-27T03:00:00Z"), s)?.day).toBe("2026-11-27");
  });

  it("starts at the first decision day for a decision made before it", () => {
    expect(nextDecisionDay(new Date("2026-11-01T00:00:00Z"), s)?.day).toBe(FIRST);
  });

  it("keeps noon local time across both daylight saving changes", () => {
    // The clocks go forward on Sunday 14 March 2027: Friday 12 March is EST (17:00 UTC), Friday 19 March EDT (16:00 UTC).
    expect(nextDecisionDay(new Date("2027-03-12T17:00:00Z"), s)).toMatchObject({
      day: "2027-03-19",
      at: new Date("2027-03-19T16:00:00Z"),
    });
    // They go back on Sunday 7 November 2027: Friday 5 November is EDT, Friday 12 November EST.
    expect(nextDecisionDay(new Date("2027-11-05T15:59:59Z"), s)?.at).toEqual(
      new Date("2027-11-05T16:00:00Z"),
    );
    expect(nextDecisionDay(new Date("2027-11-05T16:00:00Z"), s)).toMatchObject({
      day: "2027-11-12",
      at: new Date("2027-11-12T17:00:00Z"),
    });
  });

  it("carries the seats of the day it names", () => {
    expect(nextDecisionDay(new Date("2027-03-01T00:00:00Z"), s)).toMatchObject({
      day: "2027-03-05",
      seats: 15,
    });
  });

  it("names no day for a schedule that is off", () => {
    expect(nextDecisionDay(new Date("2026-11-20T00:00:00Z"), on(null))).toBeNull();
  });
});

describe("the seats of a day", () => {
  it("are 10 on the first decision day and until the first step", () => {
    const s = on(FIRST);
    expect(seatsOn(FIRST, s)).toBe(10);
    expect(seatsOn("2027-02-26", s)).toBe(10); // the Friday before 27 February + the step
  });

  it("grow by half again on the first decision day on or after each 3 months", () => {
    const s = on(FIRST);
    // 27 Nov + 3 months is Saturday 27 Feb 2027, so the first step starts on Friday 5 March.
    expect(seatsOn("2027-03-05", s)).toBe(15);
    // + 6 months is Thursday 27 May, so the second step starts on Friday 28 May.
    expect(seatsOn("2027-05-21", s)).toBe(15);
    expect(seatsOn("2027-05-28", s)).toBe(23);
  });

  it("clamp a date past the end of its month", () => {
    // First day Friday 31 July 2026. Step 3 is 31 Apr, which is 30 Apr 2027, a Friday: it starts that day,
    // not on 7 May.
    const s = on("2026-07-31");
    expect(seatsOn("2027-04-23", s)).toBe(23);
    expect(seatsOn("2027-04-30", s)).toBe(34);
  });

  it("round half up once, never a rounded number again", () => {
    const seen = new Set<number>();
    const s = on(FIRST);
    for (let week = 0; week < 52 * 4; week += 1) {
      const day = addDays(FIRST, week * 7);
      seen.add(seatsOn(day, s));
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([10, 15, 23, 34, 51, 76, 114, 171, 256, 384, 500]);
  });

  it("never go down, and never pass 500", () => {
    const s = on(FIRST);
    let last = 0;
    for (let week = 0; week < 52 * 8; week += 1) {
      const seats = seatsOn(addDays(FIRST, week * 7), s);
      expect(seats).toBeGreaterThanOrEqual(last);
      expect(seats).toBeLessThanOrEqual(500);
      last = seats;
    }
    expect(last).toBe(500);
  });

  it("are the same on the 10th step as on the 11th and every one after", () => {
    const s = on(FIRST);
    expect(seatsOn(addDays(FIRST, 7 * 52 * 20), s)).toBe(500);
  });

  it("stop at the most, whatever the start", () => {
    const s = on(FIRST, { startSeats: 400 });
    expect(seatsOn(FIRST, s)).toBe(400);
    expect(seatsOn("2027-03-05", s)).toBe(500);
  });

  it("are 0 for a day before the first decision day, or while off", () => {
    expect(seatsOn("2026-11-20", on(FIRST))).toBe(0);
    expect(seatsOn(FIRST, on(null))).toBe(0);
  });
});

describe("adding months", () => {
  it("keeps the day of the month when it exists", () => {
    expect(addMonths("2026-11-27", 3)).toBe("2027-02-27");
    expect(addMonths("2026-11-27", 12)).toBe("2027-11-27");
  });

  it("clamps to the last day of a shorter month, in a leap year too", () => {
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2027-11-30", 3)).toBe("2028-02-29");
    expect(addMonths("2026-08-31", 3)).toBe("2026-11-30");
  });
});

describe("a day in words", () => {
  it("says the weekday, the day and the month", () => {
    expect(dayWords("2026-11-27")).toBe("Friday 27 November");
    expect(dayWords("2027-03-05")).toBe("Friday 5 March");
  });
});

function addDays(day: string, days: number): string {
  const [year = 0, month = 0, date = 0] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}
