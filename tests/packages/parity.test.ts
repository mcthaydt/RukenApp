// Criterion A1: every action the maker's screens have is carried by a command (or says why not), and every command a row
// calls built is really there. A new maker screen added with no command fails here.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMANDS } from "../../packages/ruken/cli.js";

const ROOT = resolve(import.meta.dirname, "../..");
const MAKE = join(ROOT, "src/routes/make");
const PARITY = join(ROOT, "packages/ruken/parity");

interface Row {
  id: string;
  command: string;
  mcp: string | null;
  endpoint: string | null;
  actions: string[];
  built: boolean;
  browserOnly?: boolean;
}

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(PARITY, name), "utf8"));
}

/** Every named form action and every `+server.ts` handler under `src/routes/make/`, written `make/<folder>#<name>`. */
function makerActions(): string[] {
  const found: string[] = [];
  const files = readdirSync(MAKE, { recursive: true, withFileTypes: true }).filter(
    (entry) => entry.isFile() && /^\+(page|layout)?\.?server\.ts$/.test(entry.name),
  );
  for (const file of files) {
    const path = join(file.parentPath, file.name);
    const folder = ["make", relative(MAKE, file.parentPath).split(sep).join("/")].filter(Boolean).join("/");
    const lines = readFileSync(path, "utf8").split("\n");
    let inActions = false;
    for (const line of lines) {
      if (line.startsWith("export const actions")) inActions = true;
      else if (inActions && line.startsWith("};")) inActions = false;
      else if (inActions) {
        const name = /^ {2}(\w+):/.exec(line)?.[1];
        if (name !== undefined) found.push(`${folder}#${name}`);
      }
      const method = /^export const (GET|POST|PUT|PATCH|DELETE)\b/.exec(line)?.[1];
      if (file.name === "+server.ts" && method !== undefined) found.push(`${folder}#${method}`);
    }
  }
  return found.sort();
}

const rows: Row[] = ["account", "games", "github", "page"].flatMap(
  (name) => readJson(`${name}.json`) as Row[],
);
const notCarried = readJson("not-carried.json") as { action: string; why: string }[];

describe("the command line carries everything the maker screens do", () => {
  it("finds the maker screens' actions", () => {
    expect(makerActions()).toContain("make/[game]/[question=question]#clip");
    expect(makerActions()).toContain("make/github#GET");
  });

  it("has every action in a row, or in the list of ones not carried over with a reason", () => {
    const covered = new Set([...rows.flatMap((row) => row.actions), ...notCarried.map((one) => one.action)]);
    expect(makerActions().filter((action) => !covered.has(action))).toEqual([]);
  });

  it("names no action that is not there, so a removed screen takes its row with it", () => {
    const real = new Set(makerActions());
    const named = [...rows.flatMap((row) => row.actions), ...notCarried.map((one) => one.action)];
    expect(named.filter((action) => !real.has(action))).toEqual([]);
  });

  it("gives every row its place in Ruken, and every not-carried action its reason", () => {
    for (const row of rows) {
      expect(row.id, row.id).toMatch(/^[a-z-]+$/);
      expect(typeof row.built, row.id).toBe("boolean");
    }
    for (const one of notCarried) expect(one.why.length, one.action).toBeGreaterThan(10);
  });

  it("has, for every built row, its command and its endpoint", () => {
    const commands = new Set(COMMANDS.map((command) => command.name));
    for (const row of rows.filter((one) => one.built)) {
      expect(commands.has(row.command.split(" ")[0] ?? ""), `${row.id}: command ${row.command}`).toBe(true);
      if (row.browserOnly !== true)
        expect(row.endpoint, `${row.id}: endpoint`).toMatch(/^[A-Z]+ \/api\/v1\//);
    }
  });

  it("has a command for nothing that no row owns", () => {
    const owned = new Set(rows.map((row) => row.command.split(" ")[0]));
    for (const command of COMMANDS) expect(owned.has(command.name), command.name).toBe(true);
  });
});
