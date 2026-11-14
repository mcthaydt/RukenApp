// The rules for a maker's address, the word after the first slash. Pure, so the form, the server and the router's matcher
// (src/params/) all say the same thing.

/** Lower-case letters and digits in runs joined by single hyphens. The database has the same rule. */
export const HANDLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/**
 * Every word Ruken uses at the first level of its own address, so no maker's page can hide a screen. A test reads
 * the folders in `src/routes/` and the names in `static/` and fails until a new word is listed here.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin",
  "make",
  "me",
  "g",
  "join",
  "sign-in",
  "sign-up",
  "sign-out",
  "forgot-password",
  "reset-password",
  "goodbye",
  "api",
  "jobs",
  "webhooks",
  "healthz",
  "legal",
  "fonts",
  "favicon",
  "robots",
  "ruken",
  "about",
  "help",
  "support",
  "terms",
  "privacy",
  "feed",
  "play",
  "game",
  "games",
  "pay",
  "split",
  "staff",
  "team",
  "official",
  "login",
  "logout",
  "signin",
  "signup",
  "settings",
  "account",
  "www",
  "static",
  "assets",
  "media",
  "app",
  "new",
  "null",
  "undefined",
]);

/** The pattern and the two lengths. Reserved words are not looked at, so a reserved word still reaches its own route. */
export function isHandleShape(value: string): boolean {
  return value.length >= HANDLE_MIN && value.length <= HANDLE_MAX && HANDLE.test(value);
}

/** What a person typed, made ready to check: trimmed, lower-case, no leading `@`. */
export function cleanHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

/**
 * What is wrong with an address, in a person's words, or null when it is fine. The first problem found is the one
 * said. It cleans the address itself, so "Admin" and "admin" get the same answer. A reserved word gets the same
 * words as an address someone else has: which words Ruken keeps is nobody's business.
 */
export function handleProblem(raw: string): string | null {
  const handle = cleanHandle(raw);
  if (handle.length < HANDLE_MIN) return `Use at least ${String(HANDLE_MIN)} letters or numbers.`;
  if (handle.length > HANDLE_MAX) return `That's too long. Use ${String(HANDLE_MAX)} characters or fewer.`;
  if (!HANDLE.test(handle)) return "Use only letters, numbers and hyphens.";
  if (RESERVED_HANDLES.has(handle)) return "That one is taken. Pick another.";
  return null;
}
