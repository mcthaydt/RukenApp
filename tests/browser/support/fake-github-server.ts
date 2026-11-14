import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tarGz } from "../../support/tar.ts";

// A stand-in GitHub for the journeys. It runs in Node on the runner, beside `wrangler dev`, and answers the calls the
// site makes (src/features/games/github.ts and github-connect.ts) so a journey can connect a maker's GitHub and pull a
// game with no network and no GitHub account. It exists only under tests/: the real site refuses a GitHub address
// that is not on this machine.
//
// It holds one installation of the app (number 1, on the account `ruken-test`) that can read three repositories:
// `tiny-game` and `broken-game` (no index.html) are listed for the person who signs in, `not-yours` is not. That is
// the case an installation really has: the app can read a repository the person cannot open.

const PORT = 12112;
const SITE_URL = "http://localhost:4173";
const APP_SLUG = "ruken-test-app";
const CLIENT_SECRET = "test-only-client-secret";
const CODE = "test-code";
const INSTALLATION_ID = 1;
const ACCOUNT = "ruken-test";

// Three kinds of token, as GitHub has them. A call must carry the right kind or it is refused, so a journey fails if
// the site ever asks about a person with the app's key, or pulls files with the person's token.
const PERSON_TOKEN = "ghu_test_person";
const INSTALLATION_TOKEN = "ghs_test_installation";

const FIXTURES = new URL("../../fixtures/tiny-game/", import.meta.url);
const fixture = (path: string) => ({ path, content: readFileSync(new URL(path, FIXTURES)) });

interface Repository {
  fullName: string;
  /** Listed for the person who signs in. */
  listed: boolean;
  files: { path: string; content: Uint8Array }[];
  commit: string;
}

const repositories = new Map<string, Repository>([
  [
    `${ACCOUNT}/tiny-game`,
    {
      fullName: `${ACCOUNT}/tiny-game`,
      listed: true,
      files: [fixture("index.html"), fixture("main.js"), fixture("img/dot.png")],
      commit: "1".repeat(40),
    },
  ],
  [
    `${ACCOUNT}/broken-game`,
    {
      fullName: `${ACCOUNT}/broken-game`,
      listed: true,
      // No index.html: a game that cannot start, which the pull refuses.
      files: [fixture("main.js")],
      commit: "2".repeat(40),
    },
  ],
  [
    `${ACCOUNT}/not-yours`,
    {
      fullName: `${ACCOUNT}/not-yours`,
      listed: false,
      files: [fixture("index.html"), fixture("main.js")],
      commit: "3".repeat(40),
    },
  ],
]);

let commitCounter = 0;

/** Every answer is made by one of these three. Each returns `true`, "answered", so a branch can end with `return send(...)`. */
function send(
  response: ServerResponse,
  status: number,
  body: string | Uint8Array,
  type = "application/json",
): boolean {
  response.writeHead(status, { "content-type": type });
  response.end(body);
  return true;
}

const sendJson = (response: ServerResponse, status: number, value: unknown): boolean =>
  send(response, status, JSON.stringify(value));

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

/** The token a call carries, or null when it carries none. */
function tokenOf(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") === true ? header.slice("Bearer ".length) : null;
}

/** Sends the browser back to the site's callback, as GitHub does after a sign-in or an installation. */
function backToSite(response: ServerResponse, state: string, extra = ""): boolean {
  const back = `${SITE_URL}/make/github/callback?code=${CODE}&state=${encodeURIComponent(state)}${extra}`;
  response.writeHead(302, { location: back });
  response.end();
  return true;
}

/** The repository named in a `/repos/<owner>/<name>/...` path, or undefined. */
function repositoryIn(parts: string[]): Repository | undefined {
  return repositories.get(`${parts[1] ?? ""}/${parts[2] ?? ""}`);
}

