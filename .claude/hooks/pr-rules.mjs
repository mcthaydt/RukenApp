#!/usr/bin/env node
// pr-rules: the check GitHub runs on every pull request event, so a pull request that
// breaks a rule cannot merge however it was opened or edited. It reads the pull request,
// its files, comments and reviews through the REST API, judges them with the same code
// the client hook uses (pr-rules-lib.mjs), and writes a commit status named `pr-rules`
// on the head commit it read. Over the open limit, an opened or reopened pull request is
// also closed with a comment.
//
// Env: PR_NUMBER, GH_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH (data, never run),
// GITHUB_API_URL (defaults to api.github.com). Run from a checkout of main: the pull
// request's commits are fetched as git objects only and never checked out or run.
// A read the script cannot finish writes a `failure` status, never `success`.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beyondDocs, byCreation, hasCriteria, laneOf, laneOfNames, onlyCleanMerges, ownBranchPrs, reviewPasses } from './pr-rules-lib.mjs';

const CONTEXT = 'pr-rules';

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const env = process.env;
const API = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
const config = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'rules.json'), 'utf8'));
const repo = env.GITHUB_REPOSITORY || config.repo;

async function api(method, path, body) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'pr-rules', 'x-github-api-version': '2022-11-28' };
  if (env.GH_TOKEN) headers.authorization = `Bearer ${env.GH_TOKEN}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new ApiError(res.status, `${method} ${path} answered ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
