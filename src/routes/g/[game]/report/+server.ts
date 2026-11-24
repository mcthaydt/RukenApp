import { error } from "@sveltejs/kit";
import { adultsOnlyRefusal } from "../../../../features/accounts/accounts.ts";
import { gamesServices } from "../../../../features/games/games.ts";
import { moderationServices, readReport } from "../../../../features/moderation/moderation.ts";
import type { RequestHandler } from "./$types";

// A player's report on a game (report-a-game spec): the sheet reads it (GET), sends it or a change to it (PUT) and takes
// it back (DELETE), all as JSON. Only the sheet's script calls here: a page on another site cannot send JSON with the
// person's cookies without the browser asking this site first, and nothing here says yes to that.

/** What the sheet shows when it opens. */
export type ReportView =
  | { state: "signed-out"; signIn: string }
  | { state: "own" }
  | { state: "none" }
  | { state: "reported"; reason: string; note: string };

/** A live game this caller may see, or the same refusal its page gives. */
async function gameFor(slug: string, caller: App.Locals["caller"]) {
  const game = await gamesServices().service.liveGameBySlug(slug);
  if (game === null) error(404);
  const refusal = await adultsOnlyRefusal(game.ageRating, caller);
  if (refusal !== null) error(403, refusal);
  return game;
}

const said = (words: string, status: number) => Response.json({ problem: words }, { status });

export const GET: RequestHandler = async ({ params, locals }) => {
  const game = await gameFor(params.game, locals.caller);
  const caller = locals.caller;
  let view: ReportView;
  if (caller.kind !== "user")
    view = { state: "signed-out", signIn: `/sign-in?next=${encodeURIComponent(`/g/${game.slug}`)}` };
  else if (caller.userId === game.makerUserId) view = { state: "own" };
  else {
    const mine = await moderationServices().reports.mine(caller.userId, game.id);
    view =
      mine === null ? { state: "none" } : { state: "reported", reason: mine.reason, note: mine.note ?? "" };
  }
  return Response.json(view, { headers: { "cache-control": "no-store" } });
};

export const PUT: RequestHandler = async ({ params, locals, request }) => {
  const game = await gameFor(params.game, locals.caller);
  if (locals.caller.kind !== "user") return said("Sign in to report a game.", 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = readReport(body);
  if ("problem" in input) return said(input.problem, 400);
  const outcome = await moderationServices().reports.save(locals.caller.userId, game, input);
  if (outcome === "own") return said("This is your game, so you can't report it.", 403);
  if (typeof outcome === "object")
    return new Response(JSON.stringify({ problem: "You've sent a lot of reports. Try again later." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(outcome.limited) },
    });
  return Response.json({ saved: outcome });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const game = await gameFor(params.game, locals.caller);
  if (locals.caller.kind !== "user") return said("Sign in to report a game.", 401);
  await moderationServices().reports.withdraw(locals.caller.userId, game.id);
  return Response.json({ withdrawn: true });
};
