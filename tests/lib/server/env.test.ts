import { describe, expect, it } from "vitest";
import { optionalEnv, requireEnv } from "../../../src/lib/server/env.ts";

describe("requireEnv", () => {
  it("returns a set value", () => {
    expect(requireEnv("A", { A: "x" })).toBe("x");
  });

  it("names the missing setting and where to set it", () => {
    expect(() => requireEnv("RESEND_API_KEY", {})).toThrow(
      "Missing setting RESEND_API_KEY. Add it as a secret on the Worker in Cloudflare.",
    );
  });

  it("treats an empty value as missing", () => {
    expect(() => requireEnv("A", { A: "" })).toThrow("Missing setting A.");
  });
});

describe("optionalEnv", () => {
  it("answers undefined for unset or empty", () => {
    expect(optionalEnv("A", {})).toBeUndefined();
    expect(optionalEnv("A", { A: "" })).toBeUndefined();
  });

  it("returns a set value", () => {
    expect(optionalEnv("A", { A: "x" })).toBe("x");
  });
});