/** Answers one request. The answer is `true` once it has been given. */
async function handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${String(PORT)}`);
  const parts = url.pathname.split("/").filter((part) => part !== "");
  const token = tokenOf(request);
  const route = `${request.method ?? "GET"} ${url.pathname}`;

  // ---- The pages the browser visits ----
  if (route === "GET /ready") return send(response, 200, "ok", "text/plain");
  if (route === "GET /login/oauth/authorize")
    return backToSite(response, url.searchParams.get("state") ?? "");
  if (route === `GET /apps/${APP_SLUG}/installations/new`) {
    return backToSite(
      response,
      url.searchParams.get("state") ?? "",
      `&installation_id=${String(INSTALLATION_ID)}&setup_action=install`,
    );
  }

  // ---- Trading the code for the person's token (GitHub answers a wrong code with a 200 and an `error`) ----
  if (route === "POST /login/oauth/access_token") {
    const body = JSON.parse(await readBody(request)) as Record<string, unknown>;
    if (body.code !== CODE || body.client_secret !== CLIENT_SECRET) {
      return sendJson(response, 200, { error: "bad_verification_code" });
    }
    return sendJson(response, 200, { access_token: PERSON_TOKEN, token_type: "bearer" });
  }

  // ---- What the person can reach: only with the person's own token ----
  if (parts[0] === "user") {
    if (token === null) return sendJson(response, 401, { message: "Requires authentication" });
    if (token !== PERSON_TOKEN) return sendJson(response, 403, { message: "That token is not a person's" });
    if (route === "GET /user/installations") {
      return sendJson(response, 200, {
        total_count: 1,
        installations: [{ id: INSTALLATION_ID, account: { login: ACCOUNT } }],
      });
    }
    if (route === `GET /user/installations/${String(INSTALLATION_ID)}/repositories`) {
      const listed = [...repositories.values()].filter((repository) => repository.listed);
      return sendJson(response, 200, {
        total_count: listed.length,
        repositories: listed.map((repository) => ({
          full_name: repository.fullName,
          default_branch: "main",
        })),
      });
    }
  }

  // ---- The app's own calls (task 8): the installation, a token, a commit and the files ----
  if (parts[0] === "repos") {
    const repository = repositoryIn(parts);
    if (token === null) return sendJson(response, 401, { message: "Requires authentication" });
    if (repository === undefined) return sendJson(response, 404, { message: "Not Found" });
    // Which installation holds it is asked as the app, with its signed token (three parts, as a JWT has).
    if (parts[3] === "installation" && token.split(".").length === 3) {
      return sendJson(response, 200, { id: INSTALLATION_ID });
    }
    // The commit and the files are read with the installation's token and never with another.
    if (token !== INSTALLATION_TOKEN) return sendJson(response, 403, { message: "Wrong kind of token" });
    if (parts[3] === "commits") return send(response, 200, repository.commit, "text/plain");
    if (parts[3] === "tarball") {
      const top = `${repository.fullName.replace("/", "-")}-${repository.commit.slice(0, 7)}`;
      const files = repository.files.map((file) => ({ path: `${top}/${file.path}`, content: file.content }));
      return send(response, 200, await tarGz(files), "application/x-gzip");
    }
  }
  if (route === `POST /app/installations/${String(INSTALLATION_ID)}/access_tokens`) {
    if (token === null) return sendJson(response, 401, { message: "Requires authentication" });
    return sendJson(response, 201, { token: INSTALLATION_TOKEN });
  }

  // ---- For a journey: the maker pushes a new commit to `tiny-game` ----
  if (route === "POST /next-commit") {
    commitCounter += 1;
    const repository = repositories.get(`${ACCOUNT}/tiny-game`);
    if (repository === undefined) return sendJson(response, 500, { message: "tiny-game is gone" });
    repository.commit = String(commitCounter).padStart(40, "a");
    return sendJson(response, 200, { sha: repository.commit });
  }

  return sendJson(response, 404, { message: "Not Found" });
}

createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error(error);
    send(response, 500, "the stand-in GitHub failed", "text/plain");
  });
}).listen(PORT, "127.0.0.1");
