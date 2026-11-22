import { expect, test, type Page } from "@playwright/test";
import { gameWhere } from "./support/game.ts";
import { boxOf, wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// What a person does to the feed (spec 5.1): swipe or press keys to move a clip at a time, press the clip for sound, share
// a game, and meet two hints on the first open. The journeys share one database, so the feed holds every game any
// journey made; none of them depends on which game is first.

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  // Three games from rows, so the feed has several clips to move between whatever else the database holds.
  for (let made = 0; made < 3; made += 1) {
    await forgetRateLimits();
    const context = await browser.newContext({ baseURL: "http://localhost:4173" });
    try {
      await gameWhere(await context.newPage(), { state: "live" });
    } finally {
      await context.close();
    }
  }
});
test.beforeEach(forgetRateLimits);

const current = (page: Page) => page.locator('section[data-current="true"]');
const soundButtons = (page: Page) => page.getByRole("button", { name: "Sound" });

/** Opens the feed with its first clip on screen. */
async function openFeed(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("section[data-slug]").nth(2)).toBeAttached();
  await expect(current(page)).toHaveCount(1);
  // The page's script has started: until it has, a key is not heard and nothing is watching the scroll.
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await wordsHaveSettled(page);
}

/**
 * Keeps, in the page, every start and pause of a clip: the calls the feed makes, what each call's promise did, and the
 * events the browser sends. A journey that finds a clip playing off screen shows it (`clipLogOf`), so the log says
 * which clip, and who started it.
 */
function keepClipLog(): void {
  const log: string[] = [];
  Object.assign(window, { clipLog: log });
  const at = () => performance.now().toFixed(0);
  const clipOf = (video: HTMLMediaElement) => {
    const section = video.closest("section");
    return `${section?.getAttribute("data-slug") ?? "?"} current=${section?.getAttribute("data-current") ?? "?"}`;
  };
  const stateOf = (video: HTMLMediaElement) =>
    `paused=${String(video.paused)} ready=${String(video.readyState)} net=${String(video.networkState)}`;
  const original = (name: "play" | "pause") =>
    Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, name)?.value as (
      this: HTMLMediaElement,
    ) => unknown;
  const play = original("play") as (this: HTMLMediaElement) => Promise<void>;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    log.push(`${at()} play() ${clipOf(this)} ${stateOf(this)}`);
    const started = play.call(this);
    started.then(
      () => log.push(`${at()} play() kept ${clipOf(this)} ${stateOf(this)}`),
      (error: unknown) =>
        log.push(
          `${at()} play() refused ${error instanceof Error ? error.name : String(error)} ${clipOf(this)}`,
        ),
    );
    return started;
  };
  const pause = original("pause");
  HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
    pause.call(this);
    log.push(`${at()} pause() ${clipOf(this)} ${stateOf(this)}`);
  };
  for (const name of ["play", "playing", "pause", "emptied", "abort"]) {
    document.addEventListener(
      name,
      (event) => {
        if (event.target instanceof HTMLMediaElement)
          log.push(`${at()} event ${name} ${clipOf(event.target)} ${stateOf(event.target)}`);
      },
      true,
    );
  }
}

/** The page's clip log, and every clip as it is now. */
async function clipLogOf(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const now = Array.from(document.querySelectorAll("section[data-slug]"), (section, index) => {
      const video = section.querySelector("video");
      return `#${String(index)} ${section.getAttribute("data-slug") ?? "?"} current=${section.getAttribute("data-current") ?? "?"} paused=${String(video?.paused)} ready=${String(video?.readyState)} src=${video?.getAttribute("src") ?? "none"}`;
    });
    const log = (window as Window & { clipLog?: string[] }).clipLog ?? [];
    return ["clip log:", ...log, "clips now:", ...now].join("\n");
  });
}

/** The slug of the clip a person is on. */
const currentSlug = async (page: Page): Promise<string | null> =>
  await current(page).first().getAttribute("data-slug");

