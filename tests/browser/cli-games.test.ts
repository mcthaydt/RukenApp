import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pageHasSettled, signUp } from "./support/account.ts";
import { letInTerminal, terminal } from "./support/computers.ts";
import { showsPlayerCountOf, stateOf } from "./support/database.ts";
import { freshName, realClip, reviewJob, TINY_GAME } from "./support/game.ts";
import { forgetRateLimits, journeyClientHeaders } from "./support/rate-limits.ts";

// A maker's games from a terminal: every row of the spec's games and GitHub tables, each step read back with `game` and
// in the browser (spec 2026-11-22-ruken-from-your-computer-design.md, criteria A5, A6 and A7).

test.beforeEach(forgetRateLimits);
test.setTimeout(240_000);

type Terminal = ReturnType<typeof terminal>;

/** Types one command and answers its exit code and what it said, so a step reads as one line. */
async function run(computer: Terminal, ...args: string[]): Promise<{ code: number; said: string }> {
  computer.said.length = 0;
  const code = await computer.run(...args);
  return { code, said: computer.text() };
}

/** Saves a real clip of this shape to a file the terminal can read. */
async function clipFile(page: Page, shape: "upright" | "wide"): Promise<string> {
  const clip = await realClip(page, shape);
  const file = join(mkdtempSync(join(tmpdir(), "ruken-clip-")), clip.name);
  writeFileSync(file, clip.buffer);
  return file;
}

/** A signed-up maker with a terminal that is let in. */
async function makerWithTerminal(page: Page) {
  await signUp(page);
  const computer = terminal();
  await letInTerminal(page, computer);
  return computer;
}

/** `github connect`, with the journey's own browser as the one the command opens: it goes where the command says. */
async function connectGitHub(page: Page, computer: Terminal) {
  const connecting = computer.run("github", "connect");
  await expect.poll(() => computer.text(), { timeout: 15_000 }).toContain("/make/github");
  await page.goto("/make/github");
  await expect(page).toHaveURL("/make");
  expect(await connecting).toBe(0);
  expect(computer.text()).toContain("Connected.");
}

/** Everything a game is asked, answered from the terminal: it ends ready to send. */
async function answerAll(page: Page, computer: Terminal, name: string, age = "12"): Promise<string> {
  const started = await run(computer, "new", name);
  expect(started.code).toBe(0);
  const slug = /Its address is ([a-z0-9-]+)\./.exec(started.said)?.[1] ?? "";
  expect(slug).not.toBe("");
  expect((await run(computer, "set", slug, "line", "Climb. Fall. Climb again.")).code).toBe(0);
  expect((await run(computer, "files", slug, TINY_GAME)).code).toBe(0);
  expect((await run(computer, "video", slug, "upright", await clipFile(page, "upright"))).code).toBe(0);
  expect((await run(computer, "video", slug, "wide", await clipFile(page, "wide"))).code).toBe(0);
  expect((await run(computer, "set", slug, "age", age)).code).toBe(0);
  return slug;
}

async function staffSays(browser: Browser, page: Page, order: object) {
  const answer = await reviewJob(page.request, order, browser);
  expect(answer.status()).toBe(200);
}

