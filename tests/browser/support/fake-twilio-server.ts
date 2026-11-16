import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { twilioSignatureOf } from "../../../src/lib/server/twilio-signature.ts";

// A stand-in for Twilio for the journeys. It runs in Node on the runner, beside `wrangler dev`, and keeps in memory
// every text the site sends (src/lib/server/text.ts posts to its Messages address), so a journey can read the text a
// person would get. It exists only under tests/: the site reaches Twilio through TWILIO_API_BASE only when that is
// set, and refuses it unless it names this machine.
//
// - POST /2010-04-01/Accounts/:sid/Messages.json: what Twilio takes. Keeps the text, answers 201 with a `sid`.
// - GET /texts?to=<number>: the texts kept for that number, oldest first, as JSON.
// - GET /v2/PhoneNumbers/:number: the changed-hands check, answered from POST /test/hands.
// - POST /test/hands {number, answer}: what that check says for a number ("yes", "no" or "no_data_available").
// - POST /test/inbound {fields}: posts a text in, or a delivery report, to the site's webhook, signed as Twilio signs it.
// - GET /ready: for Playwright to know it is up.

const PORT = 12114;
// The auth token and the webhook address the site is given in playwright.config.ts: all plainly fake.
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const WEBHOOK_URL = process.env.TWILIO_WEBHOOK_URL ?? "";

interface KeptText {
  to: string;
  body: string;
  service: string;
  statusCallback: string;
  sid: string;
}

const kept: KeptText[] = [];
const hands = new Map<string, string>();

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${String(PORT)}`);
  const method = request.method ?? "GET";

  if (method === "GET" && url.pathname === "/ready") {
    json(response, 200, { ready: true });
    return;
  }

  if (method === "POST" && /^\/2010-04-01\/Accounts\/[^/]+\/Messages\.json$/.test(url.pathname)) {
    const form = new URLSearchParams(await readBody(request));
    const sid = `SM-stand-in-${String(kept.length + 1)}`;
    kept.push({
      to: form.get("To") ?? "",
      body: form.get("Body") ?? "",
      service: form.get("MessagingServiceSid") ?? "",
      statusCallback: form.get("StatusCallback") ?? "",
      sid,
    });
    json(response, 201, { sid });
    return;
  }

  if (method === "GET" && url.pathname === "/texts") {
    const to = url.searchParams.get("to") ?? "";
    json(
      response,
      200,
      kept.filter((text) => text.to === to),
    );
    return;
  }

  const lookup = /^\/v2\/PhoneNumbers\/(.+)$/.exec(url.pathname);
  if (method === "GET" && lookup !== null) {
    const answer = hands.get(decodeURIComponent(lookup[1] ?? "")) ?? "no_data_available";
    json(response, 200, { reassigned_number: { is_number_reassigned: answer } });
    return;
  }

  if (method === "POST" && url.pathname === "/test/hands") {
    const { number, answer } = JSON.parse(await readBody(request)) as { number: string; answer: string };
    hands.set(number, answer);
    json(response, 200, { ok: true });
    return;
  }

  if (method === "POST" && url.pathname === "/test/inbound") {
    const { fields } = JSON.parse(await readBody(request)) as { fields: Record<string, string> };
    const sent = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": twilioSignatureOf(AUTH_TOKEN, WEBHOOK_URL, new Map(Object.entries(fields))),
      },
      body: new URLSearchParams(fields).toString(),
    });
    json(response, 200, { status: sent.status });
    return;
  }

  json(response, 404, { error: `the Twilio stand-in does not answer ${method} ${url.pathname}` });
}

createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error(`Twilio stand-in: ${String(error)}`);
    if (!response.headersSent) json(response, 500, { error: String(error) });
    else response.end();
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`stand-in Twilio on http://127.0.0.1:${String(PORT)}`);
});
