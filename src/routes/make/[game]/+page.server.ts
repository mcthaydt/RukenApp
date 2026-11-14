import { error, fail, redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import {
  beforeSendWords,
  GameError,
  gamesServices,
  nextStepWords,
  type ClipShape,
  type MissingBeforeSend,
} from "../../../features/games/games.ts";
import { agree, hasAgreed, MAKER_AGREEMENT_TEXT, parseAgreement } from "../../../features/make/make.ts";
import { systemClock } from "../../../lib/clock.ts";
import { prisma } from "../../../lib/server/db.ts";
import { sizeWords } from "../../../lib/size-words.ts";
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
  return {
    game,
    filesLine:
      game.newestPull === null
        ? null
        : `${filesWords(game.newestPull.fileCount)}, ${sizeWords(game.newestPull.totalBytes)}`,
    // The one next step, in a line under the game's state.
    nextStep: nextStepWords({
      state: game.state,
      stateReason: game.reason,
      hasPending: game.hasPending,
      filesProblem: game.pullProblem !== null,
      upright: game.clips.upright !== null,
      wide: game.clips.wide !== null,
    }),
    // Shown only until the maker has agreed once, with the agreement to read in place beside the tick.
    agreed: await hasAgreed(prisma(), userId),
    agreement: parseAgreement(MAKER_AGREEMENT_TEXT).points,
    address: gamesServices().address(`g-${game.publicId}`),
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
      return fail(413, { clip: { shape, problem: "A video can be up to 30 MB." } });
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
  // the game turns out to lack a video. Everything still missing is said at once, so a maker is refused once.
  send: async (event) => {
    const { userId, game } = await ownGame(event);
    const ticked = (await event.request.formData()).get("agree") !== null;
    const agreed = await hasAgreed(prisma(), userId);
    if (!agreed && ticked) await agree(prisma(), systemClock, userId);
    const missing: MissingBeforeSend = {
      files: game.newestPull === null,
      upright: game.clips.upright === null,
      wide: game.clips.wide === null,
      agreement: !agreed && !ticked,
    };
    const sendProblem = beforeSendWords(missing);
    if (sendProblem !== null) return fail(400, { sendProblem, missing });
    try {
      await gamesServices().service.sendForReview(game.id, userId);
    } catch (problem) {
      // The service's own guard: nothing is known to be missing, so no box is marked.
      const none: MissingBeforeSend = { files: false, upright: false, wide: false, agreement: false };
      if (problem instanceof GameError) return fail(400, { sendProblem: problem.message, missing: none });
      throw problem;
    }
    redirect(303, `/make/${game.slug}`);
  },
};
