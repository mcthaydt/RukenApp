#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { hostname } from "node:os";
import { createInterface } from "node:readline";
import { main } from "./cli.js";

/** @type {import("./lib/types.js").Ctx} */
const ctx = {
  env: process.env,
  fetch: globalThis.fetch,
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  raw: (text) => process.stderr.write(text),
  interactive: Boolean(process.stderr.isTTY),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  computerName: () => hostname(),
  readFile: (file) => readFile(file),
  sizeOf: async (file) => (await stat(file)).size,
  prompt: (question) =>
    new Promise((resolve) => {
      const lines = createInterface({ input: process.stdin, output: process.stderr });
      // A closed input (a pipe with nothing left) is an empty answer, which is a no.
      lines.once("close", () => resolve(""));
      lines.question(`${question} `, (answer) => {
        resolve(answer);
        lines.close();
      });
    }),
  openBrowser: (address) => {
    const [command, ...args] =
      process.platform === "darwin"
        ? ["open", address]
        : process.platform === "win32"
          ? ["cmd", "/c", "start", "", address]
          : ["xdg-open", address];
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => undefined);
    child.unref();
  },
};

process.exitCode = await main(process.argv.slice(2), ctx);
