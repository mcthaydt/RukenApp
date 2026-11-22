import { error } from "@sveltejs/kit";
import { gamesServices } from "../../../../features/games/games.ts";
import { PHOTO_MAX_BYTES, pagesServices, THEMES } from "../../../../features/pages/pages.ts";
import { ownPage } from "../own-page.server";
import { refused, said, savedThenRooms } from "../page-words.server";
import type { Actions, PageServerLoad } from "./$types";

// One room of your page, each a question with Save. A word that is not a room is a page that does not exist.

const ROOMS = ["address", "name", "line", "photo", "colours"] as const;
type Room = (typeof ROOMS)[number];

function roomOf(word: string): Room {
  const found = ROOMS.find((room) => room === word);
  if (found === undefined) error(404, "Not found");
  return found;
}

export const load: PageServerLoad = async (event) => {
  const room = roomOf(event.params.room);
  const { page } = await ownPage(event);
  return {
    room,
    host: event.url.host,
    handle: page.handle,
    name: page.name,
    oneLine: page.oneLine,
    themeId: page.themeId,
    photo: page.photoKey === null ? null : gamesServices().media(page.photoKey),
    // Ruken's own colours first, then each offered combination as the tile it is shown by.
    themes: THEMES.map(({ id, ground, text, button, buttonText }) => ({
      id,
      ground,
      text,
      button,
      buttonText,
    })),
  };
};

export const actions: Actions = {
  answer: async (event) => {
    const room = roomOf(event.params.room);
    const { userId, page } = await ownPage(event);
    const data = await event.request.formData();
    const text = (key: string): string => {
      const value = data.get(key);
      return typeof value === "string" ? value : "";
    };
    const { service } = pagesServices();
    try {
      if (room === "address") {
        const handle = text("handle");
        await service.savePage(userId, { handle, name: page.name, oneLine: page.oneLine });
      } else if (room === "name") {
        await service.savePage(userId, { handle: page.handle, name: text("name"), oneLine: page.oneLine });
      } else if (room === "line") {
        await service.savePage(userId, { handle: page.handle, name: page.name, oneLine: text("line") });
      } else if (room === "colours") {
        // A number that is not a whole number is no colour at all.
        const asked = Number(text("theme"));
        if (!Number.isInteger(asked)) return said("Pick one of the colours shown.");
        await service.saveTheme(userId, asked);
      } else {
        const file = data.get("photo");
        if (!(file instanceof File) || file.size === 0) return said("Pick a photo first.");
        // A file far over the limit is refused before it is read into memory; the service checks the rest.
        if (file.size > PHOTO_MAX_BYTES) {
          return said("That photo is too big. A photo can be up to 5 MB.");
        }
        const upload = { contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
        await service.savePhoto(userId, upload);
      }
    } catch (problem) {
      return refused(problem, { handle: text("handle"), name: text("name"), line: text("line") });
    }
    savedThenRooms(event.cookies, "Saved.");
  },

  removePhoto: async (event) => {
    roomOf(event.params.room);
    const { userId } = await ownPage(event);
    try {
      await pagesServices().service.removePhoto(userId);
    } catch (problem) {
      return refused(problem, {});
    }
    savedThenRooms(event.cookies, "Photo removed.");
  },
};
