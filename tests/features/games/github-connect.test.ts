import { describe, expect, it } from "vitest";
import { GameError } from "../../../src/features/games/game-error.ts";
import {
  connectionOf,
  installUrl,
  openState,
  sealState,
  signInUrl,
} from "../../../src/features/games/github-connect.ts";

const SECRET = "test-only-state-secret";
const NOW_MS = 1_800_000_000_000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

describe("the two addresses", () => {
  it("sends a person to GitHub's sign-in, with the app's id and the state", () => {
    expect(signInUrl({ clientId: "test-client", state: "abc" })).toBe(
      "https://github.com/login/oauth/authorize?client_id=test-client&state=abc",
    );
  });

  it("sends a person to GitHub's page for choosing repositories, for this app", () => {
    expect(installUrl({ appSlug: "ruken-test-app", state: "abc" })).toBe(
      "https://github.com/apps/ruken-test-app/installations/new?state=abc",
    );
  });

  it("takes a web address of its own, for the stand-in on this machine", () => {
    const webBase = "http://127.0.0.1:12112";
    expect(signInUrl({ clientId: "c", state: "s", webBase })).toBe(
      "http://127.0.0.1:12112/login/oauth/authorize?client_id=c&state=s",
    );
    expect(installUrl({ appSlug: "a", state: "s", webBase })).toBe(
      "http://127.0.0.1:12112/apps/a/installations/new?state=s",
    );
  });

  it("escapes what it is given, so a value cannot add a field of its own", () => {
    expect(signInUrl({ clientId: "a&b", state: "x y&z=1" })).toBe(
      "https://github.com/login/oauth/authorize?client_id=a%26b&state=x%20y%26z%3D1",
    );
  });
});

describe("the state", () => {
  it("opens for the account that made it, within ten minutes", () => {
    const state = sealState("user-1", NOW_MS, SECRET);
    expect(openState(state, "user-1", NOW_MS, SECRET)).toBe(true);
    expect(openState(state, "user-1", NOW_MS + TEN_MINUTES_MS, SECRET)).toBe(true);
  });

  it("does not open after ten minutes and one millisecond", () => {
    const state = sealState("user-1", NOW_MS, SECRET);
    expect(openState(state, "user-1", NOW_MS + TEN_MINUTES_MS + 1, SECRET)).toBe(false);
  });

  it("does not open before it was made", () => {
    const state = sealState("user-1", NOW_MS, SECRET);
    expect(openState(state, "user-1", NOW_MS - 1, SECRET)).toBe(false);
  });

  // It is what stops someone from finishing a connection that another person started.
  it("does not open for another account", () => {
    const state = sealState("user-1", NOW_MS, SECRET);
    expect(openState(state, "user-2", NOW_MS, SECRET)).toBe(false);
  });

  it("does not open when the secret is not the one it was made with", () => {
    const state = sealState("user-1", NOW_MS, SECRET);
    expect(openState(state, "user-1", NOW_MS, "another-secret")).toBe(false);
  });

  it("does not open when any part has been changed, or is not there", () => {
    const state = sealState("user-1", NOW_MS, SECRET);
    const [payload = "", mac = ""] = state.split(".");
    const flipped = (text: string) => `${text.slice(0, -1)}${text.endsWith("A") ? "B" : "A"}`;
    for (const changed of [
      `${flipped(payload)}.${mac}`,
      `${payload}.${flipped(mac)}`,
      payload,
      `${payload}.${mac}.${mac}`,
      "",
      "made-up",
    ]) {
      expect(openState(changed, "user-1", NOW_MS, SECRET)).toBe(false);
    }
    expect(openState(undefined, "user-1", NOW_MS, SECRET)).toBe(false);
  });

  it("is made the same way for the same account, time and secret", () => {
    expect(sealState("user-1", NOW_MS, SECRET)).toBe(sealState("user-1", NOW_MS, SECRET));
    expect(sealState("user-1", NOW_MS, SECRET)).not.toBe(sealState("user-2", NOW_MS, SECRET));
  });
});

// ---- Asking GitHub, as the person ------------------------------------------------------------------------------

const API = "https://api.github.com";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const PERSON_TOKEN = "ghu_person_token";
const CLIENT_SECRET = "test-only-client-secret";
const INPUT = { code: "test-code", clientId: "test-client", clientSecret: CLIENT_SECRET };

/** One request GitHub's stand-in saw. Header names are lower case, whatever way they were written. */
interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

const json = (value: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), { status: 200, headers });

