import { expect, type Locator, type Page } from "@playwright/test";
import { signUp } from "./account.ts";

// The steps every maker journey shares: a maker with a game, and its clips. GitHub is the stand-in on this machine
// (support/fake-github-server.ts), which lists `ruken-test/tiny-game` and `ruken-test/broken-game` for the person.

/** The stand-in's game that pulls cleanly, and the one with no index.html that the pull refuses. */
export const TINY_GAME = "ruken-test/tiny-game";
export const BROKEN_GAME = "ruken-test/broken-game";

/** A name no other journey has used, so its page address is its own. */
export const freshName = (stem = "Tiny game") => `${stem} ${crypto.randomUUID().slice(0, 8)}`;

/** Connects GitHub through the stand-in, which sends the maker to the new-game form. */
export async function connectGitHub(page: Page): Promise<void> {
  await page.goto("/make/github");
  await expect(page).toHaveURL("/make/new");
}

/** Fills the new-game form for a repository and sends it, then waits for the game's page. Returns its address's end. */
export async function makeGame(page: Page, repository = TINY_GAME): Promise<string> {
  await page.getByLabel("Name").fill(freshName(repository === TINY_GAME ? "Tiny game" : "Broken game"));
  await page.getByLabel("One line").fill("A tiny game about tapping.");
  await page.getByLabel("Game files").selectOption(repository);
  await page.getByRole("button", { name: "Next: add your clips" }).click();
  // A game's address has a hyphen in it; `/make/new` and `/make/github` do not.
  await expect(page).toHaveURL(/\/make\/[a-z0-9]+(-[a-z0-9]+)+$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

/** A new maker with a game made from `repository`: signs up, connects GitHub, fills the form. Returns the page's slug. */
export async function startGame(page: Page, repository = TINY_GAME): Promise<string> {
  await signUp(page);
  await connectGitHub(page);
  return makeGame(page, repository);
}

/** A small file that is a video as far as Ruken can tell: four length bytes, `ftyp`, then zeros. */
export function videoFile(): { name: string; mimeType: string; buffer: Buffer } {
  const buffer = Buffer.alloc(64);
  buffer.writeUInt32BE(64, 0);
  buffer.write("ftyp", 4, "ascii");
  return { name: "clip.mp4", mimeType: "video/mp4", buffer };
}

/** A web page that says it is a video, which Ruken must refuse. */
export function pageNamedAsVideo(): { name: string; mimeType: string; buffer: Buffer } {
  return {
    name: "clip.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("<html><body>not a video</body></html>"),
  };
}

/** The clip's own line on a game's page: its label, what it says now, and its file field and button. */
export function clipLine(page: Page, label: string): Locator {
  return page.locator("form", { has: page.getByLabel(label) });
}

/** Chooses a file for one clip and presses its Upload. Does not wait: the answer may be a refusal. */
export async function sendClip(
  page: Page,
  label: string,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.getByLabel(label).setInputFiles(file);
  await clipLine(page, label).getByRole("button", { name: "Upload" }).click();
}

/** Uploads a good clip for one line ("Upright clip" or "Wide clip") and waits until the line says it is added. */
export async function uploadClip(page: Page, label: string): Promise<void> {
  await sendClip(page, label, videoFile());
  await expect(clipLine(page, label).getByText("Added", { exact: true })).toBeVisible();
}
