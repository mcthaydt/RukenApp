# Plan audit 4: Deploy from a green main

- Spec: `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md`
- Branch: `claude/project-thread-mqcz6h`. Examined commit: `1636b24` (the fix of plan audit 3, `4d0364a`, FAIL 1 red at `3e5d939`).
- Also read: `git diff 3e5d939 1636b24`, the owner steps at `/mnt/project-files/owner-steps/2026-11-22-deploy-from-green-main.md`, and the source of the Neon CLI that `npx -y neonctl` runs today (`neonctl` 9.9.3, which loads `neon` 9.9.3, fetched with `npm pack`: `dist/_chunks/computes-Cgc9-J33.js`, `connection_string-6WhV4WFx.js`, `projects-*.js`, `dist/utils/enrichers.js`, `dist/context.js`).
- Lane 3. Model: Opus 5.5, medium.

**Verdict: PASS: 0 red, 1 note.** R6 is fixed, and N12 and N13 are taken. The owner steps file is the same as spec section 4. Everything from audits 1 to 3 still holds; the diff since `3e5d939` touches only section 4 and adds the audit 3 file.

## R6 and the two notes of audit 3

- **R6: fixed.** Spec line 71 now says "note the id of each project"; line 72 runs `npx -y neonctl computes list --project-id <project id>`; line 76 says what to look for (the origin host's first label with any `-pooler` removed), to run it for each project id until one matches, and that the row's `branch_id` is `<branch_id>`. Both `connection-string` lines (73 and 87) now take `<branch_id>`. Checked against the CLI source:
  - `computes` is a real command (aliases `compute`, `endpoints`, `endpoint`) with a `--project-id` option, and `list` with no `--branch` lists every compute in the project (`computes-Cgc9-J33.js` lines 50 to 60 and 108 to 119).
  - Its output fields are `id, branch_id, type, current_state, autoscaling_limit_min_cu, autoscaling_limit_max_cu` (`COMPUTE_FIELDS`, lines 23 to 30), so the endpoint id and its branch id are on the same row.
  - A Neon host's first label is that endpoint id, and the pooled host is the same host with `-pooler` added after the id (`connection_string-6WhV4WFx.js`: `endpoint.host.replace(endpoint.id, `${endpoint.id}-pooler`)`), so "first label minus `-pooler`" is the right match.
  - `connection-string [branch]` takes a branch name or id; an id that looks like `br-…` is used as is, with no lookup (`enrichers.js` `branchIdResolve`, line 35).
- **N12: done.** The check line uses `DB_HOST`, not `HOST`, on both sides of the test and in the STOP message.
- **N13: done.** `[ -n "$DB_HOST" ] &&` comes before the comparison, so an empty `DB_HOST` (the `neonctl` call failed) prints STOP. If `ORIGIN_HOST` is empty and `DB_HOST` is not, the comparison fails and prints STOP too.

## Owner steps: same as the spec?

Yes. Checked with `diff` of spec section 4 (between the `## 4.` and `## 5.` headings) against the owner steps file minus its four-line header: identical. Order is right: find the database, check it, then create the environment and set the secrets; the database secret is set from the same `connection-string` arguments that passed the check. With this PASS the file's header ("Held until the plan re-check passes") can be lifted.

## New reds

None. Read again for anything the section 4 change could break: the `sed` that takes the host still matches the `postgresql://role:password@host/db?…` string the CLI writes (the password is URL-encoded, so it holds no `@`); `${ORIGIN_HOST/-pooler/}` works in both zsh and bash; nothing outside section 4 changed.

## Note (recorded, not blocking)

- N14. If the owner's Neon account belongs to an organization, `neonctl projects list` can answer "org_id is required"; the CLI then asks "What organization would you like to use?" and "Would you like to use this organization by default?" (`projects-*.js`, `handleMissingOrgId` and `selectOrg`). Answering yes writes a `.neon` file in the RukenApp folder (`context.js` line 124), and `.gitignore` does not list `.neon`. Nothing breaks: `computes list` and `connection-string` still take `--project-id` and the branch id explicitly. A one-line hint ("if it asks which organization, pick the one with Ruken and answer No to saving it") would save the owner a surprise. Change only if section 4 is touched again.
