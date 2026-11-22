import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pageHasSettled, signUp } from "./support/account.ts";
import { letInTerminal, terminal } from "./support/computers.ts";
import { addDraft, realClip, tooBigVideo } from "./support/game.ts";
import { forgetRateLimits, journeyClientHeaders } from "./support/rate-limits.ts";

// A maker's computer: signing in from a terminal with a Yes on Ruken, Your computers, the key's reach, and videos sent
// from the command line (spec 2026-11-22-ruken-from-your-computer-design.md, criteria A2 to A5, A9, A11 and A14).

test.beforeEach(forgetRateLimits);
test.setTimeout(120_000);

const KEY_HEADER = (key: string) => ({ authorization: `Bearer ${key}`, ...journeyClientHeaders() });

test("a computer is let in with a Yes, uses Ruken, and is taken out again", async ({ page }) => {
  await signUp(page);
  const { slug, name } = await addDraft(page);
  const computer = terminal("Journey laptop");

  // Not signed in: told plainly what to type.
  expect(await computer.run("whoami")).toBe(1);
  expect(computer.text()).toContain("npx ruken sign-in");

  await letInTerminal(page, computer);
  expect(computer.text()).toMatch(
    /Open http:\/\/localhost:4173\/me\/link and press Yes\. Your code is [A-Z]{4}-[A-Z]{4}\./,
  );
  expect(computer.text()).toContain("Signed in as ");
  expect(computer.key()).toMatch(/^rk_[a-z2-7]{52}$/);
  // The key is never said.
  expect(computer.text()).not.toContain(computer.key() ?? "never");

  expect(await computer.run("whoami")).toBe(0);
  expect(await computer.run("games")).toBe(0);
  expect(computer.text()).toContain(name);
  expect(await computer.run("game", slug)).toBe(0);
  expect(computer.text()).toContain("Upright video: not added yet");

  // A real clip goes up as it is.
  const clip = await realClip(page, "upright");
  const file = join(mkdtempSync(join(tmpdir(), "ruken-clip-")), clip.name);
  writeFileSync(file, clip.buffer);
  expect(await computer.run("video", slug, "upright", file)).toBe(0);
  expect(computer.text()).toContain("video is in");
  computer.said.length = 0;
  expect(await computer.run("game", slug)).toBe(0);
  expect(computer.text()).toContain("Upright video: added");

  // Your computers lists it; renaming shows; removing stops it at once.
  await page.goto("/me/computers");
  await pageHasSettled(page);
  await expect(page.getByText("Journey laptop").first()).toBeVisible();
  await page.getByLabel("Its name").fill("Study desktop");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByText("Renamed.")).toBeVisible();
  await expect(page.getByText("Study desktop").first()).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("No computers can use your Ruken.")).toBeVisible();

  expect(await computer.run("whoami")).toBe(1);
  expect(computer.said.at(-1)).toContain("Sign in again");
});

test("pressing No sends the terminal away, and a code works for one Yes", async ({ page }) => {
  await signUp(page);
  const computer = terminal();
  const signingIn = computer.run("sign-in");
  const code = await computer.codeShown();
  await page.goto(`/me/link?code=${code}`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No problem" })).toBeVisible();
  expect(await signingIn).toBe(1);
  expect(computer.text()).toContain("You pressed No");
  expect(computer.key()).toBeNull();

  // The same code is used up: a second visit has nothing to answer.
  await page.goto(`/me/link?code=${code}`);
  await expect(page.getByRole("button", { name: "Yes", exact: true })).toHaveCount(0);
});

test("a computer signs out, and the key stops at once", async ({ page, request }) => {
  await signUp(page);
  const computer = terminal();
  await letInTerminal(page, computer);
  const key = computer.key() ?? "";
  expect(await computer.run("sign-out")).toBe(0);
  expect(computer.key()).toBeNull();
  const answer = await request.get("/api/v1/me", { headers: KEY_HEADER(key) });
  expect(answer.status()).toBe(401);
});

test("the key reaches only the maker's API; the cookie never does", async ({ page, request }) => {
  const maker = await signUp(page);
  const computer = terminal();
  await letInTerminal(page, computer);
  const key = computer.key() ?? "";

  expect((await request.get("/api/v1/me", { headers: KEY_HEADER(key) })).status()).toBe(200);
  // The key opens no screen: not the account, not Your computers, not the link screen.
  for (const path of ["/me", "/me/computers", "/me/link", "/make"]) {
    const answer = await request.get(path, { headers: KEY_HEADER(key), maxRedirects: 0 });
    expect(answer.status(), path).toBeGreaterThanOrEqual(300);
    expect(answer.status(), path).toBeLessThan(400);
    expect(answer.headers().location, path).toContain("/sign-in");
  }
  // A signed-in browser cookie is no key under /api/v1.
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((one) => `${one.name}=${one.value}`).join("; ");
  const withCookie = await request.get("/api/v1/me", {
    headers: { cookie: cookieHeader, ...journeyClientHeaders() },
  });
  expect(withCookie.status()).toBe(401);
  expect(maker.number).toBeTruthy();

  // A key that was never made is the same plain 401.
  const stranger = await request.get("/api/v1/me", { headers: KEY_HEADER(`rk_${"a".repeat(52)}`) });
  expect(stranger.status()).toBe(401);
  expect(await stranger.json()).toEqual({ problem: expect.stringContaining("Sign in again") });
});

test("another maker's game is a 404, as if it were not there", async ({ page, browser }) => {
  await signUp(page);
  const { slug } = await addDraft(page);

  const otherContext = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    const other = await otherContext.newPage();
    await signUp(other);
    const computer = terminal("Other laptop");
    await letInTerminal(other, computer);
    expect(await computer.run("game", slug)).toBe(1);
    expect(computer.said.at(-1)).toContain("find");
    expect(await computer.run("keep-old", slug, "upright")).toBe(1);
    const file = join(mkdtempSync(join(tmpdir(), "ruken-clip-")), "upright.webm");
    writeFileSync(file, (await realClip(other, "upright")).buffer);
    expect(await computer.run("video", slug, "upright", file)).toBe(1);
  } finally {
    await otherContext.close();
  }
});

