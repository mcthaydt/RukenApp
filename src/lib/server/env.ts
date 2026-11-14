type Settings = Record<string, string | undefined>;

/**
 * A setting that must be there. The message says where to set it, because a person reading a
 * failed deploy should not have to guess. An empty value counts as missing: a setting left blank
 * in Cloudflare is a mistake, not a choice.
 */
export function requireEnv(name: string, source: Settings = process.env): string {
  const value = source[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing setting ${name}. Add it as a secret on the Worker in Cloudflare.`);
  }
  return value;
}

/** A setting that may be missing. An empty value counts as missing. */
export function optionalEnv(name: string, source: Settings = process.env): string | undefined {
  const value = source[name];
  return value === "" ? undefined : value;
}
