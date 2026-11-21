import { error } from "@sveltejs/kit";
import { attachPhoneToAccount } from "../../../features/accounts/accounts.ts";
import { prisma } from "../../../lib/server/db.ts";
import { hasJobSecret } from "../../../lib/server/job-secret.ts";
import type { RequestHandler } from "./$types";

/** The email and phone of a JSON body, or null when the body is not JSON or holds no text there. */
async function textsOf(request: Request): Promise<{ email: string; phone: string } | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) return null;
    const { email, phone } = body as { email?: unknown; phone?: unknown };
    return typeof email === "string" &&
      email.trim() !== "" &&
      typeof phone === "string" &&
      phone.trim() !== ""
      ? { email, phone }
      : null;
  } catch {
    return null;
  }
}

// Gives an account made by email, before sign-in moved to phone numbers, its phone number (the Owner runs it once,
// by command). Like the daily job, it answers 404 to anyone without the secret.
export const POST: RequestHandler = async ({ request }) => {
  if (!hasJobSecret(request)) error(404, "Not found");
  const given = await textsOf(request);
  if (given === null)
    return Response.json({ problem: "Send the email of the account and the phone number." }, { status: 400 });

  switch (await attachPhoneToAccount(prisma(), given.email, given.phone)) {
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
