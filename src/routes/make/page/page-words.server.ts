import { fail, redirect, type Cookies } from "@sveltejs/kit";
import { PageError } from "../../../features/pages/pages.ts";

// The one-time line a room says after it saves ("Saved."): set by the action that saved, read and cleared by the next
// look at the rooms, so a reload shows the plain list.
const SAVED = "page-saved";

/** Remembers what the rooms should say once, then sends the maker to them. */
export function savedThenRooms(cookies: Cookies, words: string, to = "/make/page"): never {
  cookies.set(SAVED, words, { path: "/make", httpOnly: true, sameSite: "lax", maxAge: 60 });
  redirect(303, to);
}

/** The line left by the last save, once. */
export function savedWords(cookies: Cookies): string | null {
  const words = cookies.get(SAVED) ?? null;
  if (words !== null) cookies.delete(SAVED, { path: "/make" });
  return words;
}

/**
 * A refusal from the pages service as a form's answer: its own words, and what was typed so the box keeps it. Anything
 * that is not a refusal is a real failure and goes on up.
 */
export function refused(problem: unknown, typed: Partial<Typed> = {}) {
  if (!(problem instanceof PageError)) throw problem;
  return said(problem.message, typed, problem.code === "NOT_FOUND" ? 404 : 400);
}

/** What a room's form may hand back to keep what was typed. Every refusal has all three, so a screen can read any. */
export interface Typed {
  handle: string;
  name: string;
  line: string;
}

/** A refusal in a person's words, with what was typed. */
export function said(problem: string, typed: Partial<Typed> = {}, status = 400) {
  return fail(status, {
    problem,
    handle: typed.handle ?? "",
    name: typed.name ?? "",
    line: typed.line ?? "",
  });
}
