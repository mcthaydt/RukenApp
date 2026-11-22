import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { general } from "../words/general.js";
import { Told } from "./told.js";

// Where Ruken is, and where this computer keeps its key. Ruken's address is https://ruken.io; a test points RUKEN_URL at a
// stand-in, and only an address on this very computer may be plain http.

const DEFAULT_ADDRESS = "https://ruken.io";

/** The address of Ruken, or a refusal in plain words when it is not a secure one. */
/**
 * @param {Record<string, string | undefined>} env
 */
export function rukenAddress(env) {
  const address = (env.RUKEN_URL ?? DEFAULT_ADDRESS).replace(/\/+$/, "");
  let url;
  try {
    url = new URL(address);
  } catch {
    throw new Told(general.notSecure(address));
  }
  const onThisComputer = url.protocol === "http:" && url.hostname === "localhost";
  if (url.protocol !== "https:" && !onThisComputer) throw new Told(general.notSecure(address));
  return url.origin;
}

/** The file the key lives in: ~/.config/ruken/key, or %APPDATA%\ruken\key on Windows. */
/**
 * @param {Record<string, string | undefined>} env
 * @param {string} [platform]
 */
export function keyFile(env, platform = process.platform) {
  if (env.RUKEN_KEY_FILE) return env.RUKEN_KEY_FILE;
  if (platform === "win32" && env.APPDATA) return join(env.APPDATA, "ruken", "key");
  return join(env.XDG_CONFIG_HOME ?? join(env.HOME ?? homedir(), ".config"), "ruken", "key");
}

/** The key this computer holds, or null. RUKEN_KEY in the environment wins over the file, for a machine with no home. */
/**
 * @param {Record<string, string | undefined>} env
 */
export async function readKey(env) {
  if (env.RUKEN_KEY) return env.RUKEN_KEY.trim();
  try {
    return (await readFile(keyFile(env), "utf8")).trim() || null;
  } catch {
    return null;
  }
}

/** Keeps the key where only this person can read it (owner-only permissions). */
/**
 * @param {Record<string, string | undefined>} env
 * @param {string} key
 */
export async function saveKey(env, key) {
  const file = keyFile(env);
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, `${key}\n`, { mode: 0o600 });
  // writeFile keeps the mode of a file that was already there.
  await chmod(file, 0o600).catch(() => undefined);
}

/**
 * @param {Record<string, string | undefined>} env
 */
export async function forgetKey(env) {
  await rm(keyFile(env), { force: true });
}
