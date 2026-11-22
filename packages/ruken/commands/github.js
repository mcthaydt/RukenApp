import { askOrTell } from "../lib/ask.js";
import { rukenAddress } from "../lib/settings.js";
import { spinner } from "../lib/say.js";
import { Told } from "../lib/told.js";
import { github as words } from "../words/github.js";

/** @typedef {import("../lib/types.js").Ctx} Ctx */

const POLL_MS = 3000;
/** About ten minutes of waiting for a person to finish on GitHub. */
const GIVE_UP_AFTER = 10 * 60_000;

/** @param {string[]} args @param {Ctx} ctx */
async function status([what], ctx) {
  if (what === "connect") return connect(ctx);
  if (what !== undefined) throw new Told(words.githubUsage);
  const now = await askOrTell(ctx, "GET", "/api/v1/github");
  ctx.out(now.connected ? words.connected(now.repos) : words.notConnected);
}

/** GitHub's own sign-in needs a browser, so this opens the page and waits until Ruken can see the connection. @param {Ctx} ctx */
async function connect(ctx) {
  const address = `${rukenAddress(ctx.env)}/make/github`;
  const before = await askOrTell(ctx, "GET", "/api/v1/github");
  if (before.connected) {
    ctx.out(words.alreadyConnected(address));
    return;
  }
  ctx.out(words.openToConnect(address));
  if (!ctx.env.RUKEN_NO_BROWSER) ctx.openBrowser?.(address);
  const wait = spinner(ctx, words.waiting);
  const every = Number(ctx.env.RUKEN_POLL_MS) || POLL_MS;
  try {
    for (let waited = 0; waited < GIVE_UP_AFTER; waited += every) {
      await ctx.sleep(every);
      const now = await askOrTell(ctx, "GET", "/api/v1/github");
      if (now.connected) {
        wait.stop();
        ctx.out(words.nowConnected(now.repos));
        return;
      }
    }
  } finally {
    wait.stop();
  }
  throw new Told(words.gaveUp);
}

/** @param {string[]} _args @param {Ctx} ctx */
async function repos(_args, ctx) {
  const { repos: found } = await askOrTell(ctx, "GET", "/api/v1/github/repos");
  if (found.length === 0) {
    ctx.out(words.noRepos);
    return;
  }
  for (const one of found) ctx.out(words.repoLine(one.repo, one.defaultBranch));
}

/** @param {string[]} args @param {Ctx} ctx */
async function branches([repo], ctx) {
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) throw new Told(words.needsRepo);
  const [owner, name] = repo.split("/");
  const found = await askOrTell(
    ctx,
    "GET",
    `/api/v1/github/repos/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(name ?? "")}/branches`,
  );
  ctx.out(words.branchesHeading(found.repo));
  for (const one of found.branches) ctx.out(one);
}

/** @type {import("../lib/types.js").Command[]} */
export const github = [
  {
    name: "github",
    usage: words.githubUsage,
    summary: "Say whether GitHub is connected, or connect it.",
    common: true,
    run: status,
  },
  {
    name: "repos",
    usage: words.reposUsage,
    summary: "List the game folders Ruken can see on GitHub.",
    common: false,
    run: repos,
  },
  {
    name: "branches",
    usage: words.branchesUsage,
    summary: "List the branches of one of your game folders.",
    common: false,
    run: branches,
  },
];
