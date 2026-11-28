// The pull request rules a program can judge, in one place. Two callers use it: the
// client hook (rules.mjs, an early warning on the routes it can read) and pr-rules.mjs
// (the check GitHub runs on every pull request event). Both judge by this code, so they
// cannot drift apart. Node only, no packages, no side effects on import.

import { spawnSync } from 'node:child_process';

// ---------- paths ----------

export const globToRegExp = (glob) => new RegExp('^' + glob.split('**').map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
export const matchesAny = (path, globs = []) => globs.some((g) => globToRegExp(g).test(path));

// ---------- the body ----------

const LANE_WORD = /\blane\s*([123])\b/gi;

// The lane a body names: the highest lane named anywhere in it wins, so a body that says
// lane 1 in one place and lane 3 in another is read as lane 3 and gets the stricter review.
// Null when no lane is named.
export function laneOf(body) {
  const all = [...String(body ?? '').matchAll(LANE_WORD)].map((m) => Number(m[1]));
  return all.length ? Math.max(...all) : null;
}

// An "Acceptance criteria" heading.
export const hasCriteria = (body) => /^ {0,3}#{1,6}[ \t]*acceptance criteria\b/im.test(String(body ?? ''));

// Docs for the criteria rule leave out .claude/**, so a change to the hooks still needs criteria.
export const criteriaDocPaths = (docPaths) => (docPaths ?? ['docs/**', '*.md', '**/*.md']).filter((p) => p !== '.claude/**');
export const beyondDocs = (files, docPaths) => {
  const docs = criteriaDocPaths(docPaths);
  return files.some((f) => !matchesAny(f, docs));
};

// ---------- lanes ----------

// The lane of a pull request's files (CLAUDE.md, Risk: the highest lane wins). `names` holds
// every filename and previous filename.
export function laneOfNames(names, lanePaths, except3 = []) {
  let lane = 1;
  for (const name of names) {
    if (!name) continue;
    if (matchesAny(name, lanePaths?.['3'] ?? []) && !matchesAny(name, except3)) return 3;
    if (matchesAny(name, lanePaths?.['2'] ?? [])) lane = 2;
  }
  return lane;
}

// ---------- verdicts ----------

// A verdict is a comment or review whose first line starts with a commit (7+ hex
// characters) followed by PASS or FAIL, e.g. "79ef366 FAIL: 5 red" or "**abc1234 PASS**".
// Only the account in f.verdictAuthor writes verdicts that count: the repo is public, so
// anyone can comment.
export function verdicts(items, f = {}) {
  const pass = new RegExp(f.passPattern ?? '^(PASS|PASSED)$');
  const fail = new RegExp(f.failPattern ?? '^(FAIL|FAILED)$');
  const author = f.verdictAuthor ? String(f.verdictAuthor).toLowerCase() : null;
  const out = [];
  for (const c of items) {
    if (author && String(c.user?.login ?? '').toLowerCase() !== author) continue;
    const raw = String(c.body ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    if (raw.startsWith('>')) continue; // a quote is not a verdict
    const first = raw.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // [abc1234](link) reads as abc1234
    const m = /^[^0-9a-z>]*([0-9a-f]{7,40})\b(.*)$/i.exec(first);
    if (!m) continue;
    // Strict: the first word after the commit, before any number, is the verdict, and it
    // must be exactly PASS/PASSED or FAIL/FAILED ("abc1234 PASS: 0 failed" passes). Anything
    // else ("abc1234: 828 passed", "abc1234: tests PASS", "abc1234: 0 failed") is a status
    // line, not a verdict, so it neither clears a FAIL nor blocks a PASS.
    const word = (/^[^A-Za-z0-9]*([A-Za-z]+)/.exec(m[2]) ?? [])[1] ?? '';
    const verdict = fail.test(word) ? 'fail' : pass.test(word) ? 'pass' : null;
    if (verdict) out.push({ sha: m[1].slice(0, 7).toLowerCase(), verdict, at: c.submitted_at ?? c.created_at ?? '' });
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

// Every verdict on a commit that is the head, or reaches it through clean merges of the
// default branch only, counts; the newest of them decides. cleanFrom(sha) says whether a
// reviewed commit reaches the head through clean merges only.
export function reviewPasses(items, f, headSha, cleanFrom) {
  const head7 = String(headSha ?? '').slice(0, 7).toLowerCase();
  const memo = new Map();
  const covers = (at) => { if (!memo.has(at)) memo.set(at, at === head7 || cleanFrom(at) === true); return memo.get(at); };
  const counted = verdicts(items, f).filter((v) => head7 && covers(v.sha));
  return { ok: counted.length > 0 && counted.at(-1).verdict === 'pass', head7, counted };
}

// ---------- git ----------

const gitRun = (cwd, args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
  return { ok: r.status === 0 && !r.error, out: (r.stdout ?? '').trim() };
};

// Commits between a reviewed commit and the head that are only clean merges of the
// default branch keep the review (release: "a clean merge of current main keeps the review").
// `notes` (rules.json, prFlow.notesPaths) widens that: a merge of the default branch may
// conflict in, or be hand-edited in, those files only, and a one-parent commit may touch
// those files only. --no-renames lists both sides of a move, so a code file moved onto a
// notes path still counts as a code change.
export function onlyCleanMerges(cwd, from, head, defaultBranch = 'main', notes = []) {
  const base = `origin/${defaultBranch}`;
  const allNotes = (names) => names.every((n) => matchesAny(n, notes));
  const changed = (a, b) => {
    const d = gitRun(cwd, ['diff', '--no-renames', '--name-only', a, b]);
    return d.ok ? d.out.split('\n').filter(Boolean) : null;
  };
  if (gitRun(cwd, ['merge-base', '--is-ancestor', from, head]).ok !== true) return false;
  const r = gitRun(cwd, ['rev-list', '--parents', `${from}..${head}`, '--not', base]);
  if (!r.ok) return false;
  for (const line of r.out.split('\n').filter(Boolean)) {
    const [c, p1, p2, ...more] = line.split(' ');
    if (!p1 || more.length) return false;
    if (!p2) {
      if (!notes.length) return false;
      const names = changed(p1, c);
      if (!names || !allNotes(names)) return false;
      continue;
    }
    if (!gitRun(cwd, ['merge-base', '--is-ancestor', p2, base]).ok) return false;
    // Exit 1 is a merge with conflicts: its tree is still the first line, the conflicted files follow.
    const m = spawnSync('git', ['merge-tree', '--write-tree', '--name-only', p1, p2], { cwd, encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
    if (m.error || (m.status !== 0 && m.status !== 1)) return false;
    const [tree, ...rest] = (m.stdout ?? '').split('\n');
    const conflicted = m.status === 1 ? rest.slice(0, Math.max(0, rest.indexOf(''))) : [];
    if (!/^[0-9a-f]{40,64}$/.test(tree) || (conflicted.length && !allNotes(conflicted))) return false;
    const names = changed(tree, c);
    if (!names || !allNotes(names)) return false;
  }
  return true;
}

// ---------- the open limit ----------

// Pull requests from this repo's own branches. A fork's pull request (or one whose fork
// was deleted, so head.repo is null) never counts.
export const ownBranchPrs = (prs, repo) => prs.filter((p) => p?.head?.repo?.full_name && String(p.head.repo.full_name).toLowerCase() === String(repo).toLowerCase());
export const byCreation = (prs) => [...prs].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.number - b.number);
