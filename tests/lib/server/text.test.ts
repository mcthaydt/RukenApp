import { describe, expect, it, vi } from "vitest";
import {
  createTwilioTexter,
  isMadeUpNumber,
  TextError,
  textFailureCode,
  type TwilioTexterOptions,
} from "../../../src/lib/server/text.ts";

// `typeof fetch` is named once, here: inside a test a local called `fetch` would be its own type.
type Fetch = typeof fetch;

const options: Omit<TwilioTexterOptions, "fetch"> = {
  accountSid: "AC1",
  apiKey: "SK1",
  apiSecret: "secret",
  services: { account: "MG-account", news: "MG-news" },
  statusCallback: "https://ruken.test/webhooks/twilio",
  allowlist: undefined,
};

/** A `fetch` that answers every request with this status and JSON body, and records what it was asked. */
function stub(status: number, body: unknown) {
  return vi.fn<Fetch>(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
}

const bodyOf = (init: RequestInit | undefined): string => (typeof init?.body === "string" ? init.body : "");
const urlOf = (url: Parameters<Fetch>[0] | undefined): string => (typeof url === "string" ? url : "");

function sentWith(fakeFetch: ReturnType<typeof stub>, extra: Partial<TwilioTexterOptions> = {}) {
  return createTwilioTexter({ ...options, ...extra, fetch: fakeFetch });
}

describe("createTwilioTexter, send", () => {
  it("posts the text to Twilio's Messages address with the line's service", async () => {
    const fakeFetch = stub(201, { sid: "SM123" });
    const result = await sentWith(fakeFetch).send({ to: "+13125551234", line: "news", body: "Ruken: hi" });

    const [url, init] = fakeFetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect(init?.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(bodyOf(init)))).toEqual({
      To: "+13125551234",
      Body: "Ruken: hi",
      MessagingServiceSid: "MG-news",
      StatusCallback: "https://ruken.test/webhooks/twilio",
    });
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Basic ${btoa("SK1:secret")}`);
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(result).toEqual({ sent: true, providerId: "SM123" });
  });

  it("uses the account service for the account line", async () => {
    const fakeFetch = stub(201, { sid: "SM1" });
    await sentWith(fakeFetch).send({ to: "+13125551234", line: "account", body: "Ruken: hi" });

    const init = fakeFetch.mock.calls[0]?.[1];
    expect(new URLSearchParams(bodyOf(init)).get("MessagingServiceSid")).toBe("MG-account");
  });

  it("posts to the address it is given instead of Twilio's, for the journeys' stand-in", async () => {
    const fakeFetch = stub(201, { sid: "SM1" });
    await sentWith(fakeFetch, { apiBase: "http://127.0.0.1:12114" }).send({
      to: "+13125551234",
      line: "account",
      body: "Ruken: hi",
    });

    expect(fakeFetch.mock.calls[0]?.[0]).toBe("http://127.0.0.1:12114/2010-04-01/Accounts/AC1/Messages.json");
  });

  it("texts only the allowlist when one is set", async () => {
    const fakeFetch = stub(201, { sid: "SM1" });
    const texter = sentWith(fakeFetch, { allowlist: " +13125551234, +13125551235 " });

    expect(await texter.send({ to: "+13125551299", line: "account", body: "Ruken: hi" })).toEqual({
      sent: false,
      why: "allowlist",
    });
    expect(fakeFetch).not.toHaveBeenCalled();
    expect(await texter.send({ to: "+13125551235", line: "account", body: "Ruken: hi" })).toEqual({
      sent: true,
      providerId: "SM1",
    });
  });

  it("never texts a made-up number, allowlist or not", async () => {
    const fakeFetch = stub(201, { sid: "SM1" });
    const texter = sentWith(fakeFetch, { allowlist: "+12125550123" });

    expect(await texter.send({ to: "+12125550123", line: "account", body: "Ruken: hi" })).toEqual({
      sent: false,
      why: "made_up",
    });
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("throws a TextError with the status and Twilio's code", async () => {
    const fakeFetch = stub(400, {
      code: 21610,
      message: "The message From/To pair violates a blacklist rule.",
    });
    const failure = await sentWith(fakeFetch)
      .send({ to: "+13125551234", line: "news", body: "Ruken: hi" })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(TextError);
    expect(textFailureCode(failure)).toBe("TWILIO 400 21610");
    expect((failure as TextError).twilioCode).toBe(21610);
  });

  it("keeps no Twilio code when the answer has none", async () => {
    const fakeFetch = vi.fn<Fetch>(() =>
      Promise.resolve(new Response("<html>bad gateway</html>", { status: 502 })),
    );
    const failure = await sentWith(fakeFetch)
      .send({ to: "+13125551234", line: "news", body: "Ruken: hi" })
      .catch((error: unknown) => error);

    expect(textFailureCode(failure)).toBe("TWILIO 502");
    expect((failure as TextError).twilioCode).toBeNull();
  });

  it("throws when a good answer carries no message id", async () => {
    const fakeFetch = stub(201, {});
    await expect(
      sentWith(fakeFetch).send({ to: "+13125551234", line: "news", body: "Ruken: hi" }),
    ).rejects.toBeInstanceOf(TextError);
  });
});

describe("textFailureCode", () => {
  it("logs nothing of the number or the body", () => {
    expect(textFailureCode(new Error("to +13125551234 failed"))).toBe("unknown error");
    expect(textFailureCode("+13125551234")).toBe("unknown error");
    expect(textFailureCode(null)).toBe("unknown error");
  });

  it("never carries the error's own message", async () => {
    const fakeFetch = stub(400, { code: 21211, message: "The 'To' number +13125551234 is not valid." });
    const failure = await sentWith(fakeFetch)
      .send({ to: "+13125551234", line: "account", body: "Ruken: your code is 123456." })
      .catch((error: unknown) => error);

    expect(textFailureCode(failure)).not.toMatch(/\+1312|123456/);
    expect((failure as Error).message).not.toMatch(/\+1312|123456/);
  });
});

describe("createTwilioTexter, changedHands", () => {
  const since = new Date("2026-11-01T23:30:00Z");
  const answerOf = (value: unknown) => stub(200, { reassigned_number: { is_number_reassigned: value } });

  it("asks whether a US number changed hands, with the day", async () => {
    const fakeFetch = answerOf("yes");
    const result = await sentWith(fakeFetch).changedHands("+13125551234", since);

    const [url, init] = fakeFetch.mock.calls[0] ?? [];
    expect(urlOf(url)).toBe(
      "https://lookups.twilio.com/v2/PhoneNumbers/%2B13125551234?Fields=reassigned_number&LastVerifiedDate=20261101",
    );
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Basic ${btoa("SK1:secret")}`);
    expect(result).toBe("yes");
  });

  it("passes no through", async () => {
    expect(await sentWith(answerOf("no")).changedHands("+13125551234", since)).toBe("no");
  });

  it("asks the stand-in's address when one is given", async () => {
    const fakeFetch = answerOf("no");
    await sentWith(fakeFetch, { lookupBase: "http://127.0.0.1:12114" }).changedHands("+13125551234", since);

    expect(urlOf(fakeFetch.mock.calls[0]?.[0])).toMatch(/^http:\/\/127\.0\.0\.1:12114\/v2\/PhoneNumbers\//);
  });

  it("cannot say for a number outside +1, with no request", async () => {
    const fakeFetch = answerOf("no");
    expect(await sentWith(fakeFetch).changedHands("+447700900123", since)).toBe("cannot_say");
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("cannot say when Twilio has no data, the field is missing, or the answer is odd", async () => {
    expect(await sentWith(answerOf("no_data_available")).changedHands("+13125551234", since)).toBe(
      "cannot_say",
    );
    expect(await sentWith(stub(200, {})).changedHands("+13125551234", since)).toBe("cannot_say");
    expect(await sentWith(answerOf("maybe")).changedHands("+13125551234", since)).toBe("cannot_say");
  });

  it("cannot say when Twilio answers 500, or the request throws, and never throws itself", async () => {
    expect(await sentWith(stub(500, {})).changedHands("+13125551234", since)).toBe("cannot_say");
    const broken = vi.fn<Fetch>(() => Promise.reject(new Error("offline")));
    expect(await sentWith(broken).changedHands("+13125551234", since)).toBe("cannot_say");
  });
});

describe("isMadeUpNumber", () => {
  it("knows the numbers kept for fiction", () => {
    expect(isMadeUpNumber("+12125550123")).toBe(true);
    expect(isMadeUpNumber("+12125550100")).toBe(true);
    expect(isMadeUpNumber("+12125551234")).toBe(false);
    expect(isMadeUpNumber("+442125550123")).toBe(false);
  });
});
