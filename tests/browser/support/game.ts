import { readFile, writeFile } from "node:fs/promises";
import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import { pageHasSettled, signInAs, signUp, SITE_URL } from "./account.ts";
import { changeGame, fillAnswers, grantStaffRole, makerOf, putGameWhereStaffLeaveIt } from "./database.ts";

// The steps every maker journey shares: a maker with a game, the answers a screen asks for, and the videos. GitHub is
// the stand-in on this machine (support/fake-github-server.ts), which lists `ruken-test/tiny-game` and
// `ruken-test/broken-game` for the person.

/** The stand-in's game that pulls cleanly, and the one with no index.html that the pull refuses. */
export const TINY_GAME = "ruken-test/tiny-game";
export const BROKEN_GAME = "ruken-test/broken-game";
/** 2048 (tests/fixtures/2048/CREDIT.md): a real game, for the journeys that play one and the play screen's pictures. */
export const TWENTY_48 = "ruken-test/2048";

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

/**
 * Types the one line about the game and presses Next. The box is found by the question it answers, whatever the game's
 * name: the address changes to /line a moment before the screen does, so a box found by its kind alone can be the
 * name's box, still there, and the line typed into it is gone when the question comes (run 43687697464: Next pressed
 * on an empty line, and the page stayed on it saying so).
 */
