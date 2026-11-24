import { gamesServices } from "../../../../features/games/games.ts";
import type { RequestHandler } from "./$types";

// A clip's still: `/api/still/<clip key>?at=<second>&width=<width>`. Anyone may have it, as anyone may have the clip.
// A clip's key is new with every upload, so a still never changes and a browser keeps it for a year. With no still
// (no such clip, no media tool, or it failed) the answer is a plain 404 and the video shows as it did before stills.
export const GET: RequestHandler = async ({ params, url }) => {
  const second = Number(url.searchParams.get("at") ?? "0");
  const width = Number(url.searchParams.get("width") ?? "");
  const answer = await gamesServices().still(params.key, second, width);
  if (answer.kind === "none") {
    return new Response("No still.", { status: 404, headers: { "cache-control": "no-store" } });
  }
  return new Response(answer.bytes, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
};
