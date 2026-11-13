import { describe, expect, it } from "vitest";
import {
  ARRIVAL_COOKIE,
  ARRIVAL_MAX_AGE_SECONDS,
  openArrival,
  sealArrival,
} from "../../../src/features/membership/arrival.ts";

const arrival = { makerUserId: "maker-1", path: "/g/a-game", atMs: 1_800_000_000_000 };

describe("the arrival cookie", () => {
  it("is named rk_arrival and lasts 400 days", () => {
    expect(ARRIVAL_COOKIE).toBe("rk_arrival");
    expect(ARRIVAL_MAX_AGE_SECONDS).toBe(400 * 24 * 60 * 60);
  });

  it("opens what it sealed", () => {
    expect(openArrival(sealArrival(arrival, "s"), "s")).toEqual(arrival);
  });

  it("ignores a value sealed with another secret", () => {
    expect(openArrival(sealArrival(arrival, "other"), "s")).toBeNull();
  });

  it("ignores a payload changed after sealing", () => {
    const mac = sealArrival(arrival, "s").split(".")[1] ?? "";
    const forged = Buffer.from(JSON.stringify({ ...arrival, makerUserId: "maker-2" })).toString("base64url");
    expect(openArrival(`${forged}.${mac}`, "s")).toBeNull();
  });

  it.each([undefined, "", "no-dot", "a.b.c", "!!.!!"])("ignores %j", (value) => {
    expect(openArrival(value, "s")).toBeNull();
  });

  it("ignores a sealed value of the wrong shape", () => {
    expect(openArrival(sealArrival({ ...arrival, path: "https://evil.example" }, "s"), "s")).toBeNull();
    expect(openArrival(sealArrival({ ...arrival, path: `/${"a".repeat(200)}` }, "s"), "s")).toBeNull();
    expect(openArrival(sealArrival({ ...arrival, makerUserId: "" }, "s"), "s")).toBeNull();
    expect(openArrival(sealArrival({ ...arrival, makerUserId: "m".repeat(65) }, "s"), "s")).toBeNull();
    expect(openArrival(sealArrival({ ...arrival, atMs: Number.NaN }, "s"), "s")).toBeNull();
    expect(openArrival(sealArrival({ ...arrival, atMs: 0 }, "s"), "s")).toBeNull();
    expect(openArrival(sealArrival({ ...arrival, atMs: 1.5 }, "s"), "s")).toBeNull();
  });
});