export async function answerLine(page: Page, line = "Climb. Fall. Climb again."): Promise<void> {
  await page.getByLabel(/about, in one line\?$/).fill(line);
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
export async function addDraft(
  page: Page,
  gameName: string = freshName(),
): Promise<{ slug: string; name: string }> {
  await page.goto("/make/new");
  await pageHasSettled(page);
  const name = await answerName(page, gameName);
  await expect(page).toHaveURL(/\/make\/[a-z0-9-]+\/line$/);
  await pageHasSettled(page);
  return { slug: slugOfPage(page), name };
}

/** A new maker with a game: signs up, then answers question 1. */
export async function startDraft(
  page: Page,
  gameName: string = freshName(),
): Promise<{ slug: string; name: string }> {
  await signUp(page);
  return addDraft(page, gameName);
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
  await expect(page.getByRole("radio")).toHaveCount(3);
}

/**
 * A new maker with a game whose answers up to the video are written straight into the database, the browser on that
 * video's question. The wide question has the upright video already in.
 */
export async function startAtVideo(page: Page, question: "upright" | "wide"): Promise<{ slug: string }> {
  const { slug } = await startDraft(page);
  await fillAnswers(slug, { files: true, ...(question === "wide" ? { videos: "upright" as const } : {}) });
  await page.goto(`/make/${slug}/${question}`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return { slug };
}

/** The real file field of a video question: hidden from sight only, so the keyboard reaches it. */
export const videoField = (page: Page): Locator => page.locator('input[type="file"]');

/** Chooses a video as a person does, a file or the path of one. Choosing adds it at once. */
export async function chooseVideo(page: Page, file: UploadFile | string): Promise<void> {
  await videoField(page).setInputFiles(file);
}

/**
 * Every address a maker's game has, for the journey that proves another maker is told nothing. `form` is a valid
 * answer to post there, so a refusal can only be the game not being theirs.
 */
export function MAKER_ADDRESSES(slug: string): { path: string; form?: Record<string, string> }[] {
  return [
    { path: `/make/${slug}` },
    { path: `/make/${slug}/name?/answer`, form: { name: "Somebody else's game" } },
    { path: `/make/${slug}/line?/answer`, form: { oneLine: "Somebody else's line." } },
    { path: `/make/${slug}/files?/answer`, form: { repo: TINY_GAME } },
    { path: `/make/${slug}/plays-on?/answer`, form: { playsOn: "computer_only" } },
    { path: `/make/${slug}/age?/answer`, form: { ageRating: "age_12" } },
    { path: `/make/${slug}/websites?/answer`, form: { servers: "api.example.com" } },
    { path: `/make/${slug}/marks?/answer`, form: { contentMarks: "gore" } },
    // A video is sent by its own action, one request to a video.
    { path: `/make/${slug}/upright?/clip`, form: {} },
    { path: `/make/${slug}/wide?/clip`, form: {} },
    { path: `/make/${slug}/throw-away` },
    // Sending a live game's newest files for review.
    { path: `/make/${slug}?/newVersion`, form: {} },
    // Taking a live game off Ruken, putting it back, and deleting what is left of its files.
    { path: `/make/${slug}/take-off` },
    { path: `/make/${slug}/take-off?/takeOff`, form: {} },
    { path: `/make/${slug}?/putBack`, form: {} },
    { path: `/make/${slug}?/deleteLeft`, form: {} },
    { path: `/make/${slug}/agreement`, form: {} },
    // The send is a named action; the stranger's GET and POST both meet the same 404 before it is looked for.
    { path: `/make/${slug}/check` },
    { path: `/make/${slug}/check?/send`, form: {} },
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

/** Where the real clips are: two seconds of each shape, as WebM and as MP4. */
const CLIPS = new URL("../../fixtures/clips/", import.meta.url);

/**
 * A real clip of this shape, which a browser can decode and draw a frame of. Safari's engine plays the MP4 and Chromium
 * (which is built without the H.264 codec) the WebM, so each browser is given the one it can play.
 */
export async function realClip(page: Page, shape: "upright" | "wide"): Promise<UploadFile> {
  const extension = page.context().browser()?.browserType().name() === "webkit" ? "mp4" : "webm";
  const buffer = await readFile(new URL(`${shape}.${extension}`, CLIPS));
  return { name: `${shape}.${extension}`, mimeType: `video/${extension}`, buffer };
}

/**
 * Gives a draft game, signed in on `page`, real clips for both videos, sent through the same action a maker's own
 * choice uses. A game made with `fillAnswers` has clip rows and no bytes behind them, so its videos show a blank block.
 */
export async function giveRealClips(page: Page, slug: string): Promise<void> {
  const site = new URL(page.url()).origin;
  for (const shape of ["upright", "wide"] as const) {
    const sent = await page.request.post(`${site}/make/${slug}/${shape}?/clip`, {
      multipart: { clip: await realClip(page, shape) },
      headers: { origin: site },
    });
    expect(sent.ok(), `the ${shape} clip is taken`).toBe(true);
  }
}

/** A web page that says it is a video, which Ruken must refuse. */
export function pageNamedAsVideo(): UploadFile {
  return {
    name: "clip.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("<html><body>not a video</body></html>"),
  };
}

/** A QuickTime file as a Mac saves a screen recording: four length bytes, `ftyp`, the brand "qt  ", then zeros. */
export function quickTimeFile(): UploadFile {
  const buffer = Buffer.alloc(64);
  buffer.writeUInt32BE(64, 0);
  buffer.write("ftypqt  ", 4, "ascii");
  return { name: "Screen Recording.mov", mimeType: "video/quicktime", buffer };
}

/** A video of a kind Ruken does not take. */
export function aviFile(): UploadFile {
  return { name: "holiday.avi", mimeType: "video/x-msvideo", buffer: Buffer.alloc(64) };
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

/** Adds a video to the question the browser is on, as a person does, and waits until it is in the frame. */
export async function addVideo(page: Page, shape: "upright" | "wide"): Promise<void> {
  // The address changes a moment before the screen does, and both video questions have the same file field, so the
  // question's own heading is waited for before anything is chosen.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Add your ${shape} video`);
  await chooseVideo(page, await realClip(page, shape));
  await expect(page.locator(`[data-frame="${shape}"] video`)).toBeAttached();
}

/**
 * A new maker's first game, answered through the real screens from the first question to the last, with the stand-in
 * GitHub and two small videos: the browser ends on the agreement (or on Check and send, for a maker who agreed before).
 * An 18+ game is asked its marks too, and `marks` names the ones chosen.
 */
export async function answerEveryQuestion(
  page: Page,
  options: {
    rating?: "3+" | "7+" | "12+" | "16+" | "18+";
    marks?: string[];
    signedIn?: boolean;
    /** The repository the game's files come from; the tiny game unless a journey plays a real one. */
    repo?: string;
  } = {},
): Promise<{ slug: string; name: string }> {
  // A maker who is already signed in adds a game; a new one signs up first.
  const { slug, name } = options.signedIn === true ? await addDraftAndLine(page) : await startAtFiles(page);
  await connectGitHubFromFiles(page, slug);
  await page.getByLabel(options.repo ?? TINY_GAME).check();
  await nextButton(page).click();
  await expect(page).toHaveURL(`/make/${slug}/plays-on`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Where does");
  await answerPlaysOn(page, "both");
  await expect(page).toHaveURL(`/make/${slug}/upright`);
  await addVideo(page, "upright");
  await nextButton(page).click();
  await expect(page).toHaveURL(`/make/${slug}/wide`);
  await addVideo(page, "wide");
  await nextButton(page).click();
  await expect(page).toHaveURL(`/make/${slug}/age`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("for?");
  await answerAge(page, options.rating ?? "12+");
  if (options.rating === "18+") {
    await expect(page).toHaveURL(`/make/${slug}/marks`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("any of these?");
    for (const mark of options.marks ?? ["Gore"]) await page.getByLabel(mark).check();
    await nextButton(page).click();
  }
  await expect(page).toHaveURL(new RegExp(`/make/${slug}/(agreement|check)$`));
  await pageHasSettled(page);
  return { slug, name };
}

/** A game for a maker who is already signed in: question 1 and 2 answered, the browser on question 3. */
async function addDraftAndLine(page: Page): Promise<{ slug: string; name: string }> {
  const { slug, name } = await addDraft(page);
  await answerLine(page);
  await expect(page).toHaveURL(`/make/${slug}/files`);
  await pageHasSettled(page);
  return { slug, name };
}

/** Presses "I agree" on the agreement of a game and waits until Check and send is there. */
export async function agreeToTheAgreement(page: Page, slug: string): Promise<void> {
  await page.goto(`/make/${slug}/agreement`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "I agree" }).click();
  await expect(page).toHaveURL(`/make/${slug}/check`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check it, then send");
}

/**
 * A new maker with a finished game written straight into the database (every answer, the files and both videos, rated
 * 12+), who has agreed: the browser is on Check and send.
 */
export async function startAtCheck(page: Page): Promise<{ slug: string; name: string }> {
  const { slug, name } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, slug);
  await agreeToTheAgreement(page, slug);
  return { slug, name };
}

/**
 * A new maker whose finished game staff have left as `decision` says (waiting, sent back or live). A game that has been
 * sent has had its maker's agreement, so a journey that opens Check and send for it passes `agreed`.
 */
export async function gameWhere(
  page: Page,
  decision: Parameters<typeof putGameWhereStaffLeaveIt>[1],
  options: { agreed?: boolean } = {},
): Promise<{ slug: string; name: string }> {
  const { slug, name } = await startDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, slug);
  if (options.agreed === true) await agreeToTheAgreement(page, slug);
  await putGameWhereStaffLeaveIt(slug, decision);
  return { slug, name };
}

/**
 * A game sent for review the way a maker sends it: every real screen, from the first question to Check and send, in a
 * browser of its own that is closed afterwards. It ends on "Waiting for review". It costs 8 to 14 seconds a project, so
 * a journey uses it only when it looks inside the frame or needs the game's files in the bucket; every other journey
 * makes its waiting game from rows (`waitingGameFromRows`).
 */
export async function submitGame(
  browser: Browser,
  repo?: string,
): Promise<{ slug: string; name: string; makerEmail: string }> {
  const context = await browser.newContext({ baseURL: SITE_URL });
  try {
    const page = await context.newPage();
    const { slug, name } = await answerEveryQuestion(page, repo === undefined ? {} : { repo });
    await agreeToTheAgreement(page, slug);
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page).toHaveURL(`/make/${slug}`);
    await expect(page.getByRole("heading", { name: "Waiting for review" })).toBeVisible();
    return { slug, name, makerEmail: (await makerOf(slug)).makerEmail };
  } finally {
    await context.close();
  }
}

/**
 * A maker in a browser of their own, with a finished game written into the database where staff's decision would leave
 * it. The maker's page stays open, so a journey can come back to see what staff did; `close` ends that browser.
 */
export async function makerWithGameWhere(
  browser: Browser,
  decision: Parameters<typeof putGameWhereStaffLeaveIt>[1],
): Promise<{ page: Page; slug: string; name: string; makerEmail: string; close: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL: SITE_URL });
  const page = await context.newPage();
  const { slug, name } = await startDraft(page);
  await putGameWhereStaffLeaveIt(slug, decision);
  return {
    page,
    slug,
    name,
    makerEmail: (await makerOf(slug)).makerEmail,
    close: () => context.close(),
  };
}

/**
 * A live game whose files are really in the bucket: sent the way a maker sends it (`submitGame`), then given staff's
 * yes as a row. Only a journey that loads the game's files needs one; it costs 8 to 14 seconds a project, so a file
 * makes the games it needs once and its journeys share them, unless a journey changes its game.
 */
export async function addGame(
  browser: Browser,
  options: {
    free?: boolean;
    playsOn?: "phone_and_computer" | "computer_only";
    /** Where its files come from: 2048, a real game, unless a journey needs the tiny game's look at the page around it. */
    repo?: string;
  } = {},
): Promise<{
  slug: string;
  name: string;
  publicId: string;
  id: string;
  makerUserId: string;
  makerEmail: string;
}> {
  const repo = options.repo ?? TWENTY_48;
  const submitted = await submitGame(browser, repo);
  const slug = submitted.slug;
  // A game that is 2048 is called 2048, so its pictures and its menu read true.
  const name = repo === TWENTY_48 ? freshName("2048") : submitted.name;
  await putGameWhereStaffLeaveIt(slug, { state: "live" });
  await changeGame(slug, {
    name,
    ...(options.free === true ? { freeToPlay: true } : {}),
    ...(options.playsOn === undefined ? {} : { playsOn: options.playsOn }),
  });
  return { slug, name, ...(await makerOf(slug)) };
}

/** The game's maker, in a browser of their own, signs in and takes the game off Ruken on the real screens. */
export async function takeOffAsItsMaker(
  browser: Browser,
  game: { slug: string; name: string; makerEmail: string },
): Promise<void> {
  const context = await browser.newContext({ baseURL: SITE_URL });
  try {
    const page = await context.newPage();
    await signInAs(page, game.makerEmail);
    await page.goto(`/make/${game.slug}/take-off`);
    await page.getByRole("button", { name: "Take it off" }).click();
    await expect(page.getByRole("heading", { name: "Taken off Ruken" })).toBeVisible();
  } finally {
    await context.close();
  }
}

/**
 * 2048 has loaded in the play screen's frame: its board has the colour its own stylesheet gives it, so a second file
 * loaded under the pass, and the pass reaches every file. It reads a style, not a tile, because a tile is drawn on
 * the next animation frame, which a journey that holds the clock never lets come.
 */
export async function expectTheGameLoaded(page: Page): Promise<void> {
  await expect(page.frameLocator("iframe.frame").locator(".game-container")).toHaveCSS(
    "background-color",
    "rgb(187, 173, 160)",
  );
}

/** Signs a new person up and makes them a curator, who checks games. Staff roles are read fresh on every request. */
export async function signInAsStaff(page: Page): Promise<{ email: string }> {
  const { email } = await signUp(page);
  await grantStaffRole(email, "curator");
  return { email };
}
