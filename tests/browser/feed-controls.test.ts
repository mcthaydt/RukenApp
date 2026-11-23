import { expect, test, type Page } from "@playwright/test";
import { gameWhere } from "./support/game.ts";
import { boxOf, wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { consented } from "./support/consent.ts";

// What a person does to the feed (spec 5.1): swipe or press keys to move a clip at a time, press the clip to open its game's
// page, press the speaker for sound, share
// a game, and meet two hints on the first open. The journeys share one database, so the feed holds every game any
// journey made; none of them depends on which game is first.

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  // Three games from rows, so the feed has several clips to move between whatever else the database holds.
  for (let made = 0; made < 3; made += 1) {
    await forgetRateLimits();
    const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
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

test("the clip that fills the window is the current one, and only one is; the others wait at their start", async ({
  page,
}) => {
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
});

test("each key moves one clip, never before the first", async ({ page }) => {
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

test("keys pressed faster than the feed slides each still move one clip", async ({ page }) => {
  await openFeed(page);
  const clips = page.locator("section[data-slug]");
  // Two keys in one go, before the feed has started to slide: a person tapping Down twice, or a busy phone that hands
  // the page both at once. The page is given them together so the second always comes while the first is under way;
  // Playwright's own presses each wait for the browser and could come after the slide has ended.
  const pressTogether = (keys: string[]) =>
    page.evaluate((names) => {
      for (const key of names) window.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
    }, keys);

  await pressTogether(["ArrowDown", "ArrowDown"]);
  await expect(clips.nth(2)).toHaveAttribute("data-current", "true");
  await pressTogether(["ArrowUp", "ArrowUp"]);
  await expect(clips.nth(0)).toHaveAttribute("data-current", "true");
  // Back and on again at once: the second key counts from where the first was going, not from where the feed still is.
  await pressTogether(["ArrowDown", "ArrowUp", "ArrowDown"]);
  await expect(clips.nth(1)).toHaveAttribute("data-current", "true");
  // And it comes to rest there, the clip's top at the window's top.
  await expect
    .poll(() =>
      clips.nth(1).evaluate((clip) => {
        const feed = clip.closest("main.feed");
        return feed === null
          ? null
          : Math.round(clip.getBoundingClientRect().top - feed.getBoundingClientRect().top);
      }),
    )
    .toBe(0);
});

test("pressing the clip opens the game's page", async ({ page }) => {
  await openFeed(page);
  const clip = current(page);
  const slug = await clip.getAttribute("data-slug");
  const box = await boxOf(clip);
  // A press away from the words and the marks: the middle of the clip, a little above its centre.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
  await expect(page).toHaveURL(new RegExp(`/g/${slug ?? "?"}$`));
});

test("a swipe or a pointer resting on a clip, its name or Play asks the server for nothing; only the press that opens the game does", async ({
  page,
  context,
}) => {
  // Opening a game's page records who brought this person (the arrival cookie), so a clip a finger or pointer only
  // passed over must not load that page ahead of time.
  const asked: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/g/")) asked.push(path);
  });
  await openFeed(page);
  const first = (await current(page).getAttribute("data-slug")) ?? "?";
  const box = await boxOf(current(page));
  // A pointer comes to rest on the clip, a finger lands on it and lifts, a press starts on it, and then the feed moves.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.4);
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height * 0.4 + 2);
  await current(page)
    .locator("a.open")
    .evaluate((link) => {
      link.dispatchEvent(new Event("touchstart", { bubbles: true }));
      link.dispatchEvent(new Event("touchend", { bubbles: true }));
      link.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
  // The same on the game's name and on Play, where a swipe can start too (a load of Play's page counts a play).
  for (const link of [
    current(page).locator("a.gamelink"),
    current(page).getByRole("link", { name: "Play", exact: true }),
  ]) {
    await link.hover();
    await link.evaluate((element) => {
      element.dispatchEvent(new Event("touchstart", { bubbles: true }));
      element.dispatchEvent(new Event("touchend", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
  }
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(1)).toHaveAttribute("data-current", "true");
  const second = (await current(page).getAttribute("data-slug")) ?? "?";
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain("rk_arrival");

  // The press that opens the second game. Its page loads the same code a load ahead of time for the first would have,
  // so by the time it shows, any such load for the first would have been asked for.
  const next = await boxOf(current(page));
  await page.mouse.click(next.x + next.width / 2, next.y + next.height * 0.4);
  await expect(page).toHaveURL(new RegExp(`/g/${second}$`));
  await expect(page.locator("h1").first()).toBeVisible();
  expect(asked.filter((path) => path.startsWith(`/g/${first}/`) || path === `/g/${first}`)).toEqual([]);
});

test("Back from a game's page comes back to the clip it was opened from", async ({ page }) => {
  await openFeed(page);
  await page.keyboard.press("ArrowDown");
  const clips = page.locator("section[data-slug]");
  await expect(clips.nth(1)).toHaveAttribute("data-current", "true");
  const second = (await clips.nth(1).getAttribute("data-slug")) ?? "?";
  const box = await boxOf(clips.nth(1));
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
  await expect(page).toHaveURL(new RegExp(`/g/${second}$`));
  await page.goBack();
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await expect(current(page)).toHaveAttribute("data-slug", second);
});

test("Back from a game opened past the first page comes back to that very clip, not an earlier showing of it", async ({
  page,
}) => {
  await openFeed(page);
  const clips = page.locator("section[data-slug]");
  const before = await clips.count();
  // Past the first page: the feed goes round, so this game was shown once already on the first page.
  await page.locator("section.more").scrollIntoViewIfNeeded();
  await expect.poll(() => clips.count()).toBeGreaterThan(before);
  await expect(clips.nth(before)).toHaveAttribute("data-current", "true");
  const slug = (await clips.nth(before).getAttribute("data-slug")) ?? "?";
  const box = await boxOf(clips.nth(before));
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
  await expect(page).toHaveURL(new RegExp(`/g/${slug}$`));

  await page.goBack();
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await expect(current(page)).toHaveAttribute("data-slug", slug);
  // The very place: the clips that came on later pages are back, and the one on screen is the one that was opened.
  expect(
    await clips.evaluateAll((sections) =>
      sections.findIndex((section) => section.getAttribute("data-current") === "true"),
    ),
  ).toBe(before);
});

test("a reload on the first page shows the feed as it is now, not as it was kept", async ({ page }) => {
  await openFeed(page);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(1)).toHaveAttribute("data-current", "true");
  const slug = (await current(page).getAttribute("data-slug")) ?? "?";
  const name = (await current(page).getByRole("heading", { level: 2 }).textContent()) ?? "?";
  // A game's name changed while the person was away: here the kept copy of the clip on screen has an old name.
  // (The kept value is text in SvelteKit's own format, as in the journey below.)
  await page.addInitScript(() => {
    const keptName = "sveltekit:navigation-snapshot";
    const kept = JSON.parse(sessionStorage.getItem(keptName) ?? "{}") as Record<
      string,
      Record<string, string>
    >;
    let changed = 0;
    for (const values of Object.values(kept))
      for (const [id, text] of Object.entries(values)) {
        const parts = JSON.parse(text) as unknown[];
        const place = parts[0] as { clips?: number } | null;
        if (typeof place?.clips !== "number") continue;
        const second = parts[(parts[place.clips] as number[])[1] as number] as { name: number };
        parts[second.name] = "A name from before";
        values[id] = JSON.stringify(parts);
        changed++;
      }
    if (changed === 0) throw new Error("the feed kept no clips");
    sessionStorage.setItem(keptName, JSON.stringify(kept));
  });
  await page.reload();
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await expect(current(page)).toHaveAttribute("data-slug", slug);
  await expect(current(page).getByRole("heading", { level: 2 })).toHaveText(name);
  await expect(page.getByText("A name from before")).toHaveCount(0);
});

test("a reload whose kept feed is shorter than the fresh one puts back the kept feed, and the page keeps working", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFeed(page);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(1)).toHaveAttribute("data-current", "true");
  const slug = (await current(page).getAttribute("data-slug")) ?? "?";
  // While a person is away, more games can go live, so the feed the page comes back with can be longer than the one
  // it keeps. Here the kept feed is cut to its first two clips, and its keys are moved to a later round, as a place past
  // the first page is, so the kept clips are the ones put back. (Each kept value is text in SvelteKit's own format: a
  // list whose first item is the value, with every object, list and string inside it held by its place in the list.)
  await page.addInitScript(() => {
    const name = "sveltekit:navigation-snapshot";
    const kept = JSON.parse(sessionStorage.getItem(name) ?? "{}") as Record<string, Record<string, string>>;
    let cut = 0;
    for (const values of Object.values(kept))
      for (const [id, text] of Object.entries(values)) {
        const parts = JSON.parse(text) as unknown[];
        const place = parts[0] as { clips?: number } | null;
        if (typeof place?.clips !== "number") continue;
        parts[place.clips] = (parts[place.clips] as number[]).slice(0, 2);
        values[id] = JSON.stringify(
          parts.map((part) => (typeof part === "string" ? part.replace(/^0~/, "7~") : part)),
        );
        cut++;
      }
    if (cut === 0) throw new Error("the feed kept no clips");
    sessionStorage.setItem(name, JSON.stringify(kept));
  });
  await page.reload();
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await expect(current(page)).toHaveAttribute("data-slug", slug);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(2)).toHaveAttribute("data-current", "true");
  expect(errors).toEqual([]);
});

test("pressing the speaker flips sound for every clip, and it stays as set from one game to the next", async ({
  page,
}) => {
  await openFeed(page);
  await expect(soundButtons(page).first()).toHaveAttribute("aria-pressed", "false");
  const first = current(page).getByRole("button", { name: "Sound" });
  // The speaker is a mark in the corner, big enough for a thumb, not the whole clip.
  const box = await boxOf(first);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeLessThan((page.viewportSize()?.width ?? 0) / 2);
  // It is frosted glass, as every see-through surface is (look.css).
  const filter = await first.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter");
  });
  expect(filter).toMatch(/blur\(/);

  await first.click();
  for (const button of await soundButtons(page).all())
    await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(1)).toHaveAttribute("data-current", "true");
  await expect(soundButtons(page).nth(1)).toHaveAttribute("aria-pressed", "true");

  await current(page).getByRole("button", { name: "Sound" }).click();
  for (const button of await soundButtons(page).all())
    await expect(button).toHaveAttribute("aria-pressed", "false");
});

