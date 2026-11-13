type Settings = Record<string, string | undefined>;

/** A setting that must be there. Throws a message that says where to set it. */
export function requireEnv(name: string, source: Settings = process.env): string {
  throw new Error(`not built yet (${name}, ${String(source[name])})`);
}

/** A setting that may be missing. An empty value counts as missing. */
export function optionalEnv(name: string, source: Settings = process.env): string | undefined {
  throw new Error(`not built yet (${name}, ${String(source[name])})`);
}
