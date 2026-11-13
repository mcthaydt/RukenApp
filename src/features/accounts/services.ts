import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { Mailer } from "../../lib/server/mail.ts";
import type { Auth } from "./auth.ts";
import type { CookiePolicy } from "./cookies.ts";
import type { FormDeps, SignUpDeps } from "./forms.ts";
import type { HandleDeps } from "./handle.ts";

type Settings = Readonly<Record<string, string | undefined>>;

export interface AuthServices {
  prisma: PrismaClient;
  clock: Clock;
  cookies: CookiePolicy;
  mailer: Mailer;
  auth: Auth;
  handleDeps: HandleDeps;
  formDeps: FormDeps;
  signUpDeps: SignUpDeps;
}

export function createAuthServices(source: Settings): AuthServices {
  throw new Error(`not built yet (${typeof source})`);
}

export function authServices(): AuthServices {
  throw new Error("not built yet");
}
