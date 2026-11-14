// Imports nothing, so the game gate (a separate Worker) can bundle it.

/**
 * Decodes the path inside a game once and refuses anything that could name a file outside it or a different
 * file than it seems to: `..` and `.` segments, empty segments (`//`), backslashes, NUL, and an encoded `/` or
 * `\` (which would otherwise become a separator after decoding). Returns null for a refused path, "" for the
 * game's own folder.
 */
export function normalizePath(raw: string): string | null {
  if (/%2f|%5c/i.test(raw)) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded === "") return "";
  if (decoded.includes("\\") || decoded.includes("\u0000")) return null;
  const segments = decoded.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  // A game's files are stored under their composed (NFC) Unicode name, so a name typed with a combining accent
  // still finds its file.
  return decoded.normalize("NFC");
}
