import { error, fail, redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { GameError, gamesServices, type ClipShape } from "../../../features/games/games.ts";
import { agree, hasAgreed } from "../../../features/make/make.ts";
import { systemClock } from "../../../lib/clock.ts";
import { prisma } from "../../../lib/server/db.ts";
import type { Actions, PageServerLoad, RequestEvent } from "./$types";

// A game's page in the maker's area (design 5.4): the checklist a maker works down. Every action finds the game among
// the signed-in maker's own, so another maker's game is a 404 for every one of them, never a refusal that says it exists.

/**
 * The most a clip's request may be before its body is read: a 30 MB clip and the form around it. One clip per request
 * keeps the Worker well under its 128 MB (two clips in one form would be held in memory with their copies).
 */
const CLIP_REQUEST_MAX_BYTES = 31_000_000;

/** "1 file", "3 files". */
function filesWords(count: number): string {
  return count === 1 ? "1 file" : `${String(count)} files`;
}

/** A size a maker reads at a glance: under a megabyte in kilobytes, otherwise in megabytes with one decimal. */
function sizeWords(bytes: number): string {
  if (bytes < 1_000_000) return `${String(Math.max(1, Math.ceil(bytes / 1_000)))} KB`;
  return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, "")} MB`;
}

/** The signed-in maker and their game for this page's address. Someone else's game, or none, is a 404. */
async function ownGame(event: Pick<RequestEvent, "locals" | "params" | "url">) {
  const { userId } = signedInOnly(event.locals.caller, event.url);
  const game = await gamesServices().service.gameForMaker(event.params.game, userId);
  if (game === null) error(404, "Not found");
  return { userId, game };
}

/** The clip a form is for, from its address. Anything but the two shapes is not a page that exists. */
function shapeOf(value: string | null): ClipShape {
  if (value === "upright" || value === "wide") return value;
  error(404, "Not found");
}

export const load: PageServerLoad = async (event) => {
  const { userId, game } = await ownGame(event);
  const { address } = gamesServices();
  return {
    game,
    filesLine:
      game.newestPull === null
        ? null
        : `${filesWords(game.newestPull.fileCount)}, ${sizeWords(game.newestPull.totalBytes)}`,
    // Shown only until the maker has agreed once.
    agreed: await hasAgreed(prisma(), userId),
    address: address(`g-${game.publicId}`),
  };
};

export const actions: Actions = {
  // Copies the maker's latest files. A refused pull is not a failed form: the game's page says what to fix (the
  // game's `pullProblem`). A live game's update goes for review in the same press.
  pull: async (event) => {
    const { userId, game } = await ownGame(event);
    const { service } = gamesServices();
    const pulled = await service.pullLatest(game.id).then(
      () => true,
      (problem: unknown) => {
        if (problem instanceof GameError) return false;
        throw problem;
      },
    );
    if (pulled && game.state === "live") {
      await service.sendForReview(game.id, userId).catch((problem: unknown) => {
        if (!(problem instanceof GameError)) throw problem;
      });
    }
    redirect(303, `/make/${game.slug}`);
  },

  // One clip, one request. Its refusals show beside it (`clip`, which names the shape).
  clip: async (event) => {
    const { game } = await ownGame(event);
    const shape = shapeOf(event.url.searchParams.get("shape"));
    // Refused before the body is read, so a huge file is never held in the Worker.
    if (Number(event.request.headers.get("content-length") ?? "0") > CLIP_REQUEST_MAX_BYTES) {
      return fail(413, { clip: { shape, problem: "A clip can be up to 30 MB." } });
    }
    const file = (await event.request.formData()).get("clip");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { clip: { shape, problem: "Choose a video first." } });
    }
    try {
      await gamesServices().service.saveClip(game.id, shape, {
        contentType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    } catch (problem) {
      if (problem instanceof GameError) return fail(400, { clip: { shape, problem: problem.message } });
      throw problem;
    }
    redirect(303, `/make/${game.slug}`);
  },

  // The agreement is recorded when it is ticked, then the game is sent: what a maker agreed to stays agreed even when
  // the game turns out to lack a clip.
  send: async (event) => {
    const { userId, game } = await ownGame(event);
    const ticked = (await event.request.formData()).get("agree") !== null;
    const agreed = await hasAgreed(prisma(), userId);
    if (!agreed && !ticked) {
      return fail(400, { sendProblem: "Tick the box to agree to the maker agreement." });
    }
    if (!agreed) await agree(prisma(), systemClock, userId);
    try {
      await gamesServices().service.sendForReview(game.id, userId);
    } catch (problem) {
      if (problem instanceof GameError) return fail(400, { sendProblem: problem.message });
      throw problem;
    }
    redirect(303, `/make/${game.slug}`);
  },
};
