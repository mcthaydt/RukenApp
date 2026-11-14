// Imports nothing, so the game gate (a separate Worker) can bundle it.

/** A slice of a file: where it starts and how many bytes it holds. */
export interface ByteRange {
  offset: number;
  length: number;
}

/**
 * One `bytes=` range. Returns "none" when there is no Range header or it asks for several ranges (then the whole
 * file is sent with 200, which RFC 9110 allows), and "unsatisfiable" for a range that starts past the end or
 * cannot be parsed.
 */
export function parseRange(header: string | null, size: number): ByteRange | "none" | "unsatisfiable" {
  if (header === null) return "none";
  const value = header.trim();
  if (!value.startsWith("bytes=") || value.includes(",")) return "none";
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (match === null) return "unsatisfiable";
  const [, startText = "", endText = ""] = match;
  if (startText === "" && endText === "") return "unsatisfiable";
  if (startText === "") {
    // `bytes=-N`: the last N bytes.
    const suffix = Math.min(Number(endText), size);
    if (suffix === 0) return "unsatisfiable";
    return { offset: size - suffix, length: suffix };
  }
  const start = Number(startText);
  const end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1);
  if (start >= size || end < start) return "unsatisfiable";
  return { offset: start, length: end - start + 1 };
}

/** Whether an `If-None-Match` header names the file's etag (weak or strong), or `*`. */
export function matchesEtag(header: string | null, etag: string): boolean {
  if (header === null) return false;
  return header.split(",").some((candidate) => {
    const value = candidate.trim();
    return value === "*" || value === etag || value === `W/${etag}`;
  });
}
