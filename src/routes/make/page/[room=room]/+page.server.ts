import { error, fail } from "@sveltejs/kit";
import { gamesServices } from "../../../../features/games/games.ts";
import { PageError, pagesServices } from "../../../../features/pages/pages.ts";
import { ownPage, savedAndBack, textOf } from "../own-page.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// One room of your page: one question and its answer (spec 5.5). Each action changes the signed-in maker's own page,
// whichever page the form names, so nobody can change another's.

type Room = "address" | "name" | "about" | "photo" | "colours";

/** A photo is cut down to a square of 512 pixels before it is sent, so this is far more than a photo is; it only stops a huge body. */
const PHOTO_REQUEST_MAX_BYTES = 6_000_000;

function roomOf(word: string): Room {
  if (word === "address" || word === "name" || word === "about" || word === "photo" || word === "colours") {
    return word;
  }
  // The matcher lets only these five through.
  return error(404, "Not found");
}

export const load: PageServerLoad = async (event) => {
  const room = roomOf(event.params.room);
  const { page } = await ownPage(event);
  return {
    room,
    host: event.url.host,
    address: page.handle,
    name: page.name,
    oneLine: page.oneLine,
    themeId: page.themeId,
    photo: page.photoKey === null ? null : gamesServices().media(page.photoKey),
  };
};

export const actions: Actions = {
  // The address, the name and the line are kept together by one save, so the other two are what the page has now.
  answer: async (event) => {
    const room = roomOf(event.params.room);
    const { userId, page } = await ownPage(event);
    const form = await event.request.formData();
    const service = pagesServices().service;
    // What was typed comes back with a refusal, so nobody types it twice.
    let typed = "";
    try {
      if (room === "colours") {
        typed = textOf(form, "themeId");
        // A number that is not a whole number is refused as a colour that is not offered.
        await service.saveTheme(userId, /^\d+$/.test(typed) ? Number(typed) : -1);
      } else if (room === "address") {
        typed = textOf(form, "handle");
        await service.savePage(userId, { handle: typed, name: page.name, oneLine: page.oneLine });
      } else if (room === "name") {
        typed = textOf(form, "name");
        await service.savePage(userId, { handle: page.handle, name: typed, oneLine: page.oneLine });
      } else if (room === "about") {
        // A new line (a paste, or a keyboard with no script) is a space, so the line stays one line.
        typed = textOf(form, "oneLine").replace(/\s*[\r\n]+\s*/g, " ");
        await service.savePage(userId, { handle: page.handle, name: page.name, oneLine: typed });
      } else {
        return error(404, "Not found");
      }
    } catch (problem) {
      if (problem instanceof PageError) return fail(400, { problem: problem.message, value: typed });
      throw problem;
    }
    return savedAndBack(event);
  },

  // The photo the maker chose, already cut square by the page when it has script.
  photo: async (event) => {
    if (roomOf(event.params.room) !== "photo") error(404, "Not found");
    const { userId } = await ownPage(event);
    // Refused before the body is read, so a huge file is never held in the Worker.
    if (Number(event.request.headers.get("content-length") ?? "0") > PHOTO_REQUEST_MAX_BYTES) {
      return fail(413, { problem: "A photo can be up to 5 MB.", value: "" });
    }
    const file = (await event.request.formData()).get("photo");
    if (!(file instanceof File) || file.size === 0)
      return fail(400, { problem: "Choose a photo first.", value: "" });
    try {
      await pagesServices().service.savePhoto(userId, {
        contentType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    } catch (problem) {
      if (problem instanceof PageError) return fail(400, { problem: problem.message, value: "" });
      throw problem;
    }
    return savedAndBack(event);
  },

  remove: async (event) => {
    if (roomOf(event.params.room) !== "photo") error(404, "Not found");
    const { userId } = await ownPage(event);
    await pagesServices().service.removePhoto(userId);
    return savedAndBack(event, "Photo removed.");
  },
};
