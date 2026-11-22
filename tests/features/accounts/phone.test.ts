import { describe, expect, it } from "vitest";
import {
  countryOf,
  hashNumber,
  isMadeUpNumber,
  OPEN_COUNTRIES,
  shownAs,
  toE164,
} from "../../../src/features/accounts/phone.ts";

describe("toE164", () => {
  it.each([
    ["+1", "312 555 0142", "+13125550142"],
    ["+1", "(312) 555-0142", "+13125550142"],
    ["+1", "+1 312 555 0142", "+13125550142"],
    ["+44", "07700 900123", "+447700900123"],
    ["+1", "+44 7700 900123", "+447700900123"],
    ["+49", "0151 23456789", "+4915123456789"],
    ["+1", "1 312 555 0142", "+13125550142"],
    ["+1", "1-312-555-0142", "+13125550142"],
    ["+1", "0044 7700 900123", "+447700900123"],
    ["+1", "011 44 7700 900123", "+447700900123"],
    ["+1", "312.555.0142", "+13125550142"],
    // "011" is the North American international prefix only: in the UK it starts Leeds, Bristol and Reading.
    ["+44", "0113 496 0000", "+441134960000"],
    ["+44", "0118 496 0000", "+441184960000"],
  ])("writes %s %s as %s", (code, typed, want) => {
    expect(toE164(code, typed)).toBe(want);
  });

  it.each([
    ["+1", ""],
    ["+1", "12345"],
    ["+1", "abc"],
    ["+1", "312 555 01x2"],
    ["+1", "1234567890123456"],
    // North America is ten digits after the 1: a number typed without its area code is not one.
    ["+1", "555 0142"],
    ["+1", "+1 555 0142"],
    ["+1", "312 555 014"],
    ["+1", "312 555 01422"],
  ])("refuses %s %s", (code, typed) => {
    expect(toE164(code, typed)).toBeNull();
  });
});

describe("hashNumber", () => {
  it("hashes the same number the same way, and shows none of it", () => {
    const first = hashNumber("+13125551234", "secret");
    expect(hashNumber("+13125551234", "secret")).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("3125551234");
  });

  it("differs by number and by secret", () => {
    expect(hashNumber("+13125551234", "secret")).not.toBe(hashNumber("+13125551235", "secret"));
    expect(hashNumber("+13125551234", "secret")).not.toBe(hashNumber("+13125551234", "other"));
  });
});

describe("isMadeUpNumber", () => {
  it("knows a made-up number", () => {
    expect(isMadeUpNumber("+12125550123")).toBe(true);
    expect(isMadeUpNumber("+12125551234")).toBe(false);
  });
});

describe("the open countries", () => {
  it("are the United States and Canada, each with its dialing code", () => {
    expect(OPEN_COUNTRIES.map((country) => [country.code, country.dialing])).toEqual([
      ["US", "+1"],
      ["CA", "+1"],
    ]);
  });

  it("are found by their two letters, and nothing else is", () => {
    expect(countryOf("CA")?.name).toBe("Canada");
    expect(countryOf("GB")).toBeNull();
    expect(countryOf("")).toBeNull();
    expect(countryOf("us")).toBeNull();
  });
});

describe("shownAs", () => {
  it("spaces a North American number the way it is read aloud", () => {
    expect(shownAs("+13125550142")).toBe("+1 312 555 0142");
  });

  it("leaves any other number as one run of digits", () => {
    expect(shownAs("+447700900123")).toBe("+447700900123");
  });
});