/** A stand-in for `fetch`: it records each request and answers what `answer` says, or 404 for a request it does not know. */
function standIn(answer: (method: string, url: string) => Response | undefined) {
  const calls: Call[] = [];
  const stand: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    calls.push({
      method,
      url,
      headers: Object.fromEntries(new Headers(init?.headers)),
      body: typeof init?.body === "string" ? init.body : null,
    });
    return Promise.resolve(answer(method, url) ?? new Response("no such address", { status: 404 }));
  };
  return { fetch: stand, calls };
}

/** The answer to a request for the person's token, the one GitHub gives for a good code. */
const gotToken = () => json({ access_token: PERSON_TOKEN, token_type: "bearer" });

/** The installations list as GitHub writes it. */
const installationsList = (ids: { id: number; login: string }[], headers: Record<string, string> = {}) =>
  json(
    {
      total_count: ids.length,
      installations: ids.map((one) => ({ id: one.id, account: { login: one.login } })),
    },
    headers,
  );

/** A repositories list as GitHub writes it. */
const repositoriesList = (names: string[], headers: Record<string, string> = {}) =>
  json(
    {
      total_count: names.length,
      repositories: names.map((name) => ({ full_name: name, default_branch: "main" })),
    },
    headers,
  );

const nextPage = (url: string) => ({ link: `<${url}>; rel="next"` });

