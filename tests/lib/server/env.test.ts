import { describe, expect, it } from "vitest";
import { optionalEnv, requireEnv } from "../../../src/lib/server/env.ts";

describe("requireEnv", () => {
  it("returns a set value", () => {
    expect(requireEnv("A", { A: "x" })).toBe("x");
  });

  it("names the missing setting and where to set it", () => {
    expect(() => requireEnv("SMTP_URL", {})).toThrow(
      "Missing setting SMTP_URL. Set it in Netlify's environment settings.",
    );
  });

  it("treats an empty value as missing", () => {
    expect(() => requireEnv("A", { A: "" })).toThrow();
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
