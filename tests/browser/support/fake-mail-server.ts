import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

// A stand-in for Resend for the journeys. It runs in Node on the runner, beside `wrangler dev`, and keeps in memory
// every mail the site sends (src/lib/server/mail.ts posts to its /emails), so a journey can read the mail a person
// would get and open the link in it. It exists only under tests/: the real site reaches its mail service through
// RESEND_API_BASE only when that is set, and the site refuses it unless it names this machine.
//
// - POST /emails: what Resend takes. Keeps the mail and answers 200 with an id, as Resend does.
// - GET /mail?to=<address>: the mails kept for that address, oldest first, as JSON. The address is compared in lower
//   case, as a mailbox is.
// - GET /ready: for Playwright to know it is up.

const PORT = 12113;

interface KeptMail {
  to: string;
  subject: string;
  text: string;
}

const kept: KeptMail[] = [];

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

  if (method === "POST" && url.pathname === "/emails") {
    const sent = JSON.parse(await readBody(request)) as { to: string[]; subject: string; text: string };
    for (const to of sent.to) kept.push({ to: to.toLowerCase(), subject: sent.subject, text: sent.text });
    json(response, 200, { id: `mail_${String(kept.length)}` });
    return;
  }

  if (method === "GET" && url.pathname === "/mail") {
    const to = (url.searchParams.get("to") ?? "").toLowerCase();
    json(
      response,
      200,
      kept.filter((mail) => mail.to === to),
    );
    return;
  }

  json(response, 404, { error: `the mail stand-in does not answer ${method} ${url.pathname}` });
}

createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error(`mail stand-in: ${String(error)}`);
    if (!response.headersSent) json(response, 500, { error: String(error) });
    else response.end();
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`stand-in mail on http://127.0.0.1:${String(PORT)}`);
});
