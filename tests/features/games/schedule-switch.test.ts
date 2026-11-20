import { describe, expect, it } from "vitest";
import { decisionSchedule } from "../../../src/features/games/seats.ts";
import { scheduleFor } from "../../../src/features/games/services.ts";
import { isThisMachine } from "../../../src/lib/this-machine.ts";

// DECISION_DAYS_TEST_OFF turns decision day off for the journeys only: it works on this machine over plain http, and a
// site anywhere else that has it set fails loudly instead of quietly skipping decision day.

describe("the test switch that turns decision day off", () => {
  it("leaves the schedule alone when it is not set", () => {
    expect(scheduleFor({})).toBe(decisionSchedule);
    expect(scheduleFor({ DECISION_DAYS_TEST_OFF: "" })).toBe(decisionSchedule);
  });

  it("turns the schedule off on this machine", () => {
    expect(
      scheduleFor({ DECISION_DAYS_TEST_OFF: "on", BETTER_AUTH_URL: "http://localhost:4173" }).firstDay,
    ).toBeNull();
    expect(
      scheduleFor({ DECISION_DAYS_TEST_OFF: "on", BETTER_AUTH_URL: "http://127.0.0.1:4173" }).firstDay,
    ).toBeNull();
  });

  it.each([
    ["on", "https://localhost:4173"],
    ["on", "http://localhost.example.com"],
    ["on", "https://ruken.example"],
    ["on", undefined],
    ["yes", "http://localhost:4173"],
  ])("refuses %s on %s", (flag, address) => {
    expect(() => scheduleFor({ DECISION_DAYS_TEST_OFF: flag, BETTER_AUTH_URL: address })).toThrow(
      /for tests on this machine/,
    );
  });

  it("reads an address as this machine only when it is plain http on localhost or 127.0.0.1", () => {
    expect(isThisMachine("http://localhost:8788")).toBe(true);
    expect(isThisMachine("http://localhost.example.com")).toBe(false);
    expect(isThisMachine("not an address")).toBe(false);
  });
});
