import { error, redirect } from "@sveltejs/kit";
import { GAME_STAFF_ROLES } from "../../../../features/accounts/accounts.ts";
import { gamesServices } from "../../../../features/games/games.ts";
import { membershipServices } from "../../../../features/membership/membership.ts";
import { pagesServices } from "../../../../features/pages/pages.ts";
import {
  GAME_FRAME_ALLOW,
  GAME_FRAME_SANDBOX,
  playServices,
  type PlayViewer,
} from "../../../../features/play/play.ts";
import type { PageServerLoad } from "./$types";

// Playing a game (spec 4). Someone who may not play is sent to the price card; a game that is not live is the missing
// page, so a game taken off is gone on the next load.
export const load: PageServerLoad = async ({ params, locals, getClientAddress }) => {
  const game = await gamesServices().service.liveGameBySlug(params.game);
  if (game === null) error(404);

  const caller = locals.caller;
  let viewer: PlayViewer | null = null;
  if (caller.kind === "user") {
    viewer = {
      userId: caller.userId,
      isStaff: caller.staffRoles.some((role) => GAME_STAFF_ROLES.includes(role)),
      isMember: await membershipServices().service.isMember(caller.userId),
    };
  }
  const started = await playServices().service.startPlay({ game, viewer, clientAddress: getClientAddress() });
  if ("refused" in started) {
    if (started.refused === "busy") error(429);
    redirect(303, `/join?next=${encodeURIComponent(`/g/${game.slug}/play`)}`);
  }

  const makerPage = await pagesServices().service.pageOf(game.makerUserId);
  return {
    name: game.name,
    slug: game.slug,
    makerName: makerPage?.name ?? null,
    frameUrl: started.frameUrl,
    // The token is for the page's own script (it sends the beats with it) and is in no address.
    session: started.session,
    frame: { sandbox: GAME_FRAME_SANDBOX, allow: GAME_FRAME_ALLOW },
  };
};
