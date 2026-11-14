import { describe, expect, it } from "vitest";
import { readCopy } from "../../../src/lib/server/copy.ts";

describe("readCopy", () => {
  it.each(["test", "live"] as const)("answers %s when RUKEN_COPY says so", (copy) => {
    expect(readCopy({ RUKEN_COPY: copy })).toBe(copy);
  });

  it.each([undefined, "", "prod", "Test", "live "])("refuses %j and says where it is set", (value) => {
    expect(() => readCopy({ RUKEN_COPY: value })).toThrow(
      'RUKEN_COPY must be "test" or "live". wrangler.jsonc sets it.',
    );
  });
});
