#!/usr/bin/env bash
# Looks at the live games Worker after it is deployed and fails with ::error:: and the reason on the first miss.
# Needs VERSION_ID (from the games deploy), CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. The rest has live
# defaults and is set only by the test.
# The gate keeps nothing about a visitor, so what Cloudflare holds for it is read from the API (never from the
# config file in the repo): "off" has to be seen, not assumed. Each check is tried every INTERVAL seconds for up to
# WAIT_SECONDS, because new settings take a moment to reach the API; a wrong answer that stays wrong still fails.
set -euo pipefail

WORKER_NAME=${WORKER_NAME:-ruken-games}
API_URL=${API_URL:-https://api.cloudflare.com/client/v4}
WRANGLER_CMD=${WRANGLER_CMD:-pnpm exec wrangler}
WAIT_SECONDS=${WAIT_SECONDS:-60}
INTERVAL=${INTERVAL:-5}
CURL_MAX_TIME=${CURL_MAX_TIME:-10}

if [ -z "${VERSION_ID:-}" ]; then
  echo "::error::Games check failed: no version id from the games deploy"
  exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# until_ok <function>: runs it until it succeeds or the wait is over; the last reason is in $reason.
until_ok() {
  local deadline=$((SECONDS + WAIT_SECONDS))
  while true; do
    if "$1"; then return 0; fi
    [ "$SECONDS" -ge "$deadline" ] && return 1
    sleep "$INTERVAL"
  done
}

version_is_live() {
  local out
  out=$($WRANGLER_CMD deployments status --name "$WORKER_NAME" 2>&1) || { reason="wrangler could not read the games deployment: $(head -c 200 <<<"$out")"; return 1; }
  if grep -E '100%' <<<"$out" | grep -qF "$VERSION_ID"; then return 0; fi
  reason="games version $VERSION_ID is not at 100% in the deployment status"
  return 1
}

keeps_nothing() {
  local status
  # The token goes in a header file, so it is never on a command line.
  printf 'Authorization: Bearer %s\n' "$CLOUDFLARE_API_TOKEN" >"$work/auth"
  status=$(curl -s --max-time "$CURL_MAX_TIME" -H "@$work/auth" -o "$work/body" -w '%{http_code}' \
    "$API_URL/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$WORKER_NAME/script-settings" 2>/dev/null) || status=000
  if [ "$status" != "200" ]; then reason="could not read the games Worker settings: Cloudflare answered $status"; return 1; fi
  if ! jq -e '.success == true' "$work/body" >/dev/null 2>&1; then
    reason="could not read the games Worker settings: Cloudflare did not say success"
    return 1
  fi
  if ! jq -e '.result.observability.enabled | type == "boolean"' "$work/body" >/dev/null 2>&1; then
    reason="the games Worker's observability setting is missing, so logs off cannot be seen"
    return 1
  fi
  if jq -e '.result.observability.enabled == true' "$work/body" >/dev/null; then reason="the games Worker has observability on"; return 1; fi
  if jq -e '.result.observability.logs.enabled == true' "$work/body" >/dev/null; then reason="the games Worker has logs on"; return 1; fi
  if jq -e '.result.observability.traces.enabled == true' "$work/body" >/dev/null; then reason="the games Worker has traces on"; return 1; fi
  if jq -e '.result.logpush == true' "$work/body" >/dev/null; then reason="the games Worker has logpush on"; return 1; fi
  if jq -e '(.result.tail_consumers // []) | length > 0' "$work/body" >/dev/null; then reason="the games Worker has a tail consumer attached"; return 1; fi
}

for step in version_is_live keeps_nothing; do
  reason=""
  if ! until_ok "$step"; then
    echo "::error::Games check failed: $reason"
    exit 1
  fi
  echo "ok: $step"
done
echo "Games check passed."
