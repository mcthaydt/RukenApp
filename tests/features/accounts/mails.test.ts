import { describe, expect, it } from "vitest";
import {
  passwordChangedMessage,
  passwordResetMessage,
  signInPausedMessage,
  verificationMessage,
} from "../../../src/features/accounts/mails.ts";

// Each mail says what it is, gives the one link, says how long it lasts, and says what to do if it
// was not expected. The link sits on a line of its own so a mail program makes it clickable.
const LINK = "https://ruken.test/api/auth/verify?token=abc";

describe("verificationMessage", () => {
  it("says what it is, carries the link on its own line, and says how long it lasts", () => {
    const message = verificationMessage("pat@example.test", LINK);
    expect(message.to).toBe("pat@example.test");
    expect(message.subject).toBe("Confirm your email for Ruken");
    expect(message.text.split("\n")).toContain(LINK);
    expect(message.text).toContain("24 hours");
    expect(message.text).toContain("you can ignore this email");
  });
});

describe("passwordResetMessage", () => {
  it("carries the link on its own line, says it lasts an hour, and says the password stays if unexpected", () => {
    const message = passwordResetMessage("pat@example.test", LINK);
    expect(message.subject).toBe("Reset your Ruken password");
    expect(message.text.split("\n")).toContain(LINK);
    expect(message.text).toContain("an hour");
    expect(message.text).toContain("Your password stays as it is");
  });
});

describe("passwordChangedMessage", () => {
  it("says the password changed, that every device was signed out, and what to do if it was not them", () => {
    const message = passwordChangedMessage("pat@example.test");
    expect(message.to).toBe("pat@example.test");
    expect(message.subject).toBe("Your Ruken password was changed");
    expect(message.text).toContain("signed you out on every device");
    expect(message.text).toContain("If it wasn't");
  });
});

describe("signInPausedMessage", () => {
  it("says sign-in with a password is paused for an hour, and that a reset still works", () => {
    const message = signInPausedMessage("pat@example.test");
    expect(message.subject).toBe("Password sign-in on your Ruken account is paused");
    expect(message.text).toContain("paused password sign-in for an hour");
    expect(message.text).toContain("Forgot your password?");
  });

  it("does not offer a sign-in link or a passkey, which this site does not have", () => {
    const text = signInPausedMessage("pat@example.test").text.toLowerCase();
    expect(text).not.toContain("sign-in link");
    expect(text).not.toContain("passkey");
  });
});
