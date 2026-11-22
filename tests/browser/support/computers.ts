import { expect, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../../packages/ruken/cli.js";
import type { Ctx } from "../../../packages/ruken/lib/types.js";
import { pageHasSettled } from "./account.ts";
import { journeyClientHeaders } from "./rate-limits.ts";

const SITE = "http://localhost:4173";

/** A computer's terminal: the real command line, run in this process against the journeys' site, with a key file of its own. */
export function terminal(name = "Journey laptop") {
  const folder = mkdtempSync(join(tmpdir(), "ruken-terminal-"));
  const keyFile = join(folder, "key");
  const said: string[] = [];
  const env = {
    HOME: folder,
    RUKEN_URL: SITE,
    RUKEN_KEY_FILE: keyFile,
    RUKEN_NO_BROWSER: "1",
    RUKEN_POLL_MS: "1500",
  };
  const ctx: Ctx = {
    env,
    // The site counts a visitor by address; this one comes from the worker's own, as every journey does.
    fetch: (address, init) =>
      fetch(address, {
        ...init,
        headers: { ...Object.fromEntries(new Headers(init?.headers)), ...journeyClientHeaders() },
      }),
    out: (line) => said.push(line),
    err: (line) => said.push(line),
    raw: () => undefined,
    interactive: false,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    computerName: () => name,
    readFile: (file) => readFile(file),
    sizeOf: async (file) => (await stat(file)).size,
  };
  return {
    said,
    keyFile,
    env,
    /** Types a command and waits for it; answers the exit code. */
    run: (...args: string[]) => main(args, ctx),
    /** What it said so far, as one text. */
    text: () => said.join("\n"),
    /** The key it holds, or null. */
    key: () => (existsSync(keyFile) ? readFileSync(keyFile, "utf8").trim() : null),
    /** Waits until it has shown the code to type, and answers it. */
    async codeShown(): Promise<string> {
      let code: string | undefined;
      await expect
        .poll(() => (code = /Your code is ([A-Z]{4}-[A-Z]{4})/.exec(said.join("\n"))?.[1]), {
          timeout: 15_000,
        })
        .toBeTruthy();
      return code ?? "";
    },
  };
}

/** Types `sign-in` in a terminal and presses Yes in the maker's own browser; answers once the computer is let in. */
export async function letInTerminal(page: Page, computer: ReturnType<typeof terminal>): Promise<void> {
  const signingIn = computer.run("sign-in");
  const code = await computer.codeShown();
  await page.goto(`/me/link?code=${code}`);
  await pageHasSettled(page);
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();
  expect(await signingIn).toBe(0);
}
