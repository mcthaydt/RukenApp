import { PREFIX } from "./prefix.js";

export const github = {
  /** @param {number} repos */
  connected: (repos) =>
    `GitHub is connected. Ruken can see ${repos === 1 ? "1 game folder" : `${String(repos)} game folders`}. See them with: ${PREFIX} repos`,
  notConnected: `GitHub is not connected yet. Connect it with: ${PREFIX} github connect`,
  /** @param {string} address */
  openToConnect: (address) => `Open ${address} and follow GitHub's steps. I'll wait here.`,
  waiting: "Waiting for you to finish on GitHub...",
  /** @param {number} repos */
  nowConnected: (repos) =>
    `Connected. Ruken can see ${String(repos)} on GitHub. See them with: ${PREFIX} repos`,
  /** @param {string} address */
  alreadyConnected: (address) =>
    `GitHub is already connected. To choose other game folders, open ${address}?choose=1`,
  gaveUp: `That took too long. Try again with: ${PREFIX} github connect`,
  noRepos: `Ruken can't see any game folders on GitHub yet. Choose some with: ${PREFIX} github connect`,
  /** @param {string} repo @param {string} branch */
  repoLine: (repo, branch) => `${repo} (main branch: ${branch})`,
  /** @param {string} repo */
  branchesHeading: (repo) => `Branches of ${repo}:`,
  reposUsage: `${PREFIX} repos`,
  branchesUsage: `${PREFIX} branches <owner/repo>`,
  githubUsage: `${PREFIX} github [connect]`,
  needsRepo: `Say which folder, like owner/repo. ${PREFIX} repos lists them.`,
};
