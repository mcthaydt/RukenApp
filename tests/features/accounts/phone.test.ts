import { describe, expect, it } from "vitest";
import { hashNumber, isMadeUpNumber, toE164 } from "../../../src/features/accounts/phone.ts";

describe("toE164", () => {
  // Review Focus 1: one account, however the number is typed.
  it.each([
    ["+1", "312 555 1234", "+13125551234"],
    ["+1", "(312) 555-1234", "+13125551234"],
    ["+1", "312.555.1234", "+13125551234"],
    ["+1", "+1 312 555 1234", "+13125551234"],
    ["+44", "07700 900123", "+447700900123"],
    ["+1", "+44 7700 900123", "+447700900123"],
    ["+49", "0151 23456789", "+4915123456789"],
    ["+1", "1 312 555 1234", "+13125551234"],
    ["+1", "1-312-555-1234", "+13125551234"],
    ["+1", "0044 7700 900123", "+447700900123"],
    ["+1", "011 44 7700 900123", "+447700900123"],
  ])("writes %s %s as %s", (code, typed, want) => {
    expect(toE164(code, typed)).toBe(want);
  });

  it("keeps a leading 1 outside +1 numbers", () => {
    expect(toE164("+44", "1632 960123")).toBe("+441632960123");
  });

  it.each([
    ["+1", ""],
    ["+1", "12345"],
    ["+1", "abc"],
    ["+1", "312 555 12x4"],
    ["+1", "1234567890123456"],
    ["+1", "+"],
    ["+1", "+1"],
  ])("refuses %s %s", (code, typed) => {
    expect(toE164(code, typed)).toBeNull();
  });
});

describe("hashNumber", () => {
  it("hashes the same number the same way and shows none of it", () => {
    const hash = hashNumber("+13125551234", "secret");

    expect(hashNumber("+13125551234", "secret")).toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("3125551234");
  });

  it("differs for another number and for another secret", () => {
    const hash = hashNumber("+13125551234", "secret");

    expect(hashNumber("+13125551235", "secret")).not.toBe(hash);
    expect(hashNumber("+13125551234", "other")).not.toBe(hash);
  });
});

describe("isMadeUpNumber", () => {
  it("knows a made-up number", () => {
    expect(isMadeUpNumber("+12125550123")).toBe(true);
    expect(isMadeUpNumber("+12125551234")).toBe(false);
  });
});
