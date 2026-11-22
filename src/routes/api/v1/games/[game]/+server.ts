import {
  gamesServices,
  ownGameOr404,
  type AgeRating,
  type Answer,
  type ContentMark,
} from "../../../../../features/games/games.ts";
import { api, gameProblem, maker, problem, readJson } from "../../api.server.ts";
import { onGame } from "../game-call.server.ts";
import type { RequestHandler } from "./$types";

const AGES: readonly string[] = ["age_3", "age_7", "age_12", "age_16", "age_18"];
const MARKS: readonly string[] = ["sex_or_nudity", "gore", "drugs", "none"];
const BAD = "That didn't work. Try again.";

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((one) => typeof one === "string");

// One game: where it stands, what is left, what was sent back, what waits for review. Someone else's game is a 404.
export const GET: RequestHandler = api((event) => onGame(event, () => Promise.resolve()));

/**
 * Answers for a game, in one body: any of `name`, `oneLine`, `files`, `websites`, `ageRating` (with its `contentMarks`
 * in the same body, as the browser's 18+ answer keeps them together), `contentMarks` alone, and `playerCount`. Each goes
 * through the same save the browser's question calls, in this order, so a refusal reads as the screen's own.
 */
export const PATCH: RequestHandler = api(async (event) => {
  const body = await readJson(event.request);
  if (body === null) return problem(400, BAD);
  const answers: Answer[] = [];
  if (body.name !== undefined) {
    if (typeof body.name !== "string") return problem(400, BAD);
    answers.push({ question: "name", name: body.name });
  }
  if (body.oneLine !== undefined) {
    if (typeof body.oneLine !== "string") return problem(400, BAD);
    // As the browser does: a new line is a space, so a line stays one line.
    answers.push({ question: "line", oneLine: body.oneLine.replace(/\s*[\r\n]+\s*/g, " ") });
  }
  const files = body.files;
  if (files !== undefined) {
    if (typeof files !== "object" || files === null || Array.isArray(files)) return problem(400, BAD);
    const { repo, branch, folder } = files as Record<string, unknown>;
    if (typeof repo !== "string" || (branch !== null && typeof branch !== "string")) return problem(400, BAD);
    if (folder !== undefined && typeof folder !== "string") return problem(400, BAD);
    answers.push({
      question: "files",
      repo: { fullName: repo, branch: branch === "" ? null : (branch ?? null), folder: folder ?? "" },
    });
  }
  if (body.websites !== undefined) {
    if (!strings(body.websites)) return problem(400, BAD);
    answers.push({ question: "websites", connectHosts: body.websites });
  }
  if (
    body.contentMarks !== undefined &&
    !(strings(body.contentMarks) && body.contentMarks.every((m) => MARKS.includes(m)))
  ) {
    return problem(400, BAD);
  }
  if (body.ageRating !== undefined) {
    if (typeof body.ageRating !== "string" || !AGES.includes(body.ageRating)) return problem(400, BAD);
    answers.push({
      question: "age",
      ageRating: body.ageRating as AgeRating,
      ...(body.contentMarks === undefined ? {} : { contentMarks: body.contentMarks as ContentMark[] }),
    });
  } else if (body.contentMarks !== undefined) {
    answers.push({ question: "marks", contentMarks: body.contentMarks as ContentMark[] });
  }
  const count = body.playerCount;
  if (count !== undefined && typeof count !== "boolean") return problem(400, BAD);
  if (answers.length === 0 && count === undefined) return problem(400, BAD);

  return onGame(event, async ({ service, game, userId }) => {
    let slug = game.slug;
    for (const answer of answers) slug = (await service.saveAnswer(game.id, userId, answer)).slug;
    if (count !== undefined) await service.setShowsPlayerCount(game.id, userId, count);
    return { slug };
  });
});

// Throws a game away, as Your games does: only from the states the screen offers it. It cannot be undone.
export const DELETE: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const { service } = gamesServices();
  try {
    const game = await ownGameOr404(service, event.params.game, userId);
    const { name } = await service.throwAway(game.id, userId);
    return Response.json({ thrownAway: true, game: game.slug, name });
  } catch (error) {
    return gameProblem(error);
  }
});
