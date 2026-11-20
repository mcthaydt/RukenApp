const THIS_MACHINE = new Set(["localhost", "127.0.0.1"]);

/** True only for a plain http address on this machine: what the test-only switches may run on. */
export function isThisMachine(address: string | undefined): boolean {
  if (address === undefined) return false;
  try {
    const url = new URL(address);
    return url.protocol === "http:" && THIS_MACHINE.has(url.hostname);
  } catch {
    return false;
  }
}
