import { ask, askOrTell } from "../lib/ask.js";
import { forgetKey, readKey, rukenAddress, saveKey } from "../lib/settings.js";
import { spinner } from "../lib/say.js";
import { Told } from "../lib/told.js";
import { account as words } from "../words/account.js";
import { general } from "../words/general.js";

/** @typedef {import("../lib/types.js").Ctx} Ctx */

const POLL_MS = 5100;

/** @param {{ handle?: string | null, phoneEnding?: string | null }} person */
function who({ handle, phoneEnding }) {
  return handle ? words.whoIsHandle(handle) : words.whoIsAccount(phoneEnding ?? "----");
}

/** @param {string[]} _args @param {Ctx} ctx */
async function signIn(_args, ctx) {
  const address = rukenAddress(ctx.env);
  const name = (ctx.computerName?.() ?? "").trim() || words.nameless;
  const started = await askOrTell(ctx, "POST", "/api/v1/sign-in/start", { json: { name }, signedIn: false });
  ctx.out(words.openAndPress(`${address}/me/link`, started.code));
  if (!ctx.env.RUKEN_NO_BROWSER) ctx.openBrowser?.(started.link);
  const wait = spinner(ctx, words.waiting);
  const every = Number(ctx.env.RUKEN_POLL_MS) || POLL_MS;
  try {
    for (;;) {
      await ctx.sleep(every);
      const { status, body } = await ask(ctx, "POST", "/api/v1/sign-in/finish", {
        json: { code: started.code, deviceSecret: started.deviceSecret },
        signedIn: false,
      });
      if (status === 202) continue;
      if (status === 429) continue;
      if (status === 200) {
        await saveKey(ctx.env, body.key);
        wait.stop();
        ctx.out(words.signedInAs(who(body)));
        return;
      }
      throw new Told(typeof body?.problem === "string" ? body.problem : words.alreadyEnded);
    }
  } finally {
    wait.stop();
  }
}

/** @param {string[]} _args @param {Ctx} ctx */
async function whoami(_args, ctx) {
  const body = await askOrTell(ctx, "GET", "/api/v1/me");
  ctx.out(words.whoami(who(body)));
}

/** @param {string[]} _args @param {Ctx} ctx */
async function signOut(_args, ctx) {
  if (ctx.env.RUKEN_KEY) throw new Told(words.keyFromEnvironment);
  if ((await readKey(ctx.env)) === null) throw new Told(words.notSignedInHere);
  // The saved key is forgotten even when Ruken cannot be reached, so a person can always get out.
  try {
    await ask(ctx, "DELETE", "/api/v1/me/key");
  } catch (thrown) {
    if (!(thrown instanceof Told)) throw thrown;
  }
  await forgetKey(ctx.env);
  ctx.out(words.signedOut);
}

/** @param {string[]} _args @param {Ctx} ctx */
function accountScreen(_args, ctx) {
  ctx.out(words.accountScreen(`${rukenAddress(ctx.env)}/me`));
}

/** @type {import("../lib/types.js").Command[]} */
export const account = [
  {
    name: "sign-in",
    usage: general.prefixed("sign-in"),
    summary: "Sign in from this computer. You press Yes on ruken.io.",
    common: true,
    run: signIn,
  },
  {
    name: "whoami",
    usage: general.prefixed("whoami"),
    summary: "Say who this computer is signed in as.",
    common: true,
    run: whoami,
  },
  {
    name: "sign-out",
    usage: general.prefixed("sign-out"),
    summary: "Stop this computer using your Ruken.",
    common: false,
    run: signOut,
  },
  {
    name: "account",
    usage: general.prefixed("account"),
    summary: "Where your account, membership and password are.",
    common: false,
    run: accountScreen,
  },
];