test("a maker's games, from the first command to throwing one away", async ({ page, browser }) => {
  const computer = await makerWithTerminal(page);

  // GitHub: not connected, connected through the browser, then its repositories and their branches.
  let said = await run(computer, "github");
  expect(said.said).toContain("npx ruken github connect");
  await connectGitHub(page, computer);
  expect((await run(computer, "github")).said).toContain("GitHub is connected.");
  expect((await run(computer, "repos")).said).toContain(TINY_GAME);
  said = await run(computer, "branches", TINY_GAME);
  expect(said.code).toBe(0);
  expect(said.said).toContain("main");
  expect((await run(computer, "branches", "ruken-test/not-yours")).code).toBe(1);

  // Create and read: the list, the new game, the list again.
  const name = freshName();
  expect((await run(computer, "games")).said).not.toContain(name);
  const slug = await answerAll(page, computer, name);
  expect((await run(computer, "games")).said).toContain(name);
  const draft = (await run(computer, "game", slug)).said;
  expect(draft).toContain("Climb. Fall. Climb again.");
  expect(draft).toContain(`Files: ${TINY_GAME}`);
  expect(draft).toContain("Upright video: added");
  expect(draft).toContain("Every question is answered.");
  expect((await run(computer, "set", slug, "websites", "api.example.com")).code).toBe(0);
  expect((await run(computer, "game", slug)).said).toContain("Other websites: api.example.com");
  expect((await run(computer, "set", slug, "line", "A new line.")).code).toBe(0);
  expect((await run(computer, "game", slug)).said).toContain("A new line.");

  // Send before agreeing is refused with the agreement's words; typing "yes" is the agreeing; then it sends.
  let sent = await run(computer, "send", slug);
  expect(sent.code).toBe(1);
  expect(sent.said).toContain("You need to agree to Ruken's maker agreement first.");
  expect(sent.said).toContain(`npx ruken agree ${slug}`);
  expect(await stateOf(slug)).toBe("draft");
  computer.typed.push("no");
  expect((await run(computer, "agree", slug)).code).toBe(1);
  expect((await run(computer, "send", slug)).code).toBe(1);
  computer.typed.push("yes");
  const agreed = await run(computer, "agree", slug);
  expect(agreed.code).toBe(0);
  expect(agreed.said).toContain("Ruken maker agreement, version");
  sent = await run(computer, "send", slug);
  expect(sent.code).toBe(0);
  expect(await stateOf(slug)).toBe("waiting");

  // Staff say yes; it is live on its page.
  await staffSays(browser, page, { do: "accept", game: slug });
  expect(await stateOf(slug)).toBe("live");
  await page.goto(`/g/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);

  // The player count, on and then off.
  expect((await run(computer, "player-count", slug, "on")).code).toBe(0);
  expect(await showsPlayerCountOf(slug)).toBe(true);
  expect((await run(computer, "game", slug)).said).toContain("Player count on its page: on");
  expect((await run(computer, "player-count", slug, "off")).code).toBe(0);
  expect(await showsPlayerCountOf(slug)).toBe(false);
  expect((await run(computer, "player-count", slug, "maybe")).code).toBe(1);

  // A new video of a live game waits for review; players keep the old one; keeping the old one drops the change.
  expect((await run(computer, "video", slug, "upright", await clipFile(page, "upright"))).said).toContain(
    "waits for review",
  );
  expect((await run(computer, "game", slug)).said).toContain("Upright video: added, waiting for review");
  expect((await run(computer, "keep-old", slug, "upright")).code).toBe(0);
  expect((await run(computer, "game", slug)).said).not.toContain("waiting for review");

  // A rating waits too, and the old one can be kept. 18+ alone is refused with what to type instead.
  expect((await run(computer, "set", slug, "age", "16")).said).toContain("waits for review");
  expect((await run(computer, "game", slug)).said).toContain("Waiting for review: ");
  expect((await run(computer, "keep-old", slug, "age")).code).toBe(0);
  expect((await run(computer, "game", slug)).said).not.toContain("Waiting for review: ");
  const alone = await run(computer, "set", slug, "age", "18");
  expect(alone.code).toBe(1);
  expect(alone.said).toContain(`Choose its 18+ marks too: npx ruken set ${slug} age 18 --marks <marks>`);
  const eighteen = await run(computer, "set", slug, "age", "18", "--marks", "gore");
  expect(eighteen.code).toBe(0);
  expect(eighteen.said).toContain("waits for review");
  expect((await run(computer, "keep-old", slug, "age")).code).toBe(0);

  // New files of a live game, sent as a new version.
  expect((await run(computer, "files", slug, TINY_GAME, "--branch", "main")).code).toBe(0);
  expect((await run(computer, "update", slug)).said).toContain("new version waits for review");

  // Take it off, put it back, take it off again, delete what it left, and throw a second game away.
  await staffSays(browser, page, { do: "accept", game: slug });
  computer.typed.push("wrong name");
  expect((await run(computer, "take-off", slug)).code).toBe(1);
  expect(await stateOf(slug)).toBe("live");
  computer.typed.push(name);
  expect((await run(computer, "take-off", slug)).code).toBe(0);
  expect(await stateOf(slug)).toBe("taken_off");
  expect((await run(computer, "put-back", slug)).said).toContain("waits for review");
  expect(await stateOf(slug)).toBe("waiting");
  await staffSays(browser, page, { do: "accept", game: slug });
  computer.typed.push(slug);
  expect((await run(computer, "take-off", slug)).code).toBe(0);
  computer.typed.push(name);
  expect((await run(computer, "delete-files", slug)).said).toContain("Deleted the files");

  const second = freshName("Second game");
  const secondSlug = /address is ([a-z0-9-]+)\./.exec((await run(computer, "new", second)).said)?.[1] ?? "";
  expect((await run(computer, "games")).said).toContain(second);
  computer.typed.push("nope");
  expect((await run(computer, "throw-away", secondSlug)).code).toBe(1);
  computer.typed.push(second);
  expect((await run(computer, "throw-away", secondSlug)).said).toContain("is thrown away");
  expect((await run(computer, "games")).said).not.toContain(second);
  expect((await run(computer, "game", secondSlug)).code).toBe(1);
});

test("an 18+ game made from a terminal is asked its marks, and is adults-only once live", async ({
  page,
  browser,
}) => {
  const computer = await makerWithTerminal(page);
  await connectGitHub(page, computer);
  const slug = await answerAll(page, computer, freshName("Grown-up"), "18");
  expect((await run(computer, "game", slug)).said).toContain("Next to answer: marks");

  computer.typed.push("yes");
  expect((await run(computer, "agree", slug)).code).toBe(0);
  const without = await run(computer, "send", slug);
  expect(without.code).toBe(1);
  expect(without.said).toContain("Answer every question first.");
  expect(without.said).toContain(`npx ruken set ${slug} marks <value>`);
  expect(await stateOf(slug)).toBe("draft");

  expect((await run(computer, "set", slug, "marks", "gore,drugs")).code).toBe(0);
  expect((await run(computer, "send", slug)).code).toBe(0);
  await staffSays(browser, page, { do: "accept", game: slug });

  // A signed-out browser meets the adults-only screen, as for a game made in the browser.
  const stranger = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    const visitor = await stranger.newPage();
    await visitor.goto(`/g/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("This game is only for adults.");
  } finally {
    await stranger.close();
  }
});

