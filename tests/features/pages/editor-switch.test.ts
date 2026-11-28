import { describe, expect, it } from "vitest";
import { createEditorOpen, isEditorPath } from "../../../src/features/pages/editor-switch.ts";

// Making your page waits for the Pages slice: the real site has no switch, so the editor is closed whatever comes. The
// journeys' site sets PAGES_TEST_SWITCH so the editor's journeys keep running, and one cookie shows it closed.

const none = { get: () => undefined };
const closed = { get: (name: string) => (name === "rk_test_pages" ? "closed" : undefined) };
const open = { get: (name: string) => (name === "rk_test_pages" ? "open" : undefined) };

describe("whether a request may see the page editor", () => {
  it("is closed when the switch is not set, whatever cookie comes", () => {
    const editorOpen = createEditorOpen({ BETTER_AUTH_URL: "https://ruken.example" });
    expect(editorOpen(none)).toBe(false);
    expect(editorOpen(open)).toBe(false);
    expect(editorOpen(closed)).toBe(false);
  });

  it("treats an empty switch as not set", () => {
    const editorOpen = createEditorOpen({ PAGES_TEST_SWITCH: "", BETTER_AUTH_URL: "http://localhost:4173" });
    expect(editorOpen(open)).toBe(false);
  });

  it.each([
    "https://ruken.example",
    "https://localhost:4173",
    "http://localhost.evil.example",
    "not a url",
    undefined,
  ])("refuses to start with the switch on at %j", (address) => {
    expect(() => createEditorOpen({ PAGES_TEST_SWITCH: "on", BETTER_AUTH_URL: address })).toThrow(
      "PAGES_TEST_SWITCH is for tests on this machine",
    );
  });

  it.each(["true", "off", "ON"])("refuses a value it does not know (%j)", (value) => {
    expect(() =>
      createEditorOpen({ PAGES_TEST_SWITCH: value, BETTER_AUTH_URL: "http://localhost:4173" }),
    ).toThrow("PAGES_TEST_SWITCH is for tests on this machine. Remove it from this site's settings.");
  });

  it.each(["http://localhost:4173", "http://127.0.0.1:4173"])(
    "on this machine (%s) the editor is open, and one cookie closes it",
    (address) => {
      const editorOpen = createEditorOpen({ PAGES_TEST_SWITCH: "on", BETTER_AUTH_URL: address });
      expect(editorOpen(none)).toBe(true);
      expect(editorOpen(open)).toBe(true);
      expect(editorOpen(closed)).toBe(false);
    },
  );
});

describe("the editor's addresses", () => {
  it.each([
    "/make/page",
    "/make/page/",
    "/make/page/name",
    "/make/page/links/add/where",
    "/make/page/take-down",
  ])("%s is the editor", (path) => {
    expect(isEditorPath(path)).toBe(true);
  });

  it.each(["/make", "/make/pages", "/make/pagefoo", "/make/new", "/m-maker", "/g/page"])(
    "%s is not",
    (path) => {
      expect(isEditorPath(path)).toBe(false);
    },
  );
});
