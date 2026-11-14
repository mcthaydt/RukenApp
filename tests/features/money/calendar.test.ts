import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  addDays,
  dayOfWeek,
  isBusinessDay,
  isUsFederalHoliday,
  nextBusinessDay,
  parseDate,
  payoutDate,
  closeDate,
  finalDate,
  questionWindowEnds,
  answerBy,
  startOfDayMs,
} from "../../../src/features/money/calendar.ts";
import { parsePeriod, periodOf, type Period } from "../../../src/features/money/period.ts";

describe("dates", () => {
  it("accepts only real YYYY-MM-DD days", () => {
    expect(parseDate("2027-05-15")).toBe("2027-05-15");
    expect(parseDate("2028-02-29")).toBe("2028-02-29");
    expect(() => parseDate("2027-02-29")).toThrow(RangeError);
    expect(() => parseDate("2027-13-01")).toThrow(RangeError);
    expect(() => parseDate("2027-5-15")).toThrow(RangeError);
    expect(() => parseDate("2027-05-15T00:00:00Z")).toThrow(RangeError);
  });

  it("knows the day of the week (Sunday is 0)", () => {
    expect(dayOfWeek(parseDate("2027-05-15"))).toBe(6); // a Saturday
    expect(dayOfWeek(parseDate("2026-11-30"))).toBe(1); // a Monday
    expect(dayOfWeek(parseDate("2026-01-01"))).toBe(4); // a Thursday
  });

  it("adds days across month and year ends", () => {
    expect(addDays(parseDate("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDays(parseDate("2027-03-01"), -1)).toBe("2027-02-28");
    expect(addDays(parseDate("2028-02-28"), 1)).toBe("2028-02-29");
    expect(addDays(parseDate("2026-11-10"), 90)).toBe("2027-02-08");
  });
});

describe("US federal holidays, observed dates (pinned for 2026 to 2028 against dates written out by hand)", () => {
  // Each row is one year's observed holidays in order. A holiday on a Saturday is observed on the
  // Friday before and one on a Sunday on the Monday after.
  const observed: Record<number, string[]> = {
    2026: [
      "2026-01-01", // New Year's Day, Thursday
      "2026-01-19", // Martin Luther King Jr. Day, third Monday of January
      "2026-02-16", // Washington's Birthday, third Monday of February
      "2026-05-25", // Memorial Day, last Monday of May
      "2026-06-19", // June 19, a Friday
      "2026-07-03", // Independence Day is Saturday July 4, observed Friday
      "2026-09-07", // Labor Day, first Monday of September
      "2026-10-12", // Columbus Day, second Monday of October
      "2026-11-11", // Veterans Day, Wednesday
      "2026-11-26", // Thanksgiving, fourth Thursday of November
      "2026-12-25", // Christmas, Friday
    ],
    2027: [
      "2027-01-01",
      "2027-01-18",
      "2027-02-15",
      "2027-05-31",
      "2027-06-18", // June 19 is a Saturday, observed Friday
      "2027-07-05", // July 4 is a Sunday, observed Monday
      "2027-09-06",
      "2027-10-11",
      "2027-11-11",
      "2027-11-25",
      "2027-12-24", // Christmas is a Saturday, observed Friday
      "2027-12-31", // New Year's Day 2028 is a Saturday, observed Friday of the year before
    ],
    2028: [
      "2028-01-17",
      "2028-02-21",
      "2028-05-29",
      "2028-06-19",
      "2028-07-04",
      "2028-09-04",
      "2028-10-09",
      "2028-11-10", // Veterans Day is a Saturday, observed Friday
      "2028-11-23",
      "2028-12-25",
    ],
  };

  it.each(Object.entries(observed))("lists exactly the %s holidays", (year, dates) => {
    const holidays: string[] = [];
    for (let day = parseDate(`${year}-01-01`); day <= `${year}-12-31`; day = addDays(day, 1)) {
      if (isUsFederalHoliday(day)) holidays.push(day);
    }
    // 2027-12-31 belongs to 2027's list above and to 2028's New Year's Day; nothing else crosses years.
    expect(holidays).toEqual(dates);
  });

  it("does not treat the Saturday or Sunday a holiday fell on as the holiday itself", () => {
    expect(isUsFederalHoliday(parseDate("2026-07-04"))).toBe(false); // the Saturday; Friday July 3 is observed
    expect(isUsFederalHoliday(parseDate("2027-07-04"))).toBe(false); // the Sunday; Monday July 5 is observed
  });
});

describe("business days", () => {
  it("counts Monday to Friday except holidays", () => {
    expect(isBusinessDay(parseDate("2027-05-14"))).toBe(true); // Friday
    expect(isBusinessDay(parseDate("2027-05-15"))).toBe(false); // Saturday
    expect(isBusinessDay(parseDate("2027-05-16"))).toBe(false); // Sunday
    expect(isBusinessDay(parseDate("2026-11-26"))).toBe(false); // Thanksgiving
  });

  it("moves a Saturday to the Monday (Sat May 15 2027 gives Mon May 17 2027)", () => {
    expect(nextBusinessDay(parseDate("2027-05-15"))).toBe("2027-05-17");
  });

  it("leaves a business day alone and skips a holiday that follows a weekend", () => {
    expect(nextBusinessDay(parseDate("2027-05-17"))).toBe("2027-05-17");
    // Saturday Jan 16 2027, Sunday, then Monday Jan 18 is Martin Luther King Jr. Day.
    expect(nextBusinessDay(parseDate("2027-01-16"))).toBe("2027-01-19");
  });

  it("adds business days, skipping weekends and holidays", () => {
    expect(addBusinessDays(parseDate("2026-11-20"), 1)).toBe("2026-11-23");
    // Ten business days from Friday Nov 20 2026 crosses Thanksgiving (Thu Nov 26).
    expect(addBusinessDays(parseDate("2026-11-20"), 10)).toBe("2026-12-07");
    expect(addBusinessDays(parseDate("2026-11-20"), 0)).toBe("2026-11-20");
  });

  it("adds business days starting from a weekend", () => {
    expect(addBusinessDays(parseDate("2027-05-15"), 1)).toBe("2027-05-17");
  });

  it("refuses a negative count", () => {
    expect(() => addBusinessDays(parseDate("2026-11-20"), -1)).toThrow(RangeError);
  });

  // Every 11th day of four years, against a spread of counts: the same coverage a property test gives, but fixed.
  const sampledDays = Array.from({ length: 133 }, (_, i) => addDays(parseDate("2026-01-01"), i * 11));
  const counts = [0, 1, 2, 5, 10, 25, 40];

  it("always lands on a business day, never earlier than the day it started from", () => {
    for (const from of sampledDays) {
      for (const count of counts) {
        const result = addBusinessDays(from, count);
        expect(result >= from).toBe(true);
        if (count > 0) expect(isBusinessDay(result)).toBe(true);
      }
    }
  });

  it("is monotone: more business days never land earlier", () => {
    for (const from of sampledDays) {
      for (const count of counts) {
        expect(addBusinessDays(from, count + 1) > addBusinessDays(from, count)).toBe(true);
      }
    }
  });
});

describe("a month's calendar", () => {
  const april2027 = parsePeriod("2027-04");

  it("closes on the 8th, makes final on the 10th and pays on the 15th of the next month", () => {
    expect(closeDate("2026-11" as Period)).toBe("2026-12-08");
    expect(finalDate("2026-11" as Period)).toBe("2026-12-10");
    expect(payoutDate("2026-11" as Period)).toBe("2026-12-15");
    expect(closeDate(april2027)).toBe("2027-05-08");
    expect(finalDate(april2027)).toBe("2027-05-10");
  });

  it("pays on the next business day when the 15th is not one", () => {
    expect(payoutDate("2027-04" as Period)).toBe("2027-05-17"); // 15 May 2027 is a Saturday
    expect(payoutDate("2027-01" as Period)).toBe("2027-02-16"); // 15 February 2027 is Washington's Birthday
  });

  it("pays on the 15th itself when it is a business day (Dec 15 2026 is a Tuesday)", () => {
    expect(payoutDate(parsePeriod("2026-11"))).toBe("2026-12-15");
  });

  it("rolls over the year end", () => {
    expect(closeDate(parsePeriod("2026-12"))).toBe("2027-01-08");
    expect(finalDate(parsePeriod("2026-12"))).toBe("2027-01-10");
    expect(payoutDate(parsePeriod("2026-12"))).toBe("2027-01-15");
  });
});

describe("questions about a statement line", () => {
  it("open for 90 days after the statement was made final", () => {
    expect(questionWindowEnds(parseDate("2026-12-10"))).toBe("2027-03-10");
  });

  it("are answered within 10 business days of being asked", () => {
    // Monday Dec 14 2026: the ten days end on Tuesday Dec 29, skipping Friday Dec 25.
    expect(answerBy(parseDate("2026-12-14"))).toBe("2026-12-29");
  });

  it("count from the next business day when asked on a weekend", () => {
    // Saturday May 15 2027: the ten days run Monday May 17 to Friday May 28.
    expect(answerBy(parseDate("2027-05-15"))).toBe("2027-05-28");
  });
});

describe("a Chicago day", () => {
  it("starts at its own midnight, in winter and in summer", () => {
    expect(startOfDayMs("2026-12-10")).toBe(Date.parse("2026-12-10T06:00:00Z"));
    expect(startOfDayMs("2027-07-10")).toBe(Date.parse("2027-07-10T05:00:00Z"));
  });

  it("is 23 hours long when the clocks go forward and 25 when they go back", () => {
    const hours = (day: string) => (startOfDayMs(addDays(day, 1)) - startOfDayMs(day)) / 3_600_000;
    expect(hours("2027-03-14")).toBe(23);
    expect(hours("2027-11-07")).toBe(25);
    expect(hours("2026-12-10")).toBe(24);
  });

  it("agrees with the month an instant falls in", () => {
    expect(periodOf(startOfDayMs("2026-12-01"))).toBe("2026-12");
    expect(periodOf(startOfDayMs("2026-12-01") - 1)).toBe("2026-11");
  });
});
