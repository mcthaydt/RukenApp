import { fail, redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import {
  connectHostsFrom,
  GameError,
  gameFieldProblems,
  gamesServices,
  type Answer,
  type GameField,
  type GamePlaysOn,
} from "../../../features/games/games.ts";
import type { Actions, PageServerLoad } from "./$types";

// The new-game form (design 5.4). Before GitHub is connected it is one button; after, four short fields and one
// button. What a maker types is not believed: the repository must be one GitHub listed for them, and every field is
// checked again by the games service.

/** The words for each box that is wrong, shown under that box: the form's fields, and the websites box. */
type NewGameProblems = Partial<Record<GameField | "servers", string>>;

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const { service } = gamesServices();
  return {
    repositories: await service.repositoriesFor(userId),
    // Connected with nothing chosen on GitHub is a different screen from not connected at all.
    connected: await service.hasConnectedGitHub(userId),
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

/** A refusal the service made in words is a value to answer with; anything else is a bug and goes on. */
function asRefusal(error: unknown): GameError {
  if (error instanceof GameError) return error;
  throw error;
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

    // A refusal gives back what was typed, the words for each box that is wrong, and words for the form as a whole.
    const refuse = (problems: NewGameProblems, error?: string) => fail(400, { ...typed, problems, error });

    // Every refusal is found at once, so a maker fixes the whole form in one go and each shows under its own box.
    const servers = connectHostsFrom(typed.servers);
    const problems: NewGameProblems = gameFieldProblems({
      name: typed.name,
      oneLine: typed.oneLine,
      repo: {
        fullName: typed.repo,
        branch: typed.branch === "" ? null : typed.branch,
        folder: typed.folder,
      },
    });
    if ("problem" in servers) problems.servers = servers.problem;
    if ("problem" in servers || Object.keys(problems).length > 0) return refuse(problems);

    // The old form asks every question at once; the service keeps one answer at a time. The game starts with its
    // name, takes each answer in turn (the website list before the files, so the pull records it), and is thrown
    // away again if one is refused, so a refused form leaves nothing behind.
    const branch = typed.branch === "" ? null : typed.branch;
    const started = await service.startGame({ makerUserId: userId, name: typed.name }).catch(asRefusal);
    if (started instanceof GameError) return refuse({ [started.field ?? "name"]: started.message });
    const answers: Answer[] = [
      { question: "line", oneLine: typed.oneLine },
      { question: "plays-on", playsOn: typed.playsOn },
      { question: "websites", connectHosts: servers.hosts },
      { question: "files", repo: { fullName: typed.repo, branch, folder: typed.folder } },
    ];
    let slug = started.slug;
    for (const answer of answers) {
      const kept = await service.saveAnswer(started.id, userId, answer).catch(asRefusal);
      if (!(kept instanceof GameError)) {
        slug = kept.slug;
        continue;
      }
      // A refused pull is not a failed form: the game is made, and its page says what to fix.
      if (kept.code === "FILES_REFUSED") continue;
      // What only the service can know (the repository is not one GitHub listed) shows under its box.
      await service.throwAway(started.id, userId);
      if (kept.field === undefined) return refuse({}, kept.message);
      return refuse({ [kept.field]: kept.message });
    }
    redirect(303, `/make/${slug}`);
  },
};
