import { describe, expect, it, vi } from "vitest";
import { createResendMailer, MailError, mailFailureCode } from "../../../src/lib/server/mail.ts";

// `typeof fetch` is named once, here: inside a test a local called `fetch` would be its own type.
type Fetch = typeof fetch;

const message = { to: "a@b.test", subject: "Hello", text: "Hi." };

/** A stand-in for `fetch` that answers every request with this status and records what it was asked. */
const answer = (status: number) => vi.fn<Fetch>(() => Promise.resolve(new Response("{}", { status })));

describe("createResendMailer", () => {
  it("posts the message to Resend with the key", async () => {
    const fakeFetch = answer(200);
    const mailer = createResendMailer({
      apiKey: "re_test_fake",
      from: "Ruken <hello@ruken.test>",
      allowlist: undefined,
      fetch: fakeFetch,
    });

    expect(await mailer.send(message)).toBe(true);
    const [url, init] = fakeFetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer re_test_fake");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    // Resend refuses a request without a User-Agent (403, error 1010).
    expect(new Headers(init?.headers).get("user-agent")).toBe("ruken");
    expect(JSON.parse(typeof init?.body === "string" ? init.body : "")).toEqual({
      from: "Ruken <hello@ruken.test>",
      to: ["a@b.test"],
      subject: "Hello",
      text: "Hi.",
    });
  });

  it("with an allowlist set, sends only to listed addresses (any case)", async () => {
    const fakeFetch = answer(200);
    const mailer = createResendMailer({
      apiKey: "k",
      from: "f",
      allowlist: " owner@example.test, QA@example.test ",
      fetch: fakeFetch,
    });

    expect(await mailer.send({ ...message, to: "stranger@example.test" })).toBe(false);
    expect(fakeFetch).not.toHaveBeenCalled();
    expect(await mailer.send({ ...message, to: "qa@example.test" })).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it("sends nothing to an address that is not on the allowlist", async () => {
    const fakeFetch = answer(200);
    const mailer = createResendMailer({
      apiKey: "k",
      from: "f",
      allowlist: "nobody@ruken.test",
      fetch: fakeFetch,
    });

    expect(await mailer.send(message)).toBe(false);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("fails with a code and no address when Resend refuses", async () => {
    const fakeFetch = vi.fn<Fetch>(() =>
      Promise.resolve(new Response('{"message":"a@b.test is not allowed"}', { status: 422 })),
    );
    const mailer = createResendMailer({ apiKey: "k", from: "f", allowlist: undefined, fetch: fakeFetch });

    const failure = await mailer.send(message).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(MailError);
    expect(mailFailureCode(failure)).toBe("RESEND 422");
    expect((failure as Error).message).toBe("Resend answered 422");
    expect((failure as Error).message).not.toContain("a@b.test");
  });

  it("calls fetch as a plain function, which Workers require", async () => {
    // Workers throw "Illegal invocation" when fetch is called as a method of another object.
    const receivers: unknown[] = [];
    const fakeFetch = vi.fn<Fetch>(function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    await createResendMailer({ apiKey: "k", from: "f", allowlist: undefined, fetch: fakeFetch }).send(
      message,
    );

    expect(receivers).toEqual([undefined]);
  });
});

describe("mailFailureCode", () => {
  it("gives the error's code and the reply's status, never the message with the address", () => {
    const rejected = Object.assign(new Error("550 5.1.1 <pat@example.test>: Recipient address rejected"), {
      code: "EENVELOPE",
      responseCode: 550,
    });
    expect(mailFailureCode(rejected)).toBe("EENVELOPE 550");
    expect(mailFailureCode(Object.assign(new Error("connect ECONNREFUSED"), { code: "ESOCKET" }))).toBe(
      "ESOCKET",
    );
  });

  it("says unknown error for anything without a code", () => {
    expect(mailFailureCode(new Error("pat@example.test"))).toBe("unknown error");
    expect(mailFailureCode("pat@example.test")).toBe("unknown error");
  });
});
