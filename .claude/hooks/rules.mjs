#!/usr/bin/env node
// Rule hooks: the rules a program can judge are judged by this program, on every
// tool call, instead of by a session's memory of CLAUDE.md. One script, run by
// .claude/settings.json on SessionStart, PreToolUse, PostToolUse and Stop; the
// repo's own values live in .claude/hooks/rules.json. Node only, no packages.
//
// Answers: a refused tool call is a PreToolUse "deny" with the reason; a problem
// found after the fact is a PostToolUse or Stop "block" with the reason; added
// context is hookSpecificOutput.additionalContext. Allowing prints nothing, so this
// script never overrides the permission system. A crash never blocks: it prints a
// warning and lets the call go ahead (the CI gate is the check that cannot be skipped).
//
// `node rules.mjs --check` validates rules.json and prints which checks are on.
// `node rules.mjs --find-repo` (for sessions started one folder above the repo)
// picks the repo each call acts in.
// `node rules.mjs --install-user` adds that launcher to ~/.claude/settings.json, once per
// computer, so sessions started one folder above a repo load its hooks. It keeps every other
// setting and never adds an entry twice. `node rules.mjs --print-setup` prints the same
// installer as a cloud environment setup script that needs no repo and never fails.

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FOOTER = 'If this refusal is wrong, say so in your report. Do not reword the command to get past it.';
const PLACEHOLDER = /\[[A-Z][A-Z0-9 _-]*\]/;

// ---------- small helpers ----------

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: opts.timeout ?? 8000, cwd: opts.cwd, env: opts.env ?? process.env, input: opts.input, maxBuffer: 16 * 1024 * 1024 });
  return { ok: r.status === 0 && !r.error, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};
const git = (cwd, args, env) => run('git', args, { cwd, env });
const readText = (path, max = 1024 * 1024) => {
  try { const s = statSync(path); if (!s.isFile() || s.size > max) return null; return readFileSync(path, 'utf8'); } catch { return null; }
};
const isPlaceholder = (v) => typeof v === 'string' && PLACEHOLDER.test(v);
const globToRegExp = (glob) => new RegExp('^' + glob.split('**').map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
const matchesAny = (path, globs = []) => globs.some((g) => globToRegExp(g).test(path));
const lines = (s) => String(s ?? '').split('\n');
const lastLine = (s) => lines(s).map((l) => l.trim()).filter(Boolean).at(-1) ?? '';
const addedLines = (before, after) => {
  const old = new Set(lines(before));
  return lines(after).filter((l) => !old.has(l));
};
const parseIdent = (s) => {
  const m = /^(.*?)\s*<([^>]*)>/.exec(String(s ?? '').trim());
  return m ? { name: m[1].trim(), email: m[2].trim() } : null;
};
const sameIdent = (a, b) => a && b && a.name === b.name && a.email.toLowerCase() === b.email.toLowerCase();
const showIdent = (p) => (p ? `${p.name} <${p.email}>` : 'unknown');

// ---------- config ----------

const loadConfig = (root) => {
  const path = join(root, '.claude', 'hooks', 'rules.json');
  const text = readText(path);
  if (text === null) return { error: `no ${relative(root, path) || path}` };
  let config;
  try { config = JSON.parse(text); } catch (e) { return { error: `${path} is not valid JSON: ${e.message}` }; }
  return { config: withNames(config, readText(join(root, 'CLAUDE.md')) ?? ''), path };
};
// The commit author and the pull request's last line come from the repo's own CLAUDE.md
// (Rules that never bend: Identity), so no name is written into the hook settings. A
// value in rules.json, when there is one, wins.
const IDENTITY = /Every commit is authored by (\[[^\]\n]+\]|[^<\n]*?<[^>\n]+>)/;
const LAST_LINE = /Pull requests end with "([^"\n]+)"/;
function withNames(config, claudeMd) {
  const c = { ...config };
  if (c.author === undefined) { const m = IDENTITY.exec(claudeMd); if (m) c.author = m[1].trim(); }
  if (c.prLastLine === undefined) { const m = LAST_LINE.exec(claudeMd); if (m) c.prLastLine = m[1]; }
  return c;
}
const blanksOf = (config) => ['author', 'prLastLine'].filter((k) => config[k] === undefined || isPlaceholder(config[k]));
const on = (config, name) => {
  const c = config?.[name];
  if (c === false) return false;
  if (c && typeof c === 'object' && c.enabled === false) return false;
  return true;
};
const authorOf = (config) => (config.author === undefined || isPlaceholder(config.author) ? null : parseIdent(config.author));
const prLastLineOf = (config) => (isPlaceholder(config.prLastLine) || !config.prLastLine ? null : config.prLastLine);
const defaultBranch = (config) => config.defaultBranch || 'main';

// ---------- reading a shell command ----------
// The command is split into simple commands, each a list of words with its inline
// environment and any heredoc body. Checks match on these words only, never on the
// raw text, so `grep screenshot` or `echo "git push --force"` match nothing.

const OPS = [';;', '&&', '||', '|&', ';', '|', '&', '\n', '(', ')'];

