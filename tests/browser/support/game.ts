import { writeFile } from "node:fs/promises";
import { expect, type Locator, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./account.ts";

// The steps every maker journey shares: a maker with a game, the answers a screen asks for, and the videos. GitHub is
// the stand-in on this machine (support/fake-github-server.ts), which lists `ruken-test/tiny-game` and
// `ruken-test/broken-game` for the person.

/** The stand-in's game that pulls cleanly, and the one with no index.html that the pull refuses. */
export const TINY_GAME = "ruken-test/tiny-game";
export const BROKEN_GAME = "ruken-test/broken-game";

/**
 * A name no other journey has used, so its page address is its own. A name makes the same address nine times at most
 * (`-2` to `-9`) and the nine projects share one database, so a journey that saves a game never types a plain name.
 */
export const freshName = (stem = "Tiny game") => `${stem} ${crypto.randomUUID().slice(0, 8)}`;

/** The one blue button of a question: "Next" the first time through, "Save" when an answer is being changed. */
export const nextButton = (page: Page): Locator => page.getByRole("button", { name: /^(Next|Save)$/ });

/** The heading's own words are the box's label, so a journey finds the box by the question it answers. */
const questionBox = (page: Page, question: string): Locator => page.getByLabel(question);

/** Types the game's name into question 1 and presses Next. Returns the name. */
export async function answerName(page: Page, name: string = freshName()): Promise<string> {
  await questionBox(page, "What's your game called?").fill(name);
  await nextButton(page).click();
  return name;
}

/** Types the one line about the game and presses Next. The heading holds the game's name, so any name is found. */
export async function answerLine(page: Page, line = "Climb. Fall. Climb again."): Promise<void> {
  await page.getByRole("textbox").fill(line);
  await nextButton(page).click();
}

/** Chooses where the game plays and presses Next. */
export async function answerPlaysOn(page: Page, where: "computers" | "both"): Promise<void> {
  await page.getByLabel(where === "both" ? "Phones and computers" : "Computers only").check();
  await nextButton(page).click();
}

/** Chooses who the game is for ("3+", "7+", "12+", "16+" or "18+") and presses Next. */
export async function answerAge(page: Page, rating: "3+" | "7+" | "12+" | "16+" | "18+"): Promise<void> {
  await page.getByRole("radio", { name: new RegExp(`^${rating.replace("+", "\\+")}`) }).check();
  await nextButton(page).click();
}

/** The part of a game's address that follows `/make/`: its slug, read from the address the browser is on. */
export function slugOfPage(page: Page): string {
  return new URL(page.url()).pathname.split("/")[2] ?? "";
}

/** Makes a game as the signed-in maker: question 1 answered, the browser on question 2. */
export async function addDraft(page: Page): Promise<{ slug: string; name: string }> {
  await page.goto("/make/new");
  await pageHasSettled(page);
  const name = await answerName(page);
  await expect(page).toHaveURL(/\/make\/[a-z0-9-]+\/line$/);
  await pageHasSettled(page);
  return { slug: slugOfPage(page), name };
}

/** A new maker with a game: signs up, then answers question 1. */
export async function startDraft(page: Page): Promise<{ slug: string; name: string }> {
  await signUp(page);
  return addDraft(page);
}

/** A new maker with a game, answered up to the question of where its files are: signs up, then answers 1 and 2. */
export async function startAtFiles(
  page: Page,
): Promise<{ slug: string; name: string; maker: { email: string; password: string } }> {
  const maker = await signUp(page);
  const { slug, name } = await addDraft(page);
  await answerLine(page);
  await expect(page).toHaveURL(`/make/${slug}/files`);
  await pageHasSettled(page);
  return { slug, name, maker };
}

/** Presses "Connect GitHub" on the files question and waits until the stand-in has sent her back to it. */
export async function connectGitHubFromFiles(page: Page, slug: string): Promise<void> {
  await page.getByRole("link", { name: "Connect GitHub" }).click();
  await expect(page).toHaveURL(`/make/${slug}/files`);
  await pageHasSettled(page);
  await expect(page.getByRole("radio")).toHaveCount(2);
}

/**
 * Every address a maker's game has, for the journey that proves another maker is told nothing. `form` is a valid
 * answer to post there, so a refusal can only be the game not being theirs.
 */
export function MAKER_ADDRESSES(slug: string): { path: string; form?: Record<string, string> }[] {
  return [
    { path: `/make/${slug}` },
    { path: `/make/${slug}/name`, form: { name: "Somebody else's game" } },
    { path: `/make/${slug}/line`, form: { oneLine: "Somebody else's line." } },
    { path: `/make/${slug}/files`, form: { repo: TINY_GAME } },
    { path: `/make/${slug}/plays-on`, form: { playsOn: "computer_only" } },
    { path: `/make/${slug}/age`, form: { ageRating: "age_12" } },
  ];
}

/**
 * Holds the answer to every request for an address until `release()` is called, and counts the requests. A press
 * is seen as taken only while its answer is out, so a journey that looks at that state holds the answer back.
 */
export async function holdAnswersTo(page: Page, address: RegExp) {
  let requests = 0;
  let release = () => {};
  const mayFinish = new Promise<void>((done) => {
    release = done;
  });
  await page.route(address, async (route) => {
    requests += 1;
    await mayFinish;
    await route.continue();
  });
  return {
    release: () => {
      release();
    },
    requestsSoFar: () => requests,
  };
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

/**
 * An MP4 over the 30 MB limit, 31 MB of it, written to a file at `path`. It is chosen by its path, not handed over as
 * bytes: 31 MB sent to the browser as bytes can take longer than a step is allowed.
 */
export async function tooBigVideo(path: string): Promise<string> {
  const buffer = Buffer.alloc(31_000_000);
  buffer.writeUInt32BE(64, 0);
  buffer.write("ftyp", 4, "ascii");
  await writeFile(path, buffer);
  return path;
}