test("another maker's key finds none of a maker's games, for any method, and changes nothing", async ({
  page,
  browser,
  request,
}) => {
  const owner = await makerWithTerminal(page);
  await connectGitHub(page, owner);
  const slug = await answerAll(page, owner, freshName("Private"));
  const before = (await run(owner, "game", slug)).said;

  // A second maker, in a browser of their own.
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    const other = await makerWithTerminal(await context.newPage());
    const headers = { authorization: `Bearer ${other.key() ?? ""}`, ...journeyClientHeaders() };
    const game = `/api/v1/games/${slug}`;
    const calls: [string, string][] = [
      ["GET", game],
      ["PATCH", game],
      ["DELETE", game],
      ["POST", `${game}/send`],
      ["POST", `${game}/new-version`],
      ["POST", `${game}/take-off`],
      ["POST", `${game}/put-back`],
      ["DELETE", `${game}/files`],
      ["DELETE", `${game}/waiting/upright`],
    ];
    for (const [method, path] of calls) {
      // A body of {}, as the command line sends one: SvelteKit turns away a change with no content type.
      const answer = await request.fetch(path, {
        method,
        headers: { ...headers, "content-type": "application/json" },
        ...(method === "GET" ? {} : { data: method === "PATCH" ? '{"name":"Taken over"}' : "{}" }),
      });
      expect(answer.status(), `${method} ${path}`).toBe(404);
    }
    const video = await request.fetch(`${game}/videos/upright`, {
      method: "PUT",
      headers: { ...headers, "content-type": "video/mp4" },
      data: Buffer.alloc(8),
    });
    expect(video.status(), `PUT ${game}/videos/upright`).toBe(404);
    // Nor does a repository that is not theirs list its branches.
    const branches = await request.get(`/api/v1/github/repos/${TINY_GAME}/branches`, { headers });
    expect(branches.status()).toBe(404);
  } finally {
    await context.close();
  }
  expect((await run(owner, "game", slug)).said).toBe(before);
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
});
