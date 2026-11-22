import { describe, expect, test } from "vitest";
import { shareLink, type ShareTools } from "../../../src/features/feed/share.ts";

const LINK = { title: "Floor Fifty", url: "https://ruken.example/g/floor-fifty" };

/** The error a browser throws when a person closes the share sheet. */
const closed = () => Object.assign(new Error("closed"), { name: "AbortError" });

describe("shareLink", () => {
  test("is `shared` when the share sheet took the link, and hands it the title and the address", async () => {
    const seen: unknown[] = [];
    const tools: ShareTools = {
      share: (data) => {
        seen.push(data);
        return Promise.resolve();
      },
    };
    expect(await shareLink(tools, LINK)).toBe("shared");
    expect(seen).toEqual([LINK]);
  });

  test("is `closed` when the person closed the sheet, and copies nothing", async () => {
    const copied: string[] = [];
    const tools: ShareTools = {
      share: () => Promise.reject(closed()),
      copy: (text) => {
        copied.push(text);
        return Promise.resolve();
      },
    };
    expect(await shareLink(tools, LINK)).toBe("closed");
    expect(copied).toEqual([]);
  });

  test("copies the address when there is no share sheet", async () => {
    const copied: string[] = [];
    const tools: ShareTools = {
      copy: (text) => {
        copied.push(text);
        return Promise.resolve();
      },
    };
    expect(await shareLink(tools, LINK)).toBe("copied");
    expect(copied).toEqual([LINK.url]);
  });

  test("copies the address when the sheet breaks for any other reason", async () => {
    const tools: ShareTools = {
      share: () => Promise.reject(new Error("no sheet here")),
      copy: () => Promise.resolve(),
    };
    expect(await shareLink(tools, LINK)).toBe("copied");
  });

  test("is `manual` when the clipboard refuses", async () => {
    const tools: ShareTools = { copy: () => Promise.reject(new Error("not allowed")) };
    expect(await shareLink(tools, LINK)).toBe("manual");
  });

  test("is `manual` with neither tool", async () => {
    expect(await shareLink({}, LINK)).toBe("manual");
  });

  test("is `manual` when the sheet breaks and there is no clipboard", async () => {
    expect(await shareLink({ share: () => Promise.reject(new Error("no")) }, LINK)).toBe("manual");
  });
});
