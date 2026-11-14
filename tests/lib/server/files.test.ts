import { describe, expect, it } from "vitest";
import { fileStore, setFileStore } from "../../../src/lib/server/files.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";

describe("fileStore", () => {
  // The first case runs before any other sets a store: the module holds one per process.
  it("says where it is set when nothing has set it", () => {
    expect(() => fileStore()).toThrow("No file store is set. src/hooks.server.ts sets it.");
  });

  it("answers what the opener given to setFileStore opens, every time it is asked", () => {
    const store = new MemoryFileStore();
    setFileStore(() => store);

    expect(fileStore()).toBe(store);
    expect(fileStore()).toBe(store);
  });
});
