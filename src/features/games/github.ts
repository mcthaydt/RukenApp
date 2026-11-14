import type { Clock } from "../../lib/clock.ts";

export interface GitHub {
  commitOf(repo: string, branch: string | null): Promise<string>;
  tarball(repo: string, commitSha: string): Promise<ReadableStream<Uint8Array>>;
}

export interface GitHubOptions {
  appId: string;
  privateKeyPem: string;
  clock: Clock;
  fetch?: typeof fetch;
  apiBase?: string;
}

export function pkcs8FromPkcs1(der: Uint8Array): Uint8Array {
  throw new Error(`not built yet: ${String(der.length)}`);
}

export function appToken(input: { appId: string; privateKeyPem: string; nowMs: number }): Promise<string> {
  throw new Error(`not built yet: ${input.appId}`);
}

export function createGitHub(options: GitHubOptions): GitHub {
  throw new Error(`not built yet: ${options.appId}`);
}