test("only the clip on screen and the next are fetched before a person scrolls", async ({ page }) => {
  const asked = new Set<string>();
  page.on("request", (request) => {
    const url = request.url().split("#")[0] ?? "";
    if (url.includes("/clips/")) asked.add(url);
  });
  await openFeed(page);
  // The clip on screen has asked for its first bytes (the browser read its size), and the network has gone quiet.
  await expect(current(page).locator("video"))
    .toHaveJSProperty("readyState", 4, { timeout: 15_000 })
    .catch(() => undefined);
  // The next clip has read its size too. (The network never goes quiet in WebKit while a clip loads, so "idle" is not
  // the thing to wait for.) A third clip, if the page wanted one, would have asked by now: it is asked for together
  // with the next.
  await expect
    .poll(() =>
      page.locator("section video").evaluateAll((videos) => (videos[1] as HTMLVideoElement).readyState >= 1),
    )
    .toBe(true);
  expect(asked.size).toBeGreaterThanOrEqual(1);
  expect(asked.size).toBeLessThanOrEqual(2);
  const preloads = await page
    .locator("section video")
    .evaluateAll((videos) => videos.map((video) => (video as HTMLVideoElement).preload));
  expect(preloads.length).toBeGreaterThanOrEqual(3);
  expect(preloads.slice(0, 2)).toEqual(["metadata", "metadata"]);
  expect(preloads.slice(2).every((preload) => preload === "none")).toBe(true);
});

const fillsTheWindow = async ({ page }: { page: Page }) => {
  await page.addInitScript(keepClipLog);
  await openFeed(page);
  const first = await currentSlug(page);
  const clips = page.locator("section[data-slug]");
  expect(first).toBe(await clips.first().getAttribute("data-slug"));

  await page.keyboard.press("ArrowDown");
  await expect(clips.nth(1)).toHaveAttribute("data-current", "true");
  await expect(current(page)).toHaveCount(1);
  await expect(clips.nth(0)).toHaveAttribute("data-current", "false");
  // A clip that is not the one on screen is paused, whatever the device lets move. The pause follows the move by a
  // moment in some engines, so the journey waits for it.
  await expect
    .poll(
      () =>
        clips.evaluateAll((sections) =>
          sections
            .filter((section) => section.getAttribute("data-current") === "false")
            .every((section) => {
              const video = section.querySelector("video");
              return video !== null && video.paused;
            }),
        ),
      { message: "a clip that is not on screen is still playing" },
    )
    .toBe(true)
    .catch(async (error: unknown) => {
      throw new Error(`${String(error)}\n${await clipLogOf(page)}`);
    });
};
for (let copy = 0; copy < 100; copy += 1)
  test(
    `the clip that fills the window is the current one, and only one is; the others wait at their start (copy ${String(copy)})`,
    fillsTheWindow,
  );

test("each key moves one clip, never past either end", async ({ page }) => {
  await openFeed(page);
  const clips = page.locator("section[data-slug]");
  await page.keyboard.press("ArrowUp");
  await expect(clips.nth(0)).toHaveAttribute("data-current", "true");

  for (const [key, back] of [
    ["ArrowDown", "ArrowUp"],
    ["PageDown", "PageUp"],
    ["Space", "Shift+Space"],
  ] as const) {
    // The journey waits for the state it is about, never for the clock: how long a key takes on a busy runner is not
    // something Ruken decides.
    await page.keyboard.press(key);
    await expect(clips.nth(1)).toHaveAttribute("data-current", "true");
    await page.keyboard.press(back);
    await expect(clips.nth(0)).toHaveAttribute("data-current", "true");
  }
});

test("pressing the clip flips sound for every clip, and it stays as set from one game to the next", async ({
  page,
}) => {
  await openFeed(page);
  await expect(soundButtons(page).first()).toHaveAttribute("aria-pressed", "false");
  const first = current(page).getByRole("button", { name: "Sound" });
  // The clip is one button the size of the window.
  const box = await boxOf(first);
  expect(box.width).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) - 1);
  expect(box.height).toBeGreaterThanOrEqual((page.viewportSize()?.height ?? 0) - 1);

  // A press away from the words: the middle of the top of the clip.
  await first.click({ position: { x: box.width / 2, y: 80 } });
  for (const button of await soundButtons(page).all())
    await expect(button).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(1)).toHaveAttribute("data-current", "true");
  await expect(soundButtons(page).nth(1)).toHaveAttribute("aria-pressed", "true");

  await current(page)
    .getByRole("button", { name: "Sound" })
    .click({ position: { x: box.width / 2, y: 80 } });
  for (const button of await soundButtons(page).all())
    await expect(button).toHaveAttribute("aria-pressed", "false");
});

