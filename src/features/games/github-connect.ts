import { createHmac, timingSafeEqual } from "node:crypto";
import { GameError } from "./game-error.ts";

// Connecting a maker's GitHub. After a maker installs the Ruken app, GitHub sends them back with an installation's
// number in the address. A number in an address can be typed by anyone, and an installation can read private
// repositories, including, in an organisation, ones this person cannot open. So Ruken never trusts that number: it asks
// GitHub, as the person (GitHub's sign-in for apps), which installations that person can reach and which repositories
// in each, and keeps only those. Plain `fetch`, no package.

/** One installation of the Ruken GitHub App that a person can reach, with the repositories GitHub listed in it. */
export interface Connection {
  installationId: bigint;
  accountLogin: string;
  repositories: { fullName: string; defaultBranch: string }[];
}

export interface ConnectOptions {
  /** Tests hand in their own. */
  fetch?: typeof fetch;
  /** Where GitHub's API is. Only a stand-in server in the journeys ever changes it. */
  apiBase?: string;
  /** Where GitHub's sign-in pages are. Only a stand-in server in the journeys ever changes it. */
  webBase?: string;
}

const API_BASE = "https://api.github.com";
const WEB_BASE = "https://github.com";

const NOT_CONNECTED = "GitHub didn't finish connecting. Try again.";

// ---- The two addresses -----------------------------------------------------------------------------------------

/** GitHub's sign-in for the app: it comes back to the app's callback address with a `code` and this `state`. */
export function signInUrl(input: { clientId: string; state: string; webBase?: string }): string {
  const query = `client_id=${encodeURIComponent(input.clientId)}&state=${encodeURIComponent(input.state)}`;
  return `${input.webBase ?? WEB_BASE}/login/oauth/authorize?${query}`;
}

/** GitHub's own page for choosing which repositories the app may read. */
export function installUrl(input: { appSlug: string; state: string; webBase?: string }): string {
  const slug = encodeURIComponent(input.appSlug);
  return `${input.webBase ?? WEB_BASE}/apps/${slug}/installations/new?state=${encodeURIComponent(input.state)}`;
}

// ---- The state -------------------------------------------------------------------------------------------------

/** How long a state stays good: the time a person takes to choose repositories on GitHub, with room to spare. */
const STATE_LIFE_MS = 10 * 60 * 1000;

/** Keeps this use of the secret apart from every other use of it (the arrival cookie, the play pass). */
const MAC_PREFIX = "ruken-github-state-v1:";

function macOf(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(MAC_PREFIX + payload)
    .digest("base64url");
}

/**
 * `<payload>.<mac>`: the account's id and the time, then their keyed hash. It stops someone from finishing a
 * connection that another person started, since the state travels through GitHub and back in an address.
 */
export function sealState(userId: string, nowMs: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, t: nowMs })).toString("base64url");
  return `${payload}.${macOf(payload, secret)}`;
}

