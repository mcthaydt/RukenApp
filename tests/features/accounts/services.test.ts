import { describe, expect, it } from "vitest";
import { createAuthServices } from "../../../src/features/accounts/services.ts";

const settings = {
  // Nothing here connects until the first query, so an unreachable database is fine.
  DATABASE_URL: "postgresql://postgres:x@127.0.0.1:1/ruken",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://ruken.example",
  SMTP_URL: "test:",
  MAIL_FROM: "Ruken <hello@ruken.test>",
};

describe("createAuthServices", () => {
  it("builds the sign-in services from the settings", async () => {
    const services = createAuthServices(settings);
    try {
      expect(services.cookies.sessionCookieName).toBe("__Host-rk_session");
      expect(typeof services.auth.handler).toBe("function");
      expect(services.handleDeps.cookies).toBe(services.cookies);
      expect(services.formDeps.baseURL).toBe("https://ruken.example");
      expect(services.signUpDeps.clock).toBe(services.clock);
    } finally {
      await services.prisma.$disconnect();
    }
  });

  it("refuses to start without the sign-in key, naming it", () => {
    expect(() => createAuthServices({ ...settings, BETTER_AUTH_SECRET: undefined })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("refuses to start without the mail address, naming it", () => {
    expect(() => createAuthServices({ ...settings, SMTP_URL: undefined })).toThrow(
      "Missing setting SMTP_URL",
    );
  });
});