test("the sound button never covers Play, Share, the two links or the bar", async ({ page }) => {
  await openFeed(page);
  const clip = current(page);
  const things = [
    clip.getByRole("link", { name: "Play", exact: true }),
    clip.getByRole("button", { name: "Share" }),
    clip.locator("a.gamelink"),
    page.getByRole("link", { name: "Home" }),
    page.getByRole("link", { name: "You" }),
  ];
  for (const thing of things) {
    const reached = await thing.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return top !== null && element.contains(top);
    });
    expect(reached).toBe(true);
  }
});

test.describe("Share", () => {
  /** A phone's share sheet and clipboard, as the journey's own. The page asks `navigator` at the moment of the press. */
  async function standIns(
    page: Page,
    how: { share: "none" | "works" | "closes" | "breaks"; clipboard: "works" | "refuses" },
  ): Promise<void> {
    await page.addInitScript((how) => {
      const seen: { shared: unknown[]; copied: string[] } = { shared: [], copied: [] };
      (window as unknown as { seen: typeof seen }).seen = seen;
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value:
          how.share === "none"
            ? undefined
            : (data: unknown) => {
                seen.shared.push(data);
                if (how.share === "closes") return Promise.reject(new DOMException("closed", "AbortError"));
                if (how.share === "breaks") return Promise.reject(new Error("no sheet"));
                return Promise.resolve();
              },
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (text: string) => {
            if (how.clipboard === "refuses") return Promise.reject(new Error("not allowed"));
            seen.copied.push(text);
            return Promise.resolve();
          },
        },
      });
    }, how);
  }
  const seenOf = (page: Page) =>
    page.evaluate(
      () => (window as unknown as { seen: { shared: { url: string }[]; copied: string[] } }).seen,
    );

  test("copies the link and says so for a few seconds, where there is no share sheet", async ({ page }) => {
    await standIns(page, { share: "none", clipboard: "works" });
    await openFeed(page);
    const slug = await currentSlug(page);
    const clip = current(page);
    await clip.getByRole("button", { name: "Share" }).click();
    await expect(clip.getByRole("status")).toHaveText("Link copied.");
    expect((await seenOf(page)).copied).toEqual([`${new URL(page.url()).origin}/g/${String(slug)}`]);
    // It goes by itself, in about four seconds.
    await expect(clip.getByRole("status")).toHaveText("", { timeout: 8000 });
  });

  test("says where to copy the address from when nothing works", async ({ page }) => {
    await standIns(page, { share: "none", clipboard: "refuses" });
    await openFeed(page);
    const clip = current(page);
    await clip.getByRole("button", { name: "Share" }).click();
    await expect(clip.getByRole("status")).toHaveText("Copy the address from the bar at the top.");
  });

  test("opens the device's share sheet with the game's page, and says nothing more", async ({ page }) => {
    await standIns(page, { share: "works", clipboard: "works" });
    await openFeed(page);
    const slug = await currentSlug(page);
    await current(page).getByRole("button", { name: "Share" }).click();
    await expect.poll(async () => (await seenOf(page)).shared.length).toBe(1);
    expect((await seenOf(page)).shared[0]?.url).toBe(`${new URL(page.url()).origin}/g/${String(slug)}`);
    await expect(current(page).getByRole("status")).toHaveText("");
  });

  test("says nothing to a person who closed the sheet", async ({ page }) => {
    await standIns(page, { share: "closes", clipboard: "works" });
    await openFeed(page);
    await current(page).getByRole("button", { name: "Share" }).click();
    await expect.poll(async () => (await seenOf(page)).shared.length).toBe(1);
    await expect(current(page).getByRole("status")).toHaveText("");
    expect((await seenOf(page)).copied).toEqual([]);
  });
});

