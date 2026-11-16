import { readFileSync } from "node:fs";

// Which of the screen walk's screens a change can reach, so a draft pull request walks only those and the full run
// (which has no list) walks them all (Owner, 2026-11-16: "All three" on "Make CI faster by changing the CI files?").
//
// A doubt never skips a screen: a change this file cannot place on a route (a shared component, a style, a helper the
// walk itself uses) makes every screen count as reached.

/** A change this file can place: a page or its server file, whose address is the folder it sits in. */
const ROUTE_FILE = /^src\/routes\/(?:(.+)\/)?\+page(?:\.server)?\.(?:svelte|ts)$/;

/** Files that cannot change what a screen looks like or links to: words about the work and the journeys' own tests. */
function cannotReachAScreen(file: string): boolean {
  if (file.endsWith(".md") || file.startsWith("docs/")) return true;
  // The walk reads everything in tests/browser/support and tests/fixtures, so a change there reaches every screen.
  if (file.startsWith("tests/browser/support/") || file.startsWith("tests/fixtures/")) return false;
  // Any other test only checks a screen; it is not part of one.
  return file.startsWith("tests/");
}

/** A folder name of a route as the segment of an address it stands for: `[game]` and `[question=question]` take any word. */
function segmentOf(folder: string): string {
  return folder.startsWith("[") ? "*" : folder;
}

/**
 * The addresses (with `*` for any word) of the screens the changed files can reach, or `"all"` when any change cannot
 * be placed on a page.
 */
export function addressesReached(changedFiles: readonly string[]): readonly string[] | "all" {
  const addresses = new Set<string>();
  for (const file of changedFiles) {
    if (cannotReachAScreen(file)) continue;
    const route = ROUTE_FILE.exec(file);
    if (route === null) return "all";
    const folders = (route[1] ?? "").split("/").filter((folder) => folder !== "");
    addresses.add(`/${folders.map(segmentOf).join("/")}`);
  }
  // Nothing placed and nothing that cannot matter: with nothing to go on, walk everything.
  return addresses.size === 0 ? "all" : [...addresses];
}

/** Whether a screen at this address (`/make/abc/check`) is one of the addresses reached. */
export function addressIsReached(address: string, reached: readonly string[] | "all"): boolean {
  if (reached === "all") return true;
  const parts = address.split("/").filter((part) => part !== "");
  return reached.some((pattern) => {
    const wanted = pattern.split("/").filter((part) => part !== "");
    return (
      wanted.length === parts.length && wanted.every((part, index) => part === "*" || part === parts[index])
    );
  });
}

/**
 * The changed files CI wrote for a draft, or `undefined` for the full run, a push to main and a run on a person's own
 * machine, which all walk every screen. CI names the file in CHANGED_FILES_LIST (one path a line).
 */
export function changedFilesFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): readonly string[] | undefined {
  const list = environment.CHANGED_FILES_LIST;
  if (list === undefined || list === "") return undefined;
  return readFileSync(list, "utf8")
    .split("\n")
    .filter((line) => line !== "");
}
