import { authServices, finishSignIn } from "../../../../../features/accounts/accounts.ts";
import { api, problem, readJson, whoIs } from "../../api.server.ts";
import type { RequestHandler } from "./$types";

// The computer asks whether Yes was pressed. 202 means not yet. With a Yes it gets its key, once.
export const POST: RequestHandler = api(async ({ request }) => {
  const body = await readJson(request);
  const code = typeof body?.code === "string" ? body.code : "";
  const deviceSecret = typeof body?.deviceSecret === "string" ? body.deviceSecret : "";
  const services = authServices();
  const finished = await finishSignIn(services.computerDeps, { code, deviceSecret });
  switch (finished.status) {
    case "waiting":
      return Response.json({ waiting: true }, { status: 202 });
    case "slow":
      return problem(429, finished.problem);
    case "no":
      return problem(403, finished.problem);
    case "gone":
      return problem(404, finished.problem);
    case "yes":
      return Response.json({ key: finished.key, ...(await whoIs(finished.userId)) });
  }
});
