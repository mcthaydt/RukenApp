# Workflow setup (#240): implementation audit, cycle 2

**af7ec29 PASS**

Re-check of the five red findings from cycle 1 (`2026-11-20-workflow-setup-1-implementation-audit.md`, at `6ffd4a4`), on commit `af7ec29`.

- R1 fixed: `mergeGreen.statuses` is `[]`; `--check` reports "mergeGreen off". The hook on `gh pr merge 240 --merge` now refuses only for the missing passing review, not for a status.
- R2 fixed: `progress.md` Remaining has the one-line pull request that turns `ruleMix.firstTimeSetup` off right after the merge.
- R3 fixed: `owner-steps/cloud-setup-script.sh` is identical to `node .claude/hooks/rules.mjs --print-setup`, and step 4 of the owner's batch tells the owner to paste it into the cloud environment's setup script.
- R4 fixed: `this-repo` and owner step 2 say `pnpm run deploy`.
- R5 fixed: `this-repo` and `history.md` record branch protection as missing until owner step 1.
- Notes N1 and N2 addressed in `history.md` and the pull request body; N3 recorded.
- `node .claude/hooks/rules.mjs --check`: no blanks. `commit-authors` passed on `af7ec29`; the quick draft run was still running when this audit was written, and the full run follows the ready mark.

## Note (not blocking)

- `this-repo`, "Outside the repo": the edited sentence reads "the owner runs `pnpm run deploy` (and `pnpm run deploy:games`; a bare `pnpm deploy` is pnpm's own deploy command, not this script) for the games Worker)." The brackets no longer pair and "for the games Worker" now hangs off the wrong part. Suggested: "the owner runs `pnpm run deploy`, and `pnpm run deploy:games` for the games Worker. A bare `pnpm deploy` is pnpm's own command, not this script." Lane 1, fine in a later docs change.
