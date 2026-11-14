import { afterAll, describe, expect, it } from "vitest";
import { createPlayServices } from "../../../src/features/play/services.ts";
import { createPrismaClient } from "../../../src/lib/server/db.ts";
import { TestClock } from "../../support/test-clock.ts";

// The services are built from the settings. Nothing here connects: the database address is one that nothing listens on.

const db = createPrismaClient("postgresql://postgres:x@127.0.0.1:1/ruken");

afterAll(async () => {
  await db.$disconnect();
});

const parts = {
  db,
  clock: new TestClock("2026-11-14T12:00:00Z"),
  address: (name: string) => `https://${name}.games.test`,
};

describe("createPlayServices", () => {
  it("builds from the play pass secret", () => {
    expect(() => createPlayServices({ PLAY_PASS_SECRET: "test-only-play-pass-secret" }, parts)).not.toThrow();
  });

  it("stops with the name of the setting when it is missing, or empty", () => {
    expect(() => createPlayServices({}, parts)).toThrow("Missing setting PLAY_PASS_SECRET");
    expect(() => createPlayServices({ PLAY_PASS_SECRET: "" }, parts)).toThrow(
      "Missing setting PLAY_PASS_SECRET",
    );
  });
});
