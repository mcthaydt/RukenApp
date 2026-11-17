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

interface Call {
  url: string;
  method: string | undefined;
  body: string;
  headers: Headers;
}

/** The sample numbers are not `555 01xx` ones: those are made-up numbers and are never texted. */
const REAL_LOOKING = "+13125551234";

/** A stand-in for `fetch` that answers each request in turn and keeps what it was asked. */
function stub(...answers: Response[]): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = [];
  let next = 0;
  const fake = vi.fn<Fetch>((input, init) => {
    calls.push({
      url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      method: init?.method,
      body: typeof init?.body === "string" ? init.body : "",
      headers: new Headers(init?.headers),
    });
    const answer = answers[Math.min(next, answers.length - 1)];
    next += 1;
    return Promise.resolve(answer ?? new Response("{}", { status: 200 }));
  });
  return { fetch: fake, calls };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function texterWith(
  fake: Fetch,
  extra: Partial<TwilioTexterOptions> = {},
): ReturnType<typeof createTwilioTexter> {
  return createTwilioTexter({
    accountSid: "AC1",
    apiKey: "SK1",
    apiSecret: "secret",
    services: { account: "MG-account", news: "MG-news" },
    verifyService: "VA1",
    allowlist: undefined,
    fetch: fake,
    ...extra,
  });
}

const formOf = (call: Call | undefined) => Object.fromEntries(new URLSearchParams(call?.body ?? ""));

describe("isMadeUpNumber", () => {
  it("knows the numbers kept for fiction, and no others", () => {
    expect(isMadeUpNumber("+12125550123")).toBe(true);
    expect(isMadeUpNumber("+13125550142")).toBe(true);
    expect(isMadeUpNumber("+12125551234")).toBe(false);
    expect(isMadeUpNumber("+442125550123")).toBe(false);
  });
});

