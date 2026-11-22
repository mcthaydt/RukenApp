import { error } from "@sveltejs/kit";
import { ageCheck, attachPhoneToAccount, type BirthDate } from "../../../features/accounts/accounts.ts";
import { systemClock } from "../../../lib/clock.ts";
import { prisma } from "../../../lib/server/db.ts";
import { hasJobSecret } from "../../../lib/server/job-secret.ts";
import type { RequestHandler } from "./$types";

/**
 * The email and phone of a JSON body, and a birth date if one came ("birthDate": {"year","month","day"}), or null when
 * the body holds no text there, or "not_json" when the body is not JSON at all. A birth date that is not whole numbers
 * is `bad_birth_date`.
 */
async function textsOf(
  request: Request,
): Promise<
  { email: string; phone: string; birthDate: BirthDate | "bad_birth_date" | null } | "not_json" | null
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return "not_json";
  }
  if (typeof body !== "object" || body === null) return null;
  const { email, phone, birthDate } = body as { email?: unknown; phone?: unknown; birthDate?: unknown };
  if (typeof email !== "string" || email.trim() === "" || typeof phone !== "string" || phone.trim() === "")
    return null;
  if (birthDate === undefined) return { email, phone, birthDate: null };
  const { year, month, day } = (typeof birthDate === "object" && birthDate !== null ? birthDate : {}) as {
    year?: unknown;
    month?: unknown;
    day?: unknown;
  };
  return {
    email,
    phone,
    birthDate:
      Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
        ? { year: year as number, month: month as number, day: day as number }
        : "bad_birth_date",
  };
}

// Gives an account made by email, before sign-in moved to phone numbers, its phone number (the Owner runs it once,
// by command). Like the daily job, it answers 404 to anyone without the secret.
export const POST: RequestHandler = async ({ request }) => {
  if (!hasJobSecret(request)) error(404, "Not found");
  const given = await textsOf(request);
  if (given === "not_json")
    return Response.json(
      { problem: "That is not written the way the command needs. A number such as 03 must be written 3." },
      { status: 400 },
    );
  if (given === null)
    return Response.json({ problem: "Send the email of the account and the phone number." }, { status: 400 });

  // An account made before the age question has no age on file; a birth date given here sets it (once, never over one).
  let adultOn: string | undefined;
  if (given.birthDate !== null) {
    const age = given.birthDate === "bad_birth_date" ? null : ageCheck(given.birthDate, systemClock);
    if (age === null || age.kind === "invalid" || age.kind === "under13")
      return Response.json({ problem: "That is not a birth date we can use." }, { status: 400 });
    adultOn = age.adultOn;
  }

  switch (await attachPhoneToAccount(prisma(), given.email, given.phone, adultOn)) {
    case "attached":
      return Response.json({ attached: true });
    case "no_account":
      return Response.json({ problem: "No account has that email." }, { status: 400 });
    case "has_number":
      return Response.json({ problem: "That account already has a phone number." }, { status: 409 });
    case "number_taken":
      return Response.json({ problem: "Another account already has that number." }, { status: 409 });
    case "bad_number":
      return Response.json({ problem: "That is not a phone number we can use." }, { status: 400 });
  }
};
