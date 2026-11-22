#!/usr/bin/env bash
# Picks the commit the Deploy workflow ships: the tip of main, and only when its own CI run is green.
# Needs REPO, RUN_SHA (the commit of the CI run that woke this workflow) and GITHUB_OUTPUT; gh must be signed in.
# Writes deploy=true and sha=<commit>, or deploy=false (every later step skips on it).
set -euo pipefail

tip=$(gh api "repos/$REPO/commits/main" --jq .sha)

if [ "$tip" = "$RUN_SHA" ]; then
  echo "Deploying $tip: the tip of main, whose CI run just passed."
  printf 'deploy=true\nsha=%s\n' "$tip" >>"$GITHUB_OUTPUT"
  exit 0
fi

runs=$(gh api "repos/$REPO/actions/runs?head_sha=$tip&event=push")
# The newest attempt of the workflow named CI.
latest=$(jq -c '[.workflow_runs[] | select(.name == "CI")] | sort_by(.run_number, .run_attempt) | last // empty' <<<"$runs")

skip() {
  echo "Not deploying: $1 The newer commit's own run decides."
  echo 'deploy=false' >>"$GITHUB_OUTPUT"
  exit 0
}

if [ -z "$latest" ]; then skip "main moved on to $tip and it has no CI run yet."; fi
status=$(jq -r .status <<<"$latest")
conclusion=$(jq -r '.conclusion // ""' <<<"$latest")
url=$(jq -r .html_url <<<"$latest")
if [ "$status" != "completed" ]; then skip "main moved on to $tip and its CI run is still running ($url)."; fi
if [ "$conclusion" != "success" ]; then skip "main moved on to $tip and its CI run failed ($url)."; fi

echo "Deploying newer commit $tip: its CI run is green ($url)."
printf 'deploy=true\nsha=%s\n' "$tip" >>"$GITHUB_OUTPUT"
