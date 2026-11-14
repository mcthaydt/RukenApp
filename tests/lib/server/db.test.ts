import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import {
  databasePerRequest,
  prisma,
  requestScopedAdapter,
  type PrismaClient,
  type RequestConnection,
} from "../../../src/lib/server/db.ts";

// A Worker may not use a database connection that another request opened, so every request gets a client of
// its own, and `prisma()` always reaches the client of the request that is running.

class FakeClient {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  whoAmI(): string {
    return this.name;
  }
}

const fakeClient = (name: string) => new FakeClient(name) as unknown as PrismaClient;

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

// One Prisma client for the whole Worker. A client made for each request leaves a few megabytes behind every time
// (it filled the Worker's memory until it aborted), so the client is shared, and its adapter is what keeps one
// request off another request's connection.
describe("requestScopedAdapter", () => {
  const QUERY = { sql: "SELECT 1", args: [], argTypes: [] };

  /** A stand-in for one request's connection: it answers every query with its own name. */
  const connectionNamed = (name: string) =>
    ({ queryRaw: () => Promise.resolve({ name }) }) as unknown as RequestConnection;

  /** The adapter the shared client holds, and the names of the connections opened through it so far. */
  async function sharedAdapter() {
    const opened: string[] = [];
    const factory = requestScopedAdapter(() => {
      const name = `connection ${String(opened.length + 1)}`;
      opened.push(name);
      return Promise.resolve(connectionNamed(name));
    });
    return { adapter: await factory.connect(), opened };
  }

  type Adapter = Awaited<ReturnType<typeof sharedAdapter>>["adapter"];
  const whoAnswers = async (adapter: Adapter) =>
    ((await adapter.queryRaw(QUERY)) as unknown as { name: string }).name;
  const oneTick = () => new Promise((done) => setTimeout(done, 0));
  const noClient = () => fakeClient("unused");

  it("opens nothing for a request that never asks the database", async () => {
    const { opened } = await sharedAdapter();

    await request(() => undefined, noClient);

    expect(opened).toEqual([]);
  });

  it("sends all of a request's queries to the one connection it opened", async () => {
    const { adapter, opened } = await sharedAdapter();
    const answers: string[] = [];

    await request(async () => {
      answers.push(await whoAnswers(adapter));
      await oneTick();
      answers.push(await whoAnswers(adapter));
    }, noClient);

    expect(answers).toEqual(["connection 1", "connection 1"]);
    expect(opened).toEqual(["connection 1"]);
  });

  it("keeps two requests at the same moment on a connection each", async () => {
    const { adapter } = await sharedAdapter();
    const seen: string[] = [];
    const asking = async () => {
      const first = await whoAnswers(adapter);
      await oneTick();
      seen.push(`${first} then ${await whoAnswers(adapter)}`);
    };

    await Promise.all([request(asking, noClient), request(asking, noClient)]);

    expect(seen.sort()).toEqual(["connection 1 then connection 1", "connection 2 then connection 2"]);
  });

  it("refuses a query made outside a request", async () => {
    const { adapter } = await sharedAdapter();

    await expect(adapter.queryRaw(QUERY)).rejects.toThrow("The database is only reachable inside a request.");
  });
});
