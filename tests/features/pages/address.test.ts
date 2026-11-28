import { describe, expect, it } from "vitest";
import { addressBase, addressesFor, cleanName } from "../../../src/features/pages/address.ts";
import { HANDLE, HANDLE_MAX, HANDLE_MIN, RESERVED_HANDLES } from "../../../src/features/pages/handle.ts";

// The address sign-up makes from a name must always keep the address rules, whatever the name. No property-test
// library (it would be a new dependency), so a fixed list of hard names stands in for generated ones.

/** Fixed digits, so every answer is the same on every run. */
function fixedDigits(count: number): string {
  return "1234567890".slice(0, count);
}

function keepsTheRules(address: string): boolean {
  return (
    HANDLE.test(address) &&
    address.length >= HANDLE_MIN &&
    address.length <= HANDLE_MAX &&
    !RESERVED_HANDLES.has(address)
  );
}

const HARD_NAMES = [
  "Ana",
  "​‍⁠",
  "12345",
  "7",
  "Jo",
  "A name that is far longer than thirty characters",
  "Bartholomew-Maximilian Featherstonehaugh",
  "abcdefghijklmnopqrstuvwxyz abcd",
  "abcdefghijklmnopqrstuvwxyzabc-d",
  "abcdefghijklmnopqrstuv-wxyz",
  "🎮🎮🎮",
  "Ma 🎮 Ria",
  "Иван Петров",
  "李小龙",
  "José Ñúñez",
  "--Hy--phens--",
  "a.b.c",
  ...RESERVED_HANDLES,
  ...[...RESERVED_HANDLES].map((word) => word.toUpperCase()),
];

describe("the address made from a name", () => {
  it("keeps the address rules for every try, for every hard name", () => {
    const broken = HARD_NAMES.flatMap((name) =>
      addressesFor(name, fixedDigits)
        .filter((address) => !keepsTheRules(address))
        .map((address) => `${JSON.stringify(name)} -> ${address}`),
    );
    expect(broken).toEqual([]);
  });

  it("tries the name itself first, then 5 with 4 digits and 5 with 6", () => {
    const tries = addressesFor("Ana Lee", fixedDigits);
    expect(tries[0]).toBe("ana-lee");
    expect(tries.slice(1, 6)).toEqual(Array(5).fill("ana-lee-1234"));
    expect(tries.slice(6)).toEqual(Array(5).fill("ana-lee-123456"));
  });

  it("skips the name itself when it is reserved or too short, and falls back to friend", () => {
    expect(addressesFor("Admin", fixedDigits)[0]).toBe("admin-1234");
    expect(addressesFor("Jo", fixedDigits)[0]).toBe("friend-1234");
    expect(addressesFor("Иван", fixedDigits)[0]).toBe("friend-1234");
    expect(addressesFor("🎮", fixedDigits)[0]).toBe("friend-1234");
  });

  it("cuts a long name to 30, and to 23 when digits go on, dropping a hyphen the cut leaves", () => {
    const long = "abcdefghijklmnopqrstuvwxyz abcd";
    expect(addressesFor(long, fixedDigits)[0]).toBe("abcdefghijklmnopqrstuvwxyz-abc");
    expect(addressesFor(long, fixedDigits)[1]).toBe("abcdefghijklmnopqrstuvw-1234");
    // The 30th character is a hyphen: the first try ends one short.
    expect(addressesFor("abcdefghijklmnopqrstuvwxyzabc-d", fixedDigits)[0]).toBe(
      "abcdefghijklmnopqrstuvwxyzabc",
    );
    // The 23rd character is a hyphen: the stem ends one short.
    expect(addressesFor("abcdefghijklmnopqrstuv-wxyz", fixedDigits)[1]).toBe("abcdefghijklmnopqrstuv-1234");
  });

  it("drops accents and invisible characters", () => {
    expect(addressBase("José Ñúñez")).toBe("jose-nunez");
    expect(cleanName(" ​Ana‍ ")).toBe("Ana");
    expect(cleanName("​‍⁠")).toBe("");
  });
});
