import { playServices } from "../../../../../features/play/play.ts";
import type { RequestHandler } from "./$types";

// A playing page's "still here", every 15 seconds and once more as it closes. It needs no sign-in and reads no cookie:
// the session's token is the proof, so free play by nobody is counted too. The body is read as text and parsed as
// JSON whatever its type, because a page that is closing sends it with `navigator.sendBeacon`, as text/plain.

/** A beat is three short fields; anything longer is not one. */
const LONGEST_BEAT_BYTES = 1_000;

/** What the server said, as an answer: taken, too soon after the last, the session is over, or no such session. */
const STATUS = { recorded: 204, too_soon: 429, over: 410, unknown: 404 } as const;

/** The beat in a body, or null when the body is not exactly a beat. */
function beatOf(text: string): { sessionId: string; token: string; attentive: boolean } | null {
  if (new TextEncoder().encode(text).length > LONGEST_BEAT_BYTES) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const { session, token, attentive } = body as Record<string, unknown>;
  if (typeof session !== "string" || typeof token !== "string" || typeof attentive !== "boolean") return null;
  return { sessionId: session, token, attentive };
}

export const POST: RequestHandler = async ({ request }) => {
  const beat = beatOf(await request.text());
  if (beat === null) return new Response(null, { status: 400 });
  const result = await playServices().service.recordBeat(beat);
  return new Response(null, { status: STATUS[result] });
};
