import { fail, redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import {
  connectHostsFrom,
  GameError,
  gamesServices,
  type GamePlaysOn,
} from "../../../features/games/games.ts";
import type { Actions, PageServerLoad } from "./$types";

// The new-game form (design 5.4). Before GitHub is connected it is one button; after, four short fields and one
// button. What a maker types is not believed: the repository must be one GitHub listed for them, and every field is
// checked again by the games service.

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  return {
    repositories: await gamesServices().service.repositoriesFor(userId),
    connectionFailed: url.searchParams.get("github") === "failed",
  };
};

/** A text field of the form, or "" when it is missing or is a file. */
function fieldOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Where the game runs: an unknown value is never trusted. */
function playsOnOf(value: string): GamePlaysOn {
  return value === "computer_only" ? "computer_only" : "phone_and_computer";
}

export const actions: Actions = {
  create: async ({ locals, request, url }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const { service } = gamesServices();
    const form = await request.formData();
    // What was typed comes back with a refusal, so nobody types it twice.
    const typed = {
      name: fieldOf(form, "name"),
      oneLine: fieldOf(form, "oneLine"),
      repo: fieldOf(form, "repo"),
      branch: fieldOf(form, "branch").trim(),
      folder: fieldOf(form, "folder").trim(),
      playsOn: playsOnOf(fieldOf(form, "playsOn")),
      servers: fieldOf(form, "servers"),
    };

    // The servers are read first: their refusal shows beside the box that holds them.
    const servers = connectHostsFrom(typed.servers);
    if ("problem" in servers) return fail(400, { ...typed, serversProblem: servers.problem });

    const made = await service
      .createGame({
        makerUserId: userId,
        name: typed.name,
        oneLine: typed.oneLine,
        playsOn: typed.playsOn,
        repo: {
          fullName: typed.repo,
          branch: typed.branch === "" ? null : typed.branch,
          folder: typed.folder,
        },
        connectHosts: servers.hosts,
      })
      .catch((error: unknown) => {
        if (error instanceof GameError) return error;
        throw error;
      });
    if (made instanceof GameError) return fail(400, { ...typed, error: made.message });

    // A refused pull is not a failed form: the game is made, and its page says what to fix.
    await service.pullLatest(made.id).catch((error: unknown) => {
      if (!(error instanceof GameError)) throw error;
    });
    redirect(303, `/make/${made.slug}`);
  },
};