describe("Texter.send", () => {
  it("posts the text to Twilio's Messages address with the line's service", async () => {
    const { fetch: fake, calls } = stub(json(201, { sid: "SM123" }));
    const result = await texterWith(fake).send({ to: REAL_LOOKING, line: "news", body: "Ruken: hi" });

    expect(calls[0]?.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect(calls[0]?.method).toBe("POST");
    expect(formOf(calls[0])).toEqual({
      To: REAL_LOOKING,
      Body: "Ruken: hi",
      MessagingServiceSid: "MG-news",
    });
    expect(calls[0]?.headers.get("authorization")).toBe(`Basic ${btoa("SK1:secret")}`);
    expect(result).toEqual({ sent: true, providerId: "SM123" });
  });

  it("uses the account line's service for the account line", async () => {
    const { fetch: fake, calls } = stub(json(201, { sid: "SM1" }));
    await texterWith(fake).send({ to: REAL_LOOKING, line: "account", body: "Ruken: hi" });
    expect(formOf(calls[0]).MessagingServiceSid).toBe("MG-account");
  });

  it("adds StatusCallback only when one is set", async () => {
    const withCallback = stub(json(201, { sid: "SM1" }));
    await texterWith(withCallback.fetch, { statusCallback: "https://ruken.test/webhooks/twilio" }).send({
      to: REAL_LOOKING,
      line: "account",
      body: "Ruken: hi",
    });
    expect(formOf(withCallback.calls[0]).StatusCallback).toBe("https://ruken.test/webhooks/twilio");

    const without = stub(json(201, { sid: "SM1" }));
    await texterWith(without.fetch).send({ to: REAL_LOOKING, line: "account", body: "Ruken: hi" });
    expect("StatusCallback" in formOf(without.calls[0])).toBe(false);
  });

  it("points at the stand-in's address when given one", async () => {
    const { fetch: fake, calls } = stub(json(201, { sid: "SM1" }));
    await texterWith(fake, { apiBase: "http://127.0.0.1:12114" }).send({
      to: REAL_LOOKING,
      line: "account",
      body: "Ruken: hi",
    });
    expect(calls[0]?.url).toBe("http://127.0.0.1:12114/2010-04-01/Accounts/AC1/Messages.json");
  });

  it("texts only the allowlist when one is set", async () => {
    const { fetch: fake, calls } = stub(json(201, { sid: "SM1" }));
    const texter = texterWith(fake, { allowlist: " +13125551234 , +14155551234 " });

    expect(await texter.send({ to: "+16175551234", line: "account", body: "Ruken: hi" })).toEqual({
      sent: false,
      why: "allowlist",
    });
    expect(calls).toHaveLength(0);
    expect((await texter.send({ to: "+14155551234", line: "account", body: "Ruken: hi" })).sent).toBe(true);
  });

  it("never texts a made-up number, allowlist or not", async () => {
    const { fetch: fake, calls } = stub(json(201, { sid: "SM1" }));

    expect(
      await texterWith(fake, { allowlist: "+12125550123" }).send({
        to: "+12125550123",
        line: "account",
        body: "Ruken: hi",
      }),
    ).toEqual({ sent: false, why: "made_up" });
    expect(await texterWith(fake).send({ to: "+12125550123", line: "account", body: "Ruken: hi" })).toEqual({
      sent: false,
      why: "made_up",
    });
    expect(calls).toHaveLength(0);
  });

  it("throws a TextError with the status and Twilio's code, and no number or words in it", async () => {
    const { fetch: fake } = stub(
      json(400, {
        code: 21610,
        message: `The message From/To pair ${REAL_LOOKING} violates a blacklist rule`,
      }),
    );
    const error: unknown = await texterWith(fake)
      .send({ to: REAL_LOOKING, line: "news", body: "Ruken: secret words" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TextError);
    expect(textFailureCode(error)).toBe("TWILIO 400 21610");
    expect((error as Error).message).not.toContain("3125551234");
  });

  it("keeps a null Twilio code when the answer has none", async () => {
    const { fetch: fake } = stub(new Response("upstream down", { status: 502 }));
    const error: unknown = await texterWith(fake)
      .send({ to: REAL_LOOKING, line: "news", body: "Ruken: hi" })
      .catch((caught: unknown) => caught);

    expect((error as TextError).twilioCode).toBeNull();
    expect(textFailureCode(error)).toBe("TWILIO 502");
  });
});

describe("textFailureCode", () => {
  it("logs nothing of the number or the body", () => {
    expect(textFailureCode(new Error("to +13125550142 failed"))).toBe("unknown error");
    expect(textFailureCode("+13125550142")).toBe("unknown error");
    expect(textFailureCode(null)).toBe("unknown error");
  });
});

describe("Texter.sendCode (Verify)", () => {
  it("cancels the open verification, then starts one with our code", async () => {
    const { fetch: fake, calls } = stub(json(200, { status: "canceled" }), json(201, { sid: "VE123" }));
    const result = await texterWith(fake).sendCode(REAL_LOOKING, "482913");

    expect(calls.map((call) => call.url)).toEqual([
      "https://verify.twilio.com/v2/Services/VA1/Verifications/%2B13125551234",
      "https://verify.twilio.com/v2/Services/VA1/Verifications",
    ]);
    expect(formOf(calls[0])).toEqual({ Status: "canceled" });
    expect(formOf(calls[1])).toEqual({ To: REAL_LOOKING, Channel: "sms", CustomCode: "482913" });
    expect(calls[0]?.headers.get("authorization")).toBe(`Basic ${btoa("SK1:secret")}`);
    expect(calls[1]?.headers.get("authorization")).toBe(`Basic ${btoa("SK1:secret")}`);
    expect(result).toEqual({ sent: true, providerId: "VE123" });
  });

  it("sends the code when nothing was open to cancel (404)", async () => {
    const { fetch: fake, calls } = stub(json(404, { code: 20404 }), json(201, { sid: "VE9" }));
    expect(await texterWith(fake).sendCode(REAL_LOOKING, "482913")).toEqual({
      sent: true,
      providerId: "VE9",
    });
    expect(calls).toHaveLength(2);
  });

  it("throws, and sends nothing, when the cancel fails any other way", async () => {
    const { fetch: fake, calls } = stub(json(500, { code: 20500 }));
    const error: unknown = await texterWith(fake)
      .sendCode(REAL_LOOKING, "482913")
      .catch((caught: unknown) => caught);

    expect(textFailureCode(error)).toBe("TWILIO 500 20500");
    expect(calls).toHaveLength(1);
  });

  it("never sends a code to a made-up number or one off the allowlist", async () => {
    const { fetch: fake, calls } = stub(json(201, { sid: "VE1" }));

    expect(await texterWith(fake).sendCode("+12125550123", "482913")).toEqual({
      sent: false,
      why: "made_up",
    });
    expect(await texterWith(fake, { allowlist: "+14155551234" }).sendCode(REAL_LOOKING, "482913")).toEqual({
      sent: false,
      why: "allowlist",
    });
    expect(calls).toHaveLength(0);
  });

  it("throws a TextError when Verify refuses, with no code in it", async () => {
    const { fetch: fake } = stub(
      json(404, { code: 20404 }),
      json(429, { code: 60203, message: "too many 482913" }),
    );
    const error: unknown = await texterWith(fake)
      .sendCode(REAL_LOOKING, "482913")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TextError);
    expect(textFailureCode(error)).toBe("TWILIO 429 60203");
    expect((error as Error).message).not.toContain("482913");
  });

  it("points at the stand-in's address when given one", async () => {
    const { fetch: fake, calls } = stub(json(404, {}), json(201, { sid: "VE1" }));
    await texterWith(fake, { verifyBase: "http://127.0.0.1:12114" }).sendCode(REAL_LOOKING, "482913");
    expect(calls[1]?.url).toBe("http://127.0.0.1:12114/v2/Services/VA1/Verifications");
  });
});

describe("Texter.codeUsed (Verify)", () => {
  it("marks the verification approved", async () => {
    const { fetch: fake, calls } = stub(json(200, { status: "approved" }));
    await texterWith(fake).codeUsed(REAL_LOOKING);

    expect(calls[0]?.url).toBe("https://verify.twilio.com/v2/Services/VA1/Verifications/%2B13125551234");
    expect(formOf(calls[0])).toEqual({ Status: "approved" });
  });

  it("makes no request for a made-up number or one off the allowlist", async () => {
    const { fetch: fake, calls } = stub(json(200, {}));
    await texterWith(fake).codeUsed("+12125550123");
    await texterWith(fake, { allowlist: "+14155551234" }).codeUsed(REAL_LOOKING);
    expect(calls).toHaveLength(0);
  });

  it("never throws: a 404 is nothing, a 500 is logged by its code, a thrown fetch is logged", async () => {
    const log = vi.fn<(line: string) => void>();

    await texterWith(stub(json(404, { code: 20404 })).fetch, { log }).codeUsed(REAL_LOOKING);
    expect(log).not.toHaveBeenCalled();

    await texterWith(stub(json(500, { code: 20500 })).fetch, { log }).codeUsed(REAL_LOOKING);
    expect(log).toHaveBeenLastCalledWith("TWILIO 500 20500");

    const broken = vi.fn<Fetch>(() => Promise.reject(new Error(`no route to ${REAL_LOOKING}`)));
    await texterWith(broken, { log }).codeUsed(REAL_LOOKING);
    expect(log).toHaveBeenLastCalledWith("unknown error");
  });
});

describe("Texter.changedHands", () => {
  it("asks whether a US number changed hands, with the day", async () => {
    const { fetch: fake, calls } = stub(json(200, { reassigned_number: { is_number_reassigned: "yes" } }));
    const answer = await texterWith(fake).changedHands(REAL_LOOKING, new Date("2026-11-01T23:30:00Z"));

    expect(answer).toBe("yes");
    expect(calls[0]?.url).toBe(
      "https://lookups.twilio.com/v2/PhoneNumbers/%2B13125551234?Fields=reassigned_number&LastVerifiedDate=20261101",
    );
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.headers.get("authorization")).toBe(`Basic ${btoa("SK1:secret")}`);
  });

  it("passes a no through", async () => {
    const { fetch: fake } = stub(json(200, { reassigned_number: { is_number_reassigned: "no" } }));
    expect(await texterWith(fake).changedHands(REAL_LOOKING, new Date("2026-11-01T00:00:00Z"))).toBe("no");
  });

  it("cannot say for a number outside +1, with no request", async () => {
    const { fetch: fake, calls } = stub(json(200, {}));
    expect(await texterWith(fake).changedHands("+447700900123", new Date())).toBe("cannot_say");
    expect(calls).toHaveLength(0);
  });

  it("cannot say when Twilio has no data, a field is missing, it answers 500, or the request throws", async () => {
    const since = new Date("2026-11-01T00:00:00Z");
    const noData = stub(json(200, { reassigned_number: { is_number_reassigned: "no_data_available" } }));
    expect(await texterWith(noData.fetch).changedHands(REAL_LOOKING, since)).toBe("cannot_say");
    expect(await texterWith(stub(json(200, {})).fetch).changedHands(REAL_LOOKING, since)).toBe("cannot_say");
    expect(await texterWith(stub(json(500, {})).fetch).changedHands(REAL_LOOKING, since)).toBe("cannot_say");
    const broken = vi.fn<Fetch>(() => Promise.reject(new Error("offline")));
    expect(await texterWith(broken).changedHands(REAL_LOOKING, since)).toBe("cannot_say");
  });
});
