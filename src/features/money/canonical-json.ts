/**
 * The one JSON form the ledger stores and hashes: object keys sorted by UTF-16 code unit at every
 * depth, no whitespace, arrays in their order, members whose value is `undefined` left out, and
 * bigints written as decimal strings so cents never pass through a floating-point number. The same
 * value always gives the same bytes, which is what lets a golden month compare byte for byte and a
 * stored statement prove it never changed.
 */
export function canonicalJson(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new RangeError(`${String(value)} has no JSON form`);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${members.join(",")}}`;
  }
  return JSON.stringify(value);
}
