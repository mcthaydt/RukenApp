import { account } from "./commands/account.js";
import { games } from "./commands/games.js";
import { github } from "./commands/github.js";
import { page } from "./commands/page.js";
import { Told } from "./lib/told.js";
import { general } from "./words/general.js";
import { PREFIX } from "./words/prefix.js";

/** Every command: its name, how it is typed, one plain sentence, whether the short help shows it, and what runs it. */
export /** @type {import("./lib/types.js").Command[]} */
const COMMANDS = [...account, ...games, ...github, ...page];

/**
 * Runs one command line. `ctx` holds everything that touches the world (the network, the files, the screen), so a test
 * runs this with stand-ins. Answers the exit code: 0 when it worked, 1 when the person was told what to fix.
 */
export async function main(/** @type {string[]} */ args, /** @type {import("./lib/types.js").Ctx} */ ctx) {
  const [first, ...rest] = args;
  try {
    if (first === undefined || first === "--help" || first === "-h" || first === "help") {
      help(ctx, first === "help" ? rest[0] : undefined);
      return 0;
    }
    const command = COMMANDS.find((one) => one.name === first);
    if (command === undefined) throw new Told(general.unknownCommand(first));
    await command.run(rest, ctx);
    return 0;
  } catch (thrown) {
    if (thrown instanceof Told) {
      ctx.err(thrown.message);
      return 1;
    }
    ctx.err(general.strangeAnswer);
    return 1;
  }
}

/**
 * @param {import("./lib/types.js").Ctx} ctx
 * @param {string | undefined} which
 */
function help(ctx, which) {
  if (which !== undefined && which !== "all") {
    const one = COMMANDS.find((command) => command.name === which);
    if (one === undefined) throw new Told(general.unknownCommand(which));
    ctx.out(general.helpOne(one.usage, one.summary));
    return;
  }
  const shown = which === "all" ? COMMANDS : COMMANDS.filter((command) => command.common);
  ctx.out(general.helpTop);
  for (const command of shown) ctx.out(`  ${command.usage}\n    ${command.summary}`);
  if (which !== "all") ctx.out(general.helpMore(PREFIX));
}
