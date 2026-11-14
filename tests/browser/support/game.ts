import { expect, type Locator, type Page } from "@playwright/test";
import { signUp } from "./account.ts";

// The steps every maker journey shares: a maker with a game, and its videos. GitHub is the stand-in on this machine
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
  await page.getByLabel("One line about your game").fill("A tiny game about tapping.");
  await page.getByLabel("Game files").selectOption(repository);
  await page.getByRole("button", { name: "Save and add videos" }).click();
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

/** A file as Playwright takes it. */
export interface UploadFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** A small file that is a video as far as Ruken can tell: four length bytes, `ftyp`, then zeros. */
export function videoFile(name = "clip.mp4"): UploadFile {
  const buffer = Buffer.alloc(64);
  buffer.writeUInt32BE(64, 0);
  buffer.write("ftyp", 4, "ascii");
  return { name, mimeType: "video/mp4", buffer };
}

/** A web page that says it is a video, which Ruken must refuse. */
export function pageNamedAsVideo(): UploadFile {
  return {
    name: "clip.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("<html><body>not a video</body></html>"),
  };
}

/** A QuickTime file: a video, but not one Ruken takes. */
export function quickTimeFile(): UploadFile {
  return { name: "holiday.mov", mimeType: "video/quicktime", buffer: Buffer.alloc(64) };
}

/** An MP4 over the 30 MB limit, 31 MB of it. */
export function tooBigVideo(): UploadFile {
  const buffer = Buffer.alloc(31_000_000);
  buffer.writeUInt32BE(64, 0);
  buffer.write("ftyp", 4, "ascii");
  return { name: "too-big.mp4", mimeType: "video/mp4", buffer };
}

/** One video's place on a game's page, by its title: "Upright video", "Wide video" or "Game files". */
export function stepOf(page: Page, title: string): Locator {
  return page.getByRole("region", { name: title });
}

/** The file field inside a video's place, which Ruken's own picker holds. */
export function fileFieldOf(page: Page, title: string): Locator {
  return stepOf(page, title).locator('input[type="file"]');
}

/** Chooses a file for one video. With script on, choosing is all it takes: the video is added at once. */
export async function chooseVideo(page: Page, title: string, file: UploadFile): Promise<void> {
  await fileFieldOf(page, title).setInputFiles(file);
}

/** Adds a good video for one place ("Upright video" or "Wide video") and waits until it says it is added. */
export async function uploadVideo(page: Page, title: string): Promise<void> {
  await chooseVideo(page, title, videoFile());
  await expect(stepOf(page, title).getByText(/^Added/)).toBeVisible();
}

/** The press that sends a game for review: "Send for review", or "Send it again" for a game that was sent back. */
export const sendButton = (page: Page): Locator =>
  page.getByRole("button", { name: /^(Send for review|Send it again)$/ });
