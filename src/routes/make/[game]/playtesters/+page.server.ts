import { error, fail, redirect } from "@sveltejs/kit";
import { gamesServices } from "../../../../features/games/games.ts";
import { launchServices } from "../../../../features/launch/launch.ts";
import { linkPath, PLAYTEST_WORDS, playtestServices } from "../../../../features/playtest/playtest.ts";
import { ownGame } from "../../own-game.server.ts";
import type { Actions, PageServerLoad, RequestEvent } from "./$types";

// The maker's Playtesters page (playtesting spec): the switch, Invite, who is asking and who is playing. Only the game's
// maker reaches it (anyone else gets the 404 ownGame gives). A game that is not live, or any game from launch on, has no
// playtesting, so the page and every action send to the game's own maker screen (Live, for a live game).

/** The maker, their game, and the launch time, or the way to the game's maker screen when there is no playtesting. */
async function playtestGame(event: RequestEvent) {
  const { userId, game } = await ownGame(event);
  const now = launchServices().now(event.cookies);
  const page = await playtestServices().service.pageFor(userId, game.slug, now);
  if (page === null) redirect(303, `/make/${game.slug}`);
  return { userId, game, now, page };
}

/** The row an action names, from the form: a row of this game or nothing changes (the service checks the game). */
function rowOf(form: FormData): string {
  const row = form.get("row");
  if (typeof row !== "string" || row === "") error(404, "Not found");
  return row;
}

export const load: PageServerLoad = async (event) => {
  const { userId, game, now, page } = await playtestGame(event);
  const service = playtestServices().service;
  // The invite sheet is open (?invite): its link, made the first time it is asked for, and the maker's friends.
  const inviting = event.url.searchParams.has("invite");
  const [token, faces] = inviting
    ? await Promise.all([service.linkFor(userId, game.slug, now), service.inviteFaces(userId, game.slug)])
    : [null, []];
  const media = (key: string) => gamesServices().media(key);
  return {
    page,
    backdrop: {
      upright: game.clips.upright === null ? null : media(game.clips.upright.key),
      wide: game.clips.wide === null ? null : media(game.clips.wide.key),
    },
    invite: token === null ? null : { link: `${event.url.origin}${linkPath(token)}`, faces },
  };
};

export const actions: Actions = {
  // The switch posts the state it wants, so a second press of an old page says the same thing twice.
  asking: async (event) => {
    const { userId, game, now } = await playtestGame(event);
    const wanted = (await event.request.formData()).get("asking");
    if (wanted !== "on" && wanted !== "off") return fail(400, { problem: PLAYTEST_WORDS.failed });
    await playtestServices().service.setAsking(userId, game.slug, wanted === "on", now);
    return { done: true };
  },
  answer: async (event) => {
    const { userId, game, now } = await playtestGame(event);
    const form = await event.request.formData();
    await playtestServices().service.answer(userId, game.slug, rowOf(form), form.get("yes") === "yes", now);
    return { done: true };
  },
  remove: async (event) => {
    const { userId, game, now } = await playtestGame(event);
    await playtestServices().service.remove(userId, game.slug, rowOf(await event.request.formData()), now);
    return { done: true };
  },
  // A face in the invite sheet: someone who is not the maker's friend is a 404, as the spec says.
  invite: async (event) => {
    const { userId, game, now } = await playtestGame(event);
    const handle = (await event.request.formData()).get("handle");
    if (typeof handle !== "string" || handle === "") error(404, "Not found");
    const done = await playtestServices().service.invite(userId, game.slug, handle, now);
    if (done === "refused") error(404, "Not found");
    return { invited: handle };
  },
  newLink: async (event) => {
    const { userId, game, now } = await playtestGame(event);
    await playtestServices().service.newLink(userId, game.slug, now);
    redirect(303, `/make/${game.slug}/playtesters?invite`);
  },
};
