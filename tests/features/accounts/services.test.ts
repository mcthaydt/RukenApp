import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { createAuthServices } from "../../../src/features/accounts/services.ts";
import { databasePerRequest, type PrismaClient } from "../../../src/lib/server/db.ts";

const settings = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://ruken.example",
  RESEND_API_KEY: "re_test_fake",
  MAIL_FROM: "Ruken <hello@ruken.test>",
};

/**
 * Runs `work` the way the site first builds the services: inside a request. better-auth reads its database
 * client once while it starts (`prismaAdapter` reads `_runtimeDataModel`), and outside a request the shared
 * `prisma()` throws, which would surface as an unhandled rejection that fails the whole run. An empty object
 * has no data model, so better-auth skips that check. Nothing here talks to a database.
 */
async function inRequest(work: () => void): Promise<void> {
  await databasePerRequest(() => ({}) as PrismaClient)({
    event: {} as RequestEvent,
    resolve: () => {
      work();
      return Promise.resolve(new Response("ok"));
    },
  });
}

describe("createAuthServices", () => {
  it("builds the sign-in services from the settings", async () => {
    await inRequest(() => {
      const services = createAuthServices(settings);
      expect(services.cookies.sessionCookieName).toBe("__Host-rk_session");
      expect(typeof services.auth.handler).toBe("function");
      expect(services.handleDeps.cookies).toBe(services.cookies);
      expect(services.formDeps.baseURL).toBe("https://ruken.example");
      expect(services.signUpDeps.clock).toBe(services.clock);
    });
  });

  it("refuses to start without the sign-in key, naming it", async () => {
    await inRequest(() => {
      expect(() => createAuthServices({ ...settings, BETTER_AUTH_SECRET: undefined })).toThrow(
        /BETTER_AUTH_SECRET/,
      );
    });
  });

  it("refuses to start without the mail key, naming it", async () => {
    await inRequest(() => {
      expect(() => createAuthServices({ ...settings, RESEND_API_KEY: undefined })).toThrow(
        "Missing setting RESEND_API_KEY",
      );
    });
  });
});
