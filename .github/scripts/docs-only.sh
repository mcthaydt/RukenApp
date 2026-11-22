#!/usr/bin/env bash
# Prints docs_only=true when this pull request changes only .md files, otherwise docs_only=false.
# A push to main, an empty diff or any error answers false: a doubt never skips a test.
# The gate's own answer is the one that counts (release, Docs only); other jobs ask only to save work.
set -u
docs_only=false
if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ]; then
  # --no-renames lists both the old and the new name, so moving a code file to a .md name still counts.
  if files=$(git diff --name-only --no-renames origin/main...HEAD); then
    printf '%s\n' "$files" >&2
    if [ -n "$files" ] && ! printf '%s\n' "$files" | grep -qvE '\.md$'; then
      docs_only=true
    fi
  fi
fi
echo "Only .md files changed: $docs_only" >&2
echo "docs_only=$docs_only"