test.describe("the first open's hints", () => {
  test("show on the first clip in the device's words, clear of Play, and go for good at the first key", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("section[data-slug]").first()).toBeAttached();
    const touch = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
    const swipe = page.getByText(touch ? "Swipe up for the next game" : "Scroll down for the next game");
    const sound = page.getByText(touch ? "Tap for sound" : "Click for sound");
    await expect(swipe).toBeVisible();
    await expect(sound).toBeVisible();
    await expect(
      page.getByText(touch ? "Scroll down for the next game" : "Swipe up for the next game"),
    ).toHaveCount(0);
    const play = await boxOf(
      page.locator("section[data-slug]").first().getByRole("link", { name: "Play", exact: true }),
    );
    for (const hint of [swipe, sound]) {
      const box = await boxOf(hint);
      expect(box.y + box.height).toBeLessThanOrEqual(play.y);
    }

    await page.keyboard.press("ArrowDown");
    await expect(swipe).toHaveCount(0);
    await page.reload();
    await expect(page.locator("section[data-slug]").first()).toBeAttached();
    await wordsHaveSettled(page);
    await expect(page.getByText(touch ? "Tap for sound" : "Click for sound")).toHaveCount(0);
  });

  test("go at the first press on the clip", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/for sound$/)).toBeVisible();
    await soundButtons(page)
      .first()
      .click({ position: { x: 100, y: 80 } });
    await expect(page.getByText(/for sound$/)).toHaveCount(0);
  });

  test("are never there with no script", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: "http://localhost:4173" });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await expect(page.locator("section[data-slug]").first()).toBeAttached();
      await expect(page.getByText(/for the next game$/)).toHaveCount(0);
      // Without script, a clip's name and Play are still plain links.
      await expect(
        page.locator("section[data-slug]").first().getByRole("link", { name: "Play", exact: true }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("with reduced motion the next clip is simply there, not slid to", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", baseURL: "http://localhost:4173" });
    try {
      const page = await context.newPage();
      await openFeed(page);
      // Every position the feed passes through on its way is written down. A glide passes through many; with reduced
      // motion the feed goes straight to the next clip.
      await page.evaluate(() => {
        const feed = document.querySelector("main") as HTMLElement;
        const seen: number[] = [];
        (window as unknown as { seen: number[] }).seen = seen;
        feed.addEventListener("scroll", () => seen.push(feed.scrollTop));
      });
      await page.keyboard.press("ArrowDown");
      await expect
        .poll(() =>
          page.evaluate(() => {
            const feed = document.querySelector("main") as HTMLElement;
            const second = document.querySelectorAll("section")[1] as HTMLElement;
            return feed.scrollTop === second.offsetTop;
          }),
        )
        .toBe(true);
      const seen = await page.evaluate(() => (window as unknown as { seen: number[] }).seen);
      expect(seen.length).toBeLessThanOrEqual(1);
      await expect(page.getByText(/for the next game$/)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

test("everything is reachable with Tab, in an order that follows the screen, and focus shows", async ({
  page,
}) => {
  await openFeed(page);
  const names: string[] = [];
  const outlines: string[] = [];
  for (let presses = 0; presses < 9; presses += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (element === null) return null;
      const label =
        element.getAttribute("aria-label") ?? (element as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      const style = getComputedStyle(element);
      return { label, outline: `${style.outlineStyle} ${style.outlineWidth}` };
    });
    names.push(focused?.label ?? "");
    outlines.push(focused?.outline ?? "");
  }
  // The bar first (it is always there), then the first clip's controls from the top of the screen to the bottom, then the
  // next clip's.
  expect(names.slice(0, 3)).toEqual(["Home", "You", "Sound"]);
  const play = names.indexOf("Play");
  expect(play).toBeGreaterThan(2);
  expect(names[play + 1]).toBe("Share");
  expect(names[play + 2]).toBe("Sound");
  for (const outline of outlines) expect(outline).not.toMatch(/^none/);
});
