import { describe, expect, it } from "vitest";
import { hasJobSecret } from "../../../src/lib/server/job-secret.ts";

const SETTINGS = { JOBS_SECRET: "the-secret" };
const askWith = (authorization?: string) =>
  new Request("https://site.test/jobs/x", {
    method: "POST",
    headers: authorization === undefined ? {} : { authorization },
  });

describe("hasJobSecret", () => {
  it("is true for `Bearer ` and the secret", () => {
    expect(hasJobSecret(askWith("Bearer the-secret"), SETTINGS)).toBe(true);
  });

  it.each([
    ["no header", undefined],
    ["a wrong secret", "Bearer other"],
    ["the secret without Bearer", "the-secret"],
    ["Bearer and nothing", "Bearer "],
    ["the secret with more after it", "Bearer the-secret-and-more"],
    ["the secret in another case", "Bearer THE-SECRET"],
  ])("is false for %s", (_name, header) => {
    expect(hasJobSecret(askWith(header), SETTINGS)).toBe(false);
  });

  it("is false for everyone when no secret is set, or it is empty", () => {
    expect(hasJobSecret(askWith("Bearer "), {})).toBe(false);
    expect(hasJobSecret(askWith("Bearer undefined"), {})).toBe(false);
    expect(hasJobSecret(askWith("Bearer "), { JOBS_SECRET: "" })).toBe(false);
  });
});
