// `/sign-in?next=/me` sends a person back to the page they chose. `next` comes from the URL, so
// anyone can craft it. Redirecting to whatever it says would make Ruken an open redirect: a phishing
// mail could link to /sign-in?next=https://evil.example and the person would land on a look-alike
// page right after signing in.
//
// So `next` is accepted only as a path on our own origin:
// - it must start with exactly one "/" ("//evil.example" is a protocol-relative URL to another host,
//   and browsers treat "/\evil.example" the same way, so backslashes are refused anywhere);
// - it must not contain control characters (browsers strip tabs and newlines from URLs, which can
//   turn "/\n/evil.example" into "//evil.example").
// Anything else sends the person home.

const HOME = "/";

/** `raw` if it is a safe same-origin path, otherwise "/". */
export function safeNextPath(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return HOME;
  if (!raw.startsWith("/") || raw.startsWith("//")) return HOME;
  if (raw.includes("\\")) return HOME;
  if (hasControlCharacter(raw)) return HOME;
  return raw;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