/** True only for a state this secret sealed for this account, no more than ten minutes ago. It never throws. */
export function openState(value: string | undefined, userId: string, nowMs: number, secret: string): boolean {
  if (value === undefined) return false;
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [payload = "", mac = ""] = parts;

  const expected = Buffer.from(macOf(payload, secret));
  const given = Buffer.from(mac);
  // timingSafeEqual refuses buffers of different lengths, so a wrong length is a plain "no".
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

  let sealed: unknown;
  try {
    sealed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (typeof sealed !== "object" || sealed === null) return false;
  const { u, t } = sealed as Record<string, unknown>;
  if (u !== userId || typeof t !== "number") return false;
  const age = nowMs - t;
  return age >= 0 && age <= STATE_LIFE_MS;
}

// ---- Asking GitHub, as the person ------------------------------------------------------------------------------

/** GitHub's own page size, the most it gives at a time. */
const PAGE_SIZE = 100;
/** A person with more installations than this is not a maker we can serve; the rest are not asked for. */
const MAX_INSTALLATIONS = 100;
/** Repositories kept in all, over every installation. A maker with more picks fewer on GitHub's page. */
const MAX_REPOSITORIES = 300;

/** The path and query of an address, for an error: it names what failed and never the token. */
const pathOf = (url: string, base: string): string => url.slice(base.length);

/** A JSON answer's fields, or null when the body is not a JSON object. */
async function jsonObject(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The address a `Link` header names as the next page, or null on the last page. */
function nextLink(response: Response): string | null {
  const match = /<([^>]+)>\s*;\s*rel="next"/.exec(response.headers.get("link") ?? "");
  return match?.[1] ?? null;
}

/** The person's own token for GitHub, for a code GitHub gave when they signed in. It is used here and never kept. */
async function personsToken(
  input: { code: string; clientId: string; clientSecret: string },
  send: typeof fetch,
  webBase: string,
): Promise<string> {
  const response = await send(`${webBase}/login/oauth/access_token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "ruken" },
    body: JSON.stringify({ client_id: input.clientId, client_secret: input.clientSecret, code: input.code }),
  });
  // GitHub answers a spent or wrong code with a 200 and an `error` in the body, so the token's presence decides.
  const token = response.ok ? (await jsonObject(response))?.access_token : undefined;
  if (typeof token !== "string" || token === "") throw new GameError("NOT_CONNECTED", NOT_CONNECTED);
  return token;
}

/**
 * Every item of a paged list, up to `limit`, following the `Link` header GitHub sends. The token goes only to
 * GitHub's API: a next page named at any other address is refused, not followed.
 */
async function listAll<T>(
  first: string,
  field: string,
  pick: (item: unknown) => T,
  limit: number,
  call: { send: typeof fetch; token: string; apiBase: string },
): Promise<T[]> {
  const found: T[] = [];
  let url: string | null = first;
  while (url !== null && found.length < limit) {
    if (!url.startsWith(`${call.apiBase}/`))
      throw new Error("GitHub sent a list's next page to another address");
    const response = await call.send(url, {
      headers: {
        authorization: `Bearer ${call.token}`,
        accept: "application/vnd.github+json",
        "user-agent": "ruken",
        "x-github-api-version": "2022-11-28",
      },
    });
    if (!response.ok)
      throw new Error(`GitHub answered ${String(response.status)} to GET ${pathOf(url, call.apiBase)}`);
    const items = (await jsonObject(response))?.[field];
    if (!Array.isArray(items))
      throw new Error(`GitHub's answer to GET ${pathOf(url, call.apiBase)} had no ${field}`);
    // An empty page that still names a next one would loop for ever.
    if (items.length === 0) break;
    found.push(...items.map(pick));
    url = nextLink(response);
  }
  return found.slice(0, limit);
}

const text = (value: unknown, what: string): string => {
  if (typeof value !== "string" || value === "")
    throw new Error(`GitHub's list had a ${what} that was not text`);
  return value;
};

/** An installation as GitHub lists it: its number and the account it is on. */
function installationFrom(item: unknown): { installationId: bigint; accountLogin: string } {
  const { id, account } = (item ?? {}) as { id?: unknown; account?: { login?: unknown } | null };
  if (typeof id !== "number" || !Number.isSafeInteger(id))
    throw new Error("GitHub's list had an installation with no number");
  return { installationId: BigInt(id), accountLogin: text(account?.login, "account name") };
}

/** A repository as GitHub lists it. */
function repositoryFrom(item: unknown): { fullName: string; defaultBranch: string } {
  const { full_name, default_branch } = (item ?? {}) as { full_name?: unknown; default_branch?: unknown };
  return { fullName: text(full_name, "repository name"), defaultBranch: text(default_branch, "branch name") };
}

/**
 * What the person who just signed in can reach: their installations of the app, and the repositories in each, as
 * GitHub says. A refused code throws `GameError("NOT_CONNECTED")`; any other failure names the status and the
 * address, and neither the token nor the app's secret is ever in an error.
 */
export async function connectionOf(
  input: { code: string; clientId: string; clientSecret: string } & ConnectOptions,
): Promise<Connection[]> {
  // A plain function, not `input.fetch(…)`: Workers refuse `fetch` called as a method of another object.
  const send: typeof fetch = input.fetch ?? ((url, init) => fetch(url, init));
  const apiBase = input.apiBase ?? API_BASE;
  const token = await personsToken(input, send, input.webBase ?? WEB_BASE);
  const call = { send, token, apiBase };

  const installations = await listAll(
    `${apiBase}/user/installations?per_page=${String(PAGE_SIZE)}`,
    "installations",
    installationFrom,
    MAX_INSTALLATIONS,
    call,
  );

  const found: Connection[] = [];
  let kept = 0;
  for (const installation of installations) {
    // Once 300 are kept, the rest of the installations are listed with none, and GitHub is not asked.
    const room = MAX_REPOSITORIES - kept;
    const repositories =
      room > 0
        ? await listAll(
            `${apiBase}/user/installations/${String(installation.installationId)}/repositories?per_page=${String(PAGE_SIZE)}`,
            "repositories",
            repositoryFrom,
            room,
            call,
          )
        : [];
    kept += repositories.length;
    found.push({ ...installation, repositories });
  }
  return found;
}