test("the press that opens the game never covers the speaker, Play, Share, the two links or the bar", async ({
  page,
}) => {
  await openFeed(page);
  const clip = current(page);
  const things = [
    clip.getByRole("button", { name: "Sound" }),
    clip.getByRole("link", { name: "Play", exact: true }),
    clip.getByRole("button", { name: "Share" }),
    clip.locator("a.gamelink"),
    page.getByRole("link", { name: "Home", exact: true }),
    page.getByRole("link", { name: "Add a game", exact: true }),
    page.getByRole("link", { name: "You", exact: true }),
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
    const sound = page.getByText(touch ? "Tap the speaker for sound" : "Click the speaker for sound");
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
    await expect(
      page.getByText(touch ? "Tap the speaker for sound" : "Click the speaker for sound"),
    ).toHaveCount(0);
  });

  test("go at the first press on the speaker", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/for sound$/)).toBeVisible();
    await soundButtons(page).first().click();
    await expect(page.getByText(/for sound$/)).toHaveCount(0);
  });

  test("are never there with no script", async ({ browser }) => {
    const context = await browser.newContext({
      ...consented,
      javaScriptEnabled: false,
      baseURL: "http://localhost:4173",
    });
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
    const context = await browser.newContext({
      ...consented,
      reducedMotion: "reduce",
      baseURL: "http://localhost:4173",
    });
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
      // A clip that may not move by itself waits at its first frame, and the speaker starts it without leaving the feed.
      const video = current(page).locator("video");
      await expect.poll(() => video.evaluate((clip: HTMLVideoElement) => clip.paused)).toBe(true);
      await current(page).getByRole("button", { name: "Sound" }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect.poll(() => video.evaluate((clip: HTMLVideoElement) => clip.paused)).toBe(false);
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
  expect(names.slice(0, 4)).toEqual(["Home", "Add a game", "You", "Sound"]);
  const play = names.indexOf("Play");
  expect(play).toBeGreaterThan(3);
  expect(names[play + 1]).toBe("Share");
  expect(names[play + 2]).toBe("Sound");
  for (const outline of outlines) expect(outline).not.toMatch(/^none/);
});

// The feed never ends (owner, 2026-11-22: "the feed should be infinite"). Near the end of what it has, it asks for the next
// page; past the last clip a spinner waits for it; when every game has been shown it goes round again.
test("the feed never ends: a spinner past the last clip, then more, then the same games again", async ({
  page,
}) => {
  // The next page is held until the spinner has been seen, so the journey waits on what is on screen, not on a clock.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/feed?*", async (route) => {
    await held;
    await route.continue();
  });
  await openFeed(page);
  const clips = page.locator("section[data-slug]");
  const before = await clips.count();

  // A fast swipe to the bottom: past the last clip is the spinner, and it says what it is waiting for.
  await page.locator("section.more").scrollIntoViewIfNeeded();
  const spinner = page.getByRole("progressbar", { name: "Loading more games" });
  await expect(spinner).toBeVisible();
  await expect(page.locator("section.more")).toHaveAttribute("aria-busy", "true");
  release();
  await expect.poll(() => clips.count()).toBeGreaterThan(before);
  // The person who waited is on the first clip that came, not left on the spinner as it moves down.
  await expect(clips.nth(before)).toHaveAttribute("data-current", "true");
  await expect(clips.nth(before)).toBeInViewport({ ratio: 0.9 });

  // Every live game came first; a game coming round again means the feed went round. With more than a page of games
  // in the shared database it can take more than one page.
  const repeats = async () => {
    const slugs = await clips.evaluateAll((sections) =>
      sections.map((section) => section.getAttribute("data-slug")),
    );
    return slugs.length - new Set(slugs).size;
  };
  for (let pages = 0; pages < 4 && (await repeats()) === 0; pages += 1) {
    const had = await clips.count();
    await page.locator("section.more").scrollIntoViewIfNeeded();
    await expect.poll(() => clips.count()).toBeGreaterThan(had);
  }
  expect(await repeats()).toBeGreaterThan(0);
  // One game is never shown twice in a row while two or more are live.
  const slugs = await clips.evaluateAll((sections) =>
    sections.map((section) => section.getAttribute("data-slug")),
  );
  if (new Set(slugs).size > 1) {
    for (let index = 1; index < slugs.length; index += 1) expect(slugs[index]).not.toBe(slugs[index - 1]);
  }

  // The keys go on past where the first page ended.
  await clips.nth(before).scrollIntoViewIfNeeded();
  await expect(clips.nth(before)).toHaveAttribute("data-current", "true");
  await page.keyboard.press("ArrowDown");
  await expect(clips.nth(before + 1)).toHaveAttribute("data-current", "true");

  // A feed that never ends holds only the clips near the person: every clip more than one behind has let go of its video,
  // so a long scroll does not keep every clip it passed.
  await expect
    .poll(() =>
      clips.evaluateAll((sections) => {
        const at = sections.findIndex((section) => section.getAttribute("data-current") === "true");
        return (
          sections
            .slice(0, Math.max(at - 1, 0))
            .map((section, index) => ({ index, video: section.querySelector("video") }))
            // Let go: no address, nothing loaded and nothing being fetched. (`currentSrc` keeps the old address after a
            // video lets go in Chromium, so it says nothing here.)
            .filter(
              ({ video }) =>
                video !== null &&
                (video.hasAttribute("src") ||
                  video.readyState > HTMLMediaElement.HAVE_NOTHING ||
                  video.networkState !== HTMLMediaElement.NETWORK_EMPTY),
            )
            .map(({ index }) => index)
        );
      }),
    )
    .toEqual([]);
});

test("when more games do not come, the feed says so and Try again brings them", async ({ page }) => {
  let refuse = true;
  await page.route("**/api/feed?*", async (route) => {
    if (refuse) await route.fulfill({ status: 500, body: "" });
    else await route.continue();
  });
  await openFeed(page);
  const clips = page.locator("section[data-slug]");
  const before = await clips.count();

  await page.locator("section.more").scrollIntoViewIfNeeded();
  await expect(page.getByText("Couldn't load more games.")).toBeVisible();
  const again = page.getByRole("button", { name: "Try again" });
  await expect(again).toBeVisible();
  expect((await boxOf(again)).height).toBeGreaterThanOrEqual(48);

  refuse = false;
  await again.click();
  await expect.poll(() => clips.count()).toBeGreaterThan(before);
  await expect(page.getByText("Couldn't load more games.")).toHaveCount(0);
});
