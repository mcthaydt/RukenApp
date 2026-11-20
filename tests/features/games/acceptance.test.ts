import { describe, expect, it } from "vitest";
import { acceptancePercent, acceptanceWords } from "../../../src/features/games/acceptance.ts";

// The label at the top of Your games: a plain line until enough games are decided, then the measured share that got in.

describe("acceptanceWords", () => {
  it("says a person checks every game while fewer than 20 games are decided", () => {
    expect(acceptanceWords({ decided: 0, accepted: 0 })).toBe("A person checks every game.");
    expect(acceptanceWords({ decided: 19, accepted: 1 })).toBe("A person checks every game.");
  });

  it("says the measured share from 20 games on, rounded to a whole percent", () => {
    expect(acceptanceWords({ decided: 20, accepted: 3 })).toBe("15% of games get in.");
    expect(acceptanceWords({ decided: 30, accepted: 4 })).toBe("13% of games get in.");
  });

  it("never says 0% when a game got in", () => {
    expect(acceptanceWords({ decided: 400, accepted: 1 })).toBe("1% of games get in.");
  });

  it("says 0% only when none got in", () => {
    expect(acceptanceWords({ decided: 25, accepted: 0 })).toBe("0% of games get in.");
  });
});

describe("acceptancePercent", () => {
  it("is null below 20 decided games, so nothing is said from a handful", () => {
    expect(acceptancePercent({ decided: 19, accepted: 19 })).toBeNull();
  });

  it("is the whole percent from 20 on", () => {
    expect(acceptancePercent({ decided: 40, accepted: 10 })).toBe(25);
  });
});
