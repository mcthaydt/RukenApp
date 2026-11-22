import { error } from "@sveltejs/kit";
import { feedServices } from "../../../features/feed/feed.ts";
import type { RequestHandler } from "./$types";

// The feed's next page, which the feed screen asks for as a person nears the end of what it has. The feed never ends:
// every page has the address of the one after it. `after` is that address, as the page before gave it.
export const GET: RequestHandler = async ({ url }) => {
  const page = await feedServices().service.page(url.searchParams.get("after") ?? "");
  if (page === null) error(400, "That is not a page of the feed.");
  // A page depends on which games are live right now: never kept by a browser or a cache in between.
  return Response.json(page, { headers: { "cache-control": "no-store" } });
};
