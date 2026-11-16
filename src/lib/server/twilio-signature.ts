// Checks that a post to the webhook came from Twilio (twilio.com/docs/usage/security, "Explore the algorithm
// yourself"). Uses the account's auth token, not the API key.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The signature Twilio puts in `X-Twilio-Signature`: HMAC-SHA1 over the address and then every form field's name
 * and value, sorted by name in byte order. The part of the address after `#` is not signed (Twilio's page on
 * connection overrides), so it is cut off.
 */
export function twilioSignatureOf(
  authToken: string,
  url: string,
  fields: ReadonlyMap<string, string>,
): string {
  const signed = url.split("#")[0] ?? url;
  const sorted = [...fields.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const text = sorted.reduce((whole, name) => `${whole}${name}${fields.get(name) ?? ""}`, signed);
  return createHmac("sha1", authToken).update(text).digest("base64");
}

/** Whether the header is the signature of this request. A missing or wrong-length header is false. */
export function isFromTwilio(
  authToken: string,
  url: string,
  fields: ReadonlyMap<string, string>,
  header: string | null,
): boolean {
  if (header === null) return false;
  const expected = Buffer.from(twilioSignatureOf(authToken, url, fields));
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
