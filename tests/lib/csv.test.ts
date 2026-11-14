import { describe, expect, it } from "vitest";
import { parseCsv } from "../../src/lib/csv.ts";

describe("parseCsv", () => {
  it("reads plain lines into rows of text", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps a comma inside a quoted field", () => {
    expect(parseCsv('id,note\n1,"one, two"\n')).toEqual([
      ["id", "note"],
      ["1", "one, two"],
    ]);
  });

  it("reads a doubled quote inside a quoted field as one quote", () => {
    expect(parseCsv('"say ""hi"""\n')).toEqual([['say "hi"']]);
  });

  it("reads \\r\\n and \\n line ends alike", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a line break inside a quoted field", () => {
    expect(parseCsv('a,b\n"line one\nline two",2\n')).toEqual([
      ["a", "b"],
      ["line one\nline two", "2"],
    ]);
  });

  it("keeps empty fields, and a last line with no line end", () => {
    expect(parseCsv("a,,c\n1,2,")).toEqual([
      ["a", "", "c"],
      ["1", "2", ""],
    ]);
  });

  it("gives no rows for an empty text, and does not count a last empty line as a row", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("a\n\n")).toEqual([["a"]]);
  });

  it("refuses a quote that never closes", () => {
    expect(() => parseCsv('a,"b\n')).toThrow(RangeError);
  });
});