// Every page of a list, to the last one. A list that never ends is an error, not a short list.
async function getAll(path) {
  const out = [];
  for (let page = 1; page <= 100; page++) {
    const got = await api('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(got)) throw new Error(`${path} did not answer a list`);
    out.push(...got);
    if (got.length < 100) return out;
  }
  throw new Error(`${path} has more than 100 pages`);
}

const git = (args) => {
  const r = spawnSync('git', args, { encoding: 'utf8', timeout: 60000 });
  return { ok: r.status === 0 && !r.error, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};

const writeStatus = (sha, state, description) => api('POST', `repos/${repo}/statuses/${sha}`, { state, context: CONTEXT, description: description.slice(0, 140) });

// The pull request's own commits, as git objects only (never checked out or run).
function fetchHead(n, headSha) {
  const r = git(['fetch', '--no-tags', 'origin', `+refs/pull/${n}/head:refs/remotes/pr-rules/${n}`]);
  if (!r.ok) throw new Error(`could not fetch refs/pull/${n}/head: ${r.err.split('\n')[0]}`);
  const got = git(['rev-parse', `refs/remotes/pr-rules/${n}`]);
  if (!got.ok || got.out !== headSha) throw new Error(`refs/pull/${n}/head is ${got.out.slice(0, 7)}, not the head ${headSha.slice(0, 7)} it was judged on`);
}

async function judge(pr, action, closeNow) {
  const failures = [];
  const f = config.prFlow ?? {};
  const n = pr.number;
  const max = f.maxOpenPrs ?? 10;
  const body = pr.body ?? '';

  // 1. Open limit. Every pull request counts, docs included; forks do not.
  const open = ownBranchPrs(await getAll(`repos/${repo}/pulls?state=open`), repo);
  const mine = open.some((p) => p.number === n);
  let closed = null;
  if (mine && max) {
    let over;
    let others;
    if (action === 'opened' || action === 'reopened') {
      others = byCreation(open.filter((p) => p.number !== n));
      over = others.length >= max;
    } else {
      const ordered = byCreation(open);
      over = ordered.findIndex((p) => p.number === n) >= max;
      others = ordered.filter((p) => p.number !== n);
    }
    if (over) {
      const named = others.slice(0, max).map((p) => `#${p.number}`).join(', ');
      failures.push(`${max} pull requests are already open (${named}); this is over the limit`);
      if (closeNow && (action === 'opened' || action === 'reopened')) closed = named;
    }
  }

  // The files, to the last page.
  const files = await getAll(`repos/${repo}/pulls/${n}/files`);
  const names = files.flatMap((x) => [x.filename, x.previous_filename]).filter(Boolean);
  const complete = files.length === pr.changed_files;
  const filesLane = complete ? laneOfNames(names, f.lanePaths, f.lanePathsExcept?.['3'] ?? []) : 3;

  // 2. Lane.
  const bodyLane = laneOf(body);
  if (!bodyLane) failures.push('the body names no lane (add a "## Lane" section that says "Lane 1", "Lane 2" or "Lane 3")');
  else if (bodyLane < filesLane) failures.push(`the body names lane ${bodyLane} but its files are lane ${filesLane}`);

  // 3. Acceptance criteria.
  if (!hasCriteria(body) && beyondDocs(names, config.ruleMix?.docPaths)) failures.push('the body has no "Acceptance criteria" heading and the change goes beyond docs');

  // 4. Workflows are lane 3.
  if (names.some((x) => /^\.github\/workflows\//.test(x)) && bodyLane !== 3) failures.push('a change to .github/workflows needs a body that names lane 3');

  // 5. Draft until a lane 2 or 3 pull request has its passing review on the head.
  const lane = Math.max(bodyLane ?? 0, filesLane);
  if (lane >= 2 && !pr.draft) {
    const items = [...(await getAll(`repos/${repo}/issues/${n}/comments`)), ...(await getAll(`repos/${repo}/pulls/${n}/reviews`))];
    let fetched = false;
    const r = reviewPasses(items, f, pr.head.sha, (at) => {
      if (!fetched) { fetchHead(n, pr.head.sha); fetched = true; }
      return onlyCleanMerges(process.cwd(), at, pr.head.sha, config.defaultBranch ?? 'main', config.prFlow?.notesPaths ?? []);
    });
    if (!r.ok) failures.push(`lane ${lane} pull request is not a draft and has no passing review that names its head ${r.head7}`);
  }
  return { failures, closed };
}

async function main() {
  const n = Number(env.PR_NUMBER);
  let event = {};
  try { event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')); } catch { /* the action is only needed to close */ }
  const action = event.action;
  if (!Number.isInteger(n) || n < 1) { console.log('::error::PR_NUMBER is not a pull request number'); return 1; }

  let pr;
  try { pr = await api('GET', `repos/${repo}/pulls/${n}`); } catch (e) {
    if (e instanceof ApiError && e.status === 404) { console.log(`#${n} is not a pull request: nothing to judge`); return 0; }
    console.log(`::error::could not read pull request #${n}: ${e.message}`);
    return 1;
  }
  if (pr.state !== 'open') { console.log(`#${n} is ${pr.state}: nothing to judge`); return 0; }

  let result;
  try { result = await judge(pr, action, true); } catch (e) {
    const why = `could not finish reading #${n}: ${e.message}`;
    console.log(`::error::${why}`);
    try { await writeStatus(pr.head.sha, 'failure', why); } catch (w) { console.log(`::error::could not write the status: ${w.message}`); }
    return 1;
  }
  for (const why of result.failures) console.log(`::error::${why}`);
  if (result.closed) {
    try {
      await api('POST', `repos/${repo}/issues/${n}/comments`, { body: `Closed: ${f3(result.closed)} are already open (${result.closed}). Reopen this when one merges or closes.` });
      await api('PATCH', `repos/${repo}/pulls/${n}`, { state: 'closed' });
    } catch (e) { console.log(`::error::could not close #${n}: ${e.message}`); }
  }
  const state = result.failures.length ? 'failure' : 'success';
  try { await writeStatus(pr.head.sha, state, result.failures[0] ?? 'every pull request rule holds'); } catch (e) {
    console.log(`::error::could not write the status: ${e.message}`);
    return 1;
  }
  return result.failures.length ? 1 : 0;
}
// "3 pull requests" for the three named in the comment.
const f3 = (named) => `${named.split(',').length} pull requests`;

main().then((code) => { process.exitCode = code; }, (e) => { console.log(`::error::pr-rules crashed: ${e?.message ?? e}`); process.exitCode = 1; });
