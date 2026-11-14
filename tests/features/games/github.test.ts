import { verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GameError } from "../../../src/features/games/game-error.ts";
import { appToken, createGitHub } from "../../../src/features/games/github.ts";
import { freshRsaKey } from "../../support/rsa.ts";
import { TestClock } from "../../support/test-clock.ts";

const NOW_MS = 1_800_000_000_000;
const SHA = "0123456789abcdef0123456789abcdef01234567";
const BASE = "https://api.github.com";

/** One request GitHub's stand-in saw. Header names are lower case, whatever way they were written. */
interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

/** A stand-in for `fetch` that records each request and answers the next response in the list. */
function fakeFetch(responses: Response[]): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const stand: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({
      method: init?.method ?? "GET",
      url,
      headers: Object.fromEntries(new Headers(init?.headers)),
      body: typeof init?.body === "string" ? init.body : null,
    });
    const next = responses.shift();
    return next === undefined
      ? Promise.reject(new Error("GitHub was asked more than the test expected"))
      : Promise.resolve(next);
  };
  return { fetch: stand, calls };
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

/** The two answers every call starts with: the installation, then its one-repository token. */
const tokenAnswers = () => [json({ id: 7 }), json({ token: "ghs_test_fake" }, 201)];

function gitHubWith(responses: Response[]) {
  const { fetch, calls } = fakeFetch(responses);
  const github = createGitHub({
    appId: "42",
    privateKeyPem: freshRsaKey().pkcs8Pem,
    clock: new TestClock("2027-01-15T08:00:00Z"),
    fetch,
  });
  return { github, calls };
}

describe("appToken", () => {
  // Review Focus 12: GitHub downloads PKCS#1; OpenSSL and Web Crypto's own export write PKCS#8.
  it.each(["pkcs1Pem", "pkcs8Pem"] as const)(
    "signs with a %s key, and the public key agrees",
    async (form) => {
      const key = freshRsaKey();
      const token = await appToken({ appId: "42", privateKeyPem: key[form], nowMs: NOW_MS });
      const [header = "", payload = "", signature = ""] = token.split(".");
      expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
      expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
        iss: "42",
        iat: 1_799_999_940,
        exp: 1_800_000_540,
      });
      expect(
        verify(
          "RSA-SHA256",
          Buffer.from(`${header}.${payload}`),
          key.publicKey,
          Buffer.from(signature, "base64url"),
        ),
      ).toBe(true);
    },
  );

  // Wrangler trims the end of a secret it is piped, so the last line break is not there.
  it.each(["pkcs1Pem", "pkcs8Pem"] as const)(
    "signs with a %s key that has no last line break",
    async (form) => {
      const pem = freshRsaKey()[form].trimEnd();
      expect(pem.endsWith("-----")).toBe(true);
      const token = await appToken({ appId: "42", privateKeyPem: pem, nowMs: NOW_MS });
      expect(token.split(".")).toHaveLength(3);
    },
  );

  it.each(["", "not a key", "-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----"])(
    "refuses %j, which is not a private key in PEM form",
    async (text) => {
      await expect(appToken({ appId: "42", privateKeyPem: text, nowMs: NOW_MS })).rejects.toThrow(
        "GITHUB_APP_PRIVATE_KEY is not a private key in PEM form.",
      );
    },
  );
});

