import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

// A stand-in for Twilio for the journeys. It runs in Node on the runner, beside `wrangler dev`, and keeps in memory
// every text and every sign-in code the site sends (src/lib/server/text.ts posts to it), so a journey can read what a
// person would get. It exists only under tests/: the real site reaches Twilio through its own address unless the
// journeys' settings point it here.
//
// - POST /2010-04-01/Accounts/:sid/Messages.json: keeps the text, answers 201 with a `sid`.
// - GET /texts?to=<number>: the texts kept for that number, oldest first.
// - POST /v2/Services/:service/Verifications: keeps a code as `pending`. It sends no code of its own, so a missing
//   `CustomCode` answers 400 with Twilio's code 60200: a Texter that forgot the code fails loudly.
// - POST /v2/Services/:service/Verifications/:number: sets the number's newest open code's status; 404 (20404) when
//   none is open.
// - GET /codes?to=<number>: the codes kept for that number, oldest first, with their statuses.
// - GET /v2/PhoneNumbers/:number: whether the number changed hands, from POST /test/hands ({ number, answer }).
// - POST /test/fail ({ to }): the next text or code started for that number answers 500, once. It is keyed by number
//   because every journey running at once shares this one stand-in, and one must not trip another.
// - GET /ready: for Playwright to know it is up.

const PORT = 12114;

interface KeptText {
  to: string;
  body: string;
  line: string;
}

interface KeptCode {
  to: string;
  code: string;
  status: string;
}

type Hands = "yes" | "no" | "no_data_available";

const texts: KeptText[] = [];
const codes: KeptCode[] = [];
const hands = new Map<string, Hands>();
const failNext = new Set<string>();

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

/** Takes the failure a journey asked for this number, once. */
function takeFailure(to: string): boolean {
  return failNext.delete(to);
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${String(PORT)}`);
  const method = request.method ?? "GET";
  const path = url.pathname;

  if (method === "GET" && path === "/ready") {
    json(response, 200, { ready: true });
    return;
  }

  if (method === "POST" && /^\/2010-04-01\/Accounts\/[^/]+\/Messages\.json$/.test(path)) {
    const form = new URLSearchParams(await readBody(request));
    if (takeFailure(form.get("To") ?? "")) {
      json(response, 500, { code: 20500, message: "the stand-in was told to fail" });
      return;
    }
    // The line is whichever service id the site named: the journeys' settings give them plain names.
    texts.push({
      to: form.get("To") ?? "",
      body: form.get("Body") ?? "",
      line: (form.get("MessagingServiceSid") ?? "").replace(/^MG-/, ""),
    });
    json(response, 201, { sid: `SM_test_${String(texts.length)}` });
    return;
  }

  if (method === "GET" && path === "/texts") {
    const to = url.searchParams.get("to") ?? "";
    json(
      response,
      200,
      texts.filter((text) => text.to === to),
    );
    return;
  }

  if (method === "POST" && /^\/v2\/Services\/[^/]+\/Verifications$/.test(path)) {
    const form = new URLSearchParams(await readBody(request));
    const code = form.get("CustomCode");
    if (code === null || code === "") {
      json(response, 400, { code: 60200, message: "Invalid parameter: CustomCode" });
      return;
    }
    if (takeFailure(form.get("To") ?? "")) {
      json(response, 500, { code: 20500, message: "the stand-in was told to fail" });
      return;
    }
    codes.push({ to: form.get("To") ?? "", code, status: "pending" });
    json(response, 201, { sid: `VE_test_${String(codes.length)}`, status: "pending" });
    return;
  }

  const closing = /^\/v2\/Services\/[^/]+\/Verifications\/([^/]+)$/.exec(path);
  if (method === "POST" && closing !== null) {
    const to = decodeURIComponent(closing[1] ?? "");
    const form = new URLSearchParams(await readBody(request));
    const open = codes.findLast((kept) => kept.to === to && kept.status === "pending");
    if (open === undefined) {
      json(response, 404, { code: 20404, message: "no verification is open" });
      return;
    }
    open.status = form.get("Status") ?? open.status;
    json(response, 200, { status: open.status });
    return;
  }

  if (method === "GET" && path === "/codes") {
    const to = url.searchParams.get("to") ?? "";
    json(
      response,
      200,
      codes.filter((code) => code.to === to),
    );
    return;
  }

  const lookup = /^\/v2\/PhoneNumbers\/([^/]+)$/.exec(path);
  if (method === "GET" && lookup !== null) {
    const number = decodeURIComponent(lookup[1] ?? "");
    json(response, 200, {
      reassigned_number: { is_number_reassigned: hands.get(number) ?? "no_data_available" },
    });
    return;
  }

  if (method === "POST" && path === "/test/hands") {
    const said = JSON.parse(await readBody(request)) as { number: string; answer: Hands };
    hands.set(said.number, said.answer);
    json(response, 200, { ok: true });
    return;
  }

  if (method === "POST" && path === "/test/fail") {
    const asked = JSON.parse(await readBody(request)) as { to: string };
    failNext.add(asked.to);
    json(response, 200, { ok: true });
    return;
  }

  json(response, 404, { error: `the Twilio stand-in does not answer ${method} ${path}` });
}

createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error(`twilio stand-in: ${String(error)}`);
    if (!response.headersSent) json(response, 500, { error: String(error) });
    else response.end();
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`stand-in twilio on http://127.0.0.1:${String(PORT)}`);
});