function parseShell(src) {
  const commands = [];
  let i = 0;
  const pending = []; // heredocs waiting for the end of their line

  const readHeredocBodies = () => {
    while (pending.length) {
      const h = pending.shift();
      const body = [];
      while (i < src.length) {
        let end = src.indexOf('\n', i);
        if (end === -1) end = src.length;
        const line = src.slice(i, end);
        i = end + 1;
        const test = h.strip ? line.replace(/^\t+/, '') : line;
        if (test.trim() === h.delim) break;
        body.push(h.strip ? line.replace(/^\t+/, '') : line);
      }
      h.cmd.heredoc = (h.cmd.heredoc ? h.cmd.heredoc + '\n' : '') + body.join('\n');
    }
  };

  // Parses until the end or, when inParen, the matching ')'. Returns the commands made.
  const parseList = (inParen) => {
    const out = [];
    let cmd = { words: [], heredoc: null, raw: '' };
    let word = null;
    const start = () => { if (word === null) word = ''; };
    const endWord = () => { if (word !== null) { cmd.words.push(word); word = null; } };
    const endCmd = () => { endWord(); if (cmd.words.length || cmd.heredoc !== null) out.push(cmd); cmd = { words: [], heredoc: null, raw: '' }; };

    const readSubst = () => { // at '$(' : returns text of the substitution, records its commands
      i += 2;
      const from = i;
      const inner = parseList(true);
      const text = src.slice(from, i - 1);
      for (const c of inner) { c.nested = true; out.push(c); }
      // `$(cat <<'EOF' ... EOF)` stands for the heredoc's text.
      const real = inner.filter((c) => !c.nested || c.words.length);
      if (real.length === 1 && real[0].words[0] === 'cat' && real[0].heredoc !== null && real[0].words.length === 1) return real[0].heredoc;
      return '$(' + text + ')';
    };

    while (i < src.length) {
      const ch = src[i];
      if (inParen && ch === ')' && word === null) { i++; endCmd(); return out; }
      if (inParen && ch === ')') { i++; endCmd(); return out; }
      if (ch === '\\') {
        if (src[i + 1] === '\n') { i += 2; continue; }
        start(); word += src[i + 1] ?? ''; i += 2; continue;
      }
      if (ch === "'") {
        start();
        const end = src.indexOf("'", i + 1);
        word += src.slice(i + 1, end === -1 ? src.length : end);
        i = end === -1 ? src.length : end + 1;
        continue;
      }
      if (ch === '"') {
        start(); i++;
        while (i < src.length && src[i] !== '"') {
          if (src[i] === '\\' && '"\\$`\n'.includes(src[i + 1])) { word += src[i + 1]; i += 2; continue; }
          if (src[i] === '$' && src[i + 1] === '(') { word += readSubst(); continue; }
          if (src[i] === '`') {
            const end = src.indexOf('`', i + 1);
            const inner = src.slice(i + 1, end === -1 ? src.length : end);
            for (const c of parseShell(inner)) { c.nested = true; out.push(c); }
            word += '`' + inner + '`';
            i = end === -1 ? src.length : end + 1;
            continue;
          }
          word += src[i]; i++;
        }
        i++;
        continue;
      }
      if (ch === '$' && src[i + 1] === '(') { start(); word += readSubst(); continue; }
      if (ch === '`') {
        start();
        const end = src.indexOf('`', i + 1);
        const inner = src.slice(i + 1, end === -1 ? src.length : end);
        for (const c of parseShell(inner)) { c.nested = true; out.push(c); }
        word += '`' + inner + '`';
        i = end === -1 ? src.length : end + 1;
        continue;
      }
      if (ch === '#' && word === null) { // a comment runs to the end of the line
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      if (ch === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
        endWord();
        i += 2;
        let strip = false;
        if (src[i] === '-') { strip = true; i++; }
        while (src[i] === ' ' || src[i] === '\t') i++;
        let delim = '';
        while (i < src.length && !/[\s;&|()<>]/.test(src[i])) {
          if (src[i] === "'" || src[i] === '"') { const q = src[i]; const end = src.indexOf(q, i + 1); delim += src.slice(i + 1, end === -1 ? src.length : end); i = end === -1 ? src.length : end + 1; } else { delim += src[i] === '\\' ? '' : src[i]; i++; }
        }
        cmd.heredoc = cmd.heredoc ?? '';
        pending.push({ cmd, delim, strip });
        continue;
      }
      if (ch === '<' && src[i + 1] === '<' && src[i + 2] === '<') { endWord(); i += 3; continue; } // here-string: next word is data
      if (ch === ' ' || ch === '\t') { endWord(); i++; continue; }
      if ((ch === '>' || ch === '<') && word === null) { // redirection: skip its target word
        i++;
        if (src[i] === '>' || src[i] === '&') i++;
        while (src[i] === ' ') i++;
        while (i < src.length && !/[\s;&|()]/.test(src[i])) i++;
        continue;
      }
      if (/^[0-9]$/.test(ch) && word === null && (src[i + 1] === '>' || (src[i + 1] === '<' && src[i + 2] !== '<'))) { i++; continue; }
      const op = OPS.find((o) => src.startsWith(o, i));
      if (op) {
        if (op === '(' && word !== null) { word += ch; i++; continue; }
        endCmd();
        i += op.length;
        if (op === '\n') readHeredocBodies();
        if (op === '(') { const inner = parseList(true); out.push(...inner); }
        continue;
      }
      start(); word += ch; i++;
    }
    endCmd();
    readHeredocBodies();
    return out;
  };

  try { commands.push(...parseList(false)); } catch { /* the parser never throws to its caller */ }
  return commands;
}

const ENV_WORD = /^[A-Za-z_][A-Za-z0-9_]*=/;
const PNPM_OWN = new Set(['add', 'install', 'i', 'remove', 'rm', 'update', 'up', 'outdated', 'list', 'ls', 'why', 'audit', 'store', 'config', 'init', 'link', 'unlink', 'prune', 'publish', 'pack', 'rebuild', 'root', 'bin', 'env', 'setup', 'import', 'fetch', 'patch', 'patch-commit', 'deploy', 'licenses', 'server', 'help', 'create', 'recursive', 'run', 'exec', 'dlx', 'test', 't', 'start']);

// Turns parsed commands into checkable ones: wrappers peeled, inline env split off,
// `bash -c` and `eval` read again, `cd` and `export` carried to later commands.
function simpleCommands(src, baseCwd, depth = 0) {
  const result = [];
  let cwd = baseCwd;
  const exported = {};
  for (const c of parseShell(src)) {
    let words = [...c.words];
    const env = { ...exported };
    while (words.length && ENV_WORD.test(words[0])) { const [k, ...v] = words.shift().split('='); env[k] = v.join('='); }
    // Peel wrappers.
    for (let guard = 0; guard < 10 && words.length; guard++) {
      const w = words[0];
      if (w === 'sudo' || w === 'doas') { words.shift(); while (words[0]?.startsWith('-')) { const f = words.shift(); if (f === '--') break; if (/^-[ugpChDrtURC]$/.test(f) || /^--(user|group|host|prompt|chdir|close-from|role|type|other-user)$/.test(f)) words.shift(); } continue; }
      if (w === 'flock') { const ci = words.findIndex((x, k) => k > 0 && (x === '-c' || x === '--command')); if (ci !== -1 && words[ci + 1] !== undefined) { result.push(...simpleCommands(words[ci + 1], cwd, depth + 1).map((x) => ({ ...x, env: { ...env, ...x.env } }))); words.length = 0; break; } words.shift(); while (words[0]?.startsWith('-')) { const f = words.shift(); if (/^(-w|--timeout|-E|--conflict-exit-code)$/.test(f)) words.shift(); } words.shift(); continue; }
      if (w === 'nohup' || w === 'time' || w === 'command' || w === 'exec' || w === 'stdbuf' || w === 'setsid' || w === 'unbuffer') { words.shift(); while (words[0]?.startsWith('-')) words.shift(); continue; }
      if (w === 'script') { const ci = words.findIndex((x, k) => k > 0 && (/^-\w*c$/.test(x) || x === '--command')); const eq = words.find((x) => x.startsWith('--command=')); if (eq) { result.push(...simpleCommands(eq.slice(10), cwd, depth + 1).map((x) => ({ ...x, env: { ...env, ...x.env } }))); words.length = 0; break; } if (ci !== -1 && words[ci + 1] !== undefined) { result.push(...simpleCommands(words[ci + 1], cwd, depth + 1).map((x) => ({ ...x, env: { ...env, ...x.env } }))); words.length = 0; break; } }
      if (w === 'env') { words.shift(); while (words.length && (words[0].startsWith('-') || ENV_WORD.test(words[0]))) { const x = words.shift(); if (ENV_WORD.test(x)) { const [k, ...v] = x.split('='); env[k] = v.join('='); } } continue; }
      if (w === 'timeout') { words.shift(); while (words[0]?.startsWith('-')) words.shift(); words.shift(); continue; }
      if (w === 'xargs') { words.shift(); while (words[0]?.startsWith('-')) { const f = words.shift(); if (/^-[IdLnPsE]$/.test(f)) words.shift(); } continue; }
      // Wrappers that run the rest of the line: a display server, priority, CPU or session.
      if (w === 'xvfb-run') { words.shift(); while (words[0]?.startsWith('-')) { const f = words.shift(); if (/^(-n|-s|-e|-f|-p|-w|--server-num|--server-args|--error-file|--auth-file|--xauth-protocol|--wait)$/.test(f)) words.shift(); } continue; }
      if (w === 'nice') { words.shift(); while (words[0]?.startsWith('-')) { const f = words.shift(); if (f === '-n' || f === '--adjustment') words.shift(); } continue; }
      if (w === 'ionice') { words.shift(); while (words[0]?.startsWith('-')) { const f = words.shift(); if (/^(-c|-n|-p|-P|-u|--class|--classdata)$/.test(f)) words.shift(); } continue; }
      if (w === 'chrt') { words.shift(); while (words[0]?.startsWith('-')) words.shift(); if (/^\d+$/.test(words[0] ?? '')) words.shift(); continue; }
      if (w === 'taskset') { words.shift(); while (words[0]?.startsWith('-')) words.shift(); words.shift(); continue; } // flags, then the mask or CPU list
      if (w === 'dbus-run-session') { words.shift(); while (words[0]?.startsWith('-')) { const f = words.shift(); if (f === '--') break; if (/^--(config-file|dbus-daemon)$/.test(f)) words.shift(); } continue; }
      if (w === 'npx' || w === 'bunx' || w === 'pnpx') { words.shift(); while (words[0]?.startsWith('-')) words.shift(); continue; }
      if (w === 'pnpm' || w === 'yarn' || w === 'npm' || w === 'bun') {
        const tool = words.shift();
        while (words[0]?.startsWith('-')) { const f = words.shift(); if (/^(-C|--dir|--filter|-F|--prefix|-w)$/.test(f) && f !== '-w') words.shift(); }
        const sub = words[0];
        if (sub === 'exec' || sub === 'dlx' || (tool === 'bun' && sub === 'x')) { words.shift(); while (words[0]?.startsWith('-')) words.shift(); continue; }
        if (sub === 'run' || sub === 'run-script') { words.shift(); if (words[0]) words[0] = 'script:' + words[0]; break; }
        if (tool === 'npm') { words.unshift(tool); break; }
        if (sub && !PNPM_OWN.has(sub)) { words[0] = 'script:' + sub; break; }
        if (sub === 'test' || sub === 't') { words[0] = 'script:test'; break; }
        words.unshift(tool); break;
      }
      break;
    }
    if (!words.length) continue;
    const prog = words[0].split('/').at(-1);
    // Nested shells are read again.
    if ((prog === 'bash' || prog === 'sh' || prog === 'zsh') && depth < 4) {
      const ci = words.indexOf('-c');
      if (ci !== -1 && words[ci + 1] !== undefined) { result.push(...simpleCommands(words[ci + 1], cwd, depth + 1)); continue; }
      if (c.heredoc !== null && words.length === 1) { result.push(...simpleCommands(c.heredoc, cwd, depth + 1)); continue; }
    }
    if (prog === 'eval' && depth < 4) { result.push(...simpleCommands(words.slice(1).join(' '), cwd, depth + 1)); continue; }
    if (prog === 'cd' && !c.nested) { const to = words[1]; if (to && !to.startsWith('-')) cwd = isAbsolute(to) ? to : resolve(cwd, to.replace(/^~(?=\/|$)/, process.env.HOME ?? '~')); continue; }
    if (prog === 'export' && !c.nested) { for (const w of words.slice(1)) if (ENV_WORD.test(w)) { const [k, ...v] = w.split('='); exported[k] = v.join('='); } continue; }
    result.push({ prog, path: words[0], args: words.slice(1), env, cwd, heredoc: c.heredoc });
  }
  return result;
}

// Git and gh: global flags skipped, the subcommand found, `-C` applied.
const GIT_GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);
// The repo a git call acts in: -C moves the starting folder (in order); --git-dir or
// GIT_DIR (against that folder, never the work tree) names the repository itself;
// --work-tree only says where files are checked out, so it never changes the repo.
function gitParts(cmd) {
  const a = cmd.args;
  let i = 0, cwd = cmd.cwd, gitDir = cmd.env?.GIT_DIR ?? null;
  const config = [];
  while (i < a.length && a[i].startsWith('-')) {
    if (a[i] === '-C') { cwd = resolve(cwd, a[i + 1] ?? '.'); i += 2; continue; }
    if (a[i] === '-c') { config.push(a[i + 1] ?? ''); i += 2; continue; }
    if (a[i] === '--git-dir') { gitDir = resolve(cwd, a[i + 1] ?? '.'); i += 2; continue; }
    if (a[i].startsWith('--git-dir=')) { gitDir = resolve(cwd, a[i].slice(10)); i++; continue; }
    if (GIT_GLOBAL_WITH_VALUE.has(a[i])) { i += 2; continue; }
    i++;
  }
  if (gitDir) { const d = resolve(cwd, gitDir); cwd = d.split(sep).at(-1) === '.git' ? dirname(d) : d; }
  return { sub: a[i], rest: a.slice(i + 1), cwd, config };
}
// owner/repo from any way gh names a repo: OWNER/REPO, HOST/OWNER/REPO, a URL.
const normRepo = (v) => {
  const t = String(v ?? '').trim().replace(/^[a-z+]+:\/\//i, '').replace(/^git@([^:]+):/, '$1/').replace(/\.git$/, '').replace(/\/+$/, '');
  const parts = t.split('/').filter(Boolean);
  if (parts.length >= 3 && /\./.test(parts[0])) return parts[0].startsWith('api.') && parts[1] === 'repos' ? `${parts[2]}/${parts[3] ?? ''}` : `${parts[1]}/${parts[2]}`;
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
};
// A repo named by a whole word: an anchored github.com pull request, issue, tree, blob
// or commit link given as a positional argument, or the `gh api` path repos/<o>/<r>.
// Flag values (a body, a title, a merge subject) are text, never the target.
const GH_LINK = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)\/(?:pull|pulls|issues|tree|blob|commit)(?:[/?#]|$)/i;
const repoInWord = (w) => { const m = GH_LINK.exec(w ?? ''); return m ? `${m[1]}/${m[2].replace(/\.git$/, '')}` : null; };
// gh flags whose value is free text or a file (a body, a title, a merge subject, notes):
// the next word is skipped, so a link written there is never read as the target. A
// value that is not a whole github.com link can never match, so other flags need no entry.
const GH_VALUE_FLAGS = new Set(['-b', '--body', '-F', '--body-file', '-t', '--title', '--subject', '--message', '-T', '--template', '-n', '--notes', '--notes-file', '--description', '--add-label', '--remove-label', '-f', '--field', '--raw-field', '-H', '--header', '-q', '--jq', '--input', '-X', '--method', '-R', '--repo']);
const GH_PLACEHOLDER = /^(?:\{(?:owner|repo)\}|:(?:owner|repo))$/;
const ghPositionals = (words) => {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === '--') { out.push(...words.slice(i + 1)); break; }
    if (w.startsWith('-')) { if (!w.includes('=') && GH_VALUE_FLAGS.has(w)) i++; continue; }
    out.push(w);
  }
  return out;
};
function ghParts(cmd) {
  const a = cmd.args;
  let i = 0, repo = null;
  while (i < a.length && a[i].startsWith('-')) { if (a[i] === '-R' || a[i] === '--repo') { repo = a[i + 1]; i += 2; continue; } if (a[i].startsWith('--repo=')) repo = a[i].slice(7); i++; }
  const rest = a.slice(i);
  const ri = rest.findIndex((w) => w === '-R' || w === '--repo');
  if (ri !== -1) repo = rest[ri + 1];
  const rr = rest.find((w) => w.startsWith('--repo=') || /^-R./.test(w));
  if (rr) repo = rr.startsWith('--repo=') ? rr.slice(7) : rr.slice(2);
  repo = repo ? normRepo(repo) : null;
  if (!repo) {
    const pos = ghPositionals(rest.slice(1));
    if (rest[0] === 'api') {
      const path = (pos[0] ?? '').replace(/^https?:\/\/api\.github\.com\//i, '').replace(/^\//, '');
      const m = /^repos\/([^/\s?#]+)\/([^/\s?#]+)/.exec(path);
      // {owner}/{repo} (or :owner/:repo) is gh's placeholder for this folder's repo.
      if (m && !GH_PLACEHOLDER.test(m[1]) && !GH_PLACEHOLDER.test(m[2])) repo = `${m[1]}/${m[2]}`;
    } else {
      // gh <group> <verb> <target>: the target is the first positional after the verb.
      for (const w of pos.slice(1)) { const r = repoInWord(w); if (r) { repo = r; break; } }
    }
  }
  if (!repo && cmd.env?.GH_REPO) repo = normRepo(cmd.env.GH_REPO);
  return { sub: rest[0], sub2: rest[1], rest: rest.slice(1), repo };
}
// Value of a flag: `--x v`, `--x=v`, `-x v`, `-xv`. Returns all values.
function flagValues(args, names) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    for (const n of names) {
      if (w === n && i + 1 < args.length) { out.push(args[i + 1]); i++; break; }
      if (n.startsWith('--') && w.startsWith(n + '=')) { out.push(w.slice(n.length + 1)); break; }
      if (!n.startsWith('--') && w.startsWith(n) && w.length > n.length && w[1] !== '-' && n.length === 2) { out.push(w.slice(2)); break; }
    }
  }
  return out;
}
const hasFlag = (args, names) => args.some((w) => names.some((n) => w === n || (n.startsWith('--') && w.startsWith(n + '='))));
// gh api: method, path and fields.
function ghApi(cmd, config = {}) {
  const { sub, rest } = ghParts(cmd);
  if (sub !== 'api') return null;
  let path = null, method = null;
  const fields = {};
  let input = null;
  for (let i = 0; i < rest.length; i++) {
    const w = rest[i];
    if (w === '-X' || w === '--method') { method = (rest[++i] ?? '').toUpperCase(); continue; }
    if (w.startsWith('--method=')) { method = w.slice(9).toUpperCase(); continue; }
    if (w.startsWith('-X') && w.length > 2) { method = w.slice(2).toUpperCase(); continue; }
    if (['-f', '-F', '--field', '--raw-field'].includes(w)) { const kv = rest[++i] ?? ''; const k = kv.split('=')[0]; fields[k] = kv.slice(k.length + 1); continue; }
    if (w === '--input') { input = rest[++i]; continue; }
    if (['-H', '--header', '-q', '--jq', '-t', '--template', '--cache', '--hostname', '-p', '--preview'].includes(w)) { i++; continue; }
    if (!w.startsWith('-') && path === null) path = w.replace(/^https?:\/\/api\.github\.com\//i, '').replace(/^\//, '');
  }
  // gh fills {owner}/{repo} from GH_REPO or this folder's repo: judge the path as that repo's.
  if (path && /^repos\/(?:\{owner\}|:owner)\/(?:\{repo\}|:repo)(?=\/|$)/.test(path)) {
    const slug = ghParts(cmd).repo ?? repoSlug(config, cmd.cwd);
    if (slug) path = path.replace(/^repos\/[^/]+\/[^/]+/, `repos/${slug}`);
  }
  if (input) {
    const text = input === '-' ? cmd.heredoc : readText(resolve(cmd.cwd, input));
    try { Object.assign(fields, JSON.parse(text ?? '')); } catch { /* not JSON */ }
  }
  for (const [k, v] of Object.entries(fields)) if (typeof v === 'string' && v.startsWith('@')) {
    const t = v === '@-' ? cmd.heredoc : readText(resolve(cmd.cwd, v.slice(1)));
    if (t !== null && t !== undefined) fields[k] = t;
  }
  if (!method) method = Object.keys(fields).length || input ? 'POST' : 'GET';
  return { path: path ?? '', method, fields };
}

// ---------- refusals ----------

const refusal = (rule, matched, instead) => `${rule}\nMatched: ${matched}\n${instead ? `Instead: ${instead}\n` : ''}${FOOTER}`;

// ---------- git state ----------

const COMMIT_MAKERS = new Set(['commit', 'merge', 'revert', 'cherry-pick', 'am', 'pull', 'rebase']);
const makesCommit = (g) => {
  if (!COMMIT_MAKERS.has(g.sub)) return false;
  if (hasFlag(g.rest, ['--abort', '--quit', '--skip', '-h', '--help'])) return false;
  if ((g.sub === 'merge' || g.sub === 'pull') && hasFlag(g.rest, ['--ff-only'])) return false;
  if (g.sub === 'commit' && hasFlag(g.rest, ['--dry-run'])) return false;
  return true;
};
const gitEnv = (cmd) => ({ ...process.env, ...cmd.env });
const configArgs = (config) => config.flatMap((c) => ['-c', c]);

// The commits a push would add: on no remote-tracking ref. The default branch is
// fetched first (once per run, bounded) so commits already on it, such as a web
// merge whose committer is GitHub, are never judged. With no remote-tracking ref
// at all nothing is judged here (commitVerify still judges each new commit).
const fetched = new Set();
function outgoingCommits(cwd, srcs, env, config) {
  const def = defaultBranch(config);
  if (!fetched.has(cwd) && config.fetchBeforePush !== false) {
    fetched.add(cwd);
    const shallow = git(cwd, ['rev-parse', '--is-shallow-repository']).out === 'true';
    run('git', ['fetch', '-q', ...(shallow ? ['--depth=50'] : []), 'origin', `+${def}:refs/remotes/origin/${def}`], { cwd, env, timeout: 15000 });
  }
  const any = git(cwd, ['for-each-ref', '--count=1', 'refs/remotes'], env);
  if (!any.ok || !any.out) return [];
  const allowed = (config.identity?.allowCommitters ?? []).map(parseIdent);
  const seen = new Set();
  const out = [];
  for (const src of [].concat(srcs)) {
    const r = git(cwd, ['log', '--format=%H%x00%an%x00%ae%x00%cn%x00%ce%x00%B%x1e', '-n', '200', src, '--not', '--remotes'], env);
    if (r.ok) for (const rec of r.out.split('\x1e')) { const sha = rec.replace(/^\n/, '').split('\x00')[0]; if (sha && !seen.has(sha)) { seen.add(sha); out.push(rec); } }
  }
  return out.join('\x1e').split('\x1e').map((s) => s.replace(/^\n/, '')).filter(Boolean).map((rec) => {
    const [sha, an, ae, cn, ce, body] = rec.split('\x00');
    return { sha, author: { name: an, email: ae }, committer: { name: cn, email: ce }, message: body ?? '' };
  }).filter((k) => !allowed.some((a) => sameIdent(a, k.committer)));
}
const localBranches = (cwd) => { const r = git(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']); return r.ok ? r.out.split('\n').filter(Boolean) : []; };
// Every branch a push sends: each refspec's source; --all, --branches, --mirror or a
// glob refspec send every local branch.
const PUSH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);
const pushWords = (rest) => { const out = []; for (let i = 0; i < rest.length; i++) { if (PUSH_VALUE.has(rest[i])) { i++; continue; } if (!rest[i].startsWith('-')) out.push(rest[i]); } return out; };
const pushEverything = (rest) => hasFlag(rest, ['--all', '--branches', '--mirror']) || pushWords(rest).slice(1).some((r) => r.includes('*'));
const pushSources = (rest, cwd) => {
  if (pushEverything(rest)) return localBranches(cwd);
  const refspecs = pushWords(rest).slice(1);
  if (!refspecs.length) return ['HEAD'];
  return [...new Set(refspecs.map((r) => r.replace(/^\+/, '').split(':')[0]).filter(Boolean))];
};
const currentBranch = (cwd) => { const r = git(cwd, ['branch', '--show-current']); return r.ok ? r.out : ''; };
const repoTop = (cwd) => { const r = git(cwd, ['rev-parse', '--show-toplevel']); return r.ok ? r.out : null; };
const attributionHits = (text, config, key = 'patterns') => {
  const pats = (config.attribution?.[key] ?? config.attribution?.patterns ?? []).map((p) => new RegExp(p, 'im'));
  return lines(text).filter((l) => pats.some((p) => { p.lastIndex = 0; return p.test(l); }));
};


// ---------- which repo a call acts in ----------
// A git or gh call in another repo is judged by that repo's own rules.json; a repo
// with none that this config names in alsoGuards gets the checks that hold in every
// repo of the owner (identity, attribution, force-push, merge method, bypass flags,
// banned commands, default-branch push); any other repo is not judged.
const REPO_ONLY = ['prBody', 'prBodyVerify', 'prFlow', 'liveState', 'mergeGreen', 'ruleMix', 'hostedRunners', 'laneNotice'];
const remoteDefault = (top) => { const r = top ? git(top, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']) : { ok: false }; return r.ok ? r.out.replace(/^origin\//, '') : 'main'; };
function agnostic(config, top) {
  const c = { ...config, repo: null, defaultBranch: remoteDefault(top), agnostic: true };
  for (const k of REPO_ONLY) c[k] = { ...(typeof config[k] === 'object' ? config[k] : {}), enabled: false };
  return c;
}
function scopeFor(root, config, cwd, slug) {
  const own = String(repoSlug(config, root) ?? '').toLowerCase();
  const guards = (config.alsoGuards ?? []).map((x) => x.toLowerCase());
  if (!slug && config.detached && !repoTop(cwd)) return { root, config: repoless(config) };
  if (slug) {
    const s = slug.toLowerCase();
    if (s === own) return { root, config };
    return guards.includes(s) ? { root, config: agnostic(config, null) } : null;
  }
  const top = repoTop(cwd);
  if (!top) return { root, config: config.detached ? repoless(config) : config };
  if (resolve(top) === resolve(root)) return { root, config };
  const theirs = loadConfig(top).config;
  if (theirs) return { root: top, config: theirs };
  const s = String(repoSlug({}, top) ?? '').toLowerCase();
  if (s && s === own) return { root: top, config };
  return s && guards.includes(s) ? { root: top, config: agnostic(config, top) } : null;
}

function checkDefaultBranchPush(cmd, config, deny) {
  if (cmd.prog !== 'git' || config.defaultBranchPush?.enabled === false) return;
  const g = gitParts(cmd);
  if (g.sub !== 'push' || hasFlag(g.rest, ['--delete', '-d', '-n', '--dry-run'])) return;
  const def = defaultBranch(config);
  const refspecs = pushWords(g.rest).slice(1);
  let targets;
  if (pushEverything(g.rest)) targets = localBranches(g.cwd);
  else if (refspecs.length) targets = refspecs.map((r) => { const x = r.replace(/^\+/, ''); return x.includes(':') ? x.split(':')[1] : x; });
  else { const up = git(g.cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']); targets = [up.ok ? up.out.split('/').slice(1).join('/') : currentBranch(g.cwd)]; }
  targets = targets.map((t) => (t === 'HEAD' ? currentBranch(g.cwd) : t).replace(/^refs\/heads\//, ''));
  if (!targets.includes(def)) return;
  // The first push to an empty remote creates the default branch; there is no base for a pull request yet.
  const remote = pushWords(g.rest)[0] ?? 'origin';
  const heads = git(g.cwd, ['ls-remote', '--heads', remote]);
  if (heads.ok && !heads.out.trim()) return;
  deny(refusal(`Nothing is pushed straight to ${def}: CI is the merge gate, and a change reaches ${def} only through a green pull request (release, Lanes and merging).`, `git push to ${def}`, 'push a branch and open a pull request'));
}

// ---------- the checks: Bash ----------

function checkIdentity(cmd, config, deny) {
  if (cmd.prog !== 'git' || !on(config, 'identity')) return;
  const want = authorOf(config);
  if (!want) return;
  const g = gitParts(cmd);
  const fix = `git config user.name "${want.name}" && git config user.email "${want.email}"`;
  if (makesCommit(g)) {
    const env = gitEnv(cmd);
    const authorFlag = flagValues(g.rest, ['--author'])[0];
    const a = authorFlag ? parseIdent(authorFlag) : parseIdent(git(g.cwd, [...configArgs(g.config), 'var', 'GIT_AUTHOR_IDENT'], env).out);
    const c = parseIdent(git(g.cwd, [...configArgs(g.config), 'var', 'GIT_COMMITTER_IDENT'], env).out);
    if (a && !sameIdent(a, want)) deny(refusal(`Every commit is authored by ${showIdent(want)} (CLAUDE.md, Rules that never bend: Identity).`, `git ${g.sub} would be authored by ${showIdent(a)}`, fix));
    else if (c && !sameIdent(c, want)) deny(refusal(`Every commit is committed by ${showIdent(want)} too (CLAUDE.md, Identity).`, `git ${g.sub} would be committed by ${showIdent(c)}`, fix));
  }
  if (g.sub === 'push' && !hasFlag(g.rest, ['--delete', '-d', '-n', '--dry-run'])) {
    for (const k of outgoingCommits(g.cwd, pushSources(g.rest, g.cwd), gitEnv(cmd), config)) {
      if (!sameIdent(k.author, want) || !sameIdent(k.committer, want)) {
        deny(refusal(`Every commit is authored by ${showIdent(want)} (CLAUDE.md, Identity).`, `outgoing commit ${k.sha.slice(0, 7)} is by ${showIdent(k.author)}, committed by ${showIdent(k.committer)}`, `${fix}, then rewrite the unpushed commit: git commit --amend --reset-author --no-edit (or rebase the unpushed range with --exec 'git commit --amend --reset-author --no-edit')`));
        break;
      }
    }
  }
}

function commitMessage(cmd, g) {
  const parts = [...flagValues(g.rest, ['-m', '--message'])];
  for (const f of flagValues(g.rest, ['-F', '--file'])) parts.push(f === '-' ? cmd.heredoc ?? '' : readText(resolve(g.cwd, f)) ?? '');
  for (const ref of flagValues(g.rest, ['-C', '-c', '--reuse-message', '--reedit-message'])) { const r = git(g.cwd, ['log', '-1', '--format=%B', ref]); if (r.ok) parts.push(r.out); }
  if (!parts.length && hasFlag(g.rest, ['--amend'])) { const r = git(g.cwd, ['log', '-1', '--format=%B']); if (r.ok) parts.push(r.out); }
  return parts.join('\n');
}

function checkAttribution(cmd, config, deny) {
  if (cmd.prog !== 'git' || !on(config, 'attribution')) return;
  const g = gitParts(cmd);
  const rule = 'No Claude co-author, no "Claude-Session" trailer and no "Generated with Claude Code" line in commits, pull request bodies or docs (CLAUDE.md, Identity).';
  if (g.sub === 'commit' || g.sub === 'merge' || g.sub === 'revert') {
    const hits = attributionHits(commitMessage(cmd, g), config);
    if (hits.length) deny(refusal(rule, `commit message line "${hits[0].trim()}"`, 'drop that line from the message'));
  }
  if (g.sub === 'push' && !hasFlag(g.rest, ['--delete', '-d'])) {
    for (const k of outgoingCommits(g.cwd, pushSources(g.rest, g.cwd), gitEnv(cmd), config)) {
      const hits = attributionHits(k.message, config);
      if (hits.length) { deny(refusal(rule, `outgoing commit ${k.sha.slice(0, 7)} has "${hits[0].trim()}"`, 'reword the unpushed commit without that line (git commit --amend for the last one)')); break; }
    }
  }
}

function checkForcePush(cmd, config, deny) {
  if (!on(config, 'forcePush')) return;
  const rule = 'Never force-push (CLAUDE.md, Identity).';
  if (cmd.prog === 'git') {
    const g = gitParts(cmd);
    if (g.sub !== 'push') return;
    const bad = g.rest.find((w) => /^--(force|force-with-lease|force-if-includes|mirror)(=|$)/.test(w) || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(w) || w.startsWith('+'));
    if (bad) deny(refusal(rule, `git push ${bad}`, 'push without force; if the remote moved, fetch and merge it (git fetch origin <branch> && git merge --no-edit FETCH_HEAD), then push'));
  }
  if (cmd.prog === 'gh') {
    const api = ghApi(cmd, config);
    if (api && /git\/refs/.test(api.path) && String(api.fields.force) === 'true') deny(refusal(rule, `gh api ${api.path} with force=true`, 'update the ref without force'));
  }
}

function checkMergeMethod(cmd, config, deny) {
  if (!on(config, 'mergeMethod')) return;
  const rule = 'Merge with a merge commit, never a squash or a rebase (CLAUDE.md, Identity).';
  if (cmd.prog === 'git') {
    const g = gitParts(cmd);
    if (g.sub === 'merge' && hasFlag(g.rest, ['--squash'])) deny(refusal(rule, 'git merge --squash', 'git merge --no-ff'));
  }
  if (cmd.prog !== 'gh') return;
  const p = ghParts(cmd);
  if (p.sub === 'pr' && p.sub2 === 'merge') {
    const a = p.rest.slice(1);
    if (hasFlag(a, ['--squash', '-s', '--rebase', '-r'])) deny(refusal(rule, `gh pr merge ${a.join(' ')}`, 'gh pr merge <number> --merge'));
    else if (!hasFlag(a, ['--merge', '-m', '--disable-auto'])) deny(refusal(rule, 'gh pr merge with no method (it would take the repo default or prompt)', 'gh pr merge <number> --merge'));
  }
  const api = ghApi(cmd, config);
  if (api && /pulls\/\d+\/(merge|ccr\/auto_merge)$/.test(api.path) && api.method !== 'GET' && api.method !== 'DELETE') {
    const m = String(api.fields.merge_method ?? 'merge').toLowerCase();
    if (m !== 'merge') deny(refusal(rule, `gh api ${api.path} merge_method=${m}`, 'merge_method=merge'));
  }
}

// Test runners: any program or package script whose name holds "test" or "e2e", plus the common runners.
const RUNNERS = /test|e2e|^(jest|playwright|mocha|ava|tap|node)$/;
function checkBypassFlags(cmd, config, deny) {
  if (!on(config, 'bypassFlags')) return;
  const rule = 'Never bypass a check: no --no-verify, no --admin merge, no passing with no tests, no retries until green (CLAUDE.md, Limits; build skill).';
  if (cmd.prog === 'git') {
    const g = gitParts(cmd);
    if (hasFlag(g.rest, ['--no-verify'])) deny(refusal(rule, `git ${g.sub} --no-verify`, 'run without --no-verify and fix what the hook finds'));
    else if (g.sub === 'commit' && g.rest.some((w) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(w))) deny(refusal(rule, 'git commit -n (skips the hooks)', 'commit without -n'));
  }
  if (cmd.prog === 'gh') {
    const p = ghParts(cmd);
    if (p.sub === 'pr' && p.sub2 === 'merge' && hasFlag(p.rest, ['--admin'])) deny(refusal(rule, 'gh pr merge --admin', 'wait for the required checks; merge when green'));
  }
  if (hasFlag(cmd.args, ['--passWithNoTests', '--pass-with-no-tests'])) deny(refusal(rule, `${cmd.prog} --passWithNoTests`, 'run the tests that exist; a run with no tests is a failure'));
  if (RUNNERS.test(cmd.prog)) {
    const n = flagValues(cmd.args, ['--retries', '--retry']).map(Number).find((x) => x > 0);
    if (n) deny(refusal(rule, `${cmd.prog} --retries ${n}`, 'run once; a test that passes only on retry is a flaky-test defect to record in history.md'));
  }
}

// GPU: pictures and rendered runs only on a GPU machine.
function isGpuMachine(config, sessionId) {
  const d = config.gpu?.detect ?? {};
  if (d.env && process.env[d.env] === '1') return true;
  if (d.env && process.env[d.env] === '0') return false;
  const cache = join(tmpdir(), `claude-rules-gpu-${String(sessionId ?? 'none').replace(/[^\w-]/g, '')}.txt`);
  const cached = readText(cache);
  if (cached === 'yes' || cached === 'no') return cached === 'yes';
  let yes = false;
  if (Array.isArray(d.command) && d.command.length) {
    const r = spawnSync(d.command[0], d.command.slice(1), { timeout: 3000, encoding: 'utf8' });
    yes = r.status === 0 && !r.error;
  }
  try { writeFileSync(cache, yes ? 'yes' : 'no'); } catch { /* cache is optional */ }
  return yes;
}
const captureIn = (text, config) => (text ? (config.gpu?.captureCalls ?? []).find((c) => text.includes(c)) : undefined);
const PW_VALUE = new Set(['--project', '-c', '--config', '-g', '--grep', '--grep-invert', '-j', '--workers', '--reporter', '--retries', '--timeout', '--repeat-each', '--output', '--max-failures', '-x', '--shard', '--trace', '--global-timeout', '--tsconfig']);
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["'](\.{1,2}\/[^"']+)["']/gm;
const EXTS = ['', '.ts', '.mts', '.js', '.mjs', '.cjs', '.tsx', '/index.ts', '/index.js'];

// A script's text plus the text of the files it imports by relative path (two levels
// deep), leaving out the helpers the config allows (a measurement, not a picture).
function scriptText(file, config, root, depth = 0, seen = new Set()) {
  if (seen.has(file)) return '';
  seen.add(file);
  const text = readText(file);
  if (text === null) return '';
  let out = text;
  if (depth >= 2) return out;
  for (const m of text.matchAll(IMPORT)) {
    for (const ext of EXTS) {
      const target = resolve(dirname(file), m[1] + ext);
      if (!existsSync(target) || !statSync(target).isFile()) continue;
      const rel = relative(root, target).split(sep).join('/');
      if (!matchesAny(rel, config.gpu?.allowedHelpers ?? [])) out += '\n' + scriptText(target, config, root, depth + 1, seen);
      break;
    }
  }
  return out;
}
function packageScript(cwd, name, root) {
  let dir = resolve(cwd);
  for (;;) {
    const text = readText(join(dir, 'package.json'));
    if (text !== null) { try { const s = JSON.parse(text).scripts?.[name]; if (typeof s === 'string') return { text: s, dir }; } catch { /* not JSON */ } }
    if (dir === resolve(root) || dirname(dir) === dir) return null;
    dir = dirname(dir);
  }
}

// The spec files a Playwright positional selects: a file, every spec in a folder, or
// (any other word) every spec whose path the word matches, as Playwright filters.
const SPEC = /\.(spec|test)\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'test-results', 'playwright-report', '.pnpm-store']);
function specFilesUnder(dir, out = [], budget = { n: 20000 }) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (--budget.n < 0) break;
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) specFilesUnder(join(dir, e.name), out, budget); }
    else if (SPEC.test(e.name)) out.push(join(dir, e.name));
  }
  return out;
}
let allSpecs = null;
function specsFor(given, cwd, root) {
  const word = given.replace(/:\d+(:\d+)?$/, ''); // Playwright's file:line and file:line:column
  const abs = resolve(cwd, word);
  if (existsSync(abs)) return statSync(abs).isDirectory() ? specFilesUnder(abs) : [abs];
  allSpecs ??= specFilesUnder(root);
  let re;
  try { re = new RegExp(word); } catch { re = null; }
  return allSpecs.filter((f) => (re ? re.test(f) : f.includes(word)));
}

// Why a command renders, or null. Reads package scripts and shell script files again.
function renderReason(cmd, config, root, depth) {
  const g = config.gpu;
  const key = cmd.prog;
  if ((g.renderCommands ?? []).includes(key)) return `${key.replace(/^script:/, 'pnpm ')} renders`;
  if (key.startsWith('script:') && depth < 3) {
    const s = packageScript(cmd.cwd, key.slice(7), root);
    if (s) for (const inner of simpleCommands(s.text, s.dir)) { inner.env = { ...cmd.env, ...inner.env }; const r = renderReason(inner, config, root, depth + 1); if (r) return `${key.replace(/^script:/, 'pnpm ')} runs "${s.text.slice(0, 60)}": ${r}`; }
    // No such script: pnpm, yarn and bun run the package binary of that name.
    return s ? null : renderReason({ ...cmd, prog: key.slice(7), path: key.slice(7) }, config, root, depth + 1);
  }
  if (['bash', 'sh', 'zsh'].includes(cmd.prog) || /\.(sh|bash)$/.test(cmd.prog)) {
    const file = /\.(sh|bash)$/.test(cmd.prog) ? cmd.path : cmd.args.find((a) => !a.startsWith('-'));
    const text = file && depth < 3 ? readText(resolve(cmd.cwd, file)) : null;
    if (text !== null) for (const inner of simpleCommands(text, cmd.cwd)) { inner.env = { ...cmd.env, ...inner.env }; const r = renderReason(inner, config, root, depth + 1); if (r) return `${file}: ${r}`; }
    return null;
  }
  if (cmd.prog === 'playwright' && cmd.args[0] === 'screenshot') return 'playwright screenshot';
  if (/chrom(e|ium)/i.test(cmd.prog) && cmd.args.some((a) => a.startsWith('--screenshot') || a.startsWith('--print-to-pdf'))) return `${cmd.prog} --screenshot`;
  if (cmd.prog === 'playwright' && cmd.args[0] === 'test') {
    const a = cmd.args.slice(1);
    const positional = [];
    const projects = [];
    let grep = '';
    for (let i = 0; i < a.length; i++) {
      const w = a[i];
      if (w.startsWith('--') && w.includes('=')) { const k = w.slice(0, w.indexOf('=')), v = w.slice(w.indexOf('=') + 1); if (k === '--project') projects.push(v); if (k === '--grep') grep += v; if (k === '--update-snapshots') return 'it updates snapshots (baselines are taken on the CI GPU machines)'; continue; }
      if (PW_VALUE.has(w)) { const v = a[++i] ?? ''; if (w === '--project') projects.push(v); if (w === '-g' || w === '--grep') grep += v; continue; }
      if (w === '-u' || w === '--update-snapshots') return 'it updates snapshots (baselines are taken on the CI GPU machines)';
      if (!w.startsWith('-')) positional.push(w);
    }
    if (!positional.length) return 'it runs the whole browser suite';
    for (const p of positional) {
      const bare = p.replace(/:\d+(:\d+)?$/, '');
      if ((g.gpuOnlySpecs ?? []).some((s) => bare.includes(s) || globToRegExp(s).test(bare.split('/').at(-1)))) return `${p} is a GPU-only spec`;
      for (const file of specsFor(p, cmd.cwd, root)) {
        const rel = relative(root, file).split(sep).join('/');
        if ((g.gpuOnlySpecs ?? []).some((s) => globToRegExp(s).test(rel.split('/').at(-1)))) return `${p} selects ${rel}, a GPU-only spec`;
        const hit = captureIn(scriptText(file, config, root), config);
        if (hit) return `${p} selects ${rel}, which (or a file it imports) calls ${hit}`;
      }
    }
    for (const pr of projects) if ((g.gpuOnlyProjects ?? []).some((s) => globToRegExp(s).test(pr))) return `project ${pr} is GPU-only`;
    if (/@gpu/.test(grep)) return 'it selects @gpu tests';
    if (g.softwareEnv && cmd.env[g.softwareEnv] === undefined && process.env[g.softwareEnv] === undefined) return `a browser run in a container needs ${g.softwareEnv}=1 (the software-renderer mode)`;
    return null;
  }
  if (['node', 'tsx', 'vite-node', 'bun', 'deno', 'python', 'python3', 'ts-node'].includes(cmd.prog)) {
    const a = cmd.args;
    let text = null, label = '';
    const evalFlag = a.findIndex((w) => ['-e', '--eval', '-p', '--print', '-c'].includes(w));
    if (evalFlag !== -1) { text = a[evalFlag + 1] ?? ''; label = `${cmd.prog} ${a[evalFlag]}`; }
    else {
      let i = 0;
      while (i < a.length && a[i].startsWith('-')) { if (['-r', '--require', '--import', '--loader', '--env-file', '-m'].includes(a[i])) i++; i++; }
      if (cmd.prog === 'deno' && ['run', 'eval'].includes(a[i])) i++;
      const file = a[i];
      if (file && file !== '-') { text = scriptText(resolve(cmd.cwd, file), config, root); label = file; }
      else if (cmd.heredoc !== null) { text = cmd.heredoc; label = `${cmd.prog} with a heredoc script`; }
    }
    const hit = captureIn(text, config);
    return hit ? `${label} (or a file it imports) calls ${hit}` : null;
  }
  return null;
}

function checkGpu(cmd, config, deny, ctx) {
  const g = config.gpu;
  if (!g || g.enabled !== true) return;
  const reason = renderReason(cmd, config, ctx.root, 0);
  if (reason && !isGpuMachine(config, ctx.sessionId)) deny(refusal('Every screenshot, screen walk, visual spec and rendered run happens on a GPU machine, never with software rendering in a container (Owner).', `${reason}; this machine is not a GPU machine`, g.hint ?? 'Render on a GPU machine.'));
}

function checkBanned(cmd, config, deny) {
  for (const b of config.bannedCommands ?? []) {
    const [prog, sub] = String(b.command ?? '').split(' ');
    if (cmd.prog !== prog) continue;
    const g = prog === 'git' ? gitParts(cmd) : null;
    const actual = g ? g.sub : cmd.args[0];
    const after = g ? g.rest : cmd.args.slice(1);
    const readOnly = (b.allow ?? []).includes(after[0] ?? ''); // the subcommand word itself, never a path after --
    if ((!sub || actual === sub) && !readOnly) deny(refusal(b.reason ?? `${b.command} is not used in this repo.`, `${prog} ${actual ?? ''}`.trim(), b.instead));
  }
}

function checkHostedRunnersOnPush(cmd, config, deny) {
  if (cmd.prog !== 'git' || config.hostedRunners?.enabled !== true) return;
  const g = gitParts(cmd);
  if (g.sub !== 'push' || hasFlag(g.rest, ['--delete', '-d'])) return;
  for (const src of pushSources(g.rest, g.cwd)) {
    const r = git(g.cwd, ['diff', '--name-only', `origin/${defaultBranch(config)}...${src}`, '--', '.github/workflows']);
    if (!r.ok) continue;
    for (const f of r.out.split('\n').filter((x) => /\.ya?ml$/.test(x))) {
      const text = git(g.cwd, ['show', `${src}:${f}`]).out;
      const hit = hostedLabel(text, config);
      if (hit) { deny(refusal(hostedRule, `${f}: ${hit}`, hostedInstead(config))); return; }
    }
  }
}
const hostedRule = 'No job runs on GitHub-hosted runners on this repo (Owner; vertical-slice, CI).';
const hostedInstead = (config) => config.hostedRunners?.hint ?? 'Use the self-hosted runner labels the gate starts.';
function hostedLabel(text, config) {
  const labels = (config.hostedRunners?.labels ?? ['ubuntu', 'windows', 'macos']).join('|');
  const re = new RegExp(`(^|[^\\w./:-])((${labels})-(latest|\\d[\\w.]*)(-[\\w]+)*)\\b`);
  for (const raw of lines(text)) {
    const line = raw.replace(/(^|\s)#.*$/, '');
    if (!line.trim()) continue;
    const m = re.exec(line);
    if (m) return `"${raw.trim()}"`;
  }
  return null;
}

function checkRuleMix(cmd, config, deny) {
  if (cmd.prog !== 'git' || !config.ruleMix || config.ruleMix.enabled === false || config.ruleMix.firstTimeSetup) return;
  const g = gitParts(cmd);
  if (g.sub !== 'push' || hasFlag(g.rest, ['--delete', '-d'])) return;
  for (const src of pushSources(g.rest, g.cwd)) {
    const r = git(g.cwd, ['diff', '--name-only', `origin/${defaultBranch(config)}...${src}`]);
    if (r.ok) ruleMixFiles(r.out.split('\n').filter(Boolean), config, deny);
  }
}
// Rules files may travel with docs and the rest of .claude/, never with product code or tests.
function ruleMixFiles(files, config, deny) {
  const rules = files.filter((f) => matchesAny(f, config.ruleMix.rulePaths));
  const docs = config.ruleMix.docPaths ?? ['docs/**', '*.md', '**/*.md', '.claude/**'];
  const other = files.filter((f) => !matchesAny(f, config.ruleMix.rulePaths) && !matchesAny(f, docs));
  if (rules.length && other.length) deny(refusal('A change does not quietly edit its own check: rules files and CI change in their own pull request, with no product code or tests (CLAUDE.md, Verification).', `this branch changes ${rules[0]} and ${other[0]}`, 'split the rules change into its own branch and pull request'));
}

// Pull request bodies.
function judgeBody(body, config, allowFooter) {
  const want = prLastLineOf(config);
  let text = String(body ?? '');
  if (allowFooter) text = stripFooter(text);
  const problems = [];
  const hits = attributionHits(text, config);
  if (hits.length) problems.push(`it has the line "${hits[0].trim()}"`);
  if (want && !lastLine(text).endsWith(want)) problems.push(`its last line is "${lastLine(text).slice(0, 80)}", not "${want}"`);
  return problems;
}
function stripFooter(body) {
  const ls = body.split('\n');
  let i = ls.length - 1, generated = 0;
  const gen = /^[\s>*_]*(?:🤖\s*)?Generated (?:by|with)\b/;
  for (; i >= 0; i--) {
    const l = ls[i].trim();
    if (l === '' || l.startsWith('https://claude.ai/code/session_')) continue;
    if (gen.test(l)) generated++; else break;
  }
  if (!generated || i < 0 || ls[i].trim() !== '---') return body;
  return ls.slice(0, i).join('\n').trimEnd();
}
const PR_RULE = 'Pull request bodies end with the owner\'s "Requested by" line and carry no Claude attribution (CLAUDE.md, Identity; release).';
function checkPrBodyBash(cmd, config, deny) {
  if (cmd.prog !== 'gh' || !on(config, 'prBody')) return;
  const p = ghParts(cmd);
  let body;
  if (p.sub === 'pr' && (p.sub2 === 'create' || p.sub2 === 'edit')) {
    const a = p.rest.slice(1);
    const given = flagValues(a, ['--body', '-b', '--body-file', '-F']).length > 0;
    if (given) body = ghBody(cmd, a);
    else if (p.sub2 === 'create') { deny(refusal(PR_RULE, hasFlag(a, ['--fill', '--fill-first', '--fill-verbose', '-f']) ? 'gh pr create --fill (the body would come from commit messages)' : 'gh pr create with no body', 'write the body to a file and pass --body-file <file>')); return; }
    else return;
  } else {
    const api = ghApi(cmd, config);
    if (!api || !/pulls(\/\d+)?$/.test(api.path) || api.method === 'GET' || api.fields.body === undefined) return;
    body = api.fields.body;
  }
  if (body === null || body === undefined || /\$\{?[A-Za-z_(]|`/.test(body)) return; // cannot resolve: prBodyVerify judges the result
  const problems = judgeBody(body, config, false);
  if (problems.length) deny(refusal(PR_RULE, `the body: ${problems.join('; ')}`, `end the body with "${prLastLineOf(config)}" on its own last line`));
}

// The pull request flow (release): a lane in the body, acceptance criteria for a change
// that is not only docs, a draft until the lane's reviews are done, an open-PR limit,
// and, for lane 2 and 3, a passing review that names the head commit before ready or merge.
const LANE = /\blane\s*([123])\b/gi;
const laneOf = (body) => { const all = [...String(body ?? '').matchAll(LANE)].map((m) => Number(m[1])); return all.length ? Math.max(...all) : null; }; // the highest lane named wins
// A verdict is a comment or review whose first line starts with a commit (7+ hex
// characters) followed by PASS or FAIL, e.g. "79ef366 FAIL: 5 red" or "**abc1234 PASS**".
function verdicts(items, f) {
  const pass = new RegExp(f.passPattern ?? '^(PASS|PASSED)$');
  const fail = new RegExp(f.failPattern ?? '^(FAIL|FAILED)$');
  const out = [];
  for (const c of items) {
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
// Commits between a reviewed commit and the head that are only clean merges of the
// default branch keep the review (release: "a clean merge of current main keeps the review").
function onlyCleanMerges(config, cwd, from, head) {
  if (git(cwd, ['merge-base', '--is-ancestor', from, head]).ok !== true) return false;
  const r = git(cwd, ['rev-list', '--parents', `${from}..${head}`, '--not', `origin/${defaultBranch(config)}`]);
  if (!r.ok) return false;
  for (const line of r.out.split('\n').filter(Boolean)) {
    const [c, p1, p2, ...more] = line.split(' ');
    if (!p2 || more.length) return false;
    const fromMain = git(cwd, ['merge-base', '--is-ancestor', p2, `origin/${defaultBranch(config)}`]).ok;
    const merged = git(cwd, ['merge-tree', '--write-tree', p1, p2]);
    const tree = git(cwd, ['rev-parse', `${c}^{tree}`]);
    if (!fromMain || !merged.ok || !tree.ok || merged.out.split('\n')[0] !== tree.out) return false;
  }
  return true;
}
const FLOW_RULE = 'Pull requests follow release: the body names the lane and the acceptance criteria, it opens as a draft, and a lane 2 or 3 pull request is marked ready or merged only after a passing review that names its head commit.';
function changesBeyondDocs(config, cwd) {
  const r = git(cwd, ['diff', '--name-only', `origin/${defaultBranch(config)}...HEAD`]);
  if (!r.ok) return true;
  const docs = config.ruleMix?.docPaths ?? ['docs/**', '*.md', '**/*.md', '.claude/**'];
  return r.out.split('\n').filter(Boolean).some((f) => !matchesAny(f, docs));
}
// A branch that changes only rules files and docs (the owner's rule requests keep their
// own pull requests) is not held back by the open pull request limit.
function onlyRulesAndDocs(config, cwd) {
  const r = git(cwd, ['diff', '--name-only', `origin/${defaultBranch(config)}...HEAD`]);
  if (!r.ok) return false;
  const files = r.out.split('\n').filter(Boolean);
  const keep = [...(config.ruleMix?.rulePaths ?? []), ...(config.ruleMix?.docPaths ?? ['docs/**', '*.md', '**/*.md'])];
  return files.length > 0 && files.every((x) => matchesAny(x, keep) && !x.startsWith('.claude/hooks/') && x !== '.claude/settings.json' && !x.startsWith('.github/'));
}
function checkPrCreate(config, cwd, repo, body, draft, deny) {
  const f = config.prFlow;
  if (!f || f.enabled === false) return;
  const known = body !== null && body !== undefined && !/\$\{?[A-Za-z_(]|`/.test(body);
  const lane = known ? laneOf(body) : null;
  if (known && f.requireLane !== false && !lane) { deny(refusal(FLOW_RULE, 'the body names no lane', 'add a "## Lane" section that says "Lane 1", "Lane 2" or "Lane 3" and why')); return; }
  if (known && f.requireCriteria !== false && !/acceptance criteria/i.test(body) && changesBeyondDocs(config, cwd)) deny(refusal(FLOW_RULE, 'the body has no acceptance criteria and the branch changes more than docs', 'add an "## Acceptance criteria" section: what done looks like, as checks a program or a person can observe (build)'));
  if (f.draft !== false && !draft) {
    const info = repo ? ghJson(`repos/${repo}`, cwd) : null;
    if (!(lane === 1 && info?.private === true)) deny(refusal(FLOW_RULE, `lane ${lane ?? '(unread)'} pull request opened ready${lane === 1 ? ' on a repo that is not known to be private' : ''}`, 'open it as a draft (gh pr create --draft, or draft: true)'));
  }
  if (f.maxOpenPrs && repo && !onlyRulesAndDocs(config, cwd)) {
    const open = ghJson(`repos/${repo}/pulls?state=open&per_page=100`, cwd);
    if (Array.isArray(open) && open.length >= f.maxOpenPrs) deny(refusal(`Pull requests open: ${f.maxOpenPrs} at most (CLAUDE.md, Settings).`, `${open.length} are open now (${open.slice(0, 5).map((x) => `#${x.number}`).join(', ')})`, 'merge or close one first, or report to the coordinator and wait for a free place'));
  }
}
function checkReviewed(config, cwd, repo, number, what, deny) {
  const f = config.prFlow;
  if (!f || f.enabled === false || f.requireReview === false || !repo) return;
  let n = number;
  if (!n) { const b = currentBranch(cwd); const list = ghJson(`repos/${repo}/pulls?head=${repo.split('/')[0]}:${b}`, cwd); n = list?.[0]?.number; }
  const pr = n ? ghJson(`repos/${repo}/pulls/${n}`, cwd) : null;
  if (!pr) { deny(refusal(FLOW_RULE, `pull request ${n ?? '(unknown)'} could not be read`, 'read it yourself, check its lane and reviews, then retry')); return; }
  const lane = laneOf(pr.body);
  if (!lane) { deny(refusal(FLOW_RULE, `${what}: the body of #${n} names no lane`, 'add the lane to the body (gh pr edit --body-file), then retry')); return; }
  if (lane < 2) return;
  const sha = String(pr.head?.sha ?? '').slice(0, 7);
  const comments = ghJson(`repos/${repo}/issues/${n}/comments?per_page=100`, cwd) ?? [];
  const reviews = ghJson(`repos/${repo}/pulls/${n}/reviews?per_page=100`, cwd) ?? [];
  // The latest verdict on a commit stands; a passing one covers the head when it is the
  // head or only clean merges of the default branch lie between them.
  // Every verdict on a commit that is the head, or reaches it through clean merges of the
  // default branch only, counts; the newest of them decides.
  const reaches = new Map();
  const covers = (at) => { if (!reaches.has(at)) reaches.set(at, at === sha || onlyCleanMerges(config, cwd, at, pr.head.sha)); return reaches.get(at); };
  const counted = verdicts([...comments, ...reviews], f).filter((v) => sha && covers(v.sha));
  const ok = counted.length > 0 && counted.at(-1).verdict === 'pass';
  if (!ok) deny(refusal(FLOW_RULE, `${what}: lane ${lane} pull request #${n} has no passing review that names its head ${sha}`, `have the coordinator start the ${lane === 3 ? 'implementation audit' : 'fresh review'} of ${sha}; it posts its verdict on the pull request with "${sha} PASS" or "${sha} FAIL" as the first line`));
}

// Live state, merge status.
const liveStatePath = (config, branch) => (config.liveState?.path ?? 'docs/superpowers/live/{branch}.md').replace('{branch}', branch.replaceAll('/', '-'));
const repoSlug = (config, cwd, explicit) => {
  if (explicit) return explicit;
  if (config.repo) return config.repo;
  const r = git(cwd, ['remote', 'get-url', 'origin']);
  const m = /github\.com[/:]([^/]+\/[^/.]+)(\.git)?$/.exec(r.out) ?? /\/git\/([^/]+\/[^/.]+)$/.exec(r.out);
  return m ? m[1] : null;
};
const ghJson = (path, cwd) => {
  const r = run('gh', ['api', path], { cwd, env: { ...process.env, GH_PAGER: 'cat' }, timeout: 8000 });
  if (!r.ok) return null;
  try { return JSON.parse(r.out); } catch { return null; }
};
function prBranch(config, cwd, repo, number) {
  if (!number) return currentBranch(cwd) || null;
  const pr = ghJson(`repos/${repo}/pulls/${number}`, cwd);
  return pr?.head?.ref ?? null;
}
function liveFileOnBranch(config, cwd, repo, branch) {
  const path = liveStatePath(config, branch);
  if (repo) {
    const r = run('gh', ['api', `repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, '--silent'], { cwd, env: { ...process.env, GH_PAGER: 'cat' } });
    if (r.ok) return path;
    if (/404|Not Found/i.test(r.err)) return null;
  }
  if (branch === currentBranch(cwd)) return git(cwd, ['cat-file', '-e', `HEAD:${path}`]).ok ? path : null;
  return null;
}
function checkLiveState(config, cwd, repo, number, what, deny) {
  if (!config.liveState || config.liveState.enabled === false) return;
  const branch = prBranch(config, cwd, repo, number);
  if (!branch) return;
  const file = liveFileOnBranch(config, cwd, repo, branch);
  if (file) deny(refusal('The live-state file is deleted in the last commit before the audit or the merge, so it never reaches main (CLAUDE.md, Live state in a file).', `${what} while ${file} is still on ${branch}`, `git rm ${file} && git commit -m "Remove live state" && git push, then retry`));
}
function checkMergeGreen(config, cwd, repo, number, deny) {
  const need = config.mergeGreen?.statuses ?? [];
  if (!config.mergeGreen || config.mergeGreen.enabled === false || !need.length) return;
  const rule = 'Green means every required check is successful on the pull request\'s current head; a missing, pending or unreadable check blocks the merge (release, Lanes and merging).';
  if (!repo) { deny(refusal(rule, 'the repo could not be worked out', 'run from inside the repo or pass -R owner/repo')); return; }
  let n = number;
  if (!n) { const b = currentBranch(cwd); const list = ghJson(`repos/${repo}/pulls?head=${repo.split('/')[0]}:${b}`, cwd); n = list?.[0]?.number; }
  const pr = n ? ghJson(`repos/${repo}/pulls/${n}`, cwd) : null;
  const status = pr ? ghJson(`repos/${repo}/commits/${pr.head.sha}/status`, cwd) : null;
  if (!status) { deny(refusal(rule, `the statuses of pull request ${n ?? '(unknown)'} could not be read`, 'read them yourself (GH_PAGER=cat gh api repos/<repo>/commits/<sha>/status) and merge once they are green')); return; }
  for (const s of need) {
    const got = (status.statuses ?? []).find((x) => x.context === s.context);
    const good = got && got.state === 'success' && (!s.description || String(got.description ?? '').includes(s.description));
    if (!good) { deny(refusal(rule, `${s.context} on ${pr.head.sha.slice(0, 7)} is ${got ? `${got.state}: ${got.description ?? ''}` : 'missing'}${s.description ? ` (needs success with "${s.description}")` : ''}`, 'wait for it in the foreground, then merge')); return; }
  }
}
const ghBody = (cmd, a) => {
  const direct = flagValues(a, ['--body', '-b']);
  const files = flagValues(a, ['--body-file', '-F']);
  let body = null;
  if (direct.length) body = direct.at(-1);
  else if (files.length) body = files.at(-1) === '-' ? cmd.heredoc : readText(resolve(cmd.cwd, files.at(-1)));
  const fromFile = /^\s*\$\(\s*cat\s+(['"]?)([^'"()\s]+)\1\s*\)\s*$/.exec(body ?? '');
  return fromFile ? readText(resolve(cmd.cwd, fromFile[2])) : body;
};
function checkPrFlowBash(cmd, config, deny) {
  if (cmd.prog !== 'gh') return;
  const p = ghParts(cmd);
  const repo = repoSlug(config, cmd.cwd, p.repo);
  if (p.sub === 'pr' && p.sub2 === 'create') { const a = p.rest.slice(1); checkPrCreate(config, cmd.cwd, repo, ghBody(cmd, a), hasFlag(a, ['--draft', '-d']), deny); return; }
  if (p.sub === 'pr' && (p.sub2 === 'ready' || p.sub2 === 'merge')) {
    const a = p.rest.slice(1);
    if (hasFlag(a, ['--undo', '--disable-auto'])) return;
    const url = a.find((w) => /\/pull\/\d+/.test(w));
    const number = a.find((w) => /^\d+$/.test(w)) ?? (url ? url.replace(/.*\/pull\/(\d+).*/, '$1') : null);
    checkLiveState(config, cmd.cwd, repo, number, `gh pr ${p.sub2}`, deny);
    checkReviewed(config, cmd.cwd, repo, number, `gh pr ${p.sub2}`, deny);
    if (p.sub2 === 'merge' && !hasFlag(a, ['--auto'])) checkMergeGreen(config, cmd.cwd, repo, number, deny);
    return;
  }
  const api = ghApi(cmd, config);
  if (!api) return;
  const m = /repos\/([^/]+\/[^/]+)\/pulls\/(\d+)\/(merge|ccr\/ready_for_review|ccr\/auto_merge)$/.exec(api.path);
  if (m && api.method !== 'GET' && api.method !== 'DELETE') {
    checkLiveState(config, cmd.cwd, m[1], m[2], `gh api ${m[3]}`, deny);
    checkReviewed(config, cmd.cwd, m[1], m[2], `gh api ${m[3]}`, deny);
    if (m[3] === 'merge') checkMergeGreen(config, cmd.cwd, m[1], m[2], deny);
  }
}

// ---------- the checks: files written ----------

function resultingText(input) {
  const path = input.file_path ?? input.path;
  if (!path) return null;
  const before = readText(path, 16 * 1024 * 1024) ?? '';
  if (typeof input.content === 'string') return { path, before, after: input.content };
  const edits = Array.isArray(input.edits) ? input.edits : [input];
  let after = before;
  for (const e of edits) {
    if (typeof e.old_string !== 'string' || typeof e.new_string !== 'string') continue;
    after = e.replace_all ? after.split(e.old_string).join(e.new_string) : after.replace(e.old_string, () => e.new_string);
  }
  return { path, before, after };
}
function checkFileWrite(input, config, root, deny) {
  const t = resultingText(input);
  if (!t) return;
  const rel = relative(root, resolve(root, t.path)).split(sep).join('/');
  if (rel.startsWith('..')) return;
  if (on(config, 'attribution') && /\.md$/i.test(rel) && !matchesAny(rel, config.attribution?.exemptPaths ?? ['tests/**'])) {
    const hits = attributionHits(addedLines(t.before, t.after).join('\n'), config, 'filePatterns');
    if (hits.length) deny(refusal('No Claude co-author, "Claude-Session" or "Generated with Claude Code" line in docs (CLAUDE.md, Identity).', `${rel} gains the line "${hits[0].trim()}"`, 'leave that line out'));
  }
  if (config.hostedRunners?.enabled === true && /^\.github\/workflows\/.+\.ya?ml$/.test(rel)) {
    const hit = hostedLabel(t.after, config);
    if (hit) deny(refusal(hostedRule, `${rel}: ${hit}`, hostedInstead(config)));
  }
  if (on(config, 'bypassFlags') && matchesAny(rel, config.bypassFlags?.configFiles ?? [])) {
    const added = addedLines(t.before, t.after).join('\n');
    const m = /passWithNoTests\s*:\s*true|--pass-?[wW]ith-?[nN]o-?[tT]ests|--retr(?:y|ies)(?:=|\s+)0*[1-9]|\bretr(?:y|ies)\s*:\s*(?!0\s*,?\s*(\/\/.*)?$)\S.*/m.exec(added);
    if (m) deny(refusal('Never loosen a check: no passing with no tests, no retries until green (build skill).', `${rel} gains "${m[0]}"`, 'leave the setting at its strict value; fix the test instead'));
  }
}

// ---------- the checks: MCP tools ----------

const toolMatches = (name, patterns = []) => patterns.some((p) => new RegExp(p).test(name));
function checkMcp(name, input, config, root, deny, ctx) {
  const repo = input.owner && input.repo ? `${input.owner}/${input.repo}` : repoSlug(config, root);
  if (config.agnostic && !(input.owner && input.repo)) return;
  const rel = (s) => String(s ?? '');
  // Owner's device.
  if (config.ownerDevice?.enabled === true && toolMatches(name, config.ownerDevice.tools)) deny(refusal('Nothing runs on the owner\'s computer or browser; work runs in the cloud (Owner; release, Where work runs).', `the tool ${name}`, 'run it in this cloud session, or start a cloud session that can'));
  // Screenshots through a browser tool.
  if (config.gpu?.enabled === true && toolMatches(name, config.gpu.mcpTools) && !toolMatches(name, config.gpu.mcpToolsAllowed) && !isGpuMachine(config, ctx.sessionId)) deny(refusal('Every screenshot happens on a GPU machine (Owner).', `the tool ${name}`, config.gpu.hint));
  // GitHub API commits are authored by the token's account, not the configured author.
  if (on(config, 'identity') && toolMatches(name, config.identity?.commitTools)) deny(refusal(`Every commit is authored by ${config.author ?? 'the CLAUDE.md author'} (CLAUDE.md, Identity).`, `${name} writes a commit through the API, authored by the token's account`, 'commit with git in this session and push'));
  // Merge method, live state, green.
  const method = input.merge_method ?? input.mergeMethod;
  const isMerge = toolMatches(name, config.mcp?.mergeTools ?? ['merge_pull_request$']);
  const isAuto = toolMatches(name, config.mcp?.autoMergeTools ?? ['enable_pr_auto_merge$']);
  if (on(config, 'mergeMethod') && isAuto && !method) deny(refusal('Merge with a merge commit, never a squash or a rebase (CLAUDE.md, Identity).', `${name} with no merge method (GitHub would use the repository's default, which may be a squash)`, 'pass mergeMethod "MERGE"'));
  else if (on(config, 'mergeMethod') && (isMerge || isAuto) && method && String(method).toLowerCase() !== 'merge') deny(refusal('Merge with a merge commit, never a squash or a rebase (CLAUDE.md, Identity).', `${name} with merge_method ${method}`, 'merge_method "merge"'));
  const number = input.pullNumber ?? input.pull_number ?? input.number;
  const readyCall = toolMatches(name, config.mcp?.updatePrTools ?? ['update_pull_request$']) && input.draft === false;
  if (isMerge || isAuto || readyCall) checkLiveState(config, root, repo, number, readyCall ? 'marking it ready' : name, deny);
  if (isMerge || isAuto || readyCall) checkReviewed(config, root, repo, number, readyCall ? 'marking it ready' : name, deny);
  if (toolMatches(name, config.mcp?.createPrTools ?? ['create_pull_request$'])) checkPrCreate(config, root, repo, typeof input.body === 'string' ? input.body : '', input.draft === true, deny);
  if (isMerge) checkMergeGreen(config, root, repo, number, deny);
  // Pull request bodies.
  if (on(config, 'prBody') && toolMatches(name, config.mcp?.prBodyTools ?? ['create_pull_request$', 'update_pull_request$']) && typeof input.body === 'string') {
    const problems = judgeBody(input.body, config, false);
    if (problems.length) deny(refusal(PR_RULE, `the body: ${problems.join('; ')}`, `end the body with "${prLastLineOf(config)}" on its own last line`));
  }
  // Commands handed to the owner.
  for (const t of config.ownerCommands?.tools ?? []) {
    if (config.ownerCommands.enabled === false || !new RegExp(t.tool).test(name)) continue;
    const text = (t.fields ?? ['text']).map((f) => rel(input[f])).join('\n');
    let fenced = false;
    for (const l of lines(text)) {
      if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; continue; }
      if (!fenced) continue;
      const s = l.trim().replace(/^\$\s+/, '');
      if (/^git\s/.test(s)) { deny(refusal('Every command handed to the owner uses gh, never plain git (Owner).', `"${s.slice(0, 80)}"`, 'the gh equivalent (gh repo clone, gh pr checkout, gh api ...)')); break; }
      if (/\bgh api\b/.test(s) && !/^GH_PAGER=cat\s/.test(s)) { deny(refusal('Every gh api command handed to the owner starts with GH_PAGER=cat (Owner).', `"${s.slice(0, 80)}"`, `GH_PAGER=cat ${s}`)); break; }
    }
  }
  // Session tools: effort cap, model and effort named, the full rule list in the brief.
  // Efforts up to the cap are allowed; anything else, a higher level included, is above it.
  const ranks = ['low', 'medium', 'high'];
  for (const t of config.sessionTools?.tools ?? []) {
    if (config.sessionTools.enabled === false || !new RegExp(t.tool).test(name)) continue;
    const effort = (t.effortFields ?? ['effort']).map((f) => input[f]).find((v) => typeof v === 'string');
    const cap = config.sessionTools.maxEffort ?? 'high';
    if (effort && !ranks.slice(0, ranks.indexOf(cap) + 1).includes(effort)) deny(refusal(`Nothing runs above ${cap} effort (CLAUDE.md, Settings).`, `${name} with effort ${effort}`, `effort "${cap}" or lower, as Settings names for the role`));
    const model = (t.modelFields ?? ['model']).map((f) => input[f]).find((v) => typeof v === 'string' && v);
    if (t.requireModelAndEffort && (!model || !effort)) deny(refusal('Every session names its model and effort, from Settings in CLAUDE.md.', `${name} with model ${model ?? 'unset'} and effort ${effort ?? 'unset'}`, 'name both'));
    if (t.requireModel && !model) deny(refusal(t.modelRule ?? 'Every session names its model, from Settings in CLAUDE.md.', `${name} with no model`, `name one: ${(t.models ?? []).join(', ') || 'the model Settings gives the role'}`));
    if (model && t.models?.length && !t.models.some((m) => new RegExp(m, 'i').test(model))) deny(refusal(t.modelRule ?? 'Models come from Settings in CLAUDE.md (Models and effort).', `${name} with model ${model}`, `one of: ${t.models.join(', ')}`));
    if (t.requireRulesInBrief) {
      const brief = (t.promptFields ?? ['prompt']).map((f) => rel(input[f])).join('\n').replace(/\s+/g, ' ');
      const missing = (config.inject?.rules ?? []).filter((r) => typeof r === 'object' && r.id && !brief.includes(`[${r.id}]`));
      if (missing.length) deny(refusal('The coordinator pastes the FULL owner rule list into every thread brief (Owner).', `${missing.length} rules are missing from the brief: ${missing.map((r) => `[${r.id}]`).join(' ')}`, `paste these lines, ids included:\n${missing.map((r) => `- ${ruleLine(r)}`).join('\n')}`));
    }
  }
}

const ruleLine = (r) => (typeof r === 'object' && r ? `[${r.id}] ${r.text}` : String(r));

// ---------- events ----------

function sessionStart(root, config, input) {
  const parts = [];
  const want = authorOf(config);
  const names = ['identity', 'attribution', 'forcePush', 'defaultBranchPush', 'mergeMethod', 'bypassFlags', 'prBody', 'prFlow', 'liveState', 'mergeGreen', 'ruleMix', 'gpu', 'hostedRunners', 'ownerDevice', 'ownerCommands', 'sessionTools', 'stop'];
  const state = names.map((n) => {
    const c = config[n];
    const enabled = n === 'gpu' || n === 'hostedRunners' || n === 'ownerDevice' || n === 'prFlow' ? c?.enabled === true : on(config, n) && !(n === 'mergeGreen' && !(c?.statuses ?? []).length);
    const blank = (n === 'identity' && !authorOf(config)) || (n === 'prBody' && !prLastLineOf(config));
    return `${n} ${blank ? 'off (blank)' : enabled ? 'on' : 'off'}`;
  });
  const placeholders = blanksOf(config);
  const branch = currentBranch(root);
  const live = branch ? liveStatePath(config, branch) : null;
  const gitIdent = parseIdent(git(root, ['var', 'GIT_AUTHOR_IDENT']).out);
  parts.push(`# Rule hooks are on in this repo (${repoSlug(config, root) ?? root})`);
  parts.push(`Tool calls that break a rule below are refused before they run, with the reason. ${FOOTER}`);
  parts.push(`Checks: ${state.join(', ')}.${placeholders.length ? ` Blanks still in CLAUDE.md's Identity rule (their checks are off): ${placeholders.join(', ')}.` : ''}`);
  if (config.gpu?.enabled === true) parts.push(isGpuMachine(config, input.session_id) ? 'This machine is a GPU machine: rendering is allowed here.' : `This machine is NOT a GPU machine: screenshots, screen walks, visual specs and rendered runs are refused here. ${config.gpu.hint ?? ''}`);
  if (want) parts.push(`Commit identity: ${showIdent(want)}. git config here gives ${showIdent(gitIdent)}${sameIdent(gitIdent, want) ? ' (matches)' : ` (DOES NOT MATCH: git config user.name "${want.name}" && git config user.email "${want.email}")`}.`);
  if (branch) parts.push(`Branch ${branch}; your live-state file is ${live} (${existsSync(join(root, live)) ? 'exists' : 'not there yet'}).`);
  const claude = readText(join(root, 'CLAUDE.md')) ?? '';
  const m = /\n## Rules that never bend\n[\s\S]*?(?=\n## )/.exec(claude);
  if (m) parts.push(m[0].trim());
  const rules = config.inject?.rules ?? [];
  if (rules.length) parts.push(`## The owner's standing rules (ids in brackets; a thread brief pastes them all)\n\n${rules.map((r) => `- ${ruleLine(r)}`).join('\n')}`);
  parts.push(['## Where the rest is', '- Settings (numbers, models, limits): the Settings section of CLAUDE.md.', '- Skills: .claude/skills/; load the one that fits before that kind of work.', '- Where things stand: docs/superpowers/progress.md.', '- The project instructions also apply.', ...(config.inject?.pointers ?? []).map((p) => `- ${p}`)].join('\n'));
  const limit = config.inject?.maxChars ?? 9000;
  let text = '';
  for (const p of parts) {
    if ((text + p).length + 2 > limit) { text += `\n\n(The rest is in CLAUDE.md and .claude/hooks/rules.json; read them now.)`; break; }
    text += (text ? '\n\n' : '') + p;
  }
  return text;
}

function stop(root, config, input) {
  if (input.stop_hook_active) return null;
  const s = config.stop ?? {};
  if (s.enabled === false) return null;
  const branch = currentBranch(root);
  if (s.dirty !== false && branch && branch !== defaultBranch(config)) {
    const r = git(root, ['status', '--porcelain', '--untracked-files=no']);
    if (r.ok && r.out) return `Tracked files are changed and not committed on ${branch}:\n${r.out.split('\n').slice(0, 10).join('\n')}\nCommit your work (a WIP commit, never a stash) or say in your reply why it stays uncommitted. A session keeps its state in commits, not in its context (CLAUDE.md, Live state in a file).`;
  }
  if (s.ciPending !== false && branch) {
    const head = git(root, ['rev-parse', 'HEAD']).out;
    const up = git(root, ['rev-parse', '@{u}']);
    const repo = repoSlug(config, root);
    if (up.ok && up.out === head && repo) {
      const st = ghJson(`repos/${repo}/commits/${head}/status`, root);
      const pending = (st?.statuses ?? []).find((x) => x.state === 'pending');
      if (pending) return `CI is still running on ${head.slice(0, 7)} (${pending.context}: ${pending.description ?? 'pending'}). Watch it in the foreground and act the moment it ends (release); do not end the turn only to wait for it. If something else will wake you when it ends, say so in your reply.`;
    }
  }
  return null;
}

function laneNotice(root, config, input, rel) {
  const n = config.laneNotice;
  if (!n || n.enabled === false || !matchesAny(rel, n.paths ?? [])) return null;
  const file = join(tmpdir(), `claude-rules-lane-${String(input.session_id ?? 'none').replace(/[^\w-]/g, '')}.json`);
  let seen = [];
  try { seen = JSON.parse(readText(file) ?? '[]'); } catch { seen = []; }
  const group = (n.paths ?? []).find((g) => globToRegExp(g).test(rel));
  if (seen.includes(group)) return null;
  seen.push(group);
  try { writeFileSync(file, JSON.stringify(seen)); } catch { /* optional */ }
  return `${rel} is a lane 3 path (CLAUDE.md, Risk): it needs its lane's audits and the owner's approval or a recorded standing permission before it merges, and a rules or CI change goes in its own pull request.`;
}

function postToolUse(root, config, input) {
  const name = input.tool_name;
  const ti = input.tool_input ?? {};
  const response = typeof input.tool_response === 'string' ? input.tool_response : JSON.stringify(input.tool_response ?? '');
  const notes = [];
  const problems = [];
  if (name === 'Bash') {
    const cmds = simpleCommands(String(ti.command ?? ''), input.cwd ?? root);
    const committed = cmds.find((c) => c.prog === 'git' && makesCommit(gitParts(c)));
    const cScope = committed ? scopeFor(root, config, gitParts(committed).cwd, null) : null;
    if (committed && cScope && on(cScope.config, 'commitVerify')) {
      const g = gitParts(committed);
      const want = authorOf(cScope.config);
      const r = git(g.cwd, ['log', '-1', '--format=%h%x00%an%x00%ae%x00%cn%x00%ce%x00%B']);
      if (r.ok) {
        const [sha, an, ae, cn, ce, body] = r.out.split('\x00');
        if (want && (!sameIdent({ name: an, email: ae }, want) || !sameIdent({ name: cn, email: ce }, want))) problems.push(`Commit ${sha} is by ${an} <${ae}>, committed by ${cn} <${ce}>, not ${showIdent(want)}. Fix it before pushing: git config user.name "${want.name}" && git config user.email "${want.email}" && git commit --amend --reset-author --no-edit`);
        const hits = on(cScope.config, 'attribution') ? attributionHits(body, cScope.config) : [];
        if (hits.length) problems.push(`Commit ${sha} carries "${hits[0].trim()}". Reword it before pushing (git commit --amend).`);
      }
    }
    const prCall = cmds.find((c) => c.prog === 'gh' && ((ghParts(c).sub === 'pr' && ['create', 'edit'].includes(ghParts(c).sub2)) || /pulls(\/\d+)?$/.test(ghApi(c)?.path ?? '')));
    const pScope = prCall ? scopeFor(root, config, prCall.cwd, ghParts(prCall).repo) : null;
    if (prCall && pScope && on(pScope.config, 'prBodyVerify') && pScope.config.prBodyVerify?.enabled !== false) {
      const p = ghParts(prCall);
      const number = (/\/pull\/(\d+)/.exec(response) ?? /"number":\s*(\d+)/.exec(response) ?? [])[1] ?? p.rest.slice(1).find((w) => /^\d+$/.test(w)) ?? (/pulls\/(\d+)/.exec(ghApi(prCall)?.path ?? '') ?? [])[1];
      const repo = repoSlug(config, prCall.cwd, p.repo ?? (/repos\/([^/]+\/[^/]+)\/pulls/.exec(ghApi(prCall, pScope.config)?.path ?? '') ?? [])[1]);
      verifyBody(config, root, repo, number, problems);
    }
  } else if (/^(Write|Edit|MultiEdit)$/.test(name)) {
    const path = ti.file_path ?? ti.path;
    if (path) { const rel = relative(root, resolve(root, path)).split(sep).join('/'); const n = laneNotice(root, config, input, rel); if (n) notes.push(n); }
  } else if (toolMatches(name, config.mcp?.prBodyTools ?? ['create_pull_request$', 'update_pull_request$']) && on(config, 'prBodyVerify')) {
    const number = ti.pullNumber ?? ti.pull_number ?? (/\/pull\/(\d+)/.exec(response) ?? [])[1];
    const repo = ti.owner && ti.repo ? `${ti.owner}/${ti.repo}` : repoSlug(config, root);
    if (ti.body !== undefined || !ti.pullNumber) verifyBody(config, root, repo, number, problems);
  }
  if (problems.length) return { decision: 'block', reason: problems.join('\n\n') };
  if (notes.length) return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n') } };
  return null;
}
function verifyBody(config, root, repo, number, problems) {
  if (!repo || !number) return;
  const pr = ghJson(`repos/${repo}/pulls/${number}`, root);
  if (!pr) return;
  const issues = judgeBody(pr.body ?? '', config, config.prBody?.footerStrippedByCi === true);
  if (issues.length) problems.push(`Pull request #${number}'s body as GitHub has it: ${issues.join('; ')}. ${PR_RULE} Write the right body to a file and apply it (gh pr edit ${number} --body-file <file>), then check the last line again.`);
}

function preToolUse(root, config, input, ctx) {
  const base = config.detached ? repoless(config) : config;
  const reasons = [];
  const deny = (r) => { if (!reasons.includes(r)) reasons.push(r); };
  const name = input.tool_name;
  const ti = input.tool_input ?? {};
  if (name === 'Bash') {
    for (const cmd of simpleCommands(String(ti.command ?? ''), input.cwd ?? root)) {
      const scope = cmd.prog === 'git' ? scopeFor(root, config, gitParts(cmd).cwd, null) : cmd.prog === 'gh' ? scopeFor(root, config, cmd.cwd, ghParts(cmd).repo) : { root, config: base };
      if (!scope) continue;
      for (const check of [checkIdentity, checkAttribution, checkForcePush, checkDefaultBranchPush, checkMergeMethod, checkBypassFlags, checkGpu, checkBanned, checkHostedRunnersOnPush, checkRuleMix, checkPrBodyBash, checkPrFlowBash]) {
        if (reasons.length) break;
        check(cmd, scope.config, deny, { ...ctx, root: scope.root });
      }
    }
  } else if (/^(Write|Edit|MultiEdit)$/.test(name)) {
    checkFileWrite(ti, base, root, deny);
  } else if (name?.startsWith('mcp__') || toolMatches(name ?? '', (config.sessionTools?.tools ?? []).map((t) => t.tool))) {
    const slug = ti.owner && ti.repo ? `${ti.owner}/${ti.repo}` : null;
    const scope = config.detached && !slug ? { root, config: base } : scopeFor(root, config, root, slug);
    const cfg = scope?.config ?? { ...config, identity: { enabled: false }, mergeMethod: { enabled: false }, prBody: { enabled: false }, liveState: { enabled: false }, mergeGreen: { enabled: false } };
    checkMcp(name, ti, cfg, scope?.root ?? root, deny, ctx);
  }
  if (!reasons.length) return null;
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reasons.join('\n\n') } };
}

// ---------- finding the repo ----------

function findRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.claude', 'hooks', 'rules.json'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
// The checks that need no repo: rendering, the owner's device, commands handed to the
// owner, session effort and briefs, banned commands, bypass flags.
const NEEDS_REPO = ['identity', 'attribution', 'commitVerify', 'forcePush', 'defaultBranchPush', 'mergeMethod', 'prBody', 'prBodyVerify', 'prFlow', 'liveState', 'mergeGreen', 'ruleMix', 'hostedRunners', 'laneNotice', 'stop'];
function repoless(config) {
  const c = { ...config, detached: true };
  for (const k of NEEDS_REPO) c[k] = { ...(typeof config[k] === 'object' ? config[k] : {}), enabled: false };
  return c;
}
function rootsBelow(dir) {
  try { return readdirSync(dir).map((d) => join(dir, d)).filter((d) => existsSync(join(d, '.claude', 'hooks', 'rules.json'))); } catch { return []; }
}
function rootForCall(input) {
  const ti = input.tool_input ?? {};
  const starts = [];
  if (ti.file_path || ti.path) starts.push(dirname(resolve(input.cwd ?? '.', ti.file_path ?? ti.path)));
  if (input.tool_name === 'Bash') for (const c of simpleCommands(String(ti.command ?? ''), input.cwd ?? '.')) starts.push(c.prog === 'git' ? gitParts(c).cwd : c.cwd);
  if (input.cwd) starts.push(input.cwd);
  for (const s of starts) { const r = findRoot(s); if (r) return r; }
  const slug = ti.owner && ti.repo ? `${ti.owner}/${ti.repo}`.toLowerCase() : null;
  for (const r of rootsBelow(input.cwd ?? '.')) {
    if (!slug) continue;
    const c = loadConfig(r).config;
    if (c && String(repoSlug(c, r) ?? '').toLowerCase() === slug) return r;
  }
  return null;
}

// ---------- main ----------

function emit(obj) { if (obj) process.stdout.write(JSON.stringify(obj) + '\n'); }

// The user-level launcher: from the folder a session starts in, run the rules.mjs of the repo
// below. At session start it also says so when no repo below has one, so a missing hook is seen.
const LAUNCH_RUN = 'for f in "$CLAUDE_PROJECT_DIR"/*/.claude/hooks/rules.mjs; do [ -f "$f" ] && exec node "$f" --find-repo; done; ';
const LAUNCH_NOTE = '[ -f "$CLAUDE_PROJECT_DIR/.claude/hooks/rules.mjs" ] || echo "Rule hooks: no .claude/hooks/rules.mjs here or one folder below, so no rule is enforced."; ';
const LAUNCH_EVENTS = [['SessionStart', null, LAUNCH_RUN + LAUNCH_NOTE + 'true'], ['PreToolUse', 'Bash|Write|Edit|MultiEdit|Agent|Workflow|mcp__.*', LAUNCH_RUN + 'true'], ['PostToolUse', 'Bash|Write|Edit|MultiEdit|mcp__.*', LAUNCH_RUN + 'true'], ['Stop', null, LAUNCH_RUN + 'true']];
// One installer, used two ways: `--install-user` runs it (a failure exits 1), and `--print-setup`
// prints it as a cloud setup script that needs no repo and never stops a session from starting.
const INSTALL_JS = [
  "const fs = require('fs'), path = require('path'), os = require('os');",
  "const p = path.join(process.env.HOME || os.homedir(), '.claude', 'settings.json');",
  "const quit = (why) => { console.error(`Rule hooks not added: ${p} ${why}. Nothing was changed.`); process.exit(process.env.RULES_INSTALL_STRICT ? 1 : 0); };",
  `const R = ${JSON.stringify(LAUNCH_RUN)};`,
  `const N = ${JSON.stringify(LAUNCH_NOTE)};`,
  `const E = [["SessionStart", null, R + N + "true"], ["PreToolUse", ${JSON.stringify(LAUNCH_EVENTS[1][1])}, R + "true"],`,
  `  ["PostToolUse", ${JSON.stringify(LAUNCH_EVENTS[2][1])}, R + "true"], ["Stop", null, R + "true"]];`,
  "const ok = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);",
  "const ours = (h) => ok(h) && /\\/\\.claude\\/hooks\\/rules\\.mjs\"?;? do /.test(String(h.command ?? ''));",
  "let text = null;",
  "try { if (fs.existsSync(p)) text = fs.readFileSync(p, 'utf8'); } catch (e) { quit(`could not be read (${e.code})`); }",
  "let s = {};",
  "try { if (text !== null) s = JSON.parse(text); } catch { quit('is not valid JSON'); }",
  "if (!ok(s) || (s.hooks !== undefined && !ok(s.hooks))) quit('is not in the usual shape');",
  "const hooks = { ...s.hooks };",
  "for (const [ev, m, c] of E) {",
  "  const list = hooks[ev] ?? [];",
  "  const odd = (e) => !ok(e) || (e.hooks !== undefined && !Array.isArray(e.hooks));",
  "  if (!Array.isArray(list) || list.some(odd)) quit(`is not in the usual shape at hooks.${ev}`);",
  "  // Only the launcher is taken out; the user's own hooks in the same entry stay.",
  "  const kept = [];",
  "  for (const e of list) {",
  "    const all = e.hooks ?? [], own = all.filter((h) => !ours(h));",
  "    if (own.length || own.length === all.length) kept.push(own.length === all.length ? e : { ...e, hooks: own });",
  "  }",
  "  hooks[ev] = [...kept, { ...(m ? { matcher: m } : {}), hooks: [{ type: 'command', command: c }] }];",
  "}",
  "const next = JSON.stringify({ ...s, hooks }, null, 2) + '\\n';",
  "if (text !== null && JSON.stringify(JSON.parse(text)) === JSON.stringify(JSON.parse(next))) {",
  "  console.log(`Rule hooks already in ${p}.`); process.exit(0);",
  "}",
  "try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, next); }",
  "catch (e) { quit(`could not be written (${e.code})`); }",
  "console.log(`Rule hooks added to ${p}: sessions started one folder above a repo now load its hooks.`);",
].join('\n');
const SETUP_SCRIPT = `# Rule hooks for sessions that start one folder above a repo. Needs no repo; never fails.\nnode - <<'RULES_HOOKS_JS' || true\n${INSTALL_JS}\nRULES_HOOKS_JS\n`;
function installUser() {
  const r = spawnSync(process.execPath, ['-'], { input: INSTALL_JS, env: { ...process.env, RULES_INSTALL_STRICT: '1' }, encoding: 'utf8' });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  if (r.status !== 0) { if (!r.stderr) console.error('Rule hooks not added. Nothing was changed.'); process.exit(1); }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--install-user')) { installUser(); return; }
  if (argv.includes('--print-setup')) { process.stdout.write(SETUP_SCRIPT); return; }
  const findRepo = argv.includes('--find-repo');
  if (argv.includes('--check')) {
    const root = process.env.CLAUDE_PROJECT_DIR || resolve(SCRIPT_DIR, '..', '..');
    const { config, error } = loadConfig(root);
    if (error) { console.error(error); process.exit(1); }
    const blanks = [...new Set([...blanksOf(config), ...Object.entries(config).filter(([, v]) => isPlaceholder(v)).map(([k]) => k)])];
    console.log(`CLAUDE.md and rules.json: ${blanks.length ? `blanks left: ${blanks.join(', ')}` : 'no blanks'}`);
    console.log(sessionStart(root, config, { session_id: 'check' }).split('\n').find((l) => l.startsWith('Checks:')));
    console.log(config.gpu?.enabled === true ? `GPU machine: ${isGpuMachine(config, `check-${Date.now()}`) ? 'yes' : 'no'}` : 'GPU check: off');
    process.exit(blanks.length && argv.includes('--strict') ? 1 : 0);
  }
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); } catch { raw = ''; }
  const input = JSON.parse(raw);
  const event = input.hook_event_name;
  if (findRepo && process.env.CLAUDE_PROJECT_DIR && existsSync(join(process.env.CLAUDE_PROJECT_DIR, '.claude', 'hooks', 'rules.mjs'))) return; // the repo's own settings run it
  let roots;
  let detached = false;
  if (findRepo) {
    roots = event === 'SessionStart' ? rootsBelow(input.cwd ?? '.').concat(findRoot(input.cwd ?? '.') ?? []) : [rootForCall(input)].filter(Boolean);
    // A call that acts in no repo still meets the checks that need none, under the one config below.
    if (!roots.length && event === 'PreToolUse') { const below = rootsBelow(input.cwd ?? '.'); if (below.length === 1) { roots = below; detached = true; } }
  }
  else roots = [process.env.CLAUDE_PROJECT_DIR || resolve(SCRIPT_DIR, '..', '..')];
  roots = [...new Set(roots)];
  if (!roots.length) return;
  const ctx = { sessionId: input.session_id, root: roots[0] };
  if (event === 'SessionStart') {
    const texts = [];
    for (const root of roots) {
      const { config, error } = loadConfig(root);
      texts.push(error ? `RULE HOOKS ARE BROKEN in ${root}: ${error}. Fix .claude/hooks/rules.json before anything else; until then no rule is enforced.` : sessionStart(root, config, input));
    }
    emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texts.join('\n\n---\n\n') } });
    return;
  }
  const root = roots[0];
  const loaded = loadConfig(root);
  const { error } = loaded;
  if (error) { emit({ systemMessage: `rules hook: ${error}; no rule check ran` }); return; }
  const config = detached ? { ...loaded.config, detached: true } : loaded.config; // repo checks still guard a repo the call names
  if (event === 'PreToolUse') emit(preToolUse(root, config, input, ctx));
  else if (event === 'PostToolUse') emit(postToolUse(root, config, input));
  else if (event === 'Stop' || event === 'SubagentStop') { const reason = stop(root, config, input); if (reason) emit({ decision: 'block', reason }); }
}

try { main(); } catch (e) {
  emit({ systemMessage: `rules hook crashed: ${e?.message ?? e}; this check did not run` });
}
process.exitCode = 0;
