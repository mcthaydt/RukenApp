// A game never runs on Ruken's own address. Two shapes of address keep it apart, and one setting says which:
//
//   https://{name}.games.example     each game has a name of its own under the games' domain (the real shape)
//   https://games.example/{name}     until that domain exists: one free address, the game as the whole path part
//
// `{name}` stands for the game's own name. The first shape also keeps one game's saves away from another's; the
// second shares one origin between games, which is why it is only for the test site.

const PROBLEM =
  "GAME_ADDRESS_PATTERN must be one address, like https://{name}.example.com or https://games.example.com/{name}: " +
  "{name} once, as the first part of the name or as the whole path.";

// The domain, in plain labels. No `{`, so a second `{name}` can never match as part of it.
const DOMAIN = "[a-z0-9]+(?:-[a-z0-9]+)*(?:\\.[a-z0-9]+(?:-[a-z0-9]+)*)*";

// `https://{name}.` or `http://{name}.`, then the domain, then an optional port. No path, query or second `{name}`,
// and nothing in front of the first one.
const NAME_FIRST = new RegExp(`^(https?)://\\{name\\}\\.(${DOMAIN})(?::\\d{1,5})?$`);
// The domain, an optional port, then `/{name}` as the whole path. Nothing before the domain, nothing after `{name}`.
const NAME_IN_PATH = new RegExp(`^(https?)://(${DOMAIN})(?::\\d{1,5})?/\\{name\\}$`);

/** Throws, naming the setting, unless the pattern is one a game may live under. */
export function checkAddressPattern(pattern: string): void {
  const match = NAME_FIRST.exec(pattern) ?? NAME_IN_PATH.exec(pattern);
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
