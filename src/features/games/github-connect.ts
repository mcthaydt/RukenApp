// Connecting a maker's GitHub (stubs: the code comes after its tests have been seen failing).

/** One installation of the Ruken GitHub App that a person can reach, with the repositories GitHub listed in it. */
export interface Connection {
  installationId: bigint;
  accountLogin: string;
  repositories: { fullName: string; defaultBranch: string }[];
}

export interface ConnectOptions {
  /** Tests hand in their own. */
  fetch?: typeof fetch;
  /** Where GitHub's API is. */
  apiBase?: string;
  /** Where GitHub's sign-in pages are. */
  webBase?: string;
}

export function signInUrl(input: { clientId: string; state: string; webBase?: string }): string {
  throw new Error(`not built yet: signInUrl ${input.clientId} ${input.state}`);
}

export function installUrl(input: { appSlug: string; state: string; webBase?: string }): string {
  throw new Error(`not built yet: installUrl ${input.appSlug} ${input.state}`);
}

export function sealState(userId: string, nowMs: number, secret: string): string {
  throw new Error(`not built yet: sealState ${userId} ${String(nowMs)} ${String(secret.length)}`);
}

export function openState(value: string | undefined, userId: string, nowMs: number, secret: string): boolean {
  throw new Error(
    `not built yet: openState ${String(value)} ${userId} ${String(nowMs)} ${String(secret.length)}`,
  );
}

export function connectionOf(
  input: { code: string; clientId: string; clientSecret: string } & ConnectOptions,
): Promise<Connection[]> {
  return Promise.reject(new Error(`not built yet: connectionOf ${input.code}`));
}
