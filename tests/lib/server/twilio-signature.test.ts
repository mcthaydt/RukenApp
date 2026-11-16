import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isFromTwilio, twilioSignatureOf } from "../../../src/lib/server/twilio-signature.ts";

// The worked example on Twilio's page "Security" (twilio.com/docs/usage/security, "Explore the algorithm yourself",
// read 2026-11-16).
const URL_SIGNED = "https://example.com/myapp.php?foo=1&bar=2";
const TOKEN = "12345";
const FIELDS = new Map([
  ["CallSid", "CA1234567890ABCDE"],
  ["Caller", "+14158675310"],
  ["Digits", "1234"],
  ["From", "+14158675310"],
  ["To", "+18005551212"],
]);
const SIGNATURE = "L/OH5YylLD5NRKLltdqwSvS0BnU=";

describe("twilioSignatureOf", () => {
  it("makes the signature on Twilio's page", () => {
    expect(twilioSignatureOf(TOKEN, URL_SIGNED, FIELDS)).toBe(SIGNATURE);
  });

  it("signs fields given in another order the same", () => {
    const reversed = new Map([...FIELDS].reverse());
    expect(twilioSignatureOf(TOKEN, URL_SIGNED, reversed)).toBe(SIGNATURE);
  });

  it("sorts by byte, so a capital letter comes before a small one", () => {
    // Twilio: "Unix-style case-sensitive sorting order", not a dictionary's.
    const fields = new Map([
      ["a", "1"],
      ["B", "2"],
    ]);
    const byByte = createHmac("sha1", TOKEN).update("https://x.test/B2a1").digest("base64");
    expect(twilioSignatureOf(TOKEN, "https://x.test/", fields)).toBe(byByte);
  });

  it("leaves out the part of the address after #, which Twilio does not sign", () => {
    expect(twilioSignatureOf(TOKEN, `${URL_SIGNED}#rc=3&rp=5xx,ct,rt`, FIELDS)).toBe(SIGNATURE);
  });
});

describe("isFromTwilio", () => {
  it("accepts the right signature", () => {
    expect(isFromTwilio(TOKEN, URL_SIGNED, FIELDS, SIGNATURE)).toBe(true);
  });

  it("refuses one changed value", () => {
    const changed = new Map(FIELDS).set("Digits", "1235");
    expect(isFromTwilio(TOKEN, URL_SIGNED, changed, SIGNATURE)).toBe(false);
  });

  it("refuses another address, another token and an added field", () => {
    expect(isFromTwilio(TOKEN, "https://example.com/other", FIELDS, SIGNATURE)).toBe(false);
    expect(isFromTwilio("54321", URL_SIGNED, FIELDS, SIGNATURE)).toBe(false);
    expect(isFromTwilio(TOKEN, URL_SIGNED, new Map(FIELDS).set("Body", "hi"), SIGNATURE)).toBe(false);
  });

  it("refuses a missing header, an empty one and one of another length", () => {
    expect(isFromTwilio(TOKEN, URL_SIGNED, FIELDS, null)).toBe(false);
    expect(isFromTwilio(TOKEN, URL_SIGNED, FIELDS, "")).toBe(false);
    expect(isFromTwilio(TOKEN, URL_SIGNED, FIELDS, SIGNATURE.slice(1))).toBe(false);
    expect(isFromTwilio(TOKEN, URL_SIGNED, FIELDS, `${SIGNATURE}A`)).toBe(false);
  });
});
