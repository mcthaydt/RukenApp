// A stand-in gamepad for the journeys: the page's `navigator.getGamepads` gives one pad in the standard layout, and a
// journey holds and lets go of its buttons as a person would (src/lib/pad-focus.ts reads it on every frame).
import { expect, type Page } from "@playwright/test";
import { pageHasSettled } from "./account.ts";

/** The standard layout's buttons (w3c.github.io/gamepad/#remapping) that Ruken reads. */
export const PAD = {
  a: 0,
  b: 1,
  lb: 4,
  rb: 5,
  view: 8,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  home: 16,
} as const;

/** Plugs the stand-in pad into every page this page opens from now on. */
export async function plugInPad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = {
      id: "Stand-in pad (STANDARD GAMEPAD)",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons,
    };
    const set = (index: number, down: boolean) => {
      const button = buttons[index];
      if (button === undefined) return;
      button.pressed = down;
      button.touched = down;
      button.value = down ? 1 : 0;
      pad.timestamp = performance.now();
    };
    // A quick press is down for exactly one reading of the pad, however long a busy machine takes between frames: a
    // press held over two readings 450 ms apart would count as held, and repeat (review 3 of #409).
    let tapping: number | null = null;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        if (tapping !== null) {
          const index = tapping;
          tapping = null;
          // Let go once the page has read this one (its reading runs on before any queued work).
          queueMicrotask(() => {
            set(index, false);
          });
        }
        return [pad, null, null, null];
      },
      configurable: true,
    });
    Object.assign(window, {
      standInPad: {
        hold: set,
        tap(index: number) {
          set(index, true);
          tapping = index;
        },
        up: (index: number) => !(buttons[index]?.pressed ?? false),
        frames: (count: number) =>
          new Promise<void>((done) => {
            const step = (left: number) => {
              if (left === 0) done();
              else
                requestAnimationFrame(() => {
                  step(left - 1);
                });
            };
            step(count);
          }),
      },
    });
  });
}

interface StandIn {
  hold(index: number, down: boolean): void;
  tap(index: number): void;
  up(index: number): boolean;
  frames(count: number): Promise<void>;
}

/**
 * Presses a button: a quick press by default, down for one reading of the pad; or held for `ms`, then let go. Either
 * way it waits for the page to see it.
 */
export async function pressPad(page: Page, button: number, ms = 0): Promise<void> {
  await page.evaluate(
    async ({ button, ms }) => {
      const pad = (window as unknown as { standInPad: StandIn }).standInPad;
      if (ms === 0) {
        pad.tap(button);
        while (!pad.up(button)) await pad.frames(1);
      } else {
        pad.hold(button, true);
        await pad.frames(2);
        await new Promise((done) => setTimeout(done, ms));
        pad.hold(button, false);
      }
      await pad.frames(2);
    },
    { button, ms },
  );
}

/**
 * Checks the pad reaches every control the Tab key reaches on this screen: it walks Tab once round to list them, then
 * from the first press moves the pad's focus every way from every control it has reached, and fails naming any that
 * no move ever landed on.
 */
export async function padReachesEverything(page: Page): Promise<void> {
  // The pad is read by the page's script, so a press before it has started is not seen.
  await pageHasSettled(page);
  await page.evaluate(() => {
    document.querySelectorAll("[data-tab-stop]").forEach((one) => {
      one.removeAttribute("data-tab-stop");
    });
  });
  // Tab's own round: from the page itself, until it comes back to the first or leaves the page.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
  });
  const tabbed: string[] = [];
  for (let step = 0; step < 80; step += 1) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate((n) => {
      const focused = document.activeElement;
      if (!(focused instanceof HTMLElement) || focused === document.body) return null;
      if (focused.hasAttribute("data-tab-stop")) return focused.getAttribute("data-tab-stop");
      focused.setAttribute("data-tab-stop", String(n));
      return String(n);
    }, step);
    if (id === null || tabbed.includes(id)) break;
    tabbed.push(id);
  }
  expect(tabbed.length, "Tab reached nothing on this screen").toBeGreaterThan(0);

  // Where the pad's focus is: a control Tab reached, or one only the pad reaches (the other buttons of a radio group,
  // which Tab passes over as one stop), marked so the walk goes on from it too.
  const stopHere = () =>
    page.evaluate(() => {
      const focused = document.activeElement;
      if (!(focused instanceof HTMLElement) || focused === document.body) return null;
      if (!focused.hasAttribute("data-tab-stop"))
        focused.setAttribute(
          "data-tab-stop",
          `pad-${String(document.querySelectorAll("[data-tab-stop]").length)}`,
        );
      return focused.getAttribute("data-tab-stop");
    });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
  });
  await page.mouse.move(0, 0);
  await pressPad(page, PAD.right);
  const first = await stopHere();
  expect(first, "the pad's first press focused nothing Tab reaches").not.toBeNull();
  const reached = new Set<string>([first ?? ""]);
  const waiting = [first ?? ""];
  const url = page.url();
  while (waiting.length > 0) {
    const from = waiting.shift() ?? "";
    for (const way of [PAD.up, PAD.down, PAD.left, PAD.right]) {
      await page.evaluate((id) => {
        document.querySelector<HTMLElement>(`[data-tab-stop="${id}"]`)?.focus();
      }, from);
      await pressPad(page, way);
      expect(page.url(), "a move of the pad changed the page").toBe(url);
      const landed = await stopHere();
      if (landed !== null && !reached.has(landed)) {
        reached.add(landed);
        waiting.push(landed);
      }
    }
  }
  const missed = await page.evaluate(
    (ids) =>
      ids.map((id) => {
        const one = document.querySelector<HTMLElement>(`[data-tab-stop="${id}"]`);
        return one === null
          ? id
          : (one.getAttribute("aria-label") ?? one.innerText).trim() || one.outerHTML.slice(0, 400);
      }),
    tabbed.filter((id) => !reached.has(id)),
  );
  expect(missed, `the pad cannot reach these on ${url}`).toEqual([]);
}
