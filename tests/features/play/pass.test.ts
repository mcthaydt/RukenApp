import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  checkPass,
  makePass,
  newPassId,
  PASS_LIFE_MS,
  PASS_MIN_LEFT_MS,
  type PassClaims,
} from "../../../src/features/play/pass.ts";

const claims: PassClaims = {
  id: "AAAAAAAAAAAAAAAAAAAAAA",
  game: "aaaaaaaaaa",
  pull: "0b0e6c2e-3f0a-4a8e-9d0a-1c2d3e4f5a6b",
  connect: ["api.example.com"],
  expiresAtMs: 1_800_000_000_000,
};

/** A pass made by hand, signed the way `makePass` signs, so a test can put in a payload `makePass` never would. */
function signed(payload: unknown, secret = "s"): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(`ruken-play-pass-v1:${body}`).digest("base64url");
  return `v1.${body}.${mac}`;
}

/** What a good pass holds, under the names it holds them by. */
const GOOD = { i: claims.id, g: claims.game, p: claims.pull, c: claims.connect, exp: 1_800_000_000 };

describe("a play pass", () => {
  it("opens what it made, until it runs out", () => {
    const pass = makePass(claims, "s");
    expect(checkPass(pass, "s", 1_799_999_999_999)).toEqual(claims);
    expect(checkPass(pass, "s", 1_800_000_000_000)).toBeNull();
  });

  // Games are untrusted: the address a game sees names no person.
  it("holds nothing but its own id, a game, a pull, its servers and a time", () => {
    const payload = JSON.parse(
      Buffer.from(makePass(claims, "s").split(".")[1] ?? "", "base64url").toString(),
    ) as object;
    expect(Object.keys(payload).sort()).toEqual(["c", "exp", "g", "i", "p"]);
  });

  it("makes the same pass from the same claims", () => {
    expect(makePass(claims, "s")).toBe(makePass({ ...claims }, "s"));
  });

  it("lasts a day, and is handed out again only while four hours are left", () => {
    expect(PASS_LIFE_MS).toBe(86_400_000);
    expect(PASS_MIN_LEFT_MS).toBe(14_400_000);
  });

  it("makes an id of 16 random bytes", () => {
    expect(newPassId(() => new Uint8Array(16))).toBe("AAAAAAAAAAAAAAAAAAAAAA");
    expect(newPassId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newPassId()).not.toBe(newPassId());
  });

  it("is one path segment", () => {
    expect(makePass(claims, "s")).toMatch(/^[A-Za-z0-9_.-]+$/);
  });

  it("keeps whole seconds", () => {
    const pass = makePass({ ...claims, expiresAtMs: 1_800_000_000_999 }, "s");
    expect(checkPass(pass, "s", 0)?.expiresAtMs).toBe(1_800_000_000_000);
  });

  it("ignores a pass made with another secret", () => {
    expect(checkPass(makePass(claims, "other"), "s", 0)).toBeNull();
  });

  it("ignores a payload changed after signing", () => {
    const real = makePass(claims, "s").split(".");
    const other = makePass({ ...claims, game: "bbbbbbbbbb" }, "s").split(".");
    expect(checkPass(`v1.${other[1] ?? ""}.${real[2] ?? ""}`, "s", 0)).toBeNull();
  });

  it.each(["", "v1", "v1.a", "v2.a.b", "a.b.c.d", "v1.!!.!!"])("ignores %j", (value) => {
    expect(checkPass(value, "s", 0)).toBeNull();
  });

  it("opens a pass signed by hand the way it signs", () => {
    expect(checkPass(signed(GOOD), "s", 0)).toEqual(claims);
  });

  // Each rule of a pass's shape. A pass with a good mac and a wrong shape is still no pass.
  it.each([
    ["an id that is too short", { ...GOOD, i: "short" }],
    ["an id with a character a path should not hold", { ...GOOD, i: "AAAAAAAAAAAAAAAAAAAA/A" }],
    ["no id", { ...GOOD, i: undefined }],
    ["a game that is not ten characters", { ...GOOD, g: "aaaaaaaaa" }],
    ["a game in capitals", { ...GOOD, g: "AAAAAAAAAA" }],
    ["a game with a digit that is not in the alphabet", { ...GOOD, g: "aaaaaaaaa1" }],
    ["no pull", { ...GOOD, p: "" }],
    ["a pull of 65 characters", { ...GOOD, p: "a".repeat(65) }],
    ["a pull with a slash", { ...GOOD, p: "a/b" }],
    ["servers that are not a list", { ...GOOD, c: "api.example.com" }],
    [
      "six servers",
      {
        ...GOOD,
        c: [
          "a.example.com",
          "b.example.com",
          "c.example.com",
          "d.example.com",
          "e.example.com",
          "f.example.com",
        ],
      },
    ],
    ["a server that is not a name", { ...GOOD, c: ["not a host"] }],
    ["a server with a scheme", { ...GOOD, c: ["https://api.example.com"] }],
    ["a server that is a number", { ...GOOD, c: [1] }],
    ["a time that is not a whole number", { ...GOOD, exp: 1_800_000_000.5 }],
    ["a time that is text", { ...GOOD, exp: "1800000000" }],
    ["a payload that is a list", [GOOD]],
    ["a payload that is not an object", "text"],
  ])("ignores a signed pass with %s", (_why, payload) => {
    expect(checkPass(signed(payload), "s", 0)).toBeNull();
  });

  it("takes a pass with no servers and one with five", () => {
    const five = ["a.example.com", "b.example.com", "c.example.com", "d.example.com", "e.example.com:8443"];
    expect(checkPass(makePass({ ...claims, connect: [] }, "s"), "s", 0)?.connect).toEqual([]);
    expect(checkPass(makePass({ ...claims, connect: five }, "s"), "s", 0)?.connect).toEqual(five);
  });

  it("ignores a payload that is not JSON, though its mac is right", () => {
    const body = Buffer.from("not json").toString("base64url");
    const mac = createHmac("sha256", "s").update(`ruken-play-pass-v1:${body}`).digest("base64url");
    expect(checkPass(`v1.${body}.${mac}`, "s", 0)).toBeNull();
  });

  it("refuses to work with no secret", () => {
    expect(() => makePass(claims, "")).toThrow("The play pass secret is not set.");
    expect(() => checkPass("v1.a.b", "", 0)).toThrow("The play pass secret is not set.");
  });
});
