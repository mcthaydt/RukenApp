import { error, redirect } from "@sveltejs/kit";
import { GAME_STAFF_ROLES } from "../../../../features/accounts/accounts.ts";
import { gamesServices } from "../../../../features/games/games.ts";
import { membershipServices } from "../../../../features/membership/membership.ts";
import {
  GAME_FRAME_ALLOW,
  GAME_FRAME_SANDBOX,
  isPhone,
  playServices,
} from "../../../../features/play/play.ts";
import type { PageServerLoad } from "./$types";

// Playing a game: the game's own files in a frame on another address, under a pass made for this play. Who may play is
// the play feature's rule; this page only says who is asking. Someone who may not play is sent to the price card, and
// comes back here once they have joined.
export const load: PageServerLoad = async ({ params, locals, request, getClientAddress }) => {
  const game = await gamesServices().service.liveGameBySlug(params.game);
  if (game === null) error(404);
  // A phone cannot play a game made for a computer: its page says so and offers the link instead.
  if (game.playsOn === "computer_only" && isPhone(request.headers.get("user-agent")))
    redirect(303, `/g/${game.slug}`);

  const caller = locals.caller;
  const viewer =
    caller.kind === "user"
      ? {
          userId: caller.userId,
          isStaff: caller.staffRoles.some((role) => GAME_STAFF_ROLES.includes(role)),
          isMember: await membershipServices().service.isMember(caller.userId),
        }
      : null;
  const started = await playServices().service.startPlay({ game, viewer, clientAddress: getClientAddress() });
  if ("refused" in started) {
    if (started.refused === "join") redirect(303, `/join?next=${encodeURIComponent(`/g/${game.slug}/play`)}`);
    error(429);
  }
  return {
    name: game.name,
    slug: game.slug,
    frame: { src: started.frameUrl, sandbox: GAME_FRAME_SANDBOX, allow: GAME_FRAME_ALLOW },
    // For this page's own script, to count play time; it is never put in the frame's address.
    session: started.session,
  };
};
