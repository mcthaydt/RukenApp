import type { RequestEvent } from "@sveltejs/kit";
import { authServices, COMPUTER_WORDS } from "../../../features/accounts/accounts.ts";
import { failureStatus, GameError } from "../../../features/games/games.ts";

// What every endpoint under /api/v1 shares. The key is read once, by the request hook (handle.ts), and only here.
// A problem always comes back as {"problem": "<plain words>"}; a game, link or page that is not the key's maker's is a 404,
// never a 403, so a stranger learns nothing from how a refusal reads.

const REQUESTS_PER_MINUTE = { max: 120, windowMs: 60_000 } as const;
const UPLOADS_PER_HOUR = { max: 30, windowMs: 60 * 60_000 } as const;
/** The most a JSON body may be: nothing the maker's API takes in JSON is longer than a few lines of words. */
const JSON_MAX_BYTES = 20_000;

/**
 * Wraps an endpoint so a Response thrown from inside it (a 401 from `maker`, a 429) is the answer, and anything else that
 * goes wrong is a plain-words 500 that carries no detail: never a request header, never the key.
 */
export function api<Event extends RequestEvent>(handler: (event: Event) => Promise<Response>) {
  return async (event: Event): Promise<Response> => {
    try {
      return await handler(event);
    } catch (thrown) {
      if (thrown instanceof Response) return thrown;
      console.error(
        `api ${event.request.method} ${event.url.pathname} failed: ${thrown instanceof Error ? thrown.name : "unknown"}`,
      );
      return problem(500, "Something went wrong on our side. Try again in a moment.");
    }
  };
}

/** An answer with a problem in plain words. */
export function problem(status: number, words: string): Response {
  return Response.json({ problem: words }, { status });
}

/** The words for a refusal from the games feature, with the status the screens use for it (404 for "not found"). */
export function gameProblem(error: unknown): Response {
  if (!(error instanceof GameError)) throw error;
  return problem(error.code === "NOT_FOUND" ? 404 : failureStatus(error.code), error.message);
}

/**
 * The maker a request's key belongs to. A request with no working key is a 401, and a maker's 121st request in a
 * minute (all their keys together) is a 429. Throws the Response, so a route reads `const userId = await maker(event)`.
 */
export async function maker(event: Pick<RequestEvent, "locals">): Promise<string> {
  const { caller } = event.locals;
  if (caller.kind !== "computer") throw problem(401, COMPUTER_WORDS.signInAgain);
  const { limiter } = authServices().computerDeps;
  if (!(await limiter.hit(`api:v1:${caller.userId}`, REQUESTS_PER_MINUTE)).allowed) {
    throw problem(429, "Wait a minute and try again.");
  }
  return caller.userId;
}

/** Counts one upload against the maker's 30 an hour; throws the 429 when it is the 31st. */
export async function countUpload(userId: string): Promise<void> {
  const { limiter } = authServices().computerDeps;
  if (!(await limiter.hit(`api:v1-upload:${userId}`, UPLOADS_PER_HOUR)).allowed) {
    throw problem(429, "Wait a minute and try again.");
  }
}

/** A JSON object from the request, or null when the body is not one or is too big. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > JSON_MAX_BYTES) return null;
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Who a maker is, to say so in the terminal: the page address when they have a page, and the end of their number. */
export async function whoIs(userId: string): Promise<{ handle: string | null; phoneEnding: string | null }> {
  const { prisma } = authServices();
  const [page, user] = await Promise.all([
    prisma.makerPage.findUnique({ where: { userId }, select: { handle: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { phoneNumber: true } }),
  ]);
  return { handle: page?.handle ?? null, phoneEnding: user?.phoneNumber?.slice(-4) ?? null };
}
