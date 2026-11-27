# Implementation audit: the deploy's live check asks /healthz/feed (#411), round 1

Reviewed commit: `d7cada9` (head of `claude/project-thread-ll6xui-live`), against `main` at `89caede`.
Lane 3 (`.github/scripts/live-check.sh`). Reviewer: Opus 5.5, medium. Written 2026-11-27 04:52 UTC.

Verdict: **PASS**. No red findings. Two notes, kept apart.

## Checks run

| Check | Result |
| --- | --- |
| `pnpm exec vitest run tests/live-check.test.ts` at `d7cada9` | 12 passed |
| Same file with `main`'s `live-check.sh` (the check fails by itself) | the 2 new cases fail, 10 pass |
| `pnpm exec vitest run tests/deploy-workflow.test.ts` (L3) | 21 passed |
| `pnpm lint`, `pnpm typecheck` | both exit 0 |
| `curl https://ruken.io/healthz/feed`, 6 tries (L2) | 6 of 6: 200, `{"ranker":"private","health":"defaults"}`, `cache-control: no-store`, no `cf-cache-status`, 0.51 to 1.00 s |
| PR checks at `d7cada9` | 14 check runs, all success or skipped |

## Criteria

- L1: met. Non-200 gives `/healthz/feed should answer 200, got N`; any body without `"ranker":"private"` gives `/healthz/feed should say the private ranker answers, got <first 200 bytes>`. Both tested.
- L2: met (live probe above; the test's default stand-in uses the same body).
- L3: met (both files pass; the old cases are unchanged apart from the stand-in learning `/healthz/feed`).

## What was looked at

- **Timeouts.** `fetch` uses `curl --max-time $CURL_MAX_TIME` (10 s) and maps any curl error to status `000`, which fails the step with a reason. `until_ok` retries every 5 s within `WAIT_SECONDS` (60 s), so the step's worst case is about 75 s. The endpoint's own wait on the private Worker is `PRIVATE_WAIT_MS` = 800 ms (`src/features/feed/service.ts:24`), far under curl's 10 s, so a slow Worker shows as `"ranker":"open"` rather than a curl timeout.
- **Caching.** The route answers `cache-control: no-store` (`src/routes/healthz/feed/+server.ts`), live headers confirm it and show no edge cache status. curl keeps nothing between tries. A stale private answer cannot be served.
- **JSON matching.** The body is `Response.json(...)`, which is `JSON.stringify` with no spaces, so `"ranker":"private"` is the exact text; `ranker` is only ever `"private"` or `"open"` (`FeedHealth`). The body file is rewritten by each `fetch`, so the home page's body cannot leak into this match. A false pass would need some other 200 page at that path to contain that exact text; none does.
- **Order.** The step runs after `version_is_live` (new version at 100%) and `home_is_up`, so it judges the new version.
- **Fallback.** `health()` answers `"ranker":"open"` when the binding is missing, the Worker throws, is slower than 800 ms, or gives a bad answer (`service.ts:129-139`). The step then retries for 60 s and fails the deploy. A brief blip (one try) does not fail it; an outage longer than the wait does. That is the purpose of the step (the PR body: the fallback is silent otherwise).

## Notes (not blocking, not fixed here)

- N1. UNIT: `.github/workflows/deploy.yml` rollback hint. VERDICT: note. REASON: when `feed_is_private` fails because the private Worker itself is down (not the new site version), the deploy's failure step still says "run: pnpm exec wrangler rollback", which would not help; the `::error::` reason line above it does name `/healthz/feed`. EXPECTED: a reader can tell a private-Worker outage from a bad site version. FIX (if wanted, lane 3): a word in the rollback hint, or in the step's reason, that the private Worker deploys from RukenPrivate. Files: `.github/workflows/deploy.yml` or `.github/scripts/live-check.sh`.
- N2. UNIT: deploy order. VERDICT: note. REASON: a failed live check skips the games Worker deploy, so a private Worker outage at deploy time also holds back a new games Worker. That follows the existing rule ("a site that failed never ships a new gate") and looks intended; recorded so it is a known effect.
