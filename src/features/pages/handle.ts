// The rules for a maker's address, the word after the first slash. Pure, so the form, the server and the router's matcher
// (src/params/) all say the same thing.

/** Lower-case letters and digits in runs joined by single hyphens. The database has the same rule. */
export const HANDLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/** Every word Ruken uses at the first level of its own address, so no maker's page can hide a screen. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set<string>();

/** The pattern and the two lengths. Reserved words are not looked at, so a reserved word still reaches its own route. */
export function isHandleShape(value: string): boolean {
  throw new Error(`not built yet: isHandleShape ${value}`);
}

/** What a person typed, made ready to check: trimmed, lower-case, no leading `@`. */
export function cleanHandle(raw: string): string {
  throw new Error(`not built yet: cleanHandle ${raw}`);
}

/** What is wrong with a cleaned address, in a person's words, or null when it is fine. */
export function handleProblem(raw: string): string | null {
  throw new Error(`not built yet: handleProblem ${raw}`);
}