test("a video that is too big, not a video, or sent with no length is refused", async ({ page, request }) => {
  await signUp(page);
  const { slug } = await addDraft(page);
  const computer = terminal();
  await letInTerminal(page, computer);
  const folder = mkdtempSync(join(tmpdir(), "ruken-big-"));

  // 31 MB: told before it is read, and nothing is sent.
  const big = await tooBigVideo(join(folder, "big.mp4"));
  expect(await computer.run("video", slug, "upright", big)).toBe(1);
  expect(computer.said.at(-1)).toMatch(/up to 30\.0 MB/);

  // A text file called .mp4 is read by Ruken and turned away.
  const fake = join(folder, "fake.mp4");
  writeFileSync(fake, "this is only words, not a video, however long it is");
  expect(await computer.run("video", slug, "upright", fake)).toBe(1);

  // A kind Ruken does not take.
  const gif = join(folder, "funny.gif");
  writeFileSync(gif, Buffer.alloc(64));
  expect(await computer.run("video", slug, "upright", gif)).toBe(1);
  expect(computer.said.at(-1)).toContain("MP4, WebM or MOV");

  // Straight at Ruken: a length over the limit is a 413 before the body is read, and no length at all is a 411.
  const key = computer.key() ?? "";
  const tooMuch = await request.put(`/api/v1/games/${slug}/videos/upright`, {
    headers: { ...KEY_HEADER(key), "content-type": "video/mp4" },
    data: Buffer.alloc(30_000_001),
  });
  expect(tooMuch.status()).toBe(413);
  const noLength = await fetch(`http://localhost:4173/api/v1/games/${slug}/videos/upright`, {
    method: "PUT",
    headers: { ...KEY_HEADER(key), "content-type": "video/mp4" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(10));
        controller.close();
      },
    }),
    // @ts-expect-error Node's fetch needs this word to send a stream.
    duplex: "half",
  });
  expect(noLength.status).toBe(411);
});

test("a wrong secret gets no key, and five wrong typed codes pause the screen", async ({ page, request }) => {
  await signUp(page);
  const start = await request.post("/api/v1/sign-in/start", { data: { name: "Fake" } });
  expect(start.status()).toBe(200);
  const { code } = (await start.json()) as { code: string };
  const wrong = await request.post("/api/v1/sign-in/finish", {
    data: { code, deviceSecret: "not-the-secret" },
  });
  expect([403, 404]).toContain(wrong.status());

  await page.goto("/me/link");
  await pageHasSettled(page);
  for (let tries = 0; tries < 6; tries += 1) {
    const typed = `ZZZZ-ZZZ${String.fromCharCode(65 + tries)}`;
    await page.getByLabel("Your code").fill(typed);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(new RegExp(`code=${typed}`));
    await expect(page.getByRole("alert")).toBeVisible();
    await pageHasSettled(page);
  }
  await expect(page.getByRole("alert")).toContainText("Too many wrong codes");
});