async function failureOf(attempt: Promise<unknown>): Promise<Error> {
  try {
    await attempt;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("expected the attempt to fail, and it did not");
}

describe("connectionOf", () => {
  it("posts the code with the app's id and secret, and asks for JSON", async () => {
    const { fetch, calls } = standIn((_method, url) => {
      if (url === TOKEN_URL) return gotToken();
      if (url.startsWith(`${API}/user/installations?`)) return installationsList([]);
      return undefined;
    });

    await connectionOf({ ...INPUT, fetch });

    expect(calls[0]).toMatchObject({ method: "POST", url: TOKEN_URL });
    expect(calls[0]?.headers.accept).toBe("application/json");
    expect(calls[0]?.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(calls[0]?.body ?? "")).toEqual({
      client_id: "test-client",
      client_secret: CLIENT_SECRET,
      code: "test-code",
    });
  });

  it("asks for the person's installations, then each one's repositories, with the person's own token", async () => {
    const { fetch, calls } = standIn((_method, url) => {
      if (url === TOKEN_URL) return gotToken();
      if (url === `${API}/user/installations?per_page=100`) {
        return installationsList([
          { id: 11, login: "alice" },
          { id: 12, login: "a-team" },
        ]);
      }
      if (url === `${API}/user/installations/11/repositories?per_page=100`) {
        return repositoriesList(["alice/one", "alice/two"]);
      }
      if (url === `${API}/user/installations/12/repositories?per_page=100`) {
        return repositoriesList(["a-team/shared"]);
      }
      return undefined;
    });

    const found = await connectionOf({ ...INPUT, fetch });

    expect(found).toEqual([
      {
        installationId: 11n,
        accountLogin: "alice",
        repositories: [
          { fullName: "alice/one", defaultBranch: "main" },
          { fullName: "alice/two", defaultBranch: "main" },
        ],
      },
      {
        installationId: 12n,
        accountLogin: "a-team",
        repositories: [{ fullName: "a-team/shared", defaultBranch: "main" }],
      },
    ]);
    expect(calls.slice(1).map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${API}/user/installations?per_page=100`,
      `GET ${API}/user/installations/11/repositories?per_page=100`,
      `GET ${API}/user/installations/12/repositories?per_page=100`,
    ]);
    // The person's token, and nothing else: never the app's own or an installation's.
    for (const call of calls.slice(1)) expect(call.headers.authorization).toBe(`Bearer ${PERSON_TOKEN}`);
  });

  it("follows a second page of the installations and of the repositories", async () => {
    const page2 = `${API}/user/installations?per_page=100&page=2`;
    const repos2 = `${API}/user/installations/11/repositories?per_page=100&page=2`;
    const { fetch } = standIn((_method, url) => {
      if (url === TOKEN_URL) return gotToken();
      if (url === `${API}/user/installations?per_page=100`) {
        return installationsList([{ id: 11, login: "alice" }], nextPage(page2));
      }
      if (url === page2) return installationsList([{ id: 12, login: "a-team" }]);
      if (url === `${API}/user/installations/11/repositories?per_page=100`) {
        return repositoriesList(["alice/one"], nextPage(repos2));
      }
      if (url === repos2) return repositoriesList(["alice/two"]);
      if (url === `${API}/user/installations/12/repositories?per_page=100`) return repositoriesList([]);
      return undefined;
    });

    const found = await connectionOf({ ...INPUT, fetch });

    expect(found.map((one) => one.installationId)).toEqual([11n, 12n]);
    expect(found[0]?.repositories.map((repo) => repo.fullName)).toEqual(["alice/one", "alice/two"]);
    expect(found[1]?.repositories).toEqual([]);
  });

  it("keeps 300 repositories in all, and stops asking once it has them", async () => {
    const { fetch, calls } = standIn((_method, url) => {
      if (url === TOKEN_URL) return gotToken();
      if (url.startsWith(`${API}/user/installations?`)) return installationsList([{ id: 11, login: "big" }]);
      if (url.includes("/repositories?")) {
        const page = Number(new URL(url).searchParams.get("page") ?? "1");
        const names = Array.from({ length: 100 }, (_, i) => `big/repo-${String(page)}-${String(i)}`);
        // Every page says there is another one.
        return repositoriesList(
          names,
          nextPage(`${API}/user/installations/11/repositories?per_page=100&page=${String(page + 1)}`),
        );
      }
      return undefined;
    });

    const found = await connectionOf({ ...INPUT, fetch });

    expect(found[0]?.repositories).toHaveLength(300);
    expect(calls.filter((call) => call.url.includes("/repositories?"))).toHaveLength(3);
  });

  it("never sends the person's token to an address that is not GitHub's API", async () => {
    const { fetch, calls } = standIn((_method, url) => {
      if (url === TOKEN_URL) return gotToken();
      if (url.startsWith(`${API}/user/installations?`)) {
        return installationsList([{ id: 11, login: "alice" }], nextPage("https://evil.example/steal"));
      }
      return undefined;
    });

    await failureOf(connectionOf({ ...INPUT, fetch }));

    expect(calls.map((call) => call.url)).not.toContain("https://evil.example/steal");
  });

  it("uses the addresses it is given, for the stand-in on this machine", async () => {
    const { fetch, calls } = standIn((_method, url) => {
      if (url === "http://127.0.0.1:12112/login/oauth/access_token") return gotToken();
      if (url.startsWith("http://127.0.0.1:12112/user/installations?")) return installationsList([]);
      return undefined;
    });

    await connectionOf({
      ...INPUT,
      fetch,
      apiBase: "http://127.0.0.1:12112",
      webBase: "http://127.0.0.1:12112",
    });

    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:12112/login/oauth/access_token",
      "http://127.0.0.1:12112/user/installations?per_page=100",
    ]);
  });

  describe("when GitHub refuses", () => {
    const WORDS = "GitHub didn't finish connecting. Try again.";

    // GitHub answers a spent or wrong code with a 200 and an `error` in the body.
    it.each([
      ["says the code is wrong, with a 200", () => json({ error: "bad_verification_code" })],
      ["answers 401", () => new Response("no", { status: 401 })],
      ["leaves the token out", () => json({ token_type: "bearer" })],
      ["sends something that is not JSON", () => new Response("<html>", { status: 200 })],
    ])("gives the person's words when GitHub %s", async (_why, answer) => {
      const { fetch } = standIn((_method, url) => (url === TOKEN_URL ? answer() : undefined));

      const error = await failureOf(connectionOf({ ...INPUT, fetch }));

      expect(error).toBeInstanceOf(GameError);
      expect(error).toMatchObject({ code: "NOT_CONNECTED", message: WORDS });
    });

    it("never puts the token or the secret in an error", async () => {
      const failures = [
        // The code is refused.
        standIn((_method, url) => (url === TOKEN_URL ? json({ error: "bad_verification_code" }) : undefined)),
        // The token is given, then the list fails.
        standIn((_method, url) => {
          if (url === TOKEN_URL) return gotToken();
          return new Response("broken", { status: 500 });
        }),
      ];
      for (const { fetch } of failures) {
        const error = await failureOf(connectionOf({ ...INPUT, fetch }));
        expect(`${error.name} ${error.message}`).not.toContain(PERSON_TOKEN);
        expect(`${error.name} ${error.message}`).not.toContain(CLIENT_SECRET);
      }
    });

    it("names the status and the address when a list fails, and nothing more", async () => {
      const { fetch } = standIn((_method, url) => {
        if (url === TOKEN_URL) return gotToken();
        return new Response("broken", { status: 500 });
      });

      const error = await failureOf(connectionOf({ ...INPUT, fetch }));

      expect(error.message).toBe("GitHub answered 500 to GET /user/installations?per_page=100");
    });
  });
});
