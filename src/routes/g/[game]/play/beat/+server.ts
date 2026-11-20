import { error } from "@sveltejs/kit";
import { playServices } from "../../../../../features/play/play.ts";
import type { RequestHandler } from "./$types";

// "Still here", from a play screen (spec 4.2). It reads no cookie and needs no sign-in: the session's own token is the
// proof, so a free game played by nobody is recorded too. The body is read as text and parsed whatever its
// content-type, because `navigator.sendBeacon` sends a string as text/plain.
const MAX_BODY_BYTES = 1000;

function beatOf(text: string): { session: string; token: string; attentive: boolean } | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) return null;
    const { session, token, attentive } = value as Record<string, unknown>;
    if (typeof session !== "string" || typeof token !== "string" || typeof attentive !== "boolean")
      return null;
    return { session, token, attentive };
  } catch {
    return null;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) error(400);
  const beat = beatOf(text);
  if (beat === null) error(400);
  const answer = await playServices().service.recordBeat({
    sessionId: beat.session,
    token: beat.token,
    attentive: beat.attentive,
  });
  if (answer === "recorded") return new Response(null, { status: 204 });
  if (answer === "too_soon") error(429);
  if (answer === "over") error(410);
  error(404);
};
