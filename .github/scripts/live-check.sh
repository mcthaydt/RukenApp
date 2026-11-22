#!/usr/bin/env bash
# Looks at the live site after a deploy and fails with ::error:: and the reason on the first miss.
# Needs VERSION_ID (from the deploy). The rest has live defaults and is set only by the test.
# Each check is tried every INTERVAL seconds for up to WAIT_SECONDS: that waits for a new version to reach every
# Cloudflare location, and is not a retry of a wrong answer, which still fails once the wait is over.
set -uo pipefail

SITE_URL=${SITE_URL:-https://ruken.io}
HTTP_URL=${HTTP_URL:-http://ruken.io/sign-in}
EXPECTED_LOCATION=${EXPECTED_LOCATION:-https://ruken.io/sign-in}
WRANGLER_CMD=${WRANGLER_CMD:-pnpm exec wrangler}
WAIT_SECONDS=${WAIT_SECONDS:-60}
INTERVAL=${INTERVAL:-5}
CURL_MAX_TIME=${CURL_MAX_TIME:-10}

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

fetch() { # url -> status in $status, headers in $work/h, body in $work/b
  status=$(curl -s --max-time "$CURL_MAX_TIME" -o "$work/b" -D "$work/h" -w '%{http_code}' "$1" 2>/dev/null) || status=000
}

version_is_live() {
  local out
  out=$($WRANGLER_CMD deployments status 2>&1) || { reason="wrangler could not read the deployment: $(head -c 200 <<<"$out")"; return 1; }
  if grep -E '100%' <<<"$out" | grep -qF "$VERSION_ID"; then return 0; fi
  reason="version $VERSION_ID is not at 100% in the deployment status"
  return 1
}

home_is_up() {
  fetch "$SITE_URL/"
  if [ "$status" != "200" ]; then reason="the home page should answer 200, got $status"; return 1; fi
  if ! grep -q '<title>Ruken' "$work/b"; then reason="the home page has no <title>Ruken"; return 1; fi
}

http_redirects() {
  fetch "$HTTP_URL"
  if [ "$status" != "308" ]; then reason="http sign-in should answer 308, got $status"; return 1; fi
  local location
  location=$(tr -d '\r' <"$work/h" | awk 'tolower($1)=="location:" {print $2}')
  if [ "$location" != "$EXPECTED_LOCATION" ]; then reason="http sign-in location should be $EXPECTED_LOCATION, got ${location:-nothing}"; return 1; fi
}

for step in version_is_live home_is_up http_redirects; do
  reason=""
  if until_ok "$step"; then
    echo "ok: $step"
  else
    echo "::error::Live check failed: $reason"
    exit 1
  fi
done
echo "Live check passed."
