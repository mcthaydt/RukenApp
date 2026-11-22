import { api, maker, whoIs } from "../api.server.ts";
import type { RequestHandler } from "./$types";

// Who this key is for. The page address when the maker has a page; the end of their number always.
export const GET: RequestHandler = api(async (event) => Response.json(await whoIs(await maker(event))));
