/**
 * Whether a request's body is too big to read, judged from its `Content-Length` before a byte is read, so a huge file is
 * never held in the Worker. A screen's form with no length is let through (the browser always sends one); the API asks
 * for the length (`needLength`), since a program might leave it out, and counts a missing one as too big.
 */
export function bodyTooBig(request: Request, max: number, needLength = false): boolean {
  const length = request.headers.get("content-length");
  if (length === null) return needLength;
  const bytes = Number(length);
  return !Number.isFinite(bytes) || bytes < 0 || bytes > max;
}
