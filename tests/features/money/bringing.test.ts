import { describe, expect, it } from "vitest";
import { bringerOf } from "../../../src/features/money/bringing.ts";
import type { Period } from "../../../src/features/money/period.ts";

const first = {
  userId: "member",
  startedAtMs: Date.parse("2026-11-30T18:00:00Z"),
  broughtByUserId: "maker-a",
};

describe("bringerOf", () => {
  it("pays the maker who brought the first join, for that month and the eleven after", () => {
    expect(bringerOf([first], "2026-11" as Period)).toBe("maker-a");
    expect(bringerOf([first], "2027-10" as Period)).toBe("maker-a");
    expect(bringerOf([first], "2027-11" as Period)).toBeNull();
    expect(bringerOf([first], "2026-10" as Period)).toBeNull();
  });

  it("counts only the first join, however the later ones arrived", () => {
    // Review Focus 7
    const later = {
      userId: "member",
      startedAtMs: Date.parse("2027-02-01T18:00:00Z"),
      broughtByUserId: "maker-b",
    };
    expect(bringerOf([later, first], "2027-03" as Period)).toBe("maker-a");
    expect(bringerOf([{ ...first, broughtByUserId: null }, later], "2027-03" as Period)).toBeNull();
  });

  it("gives no bonus for bringing yourself", () => {
    // Review Focus 7
    expect(bringerOf([{ ...first, broughtByUserId: "member" }], "2026-11" as Period)).toBeNull();
  });

  it("uses the Chicago month of the join", () => {
    // 05:00 UTC on 1 December is 23:00 on 30 November in Chicago: November, so the twelve months end with 2027-10.
    const lateNovember = { ...first, startedAtMs: Date.parse("2026-12-01T05:00:00Z") };
    expect(bringerOf([lateNovember], "2026-11" as Period)).toBe("maker-a");
    expect(bringerOf([lateNovember], "2027-10" as Period)).toBe("maker-a");
    expect(bringerOf([lateNovember], "2027-11" as Period)).toBeNull();
    // 06:00 UTC is already December in Chicago: the twelve months run to 2027-11.
    const earlyDecember = { ...first, startedAtMs: Date.parse("2026-12-01T06:00:00Z") };
    expect(bringerOf([earlyDecember], "2026-11" as Period)).toBeNull();
    expect(bringerOf([earlyDecember], "2027-11" as Period)).toBe("maker-a");
  });

  it("takes the first join in the order given when two start at the same instant", () => {
    const twin = { ...first, broughtByUserId: "maker-b" };
    expect(bringerOf([first, twin], "2026-11" as Period)).toBe("maker-a");
    expect(bringerOf([twin, first], "2026-11" as Period)).toBe("maker-b");
  });

  it("has no bringer with no joins", () => {
    expect(bringerOf([], "2026-11" as Period)).toBeNull();
  });
});
