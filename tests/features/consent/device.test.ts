import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deviceStore, setAgreed } from "../../../src/features/consent/consent.browser.ts";

const ROOT = resolve(import.meta.dirname, "../../..");

/** A browser's storage, enough to see what was written. */
class FakeStorage {
  items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe("deviceStore (guard 3)", () => {
  const local = new FakeStorage();
  beforeEach(() => {
    local.items.clear();
    (globalThis as Record<string, unknown>).localStorage = local;
    setAgreed(false);
  });
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it("keeps a value for the visit and writes nothing to the device before a yes", () => {
    deviceStore.set("rk_seen_hints", "1");
    expect(deviceStore.get("rk_seen_hints")).toBe("1");
    expect(local.items.size).toBe(0);
  });

  it("reads what the device holds once this browser agreed", () => {
    local.setItem("rk_on_device", "1");
    expect(deviceStore.get("rk_on_device")).toBeNull();
    setAgreed(true);
    expect(deviceStore.get("rk_on_device")).toBe("1");
  });

  it("writes to the device once this browser agreed", () => {
    setAgreed(true);
    deviceStore.set("rk_menu_tab", "x");
    expect(local.items.get("rk_menu_tab")).toBe("x");
  });
});

describe("the only code that touches the browser's storage", () => {
  it("is deviceStore: no localStorage or sessionStorage anywhere else in src/", () => {
    const allowed = ["src/features/consent/device-store.ts", "src/app.html"];
    const found = readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(ts|svelte|html|js)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((file) => /\b(localStorage|sessionStorage)\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file))
      .filter((file) => !allowed.includes(file) && !file.includes("/generated/"));
    expect(found).toEqual([]);
  });
});

// Guard 4: app.html puts a stand-in in front of sessionStorage before any script runs, unless the server said yes.
describe("the framework-storage guard in app.html (guard 4)", () => {
  const html = readFileSync(join(ROOT, "src/app.html"), "utf8");
  const script = /<script data-rk-consent="no">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";

  function pageWith(consent: "yes" | "no") {
    const real = new FakeStorage();
    const window: Record<string, unknown> = {};
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => real });
    const context = vm.createContext({
      window,
      document: { currentScript: { getAttribute: () => consent } },
      Object,
      String,
    });
    vm.runInContext(script, context);
    return {
      window: window as { sessionStorage: FakeStorage; __rkStorage: { restore(): void; hold(): void } },
      real,
    };
  }

  it("is there, ahead of everything, in the head", () => {
    expect(script).not.toBe("");
    expect(html.indexOf('data-rk-consent="no"')).toBeLessThan(html.indexOf("%sveltekit.head%"));
  });

  it("sends every write to memory until the server said yes", () => {
    const { window, real } = pageWith("no");
    window.sessionStorage.setItem("sveltekit:snapshot", "x");
    expect(window.sessionStorage.getItem("sveltekit:snapshot")).toBe("x");
    expect(real.items.size).toBe(0);
  });

  it("leaves the real storage alone once the server said yes", () => {
    const { window, real } = pageWith("yes");
    window.sessionStorage.setItem("sveltekit:snapshot", "x");
    expect(real.items.get("sveltekit:snapshot")).toBe("x");
  });

  it("gives the real storage back on a yes without a reload, and takes it away again", () => {
    const { window, real } = pageWith("no");
    window.__rkStorage.restore();
    window.sessionStorage.setItem("a", "1");
    expect(real.items.get("a")).toBe("1");
    window.__rkStorage.hold();
    window.sessionStorage.setItem("b", "2");
    expect(real.items.has("b")).toBe(false);
  });
});
