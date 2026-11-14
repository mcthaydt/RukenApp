import type { Clock } from "../../lib/clock.ts";
import { GameError } from "./game-error.ts";

// Ruken's GitHub App, as the code sees it: sign in as the app, get a token for one repository that can only read its
// files, then ask for a commit or for its files. Plain `fetch`, no package: the four requests below are all it does.

/** What the games service needs from GitHub. The tests hand it a stand-in with the same two methods. */
export interface GitHub {
  /** The id of the commit a branch points at now. A null branch means the repository's default branch. */
  commitOf(repo: string, branch: string | null): Promise<string>;
  /** The commit's files as one gzipped tarball, streamed. */
  tarball(repo: string, commitSha: string): Promise<ReadableStream<Uint8Array<ArrayBuffer>>>;
  /** The number of the installation of the app that holds a repository now, or null when the app is not there. */
  installationOf(repo: string): Promise<bigint | null>;
}

export interface GitHubOptions {
  appId: string;
  /** The app's private key in PEM form, PKCS#8 or PKCS#1. */
  privateKeyPem: string;
  clock: Clock;
  /** Tests hand in their own. */
  fetch?: typeof fetch;
  /** Where GitHub's API is. Only a stand-in server in the journeys ever changes it. */
  apiBase?: string;
}

/** What a person is told when Ruken cannot reach their repository, whatever the reason. */
export const NOT_VISIBLE = "Ruken can't see that repository. Choose it on GitHub, then try again.";
const NO_BRANCH = "We couldn't find that branch in your repository.";
const NOT_A_KEY = "GITHUB_APP_PRIVATE_KEY is not a private key in PEM form.";

// ---- The private key -------------------------------------------------------------------------------------------

/** One DER length: a single byte under 128, else a count byte and then the length, most significant byte first. */
function derLength(length: number): number[] {
  if (length < 0x80) return [length];
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest % 256);
  return [0x80 | bytes.length, ...bytes];
}

/** A DER value: its tag, its length, then its content. */
function derValue(tag: number, content: Uint8Array): Uint8Array<ArrayBuffer> {
  const head = [tag, ...derLength(content.length)];
  const out = new Uint8Array(head.length + content.length);
  out.set(head);
  out.set(content, head.length);
  return out;
}

/** `INTEGER 0`, then `SEQUENCE { OID rsaEncryption, NULL }`: what comes before the key in a PKCS#8 wrapper. */
const PKCS8_PREFIX = Uint8Array.from([
  0x02, 0x01, 0x00, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
]);

/**
 * Wraps a PKCS#1 RSA key in the PKCS#8 envelope. GitHub hands out the app's key as PKCS#1 (`BEGIN RSA PRIVATE
 * KEY`) but Web Crypto imports only PKCS#8, and the Owner should not have to convert a key with a tool of their own
 * before giving it to the site.
 */
export function pkcs8FromPkcs1(der: Uint8Array): Uint8Array<ArrayBuffer> {
  const octets = derValue(0x04, der);
  const body = new Uint8Array(PKCS8_PREFIX.length + octets.length);
  body.set(PKCS8_PREFIX);
  body.set(octets, PKCS8_PREFIX.length);
  return derValue(0x30, body);
}

/** `BEGIN PRIVATE KEY` (PKCS#8) or `BEGIN RSA PRIVATE KEY` (PKCS#1), with any amount of white space around it. */
const PEM_KEY = /^\s*-----BEGIN (RSA )?PRIVATE KEY-----([A-Za-z0-9+/=\s]+)-----END \1PRIVATE KEY-----\s*$/;

/** The key's PKCS#8 bytes, from either form of PEM. Anything else is refused with words the Owner can act on. */
function pkcs8FromPem(pem: string): Uint8Array<ArrayBuffer> {
  const match = PEM_KEY.exec(pem);
  if (match === null) throw new Error(NOT_A_KEY);
  const der = Uint8Array.from(atob((match[2] ?? "").replace(/\s/g, "")), (char) => char.charCodeAt(0));
  return match[1] === undefined ? der : pkcs8FromPkcs1(der);
}

// ---- The app's own token ---------------------------------------------------------------------------------------

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

// `Uint8Array<ArrayBuffer>`, not the wider default: Web Crypto takes only bytes that are not in a shared buffer.
const utf8 = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

/**
 * The short token that says "this is the app": RS256, issued by the app's id. It starts a minute in the past because
 * GitHub refuses a token that looks issued in its future, and our clock may run a little ahead; it ends nine minutes
 * after now, inside GitHub's ten-minute limit.
 */
