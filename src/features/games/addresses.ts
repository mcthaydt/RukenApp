// A game never runs on Ruken's own address: each one gets a name of its own under the games' domain, so it can
// neither see Ruken's cookies nor another game's saves. One setting says where, with `{name}` standing for the game's
// own name.

const PROBLEM =
  "GAME_ADDRESS_PATTERN must be one address, like https://{name}.example.com: {name} first in the name, then the " +
  "games' domain, and nothing after it but a port.";

// `https://{name}.` or `http://{name}.`, then the domain in plain labels, then an optional port. No path, query or
// second `{name}`, and nothing in front of the first one.
const PATTERN =
  /^(https?):\/\/\{name\}\.([a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*)(?::\d{1,5})?$/;

/** Throws, naming the setting, unless the pattern is one a game may live under. */
export function checkAddressPattern(pattern: string): void {
  const match = PATTERN.exec(pattern);
  if (match === null) throw new Error(PROBLEM);
  const host = match[2] ?? "";
  // Plain http is for a developer's own machine only: a real name is https, or a game's page would be open to tampering.
  const isLocal = host === "localhost" || host.endsWith(".localhost");
  if (match[1] === "http" && !isLocal) throw new Error(PROBLEM);
}

/** The pattern with the game's own name filled in. */
export function gameAddress(pattern: string, name: string): string {
  // A function, so that nothing in `name` is read as a replacement code.
  return pattern.replace("{name}", () => name);
}
