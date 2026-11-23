import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// deploy.yml holds the deploy key, so these tests read it as text and fail on a change that widens who can reach
// the key, deploys from a pull request or a red run, or hands a secret to a step that does not need it.

const text = readFileSync(".github/workflows/deploy.yml", "utf8");
// Comments are not rules, and some of them quote the words the checks look for.
const code = text
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");

const stepsAt = code.indexOf("\n    steps:\n");
const stepBlocks = code
  .slice(stepsAt + "\n    steps:\n".length)
  .split(/^ {6}- /m)
  .filter((s) => s.trim() !== "");
const stepNamed = (needle: RegExp) => {
  const found = stepBlocks.find((s) => needle.test(s));
  if (!found) throw new Error(`no step matches ${String(needle)}`);
  return found;
};
const indexOfStep = (needle: RegExp) => stepBlocks.findIndex((s) => needle.test(s));
const header = code.slice(0, stepsAt);

describe("deploy.yml: who and what can deploy", () => {
  it("wakes only when CI completes on main", () => {
    expect(header).toMatch(
      /\non:\n {2}workflow_run:\n {4}workflows: \[CI\]\n {4}types: \[completed\]\n {4}branches: \[main\]\n/,
    );
  });

  it("has no pull request trigger", () => {
    expect(code).not.toMatch(/pull_request/);
  });

  it("deploys only a successful push run from this repository", () => {
    expect(header).toContain("github.event.workflow_run.event == 'push'");
    expect(header).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(header).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
  });

  it("uses the production environment", () => {
    expect(header).toMatch(/\n {4}environment: production$/);
  });

  it("can read the repository and its runs and nothing else", () => {
    expect(header).toMatch(/\npermissions:\n {2}contents: read\n {2}actions: read\n+\S/);
    expect(code.match(/permissions:/g)).toHaveLength(1);
  });

  it("runs one deploy at a time and never stops one halfway", () => {
    expect(header).toMatch(/concurrency:\n {2}group: deploy-production\n {2}cancel-in-progress: false\n/);
  });
});

describe("deploy.yml: the steps", () => {
  it("runs the target, checkout, install, build, deploy and live check in that order", () => {
    const order = [
      /id: target/,
      /actions\/checkout[^\n]*\n\s+if: steps\.target/,
      /pnpm install --frozen-lockfile/,
      /pnpm build/,
      /pnpm run deploy/,
      /live-check\.sh/,
    ].map(indexOfStep);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("skips every step after the target when there is nothing to deploy", () => {
    const targetAt = indexOfStep(/id: target/);
    const after = stepBlocks.slice(targetAt + 1);
    expect(after).toHaveLength(8);
    for (const step of after) expect(step).toMatch(/\n\s+if: .*steps\.target\.outputs\.deploy == 'true'/);
  });

  it("hints at a manual rollback only after a failure with a new version already live", () => {
    const hint = stepNamed(/how to roll back/);
    expect(hint).toContain("failure()");
    expect(hint).toContain("steps.deploy.outputs.shipped == 'true'");
    expect(hint).toContain("pnpm exec wrangler rollback");
    expect(stepNamed(/id: deploy/)).toContain('echo "shipped=true"');
    expect(hint).not.toMatch(/secrets\./);
  });

  it("checks out the commit the target picked, without keeping the token", () => {
    const checkout = stepNamed(/actions\/checkout[^\n]*\n\s+if: steps\.target/);
    expect(checkout).toContain("ref: ${{ steps.target.outputs.sha }}");
    expect(checkout).toContain("persist-credentials: false");
    const first = stepBlocks[0] ?? "";
    expect(first).toContain("persist-credentials: false");
  });

  it("starts with a sparse checkout of the scripts at github.sha, with no secret and no token", () => {
    const first = stepBlocks[0] ?? "";
    expect(first).toContain("ref: ${{ github.sha }}");
    expect(first).toContain("path: tip");
    expect(first).toContain("sparse-checkout: .github/scripts");
    expect(first).toContain("persist-credentials: false");
    expect(first).not.toMatch(/secrets\.|GH_TOKEN|env:/);
  });

  it("runs the target script from that folder, with the run's commit passed through env", () => {
    const target = stepNamed(/id: target/);
    expect(target).toContain("run: tip/.github/scripts/deploy-target.sh");
    expect(target).toContain("RUN_SHA: ${{ github.event.workflow_run.head_sha }}");
    expect(target).not.toMatch(/run:[^\n]*\$\{\{/);
  });

  it("has no env before the steps, so no step gets a secret it does not use", () => {
    expect(header).not.toMatch(/^\s*env:/m);
  });

  it("names secrets only in the deploy and live-check steps", () => {
    const withSecrets = stepBlocks.filter((s) => /secrets\./.test(s));
    expect(withSecrets).toEqual([stepNamed(/id: deploy/), stepNamed(/live-check\.sh/)]);
  });

  it("gives the database address to the deploy step only", () => {
    const withDatabase = stepBlocks.filter((s) => s.includes("DIRECT_DATABASE_URL"));
    expect(withDatabase).toEqual([stepNamed(/id: deploy/)]);
  });
});
