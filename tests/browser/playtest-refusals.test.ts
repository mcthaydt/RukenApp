import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { playtestScene } from "./support/playtest.ts";
import { PLAYTEST_WORDS as W } from "../../src/features/playtest/words.ts";

// Only a game's maker reaches its Playtesters page and its actions; nobody asks to playtest their own game; and a
// player's Remove on someone else's Your turn row changes nothing (playtesting spec, criterion 8). Each refusal is a
// missing page, asked for straight at the address, as someone who never saw the button would.

const SITE = "http://localhost:4173";

async function post(page: Page, path: string, form: Record<string, string>): Promise<number> {
  const answer = await page.request.post(path, { headers: { origin: SITE }, form, maxRedirects: 0 });
  return answer.status();
}

/** The rows on the maker's page, by the person's name: the ids its own forms carry. */
async function rowIdOf(maker: Page, name: string): Promise<string> {
  const id = await maker
    .getByRole("listitem")
    .filter({ hasText: name })
    .locator('input[name="row"]')
    .first()
    .getAttribute("value");
  expect(id, `${name}'s row`).not.toBeNull();
  return id ?? "";
}

test("someone who is not the maker gets a missing page from every Playtesters address and action, and nothing changes", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const scene = await playtestScene(browser);
  try {
    const maker = scene.maker.page;
    await maker.goto(`${scene.playtesters}?invite`);
    await pageHasSettled(maker);
    const link = await maker.getByRole("dialog", { name: W.sheetTitle }).locator(".link").textContent();
    const asking = await rowIdOf(maker, scene.asker.name);
    const playing = await rowIdOf(maker, scene.tester.name);

    // The asker, a player of this game but not its maker, tries every address and action.
    const stranger = scene.asker.page;
    const page = await stranger.request.get(scene.playtesters, { maxRedirects: 0 });
    expect(page.status(), "the Playtesters page").toBe(404);
    const invitePage = await stranger.request.get(`${scene.playtesters}?invite`, { maxRedirects: 0 });
    expect(invitePage.status(), "the invite sheet").toBe(404);
    const refused: [string, Record<string, string>][] = [
      ["asking", { asking: "off" }],
      ["answer", { row: asking, yes: "yes" }],
      ["remove", { row: playing }],
      ["invite", { handle: "anyone" }],
      ["newLink", {}],
    ];
    for (const [action, form] of refused)
      expect(await post(stranger, `${scene.playtesters}?/${action}`, form), action).toBe(404);

    // Nothing changed: asking is still on, the ask still waits, the player still plays, and the link is the same.
    await maker.goto(`${scene.playtesters}?invite`);
    await pageHasSettled(maker);
    await expect(maker.getByRole("dialog", { name: W.sheetTitle }).locator(".link")).toHaveText(link ?? "");
    await maker.goto(scene.playtesters);
    await pageHasSettled(maker);
    await expect(maker.getByRole("button", { name: new RegExp(`^${W.switch}`) })).toContainText(W.on);
    await expect(maker.getByRole("region", { name: W.asking })).toContainText(W.wants(scene.asker.name));
    await expect(maker.getByRole("region", { name: W.playing })).toContainText(scene.tester.name);
  } finally {
    await scene.close();
  }
});

test("a maker cannot ask to playtest their own game, and a player cannot remove someone else's Your turn row", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const scene = await playtestScene(browser);
  try {
    expect(
      await post(scene.maker.page, `/g/${scene.slug}/playtest`, { want: "on" }),
      "the maker's own ask",
    ).toBe(404);
    await scene.maker.page.goto(scene.playtesters);
    await pageHasSettled(scene.maker.page);
    await expect(scene.maker.page.getByRole("region", { name: W.asking })).not.toContainText(
      "Pat Playtest Maker",
    );

    // The playtester's own row: "<maker> let you playtest" on their Your turn.
    const tester = scene.tester.page;
    await tester.goto("/your-turn");
    await pageHasSettled(tester);
    const row = tester.locator('form[action="/your-turn/remove"]:has(input[name="kind"][value="playtest"])');
    await expect(row).toHaveCount(1);
    const id = (await row.locator('input[name="id"]').getAttribute("value")) ?? "";
    expect(id).not.toBe("");

    expect(
      await post(scene.asker.page, "/your-turn/remove", { id, kind: "playtest" }),
      "someone else's row",
    ).toBe(404);
    await tester.goto("/your-turn");
    await pageHasSettled(tester);
    await expect(row).toHaveCount(1);
  } finally {
    await scene.close();
  }
});
