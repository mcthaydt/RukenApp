import { agree, hasAgreed, MAKER_AGREEMENT_TEXT, parseAgreement } from "../../../../features/make/make.ts";
import { systemClock } from "../../../../lib/clock.ts";
import { prisma } from "../../../../lib/server/db.ts";
import { api, maker } from "../api.server.ts";
import type { RequestHandler } from "./$types";

// The maker agreement, whole, and whether this maker has agreed to this version. The command line prints it in full and
// then asks the person, so agreeing is always a person's own yes.
export const GET: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const { version, updated, points } = parseAgreement(MAKER_AGREEMENT_TEXT);
  return Response.json({ version, updated, points, agreed: await hasAgreed(prisma(), userId) });
});

// Recorded once: a second yes for the same version adds nothing.
export const POST: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  await agree(prisma(), systemClock, userId);
  return Response.json({ agreed: true });
});
