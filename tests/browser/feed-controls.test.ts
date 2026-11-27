import { expect, test, type Locator, type Page } from "@playwright/test";
import { gameWhere } from "./support/game.ts";
import { boxOf, wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { consented } from "./support/consent.ts";

// What a person does to the feed (spec 5.1): swipe or press keys to move a clip at a time, press the clip to open its game's
// page, press the speaker for sound, share
// a game, and meet two hints on the first open. The journeys share one database, so the feed holds every game any
// journey made; none of them depends on which game is first.

// The games this file made, with clips this browser can play (`realClip`): other files' games may carry the other kind.
const ours: string[] = [];

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  // Three games from rows, so the feed has several clips to move between whatever else the database holds.
  for (let made = 0; made < 3; made += 1) {
    await forgetRateLimits();
    const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
    try {
      ours.push((await gameWhere(await context.newPage(), { state: "live" })).slug);
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
  // A clip's still is asked for at /api/still/clips/…: a small picture, not the clip, so it is counted on its own.
  const stills = new Set<string>();
  page.on("request", (request) => {
    const url = request.url().split("#")[0] ?? "";
    if (url.includes("/api/still/")) stills.add(url);
    else if (url.includes("/clips/")) asked.add(url);
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
  // Stills are asked for only near the clip on screen: it and the three after it, at the top of the feed.
  expect(stills.size).toBeLessThanOrEqual(4);
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

/**
 * Waits until the clip is really playing: not paused, and its time has moved on from its start. A busy machine can take
 * a few seconds to hand a clip its data; a clip that stalls stays at its start (0.001 s) and never gets here.
 */
async function isPlaying(video: Locator): Promise<void> {
  await expect(video).toHaveJSProperty("paused", false);
  await expect
    .poll(async () => await video.evaluate((element: HTMLVideoElement) => element.currentTime), {
      message: "the clip's time moves on from its start",
      timeout: 15_000,
    })
    .toBeGreaterThan(0.05);
}

/** What a clip has done since `watchClip` started on it: how far it got, whether it came back round, how many jumps. */
interface Watched {
  furthest: number;
  cameBack: boolean;
  jumps: number;
  /** Whether the browser's own loop was ever on while watched: the clip must loop by hand (`loopByHand`). */
  loopWasOn: boolean;
}

/**
 * Watches a clip until it has played past 0.5 s and come back round, and gives what it saw. Its time is read every 50
 * ms as well as on `timeupdate`, which comes only every quarter second or so, and less often on a busy machine. The bar
 * is low on purpose: in this engine a clip's loops grow shorter after a few rounds (progress.md), and a clip that stalls
 * never gets past 0 s. The page keeps what it saw and the journey asks for it, rather than the page holding one answer
 * open for seconds: in WebKit under load, such an answer sometimes never came back (#372's review).
 */
async function watchClip(video: Locator, label: string): Promise<Watched> {
  await video.evaluate((element: HTMLVideoElement) => {
    // A second watch on the same clip first stops the first one, so only one watcher reads it at a time.
    (element as HTMLVideoElement & { stopWatching?: () => void }).stopWatching?.();
    const seen: Watched = { furthest: 0, cameBack: false, jumps: 0, loopWasOn: false };
    const look = () => {
      if (element.loop) seen.loopWasOn = true;
      if (seen.furthest > 0.5 && element.currentTime < 0.5) seen.cameBack = true;
      seen.furthest = Math.max(seen.furthest, element.currentTime);
    };
    const jumped = () => (seen.jumps += 1);
    element.addEventListener("seeking", jumped);
    element.addEventListener("timeupdate", look);
    const reader = setInterval(look, 50);
    const stopWatching = () => {
      clearInterval(reader);
      element.removeEventListener("seeking", jumped);
      element.removeEventListener("timeupdate", look);
    };
    Object.assign(element, { watched: seen, stopWatching });
  });
  const seen = async (): Promise<Watched> =>
    await video.evaluate((element: HTMLVideoElement) => ({
      ...(element as HTMLVideoElement & { watched: Watched }).watched,
    }));
  await expect
    .poll(async () => await seen(), {
      message: `${label}: the clip plays past 0.5 s and comes back round`,
      timeout: 15_000,
    })
    .toMatchObject({ cameBack: true })
    .catch(async (error: unknown) => {
      // Says whether the page was stuck or only slow: once it answers (it may take a while on a busy machine), how far
      // the clip got and how often it jumped. A clip that jumps back to its start over and over shows hundreds of jumps.
      const asked = Date.now();
      const late = await video
        .evaluate(
          (element: HTMLVideoElement) => ({
            ...(element as HTMLVideoElement & { watched: Watched }).watched,
            now: element.currentTime,
            loop: element.loop,
            paused: element.paused,
          }),
          undefined,
          { timeout: 40_000 },
        )
        .catch(() => "no answer in 40 s");
      throw new Error(
        `${String(error)}\nthe page answered after ${String(Date.now() - asked)} ms: ${JSON.stringify(late)}`,
      );
    });
  return await seen();
}

test("the clip on screen plays through and starts again, and again after a person comes back to it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Safari's engine on Linux, given a looping video whose address names a start time (every clip's `#t=0.001`), jumped
  // back to the start about a hundred times a second and never played, and a clip whose `loop` was switched on while it
  // played sometimes stopped the page for good at its end (progress.md, Flaky tests). So the clip loops by hand.
  const [slug] = ours;
  if (slug === undefined) throw new Error("this file's beforeAll made no game, so there is no clip to watch");
  await openFeed(page);
  const clip = page.locator(`section[data-slug="${slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toHaveAttribute("data-current", "true");
  const video = clip.locator("video");
  await isPlaying(video);

  const first = await watchClip(video, "the first time");
  expect(first.furthest, "how far the clip played").toBeGreaterThan(0.5);
  expect(first.jumps, "jumps in one round of a two-second clip").toBeLessThanOrEqual(5);
  expect(first.loopWasOn, "the browser's own loop was on while the clip played").toBe(false);

  // Away and back: the clip a person left waits at its start, and plays again from there.
  await page.keyboard.press("ArrowDown");
  await expect(clip).toHaveAttribute("data-current", "false");
  await page.keyboard.press("ArrowUp");
  await expect(clip).toHaveAttribute("data-current", "true");
  await isPlaying(video);
  const again = await watchClip(video, "the second time");
  expect(again.furthest, "how far the clip played the second time").toBeGreaterThan(0.5);
  expect(again.jumps, "jumps in one round, the second time").toBeLessThanOrEqual(5);
  expect(again.loopWasOn, "the browser's own loop was on, the second time").toBe(false);
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

test("a key pressed while the feed slides still moves it when the browser never says the slide ended", async ({
  page,
}) => {
  // Safari's engine on a busy machine sometimes sends no `scrollend` for a slide. A key that waited for that slide
  // must still be carried out once the feed stops waiting, never dropped.
  await page.addInitScript(() => {
    window.addEventListener(
      "scrollend",
      (event) => {
        event.stopImmediatePropagation();
      },
      { capture: true },
    );
  });
  await openFeed(page);
  const clips = page.locator("section[data-slug]");
  await page.keyboard.press("ArrowUp");
  await expect(clips.nth(0)).toHaveAttribute("data-current", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(clips.nth(1)).toHaveAttribute("data-current", "true");
  await expect(clips.nth(0)).toHaveAttribute("data-current", "true", { timeout: 10_000 });
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

test("a slide that never moves does not hold the keys for long", async ({ page }) => {
  await openFeed(page);
  const clips = page.locator("section[data-slug]");
  // The first slide asked for goes nowhere, so no end of it ever comes: the feed must stop waiting for it by itself.
  await page.evaluate(() => {
    const slide = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
    Element.prototype.scrollIntoView = function () {
      if (slide) Object.defineProperty(Element.prototype, "scrollIntoView", slide);
    };
  });
  await page.keyboard.press("ArrowDown");
  await expect(clips.nth(0)).toHaveAttribute("data-current", "true");
  // A few seconds on, a key moves the feed again. Keys pressed before then are still held, so the journey presses until
  // one is heard, and each press moves at most one clip.
  await expect(async () => {
    await page.keyboard.press("ArrowDown");
    await expect(clips.nth(1)).toHaveAttribute("data-current", "true", { timeout: 1000 });
  }).toPass({ timeout: 6000 });
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
  // it keeps. Here the kept feed is cut to its first two clips, and only the first of them counts as the first page, so
  // the place is past it and the kept clips are the ones put back. (Each kept value is text in SvelteKit's own format: a
  // list whose first item is the value, with every object, list and string inside it held by its place in the list.)
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/feed?*", async (route) => {
    await held;
    await route.continue();
  });
  await page.addInitScript(() => {
    const name = "sveltekit:navigation-snapshot";
    const kept = JSON.parse(sessionStorage.getItem(name) ?? "{}") as Record<string, Record<string, string>>;
    let cut = 0;
    for (const values of Object.values(kept))
      for (const [id, text] of Object.entries(values)) {
        const parts = JSON.parse(text) as unknown[];
        const place = parts[0] as { clips?: number; firstCount?: number } | null;
        if (typeof place?.clips !== "number" || typeof place.firstCount !== "number") continue;
        parts[place.clips] = (parts[place.clips] as number[]).slice(0, 2);
        parts[place.firstCount] = 1;
        values[id] = JSON.stringify(parts);
        cut++;
      }
    if (cut === 0) throw new Error("the feed kept no clips");
    sessionStorage.setItem(name, JSON.stringify(kept));
  });
  await page.reload();
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await expect(current(page)).toHaveAttribute("data-slug", slug);
  // On to the spinner while the next page is held, and back up: the way up is the last kept clip.
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("progressbar", { name: "Loading more games" })).toBeInViewport();
  await expect(current(page)).toHaveCount(0);
  // A touch on the spinner makes the feed forget where the last key sent it, so the way up comes from what is on screen.
  await page.getByRole("progressbar", { name: "Loading more games" }).dispatchEvent("pointerdown");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("section[data-slug]").nth(1)).toHaveAttribute("data-current", "true");
  release();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(2)).toHaveAttribute("data-current", "true");
  expect(errors).toEqual([]);
});

test("a reload on a game that came off while the person was away starts from the top, without that game", async ({
  page,
}) => {
  await openFeed(page);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(1)).toHaveAttribute("data-current", "true");
  // The kept copy of the clip on screen becomes a game that is no longer on Ruken. (SvelteKit's format, as above.)
  await page.addInitScript(() => {
    const name = "sveltekit:navigation-snapshot";
    const kept = JSON.parse(sessionStorage.getItem(name) ?? "{}") as Record<string, Record<string, string>>;
    let changed = 0;
    for (const values of Object.values(kept))
      for (const [id, text] of Object.entries(values)) {
        const parts = JSON.parse(text) as unknown[];
        const place = parts[0] as { clips?: number; key?: number } | null;
        if (typeof place?.clips !== "number" || typeof place.key !== "number") continue;
        const second = parts[(parts[place.clips] as number[])[1] as number] as { key: number; slug: number };
        parts[second.key] = "0~a-game-taken-off";
        parts[second.slug] = "a-game-taken-off";
        parts[place.key] = "0~a-game-taken-off";
        values[id] = JSON.stringify(parts);
        changed++;
      }
    if (changed === 0) throw new Error("the feed kept no clips");
    sessionStorage.setItem(name, JSON.stringify(kept));
  });
  await page.reload();
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await expect(page.locator('section[data-slug="a-game-taken-off"]')).toHaveCount(0);
  // The top is the fresh first page's first clip; other journeys can make games live meanwhile, so it is found by place.
  await expect(page.locator("section[data-slug]").first()).toHaveAttribute("data-current", "true");
});

test("pressing the speaker flips sound for every clip, and it stays as set from one game to the next", async ({
  page,
}) => {
  await openFeed(page);
  // One speaker for the whole feed, in the top bar with the tabs and Search (the owner, 2026-11-27: "they need to be
  // grouped together as a unit"), so it never travels with the clips.
  const speaker = soundButtons(page);
  await expect(speaker).toHaveCount(1);
  await expect(speaker).toHaveAttribute("aria-pressed", "false");
  // The speaker is a mark in the corner, big enough for a thumb, not the whole clip.
  const box = await boxOf(speaker);
  expect(box.width).toBeGreaterThanOrEqual(48);
  expect(box.height).toBeGreaterThanOrEqual(48);
  expect(box.width).toBeLessThan((page.viewportSize()?.width ?? 0) / 2);
  // It is frosted glass, as every see-through surface is (look.css).
  const filter = await speaker.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter");
  });
  expect(filter).toMatch(/blur\(/);

  await speaker.click();
  await expect(speaker).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(1)).toHaveAttribute("data-current", "true");
  await expect(speaker).toHaveAttribute("aria-pressed", "true");
  // The next clip has come up, and the speaker is where it was.
  expect(await boxOf(speaker)).toEqual(box);

  await speaker.click();
  await expect(speaker).toHaveAttribute("aria-pressed", "false");
});

test("the press that opens the game never covers the speaker, Play, Share, the two links or the bar", async ({
  page,
}) => {
  await openFeed(page);
  const clip = current(page);
  const things = [
    soundButtons(page),
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
  // Share opens Ruken's own sheet (the owner, 2026-11-24: "our share uses native and not a custom share"): Copy link,
  // the apps, and the phone's own sheet as "More" where there is one.
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
  const sheetOf = (page: Page) => page.getByRole("dialog", { name: "Share" });

  test("opens Ruken's own sheet with the game's link, never the phone's sheet first, and copies the link", async ({
    page,
  }) => {
    await standIns(page, { share: "works", clipboard: "works" });
    await openFeed(page);
    const slug = await currentSlug(page);
    const name = (await current(page).getByRole("heading", { level: 2 }).textContent()) ?? "";
    const address = `${new URL(page.url()).origin}/g/${String(slug)}`;
    await current(page).getByRole("button", { name: "Share" }).click();
    const sheet = sheetOf(page);
    await expect(sheet).toBeVisible();
    expect((await seenOf(page)).shared).toEqual([]);
    await expect(sheet.getByText(name, { exact: true })).toBeVisible();
    await expect(sheet.getByText(address, { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Copy link" }).click();
    await expect(sheet.getByRole("status")).toHaveText("Link copied.");
    expect((await seenOf(page)).copied).toEqual([address]);
  });

  test("offers the apps, each with the game's link written in, and Instagram with it copied to paste", async ({
    page,
  }) => {
    await standIns(page, { share: "none", clipboard: "works" });
    await openFeed(page);
    const slug = await currentSlug(page);
    const address = `${new URL(page.url()).origin}/g/${String(slug)}`;
    await current(page).getByRole("button", { name: "Share" }).click();
    const sheet = sheetOf(page);
    for (const app of ["Text", "WhatsApp", "Email", "X"]) {
      const href = (await sheet.getByRole("link", { name: app, exact: true }).getAttribute("href")) ?? "";
      expect(decodeURIComponent(href), app).toContain(address);
    }
    await expect(sheet.getByRole("link", { name: "Facebook" })).toHaveCount(0);
    // Instagram takes no words in its address: the press copies the link and opens Instagram's messages beside the
    // sheet, and the sheet says to paste it there.
    const instagram = sheet.getByRole("link", { name: "Instagram", exact: true });
    await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/direct/inbox/");
    await expect(instagram).toHaveAttribute("target", "_blank");
    // The new tab is not followed: Instagram is outside this test's reach.
    await page.context().route("https://www.instagram.com/**", (route) => route.fulfill({ body: "" }));
    const opened = page.context().waitForEvent("page");
    await instagram.click();
    await (await opened).close();
    await expect(sheet.getByRole("status")).toHaveText("Link copied. Paste it in Instagram.");
    expect((await seenOf(page)).copied).toEqual([address]);
    // No phone sheet here, so no More.
    await expect(sheet.getByRole("button", { name: "More" })).toHaveCount(0);
  });

  test("says how to copy the link by hand when the clipboard refuses", async ({ page }) => {
    await standIns(page, { share: "none", clipboard: "refuses" });
    await openFeed(page);
    await current(page).getByRole("button", { name: "Share" }).click();
    const sheet = sheetOf(page);
    await sheet.getByRole("button", { name: "Copy link" }).click();
    await expect(sheet.getByRole("status")).toHaveText(/copy it\.$/);
  });

  test("More opens the phone's own sheet with the game's page, and closing it says nothing", async ({
    page,
  }) => {
    await standIns(page, { share: "closes", clipboard: "works" });
    await openFeed(page);
    const slug = await currentSlug(page);
    await current(page).getByRole("button", { name: "Share" }).click();
    const sheet = sheetOf(page);
    await sheet.getByRole("button", { name: "More" }).click();
    await expect.poll(async () => (await seenOf(page)).shared.length).toBe(1);
    expect((await seenOf(page)).shared[0]?.url).toBe(`${new URL(page.url()).origin}/g/${String(slug)}`);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("status")).toHaveText("");
  });

  test("keys pressed while the sheet is open never move the feed behind it", async ({ page }) => {
    await standIns(page, { share: "none", clipboard: "works" });
    await openFeed(page);
    const clips = page.locator("section[data-slug]");
    await expect(clips.nth(0)).toHaveAttribute("data-current", "true");
    // Every scroll of the feed is counted, the feed's own moves and the browser's own key scrolling alike.
    await page.evaluate(() => {
      const moved = { scrolls: 0 };
      (window as unknown as { moved: typeof moved }).moved = moved;
      document.querySelector("main.feed")?.addEventListener("scroll", () => (moved.scrolls += 1));
    });
    await current(page).getByRole("button", { name: "Share" }).click();
    const sheet = sheetOf(page);
    await expect(sheet.getByRole("button", { name: "Copy link" })).toBeFocused();
    for (const key of ["ArrowDown", "PageDown", "ArrowUp", "PageUp"]) await page.keyboard.press(key);
    // A sheet can lose its focus to the page while it stays open (a button inside it goes away when it changes what
    // it shows). The keys still move nothing behind it.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    for (const key of ["ArrowDown", "PageDown", "End", "Space"]) await page.keyboard.press(key);
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    // A smooth scroll the keys started lands a while later, so the check waits until the feed has been still for a
    // whole second (or 5 seconds have gone) before it looks.
    await page.evaluate(
      () =>
        new Promise<void>((done) => {
          const moved = (window as unknown as { moved: { scrolls: number } }).moved;
          let seen = moved.scrolls;
          let still = 0;
          const timer = setInterval(() => {
            still = moved.scrolls === seen ? still + 1 : 0;
            seen = moved.scrolls;
            if (still >= 10) {
              clearInterval(timer);
              done();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(timer);
            done();
          }, 5000);
        }),
    );
    expect(
      await page.evaluate(() => (window as unknown as { moved: { scrolls: number } }).moved.scrolls),
    ).toBe(0);
    await expect(clips.nth(0)).toHaveAttribute("data-current", "true");
  });

  test("the cross, Escape and the dimmed screen each close it, and focus goes back to Share", async ({
    page,
  }) => {
    await standIns(page, { share: "none", clipboard: "works" });
    await openFeed(page);
    const share = current(page).getByRole("button", { name: "Share" });
    const sheet = sheetOf(page);

    await share.click();
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await expect(share).toBeFocused();

    await share.press("Enter");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Copy link" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(share).toBeFocused();

    await share.click();
    await expect(sheet).toBeVisible();
    // A press on the dimmed screen, well above the panel.
    await page.mouse.click(5, 5);
    await expect(sheet).toBeHidden();
  });

  test("slides up and fades in, and slides away when it closes; with reduced motion it simply comes and goes", async ({
    page,
    browser,
  }) => {
    // The animations the sheet runs as it opens and closes are written down, by name, from before the first press.
    const played = async (on: Page) => {
      await on.evaluate(() => {
        const names: string[] = [];
        (window as unknown as { played: string[] }).played = names;
        // Each time the sheet opens or starts to close, the animations it then runs are asked for.
        new MutationObserver((changes) => {
          for (const change of changes) {
            const dialog = change.target as Element;
            if (!dialog.matches("dialog.sharesheet")) continue;
            for (const animation of dialog.getAnimations()) {
              if ((animation.effect as KeyframeEffect | null)?.pseudoElement) continue;
              // Without the mark Svelte adds to a screen's own animation names.
              const name = (animation as CSSAnimation).animationName.replace(/^svelte-[a-z0-9]+-/, "");
              if (names.at(-1) !== name) names.push(name);
            }
          }
        }).observe(document.body, { subtree: true, attributeFilter: ["open", "class"] });
      });
      return () => on.evaluate(() => (window as unknown as { played: string[] }).played);
    };
    await standIns(page, { share: "none", clipboard: "works" });
    await openFeed(page);
    const names = await played(page);
    const upright = (await page.evaluate(
      () => matchMedia("(orientation: portrait) and (max-width: 47.99rem)").matches,
    ))
      ? { open: "sheet-up", shut: "sheet-down" }
      : { open: "sheet-in", shut: "sheet-out" };
    const share = current(page).getByRole("button", { name: "Share" });
    const sheet = sheetOf(page);
    await share.click();
    await expect(sheet).toBeVisible();
    await expect.poll(names).toEqual([upright.open]);
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await expect(share).toBeFocused();
    expect(await names()).toEqual([upright.open, upright.shut]);
    // Escape slides it away the same way.
    await share.press("Enter");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(share).toBeFocused();
    expect(await names()).toEqual([upright.open, upright.shut, upright.open, upright.shut]);

    const context = await browser.newContext({
      ...consented,
      reducedMotion: "reduce",
      baseURL: "http://localhost:4173",
    });
    try {
      const still = await context.newPage();
      await openFeed(still);
      const stillNames = await played(still);
      const stillShare = current(still).getByRole("button", { name: "Share" });
      await stillShare.click();
      await expect(sheetOf(still)).toBeVisible();
      await sheetOf(still).getByRole("button", { name: "Close" }).click();
      await expect(sheetOf(still)).toBeHidden();
      await expect(stillShare).toBeFocused();
      expect(await stillNames()).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("fits the window with nothing to scroll", async ({ page }) => {
    await standIns(page, { share: "works", clipboard: "works" });
    await openFeed(page);
    await current(page).getByRole("button", { name: "Share" }).click();
    const sheet = sheetOf(page);
    await expect(sheet).toBeVisible();
    await sheet.evaluate(async (dialog) => {
      await Promise.all(dialog.getAnimations({ subtree: true }).map((one) => one.finished));
    });
    const box = (await sheet.boundingBox()) ?? { y: -1, height: Infinity };
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) + 1);
    const inside = sheet.locator(".inside");
    expect(await inside.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    for (const target of await sheet.locator("a, button").all()) {
      const size = await target.boundingBox();
      expect(size?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(size?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
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
    await soundButtons(page).click();
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
      await soundButtons(page).click();
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
  for (let presses = 0; presses < 17; presses += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (element === null) return null;
      const label =
        element.getAttribute("aria-label") ?? (element as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      const style = getComputedStyle(element);
      // The bar's ring is a shadow in the button's own shape (the owner, 2026-11-27: no square ring there); the rest is an
      // outline.
      const ring =
        element.closest("nav.bar") !== null ? style.boxShadow : `${style.outlineStyle} ${style.outlineWidth}`;
      return { label, outline: ring };
    });
    names.push(focused?.label ?? "");
    outlines.push(focused?.outline ?? "");
  }
  // The bar first (it is always there), then the feed's top bar from the left (the speaker, the tabs and Search, there
  // once for the whole feed), then the first clip's controls: the band (the game, Play), then the column on the right
  // from its top, which starts with the maker and their plus when the game's maker has a page, then the marks and Share,
  // then the next clip's, from its game and Play again.
  expect(names.slice(0, 7)).toEqual(["Home", "Add a game", "You", "Sound", "Fresh", "Followed", "Search"]);
  const play = names.indexOf("Play");
  expect(play).toBeGreaterThan(6);
  const plus = names[play + 2] ?? "";
  const marks = plus.startsWith("Follow ") ? play + 3 : play + 1;
  // The link's words include the first letter drawn when the maker has no photo, so the name is looked for inside them.
  if (marks === play + 3) expect(names[play + 1]).toContain(plus.slice("Follow ".length));
  // Like, Save and Repost stand above Share in the clip's right column (learned-feed spec 6.1), under the maker; then
  // the next clip's game and its Play.
  expect(names.slice(marks, marks + 4)).toEqual(["Like", "Save", "Repost", "Share"]);
  expect(names[marks + 5]).toBe("Play");
  for (const outline of outlines.slice(0, 3)) expect(outline).toMatch(/0px 0px 0px 3px/);
  for (const outline of outlines.slice(3)) expect(outline).not.toMatch(/^none/);
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
