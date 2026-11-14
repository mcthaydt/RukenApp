import { error } from "@sveltejs/kit";
import { grantFirstOwner } from "../../../features/accounts/accounts.ts";
import { prisma } from "../../../lib/server/db.ts";
import { hasJobSecret } from "../../../lib/server/job-secret.ts";
import type { RequestHandler } from "./$types";

/** The `email` of a JSON body, or null when the body is not JSON or holds no text there. */
async function emailOf(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json();
    const email = typeof body === "object" && body !== null ? (body as { email?: unknown }).email : undefined;
    return typeof email === "string" && email.trim() !== "" ? email : null;
  } catch {
    return null;
  }
}

// Makes the Owner's account the first staff account (the Owner runs it once, by command). Like the daily job, it
// answers 404 to anyone without the secret. It does nothing once any staff account exists.
export const POST: RequestHandler = async ({ request }) => {
  if (!hasJobSecret(request)) error(404, "Not found");
  const email = await emailOf(request);
  if (email === null)
    return Response.json({ problem: "Send the email address of the account." }, { status: 400 });

  switch (await grantFirstOwner(prisma(), email)) {
    case "granted":
      return Response.json({ granted: true });
    case "already_one":
      return Response.json({ problem: "There is already a staff account." }, { status: 409 });
    case "no_account":
      return Response.json(
        { problem: "No account has that email. Sign up on the site first." },
        { status: 400 },
      );
  }
};
