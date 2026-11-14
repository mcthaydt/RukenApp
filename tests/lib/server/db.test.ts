import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { databasePerRequest, prisma, type PrismaClient } from "../../../src/lib/server/db.ts";

// A Worker may not use a database connection that another request opened, so every request gets a client of
// its own, and `prisma()` always reaches the client of the request that is running.

const fakeClient = (name: string) =>
  ({
    name,
    whoAmI() {
      return this.name;
    },
  }) as unknown as PrismaClient;

/** Runs `work` as one request: the handle opens what it needs, `work` runs inside, and the request ends. */
const request = (work: () => unknown, open: () => PrismaClient) =>
  databasePerRequest(open)({
    event: {} as RequestEvent,
    resolve: async () => {
      await work();
      return new Response("ok");
    },
  });

const nameOf = () => (prisma() as unknown as { whoAmI(): string }).whoAmI();

describe("databasePerRequest", () => {
  it("opens nothing for a request that never uses the database", async () => {
    const open = vi.fn(() => fakeClient("a"));

    await request(() => undefined, open);

    expect(open).not.toHaveBeenCalled();
  });

  it("gives one request one client, however often it asks", async () => {
    const open = vi.fn(() => fakeClient("a"));

    await request(() => {
      nameOf();
      nameOf();
    }, open);

    expect(open).toHaveBeenCalledTimes(1);
  });

  it("gives two requests at the same moment a client each", async () => {
    const seen: string[] = [];
    const later = async (name: string) => {
      await new Promise((done) => setTimeout(done, 0));
      seen.push(`${nameOf()} for ${name}`);
    };

    await Promise.all([
      request(
        () => later("a"),
        () => fakeClient("a"),
      ),
      request(
        () => later("b"),
        () => fakeClient("b"),
      ),
    ]);

    expect(seen.sort()).toEqual(["a for a", "b for b"]);
  });

  it("calls a method on the real client, not on the stand-in", async () => {
    await request(
      () => {
        expect(nameOf()).toBe("a");
      },
      () => fakeClient("a"),
    );
  });
});

describe("prisma", () => {
  it("refuses the database outside a request", () => {
    expect(() => nameOf()).toThrow("The database is only reachable inside a request.");
  });
});
