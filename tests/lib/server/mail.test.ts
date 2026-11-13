import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { describe, expect, it } from "vitest";
import { createSmtpMailer, mailFailureCode, smtpTransport } from "../../../src/lib/server/mail.ts";

// nodemailer's JSON transport builds the real message without a network, and returns it.
interface SentMessage {
  to: string;
  from: string;
  subject: string;
  text: string;
}

function recordingTransport(): { transport: Transporter; sent: SentMessage[] } {
  const sent: SentMessage[] = [];
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const send = transport.sendMail.bind(transport);
  transport.sendMail = async (options: SendMailOptions) => {
    const info = (await send(options)) as { message: string };
    const message = JSON.parse(info.message) as {
      to: { address: string }[];
      from: { address: string; name: string };
      subject: string;
      text: string;
    };
    sent.push({
      to: message.to.map((address) => address.address).join(","),
      from: `${message.from.name} <${message.from.address}>`,
      subject: message.subject,
      text: message.text,
    });
    return info;
  };
  return { transport, sent };
}

describe("createSmtpMailer", () => {
  it("sends from MAIL_FROM", async () => {
    const { transport, sent } = recordingTransport();
    const mailer = createSmtpMailer({ from: "Ruken <hello@ruken.test>", allowlist: undefined, transport });

    expect(await mailer.send({ to: "pat@example.test", subject: "Hi", text: "Hello" })).toBe(true);
    expect(sent).toEqual([
      { to: "pat@example.test", from: "Ruken <hello@ruken.test>", subject: "Hi", text: "Hello" },
    ]);
  });

  it("with MAIL_ALLOWLIST set, sends only to listed addresses (any case)", async () => {
    const { transport, sent } = recordingTransport();
    const mailer = createSmtpMailer({
      from: "Ruken <hello@ruken.test>",
      allowlist: " owner@example.test, QA@example.test ",
      transport,
    });

    expect(await mailer.send({ to: "stranger@example.test", subject: "Hi", text: "Hello" })).toBe(false);
    expect(await mailer.send({ to: "qa@example.test", subject: "Hi", text: "Hello" })).toBe(true);
    expect(sent.map((message) => message.to)).toEqual(["qa@example.test"]);
  });

  it("sends nothing over the network for the test: address", async () => {
    const mailer = createSmtpMailer({
      from: "a@b.test",
      allowlist: undefined,
      transport: smtpTransport("test:"),
    });
    expect(await mailer.send({ to: "pat@example.test", subject: "Hi", text: "Hello" })).toBe(true);
  });
});

describe("mailFailureCode", () => {
  it("gives nodemailer's error code and the server's reply code, never the message with the address", () => {
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