export async function appToken(input: {
  appId: string;
  privateKeyPem: string;
  nowMs: number;
}): Promise<string> {
  const nowSeconds = Math.floor(input.nowMs / 1000);
  const header = base64url(utf8(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(
    utf8(JSON.stringify({ iss: input.appId, iat: nowSeconds - 60, exp: nowSeconds + 540 })),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8FromPem(input.privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, utf8(`${header}.${payload}`));
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
}

// ---- What a person typed ---------------------------------------------------------------------------------------

/** `owner/name`, as GitHub allows them. */
const REPO = /^[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/;

/** Throws unless `repo` is an `owner/name` that is safe to put in a GitHub address. */
export function checkRepo(repo: string): void {
  // The form lists the maker's repositories and starts on none, so an empty one means "not chosen yet".
  if (repo === "") throw new GameError("INVALID", "Choose the repository your game is in.");
  const parts = repo.split("/");
  // `.` and `..` fit the pattern's letters but would climb out of the address.
  if (!REPO.test(repo) || parts.some((part) => /^\.+$/.test(part))) {
    throw new GameError("INVALID", "That doesn't look like a GitHub repository. It should read owner/name.");
  }
}

/** Throws unless `branch` is a name we are willing to ask GitHub about. */
export function checkBranch(branch: string): void {
  const hasControlCharacter = Array.from(branch).some((char) => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
  if (
    branch.length < 1 ||
    branch.length > 200 ||
    branch.includes(" ") ||
    branch.includes("..") ||
    hasControlCharacter
  ) {
    throw new GameError("INVALID", "That doesn't look like a branch name.");
  }
}

// ---- The client ------------------------------------------------------------------------------------------------

/** A field of a JSON answer, or undefined: GitHub's answers are checked, not trusted to have the shape we hope for. */
async function jsonField(response: Response, name: string): Promise<unknown> {
  const body: unknown = await response.json();
  return typeof body === "object" && body !== null && name in body
    ? (body as Record<string, unknown>)[name]
    : undefined;
}

export function createGitHub(options: GitHubOptions): GitHub {
  // A plain function, not `options.fetch(…)`: Workers refuse `fetch` called as a method of another object.
  const send: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const apiBase = options.apiBase ?? "https://api.github.com";

  function request(
    path: string,
    init: { method?: string; token: string; accept?: string; body?: unknown },
  ): Promise<Response> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${init.token}`,
      accept: init.accept ?? "application/vnd.github+json",
      "user-agent": "ruken",
      "x-github-api-version": "2022-11-28",
    };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    return send(`${apiBase}${path}`, {
      method: init.method ?? "GET",
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  }

  /** An error that names what failed and never the token: the path and the status are all anyone needs. */
  const failure = (method: string, path: string, response: Response) =>
    new Error(`GitHub answered ${String(response.status)} to ${method} ${path}`);

  /** The app's own short token, from the app's key and the clock. */
  function appJwt(): Promise<string> {
    return appToken({
      appId: options.appId,
      privateKeyPem: options.privateKeyPem,
      nowMs: options.clock.epochMs(),
    });
  }

  /** The number of the installation that holds a repository, asked as the app; null when the app is not there. */
  async function installationNumber(repo: string, jwt: string): Promise<number | null> {
    const path = `/repos/${repo}/installation`;
    const response = await request(path, { token: jwt });
    if (response.status === 404) return null;
    if (!response.ok) throw failure("GET", path, response);
    const id = await jsonField(response, "id");
    if (typeof id !== "number") throw new Error(`GitHub's answer to GET ${path} had no id`);
    return id;
  }

  /** A token for this one repository that can only read its files, good for an hour. */
  async function repositoryToken(repo: string): Promise<string> {
    const jwt = await appJwt();
    const installationId = await installationNumber(repo, jwt);
    if (installationId === null) throw new GameError("NOT_CONNECTED", NOT_VISIBLE);

    const tokenPath = `/app/installations/${String(installationId)}/access_tokens`;
    const name = repo.split("/")[1] ?? repo;
    const granted = await request(tokenPath, {
      method: "POST",
      token: jwt,
      body: { repositories: [name], permissions: { contents: "read" } },
    });
    if (!granted.ok) throw failure("POST", tokenPath, granted);
    const token = await jsonField(granted, "token");
    if (typeof token !== "string") throw new Error(`GitHub's answer to POST ${tokenPath} had no token`);
    return token;
  }

  return {
    async installationOf(repo) {
      checkRepo(repo);
      const id = await installationNumber(repo, await appJwt());
      return id === null ? null : BigInt(id);
    },

    async commitOf(repo, branch) {
      checkRepo(repo);
      if (branch !== null) checkBranch(branch);
      const token = await repositoryToken(repo);

      // A branch may hold slashes (`release/v1`); every other character that means something in an address is escaped.
      const ref = branch === null ? "HEAD" : branch.split("/").map(encodeURIComponent).join("/");
      const path = `/repos/${repo}/commits/${ref}`;
      const response = await request(path, { token, accept: "application/vnd.github.sha" });
      if (response.status === 404 || response.status === 422) throw new GameError("INVALID", NO_BRANCH);
      if (!response.ok) throw failure("GET", path, response);
      return (await response.text()).trim();
    },

    async tarball(repo, commitSha) {
      checkRepo(repo);
      const token = await repositoryToken(repo);

      // GitHub answers with a redirect to the files; `fetch` follows it and leaves the token behind at the other host.
      const path = `/repos/${repo}/tarball/${encodeURIComponent(commitSha)}`;
      const response = await request(path, { token });
      if (!response.ok) throw failure("GET", path, response);
      if (response.body === null) throw new Error(`GitHub's answer to GET ${path} had no body`);
      return response.body;
    },
  };
}
