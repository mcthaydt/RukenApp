import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { createAuthServices } from "../../../src/features/accounts/services.ts";
import { databasePerRequest, type PrismaClient } from "../../../src/lib/server/db.ts";

const settings = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://ruken.example",
  RESEND_API_KEY: "re_test_fake",
  MAIL_FROM: "Ruken <hello@ruken.test>",
  TWILIO_ACCOUNT_SID: "AC_test_fake",
  TWILIO_API_KEY: "SK_test_fake",
  TWILIO_API_SECRET: "test-fake-secret",
  TWILIO_ACCOUNT_SERVICE: "MG_test_account",
  TWILIO_NEWS_SERVICE: "MG_test_news",
  TWILIO_VERIFY_SERVICE: "VA_test_verify",
};

/**
 * Runs `work` the way the site first builds the services: inside a request. better-auth reads its database
 * client once while it starts (`prismaAdapter` reads `_runtimeDataModel`), and outside a request the shared
 * `prisma()` throws, which would surface as an unhandled rejection that fails the whole run. An empty object
 * has no data model, so better-auth skips that check. Nothing here talks to a database.
 */
async function inRequest(work: () => unknown): Promise<void> {
  await databasePerRequest(() => ({}) as PrismaClient)({
    event: {} as RequestEvent,
    resolve: async () => {
      await work();
      return new Response("ok");
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
      expect(typeof services.texter.sendCode).toBe("function");
    });
  });

  it.each([
    "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY",
    "TWILIO_API_SECRET",
    "TWILIO_ACCOUNT_SERVICE",
    "TWILIO_NEWS_SERVICE",
    "TWILIO_VERIFY_SERVICE",
  ])("refuses to start without %s, naming it", async (name) => {
    await inRequest(() => {
      expect(() => createAuthServices({ ...settings, [name]: undefined })).toThrow(`Missing setting ${name}`);
    });
  });

  it("takes the text service's address of a stand-in on this machine", async () => {
    await inRequest(() => {
      expect(() =>
        createAuthServices({ ...settings, TWILIO_API_BASE: "http://127.0.0.1:12114" }),
      ).not.toThrow();
    });
  });

  it("refuses a text service address that is not a stand-in on this machine, so the real site cannot be pointed away from Twilio", async () => {
    await inRequest(() => {
      expect(() => createAuthServices({ ...settings, TWILIO_API_BASE: "https://sms.example" })).toThrow(
        /TWILIO_API_BASE is for a stand-in on this machine only/,
      );
    });
  });

  it("texts only the allowlist when one is set, so a test copy cannot text strangers", async () => {
    await inRequest(() => {
      const services = createAuthServices({ ...settings, TEXT_ALLOWLIST: "+13125551234" });
      return expect(
        services.texter.send({ to: "+13125559999", line: "account", body: "Ruken: hi" }),
      ).resolves.toEqual({
        sent: false,
        why: "allowlist",
      });
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

  it("takes a mail address of a stand-in on this machine", async () => {
    await inRequest(() => {
      expect(() =>
        createAuthServices({ ...settings, RESEND_API_BASE: "http://127.0.0.1:12113" }),
      ).not.toThrow();
    });
  });

  it("refuses a mail address that is not a stand-in on this machine, so the real site cannot be pointed away from Resend", async () => {
    await inRequest(() => {
      expect(() => createAuthServices({ ...settings, RESEND_API_BASE: "https://mail.example" })).toThrow(
        /RESEND_API_BASE is for a stand-in on this machine only/,
      );
    });
  });
});
