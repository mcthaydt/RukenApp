import { feedServices } from "../../../features/feed/feed.ts";
import type { RequestHandler } from "./$types";

// Which ranker puts the feed in order right now (the private Worker, or the open order standing in for it) and what it
// says of its own settings. It names no setting and no game, so anyone who asks learns nothing about the order.
export const GET: RequestHandler = async () =>
  Response.json(await feedServices().service.health(), { headers: { "cache-control": "no-store" } });
