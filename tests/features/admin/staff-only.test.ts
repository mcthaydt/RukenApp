import { describe, expect, it } from "vitest";
import type { Caller } from "../../../src/features/accounts/accounts.ts";
import { isStaff, staffOnly } from "../../../src/features/admin/admin.ts";
import type { StaffRole } from "../../../src/lib/server/db.ts";

// The staff pages are a missing page for everyone else (Review Focus 7): the address looks like any address the site
// does not have, so it is never a hint that something is behind it.

const userWith = (staffRoles: StaffRole[]): Caller => ({
  kind: "user",
  userId: "user-1",
  sessionId: "session-1",
  staffRoles,
});

describe("staffOnly", () => {
  it("is a missing page for someone signed out", () => {
    expect(() => staffOnly({ kind: "none" })).toThrow(expect.objectContaining({ status: 404 }) as Error);
  });

  // Each case is one argument that is itself a list, so each list is wrapped once more.
  it.each<[StaffRole[]]>([[[]], [["finance"]], [["moderator"]], [["support"]]])(
    "is a missing page for staff roles %j, which do not check games",
    (roles) => {
      expect(() => staffOnly(userWith(roles))).toThrow(expect.objectContaining({ status: 404 }) as Error);
    },
  );

  it.each<StaffRole>(["owner", "head_curator", "curator"])("lets a %s in, and says who", (role) => {
    expect(staffOnly(userWith([role]))).toEqual({ userId: "user-1" });
  });

  it("lets in someone with one of these roles among others", () => {
    expect(staffOnly(userWith(["finance", "curator"]))).toEqual({ userId: "user-1" });
  });
});

// The doors to the staff pages are shown to exactly the people the pages let in.
describe("isStaff", () => {
  it("is no for someone signed out", () => {
    expect(isStaff({ kind: "none" })).toBe(false);
  });

  it.each<[StaffRole[]]>([[[]], [["finance"]], [["moderator"]], [["support"]]])(
    "is no for staff roles %j, which do not check games",
    (roles) => {
      expect(isStaff(userWith(roles))).toBe(false);
    },
  );

  it.each<StaffRole>(["owner", "head_curator", "curator"])("is yes for a %s", (role) => {
    expect(isStaff(userWith([role]))).toBe(true);
  });

  it("is yes for someone with one of these roles among others", () => {
    expect(isStaff(userWith(["finance", "curator"]))).toBe(true);
  });
});