describe("commitOf", () => {
  it("asks for a token for one repository, read only, then for the commit", async () => {
    const { github, calls } = gitHubWith([...tokenAnswers(), new Response(SHA)]);

    expect(await github.commitOf("acme/game", null)).toBe(SHA);

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${BASE}/repos/acme/game/installation`,
      `POST ${BASE}/app/installations/7/access_tokens`,
      `GET ${BASE}/repos/acme/game/commits/HEAD`,
    ]);
    expect(calls[0]?.headers.authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    expect(JSON.parse(calls[1]?.body ?? "null")).toEqual({
      repositories: ["game"],
      permissions: { contents: "read" },
    });
    expect(calls[1]?.headers.authorization).toBe(calls[0]?.headers.authorization);
    expect(calls[2]?.headers.authorization).toBe("Bearer ghs_test_fake");
    expect(calls[2]?.headers.accept).toBe("application/vnd.github.sha");
    for (const call of calls) {
      expect(call.headers["user-agent"]).toBe("ruken");
      expect(call.headers["x-github-api-version"]).toBe("2022-11-28");
    }
  });

  it("signs its app token from the clock it was given", async () => {
    const { github, calls } = gitHubWith([...tokenAnswers(), new Response(SHA)]);
    await github.commitOf("acme/game", "main");
    const payload = (calls[0]?.headers.authorization ?? "").split(".")[1] ?? "";
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { iat: number; exp: number };
    const nowSeconds = Date.parse("2027-01-15T08:00:00Z") / 1000;
    expect(claims).toMatchObject({ iat: nowSeconds - 60, exp: nowSeconds + 540 });
  });

  it("keeps a branch's slash and escapes everything else in it", async () => {
    const { github, calls } = gitHubWith([
      ...tokenAnswers(),
      new Response(SHA),
      ...tokenAnswers(),
      new Response(SHA),
    ]);
    await github.commitOf("acme/game", "release/v1");
    await github.commitOf("acme/game", "a?b#c");
    expect(calls[2]?.url).toBe(`${BASE}/repos/acme/game/commits/release/v1`);
    expect(calls[5]?.url).toBe(`${BASE}/repos/acme/game/commits/a%3Fb%23c`);
  });

  it("says so when the app is not installed on the repository", async () => {
    const { github, calls } = gitHubWith([json({ message: "Not Found" }, 404)]);
    await expect(github.commitOf("acme/game", null)).rejects.toMatchObject({
      name: "GameError",
      code: "NOT_CONNECTED",
      message: "Ruken can't see that repository. Choose it on GitHub, then try again.",
    });
    expect(calls).toHaveLength(1);
  });

  it.each([404, 422])("says so when the branch is not there (%i)", async (status) => {
    const { github } = gitHubWith([...tokenAnswers(), json({ message: "No commit found" }, status)]);
    await expect(github.commitOf("acme/game", "nope")).rejects.toMatchObject({
      code: "INVALID",
      message: "We couldn't find that branch in your repository.",
    });
  });

  it("names the status and the path when GitHub fails, and not the token", async () => {
    const { github } = gitHubWith([...tokenAnswers(), new Response("busy", { status: 503 })]);
    const failure = await github.commitOf("acme/game", null).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(GameError);
    const message = (failure as Error).message;
    expect(message).toContain("503");
    expect(message).toContain("/repos/acme/game/commits/HEAD");
    expect(message).not.toContain("ghs_");
  });
});

describe("installationOf", () => {
  it("asks, as the app, which installation holds the repository, and answers its number", async () => {
    const { github, calls } = gitHubWith([json({ id: 7 })]);

    expect(await github.installationOf("acme/game")).toBe(7n);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "GET", url: `${BASE}/repos/acme/game/installation` });
    // The app's own token (three parts, as a JWT has), not an installation's.
    expect(calls[0]?.headers.authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it("answers null when the app is not installed on the repository", async () => {
    const { github } = gitHubWith([json({ message: "Not Found" }, 404)]);
    expect(await github.installationOf("acme/game")).toBeNull();
  });

  it("refuses a name that is not owner/name before it asks anything", async () => {
    const { github, calls } = gitHubWith([]);
    await expect(github.installationOf("../x")).rejects.toMatchObject({ code: "INVALID" });
    expect(calls).toHaveLength(0);
  });

  it("names the status and the path when GitHub fails, and not the token", async () => {
    const { github } = gitHubWith([new Response("busy", { status: 503 })]);
    const failure = await github.installationOf("acme/game").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(GameError);
    const message = (failure as Error).message;
    expect(message).toContain("503");
    expect(message).toContain("/repos/acme/game/installation");
    expect(message).not.toMatch(/eyJ/);
  });
});

describe("tarball", () => {
  it("asks for the commit's files with the repository's token and answers the body", async () => {
    const { github, calls } = gitHubWith([...tokenAnswers(), new Response("the tarball")]);
    const body = await github.tarball("acme/game", SHA);
    expect(await new Response(body).text()).toBe("the tarball");
    expect(calls[2]?.method).toBe("GET");
    expect(calls[2]?.url).toBe(`${BASE}/repos/acme/game/tarball/${SHA}`);
    expect(calls[2]?.headers.authorization).toBe("Bearer ghs_test_fake");
  });

  it("never puts the token in an error", async () => {
    const { github } = gitHubWith([...tokenAnswers(), new Response("broken", { status: 500 })]);
    const failure = await github.tarball("acme/game", SHA).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("500");
    expect((failure as Error).message).not.toContain("ghs_");
  });

  it("says so when the app is not installed on the repository", async () => {
    const { github } = gitHubWith([json({ message: "Not Found" }, 404)]);
    await expect(github.tarball("acme/game", SHA)).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  });
});

describe("what a person typed", () => {
  // Review Focus 17: nothing typed is put into a GitHub address before it is checked.
  it.each(["acme", "acme/game/extra", "acme/ga me", "../x", "acme/..", "/game", "acme/"])(
    "refuses the repository name %j before asking GitHub",
    async (repo) => {
      const { github, calls } = gitHubWith([]);
      await expect(github.commitOf(repo, null)).rejects.toMatchObject({ code: "INVALID" });
      await expect(github.tarball(repo, SHA)).rejects.toMatchObject({ code: "INVALID" });
      expect(calls).toEqual([]);
    },
  );

  it.each(["a b", "a..b", "", "x".repeat(201), "line\nbreak", "tab\there"])(
    "refuses the branch %j before asking GitHub",
    async (branch) => {
      const { github, calls } = gitHubWith([]);
      await expect(github.commitOf("acme/game", branch)).rejects.toMatchObject({ code: "INVALID" });
      expect(calls).toEqual([]);
    },
  );
});
