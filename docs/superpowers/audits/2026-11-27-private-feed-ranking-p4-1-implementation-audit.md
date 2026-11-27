# Implementation audit: private feed ranking, P4 (the binding), cycle 1

- Pull request: #403, `claude/project-thread-ll6xui`
- Commit examined: `262befc3495b0dbe39f7453045b4e69cf37c2a6e` (base `main` at `c7d3ad6`)
- Lane: 3 (deploy configuration: `wrangler.jsonc`, `package.json`)
- Brief: the pull request's acceptance criteria, and P4, C6, C9 and C16 of `docs/superpowers/specs/2026-11-22-private-feed-ranking-design.md`
- Private side read for the contract: RukenPrivate `main` at `4aa7d24` (`worker/src/index.ts`, `worker/wrangler.jsonc`)

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**PASS.** No red findings. Three notes, none blocking.

## What was checked, and what it showed

| # | Property | How | Result |
| - | -------- | --- | ------ |
| 1 | The feed falls back to the open order when the binding fails or is slow | Read `src/features/feed/service.ts` at the head: `page()` sends a throw, an answer slower than `PRIVATE_WAIT_MS` (800 ms) or an answer failing `isRankedPageOrBadCursor` to `open.page()`, with one log line naming only the reason. The `within()` refactor keeps the same timer, race and `finally` clear. `health()` falls back the same way. | PASS |
| 2 | Tests cover the fallback | `tests/features/feed/ranker.test.ts`: the page fallback suite from #361 ("when the private ranker does not answer, the open one does") still passes; the new suite covers health with no binding, each good answer, a throw, nonsense and slow (fake timers). `pnpm exec vitest run tests/features/feed tests/wrangler.test.ts`: 8 files, 108 tests passed. | PASS |
| 3 | No viewer identity reaches the ranker without cookie consent | `src/features/feed/services.ts` still passes `consented: false` to `askingFor`, so every request is `crowd` (seed only) whatever `FEED_PUBLIC` says; `askingFor` in `feed-public.ts` returns `CROWD` unless consented. The diff does not touch either. `health()` and `/healthz/feed` send nothing about the viewer: the RPC call takes no arguments. | PASS |
| 4 | No private logic in the public repo | Read the whole diff (8 files, +151 −9): it adds the binding, the deploy flag, a health pass-through, a route and tests. No weights, thresholds, settings or ranking code. The route answers only `ranker` and one of three health words, which spec section 3 lists as public. | PASS |
| 5 | `wrangler.jsonc` binds correctly | `wrangler deploy cloudflare/worker.js --env production --dry-run` (after `pnpm build`) lists `HYPERDRIVE`, `GAME_FILES`, `PRIVATE (ruken-private)`, `MEDIA`, `ASSETS`. The same with no `--env` lists `HYPERDRIVE`, `GAME_FILES`, `MEDIA`, `ASSETS` and no `PRIVATE`. Wrangler's own reader (`unstable_readConfig`) for both shows the same `name` (`ruken`, so the same Worker and its secrets), `main`, compatibility date and flags, `workers_dev: true`, `preview_urls: false`, both crons, `observability.enabled: false` and `assets`; only `services` differs. The binding's service name matches RukenPrivate's `worker/wrangler.jsonc` `name`, and `env.PRIVATE.feed.page/notes/health` matches its `WorkerEntrypoint` `feed` getter returning an `RpcTarget` with those three methods. | PASS |
| 6 | The deploy uses the environment | `package.json` `deploy` adds `--env production`; `.github/workflows/deploy.yml` runs `pnpm run deploy`, so it picks it up. `live-check.sh` (`deployments status`) and the printed `wrangler rollback` read the top-level name `ruken`, the same Worker, so they still point at the right one. `tests/wrangler.test.ts` checks the deploy script. | PASS |
| 7 | `tests/wrangler.test.ts` fails if the top level gains `services` or a repeated binding drifts | The new test asserts no top-level `services`, `production.name === "ruken"`, `production.services` exactly `PRIVATE → ruken-private`, and that `hyperdrive`, `r2_buckets`, `media`, `kv_namespaces`, `d1_databases`, `vars`, `queues` equal the top level. | PASS |
| 8 | `/healthz/feed` exists | `src/routes/healthz/feed/+server.ts` answers `service.health()` as JSON with `cache-control: no-store`. `tests/browser/healthz.test.ts` expects `{"ranker":"open","health":"defaults"}` and `no-store` in the journeys (no binding). | PASS (journey in CI, see below) |
| 9 | C6: no fallback line when the binding is absent | The no-binding health test asserts `lines` is empty; `page()` with `privateRanker() === null` goes to the open order without logging. | PASS |
| 10 | Lint and typecheck | `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 0 warnings. | PASS |
| 11 | The pull request body | Starts with the attribution lines, has `## Lane` and `## Acceptance criteria`, names the changed tests, ends with "Requested by **McThayDT**". The `pr-rules-run` check is green. | PASS |

Not run here: `pnpm test:browser` and `pnpm test:pg` (CI runs them on this head; postgres and verify were green, browser shards still running when this was written). Not checkable before merge: the PR's fourth criterion and spec C9 (the live site's `/healthz/feed` answering `"ranker":"private"`, and the p50 of 20 feed loads under 300 ms). Those are measured on the live site after the deploy, and the merge does not wait on them.

## Notes (not blocking, not fixed here)

- UNIT: `.github/scripts/live-check.sh`. VERDICT: note. REQUIREMENT: spec C9 and section 6 ("`/healthz/feed` answering `defaults` on the live site is how a check sees it"). REASON: the deploy's live check does not read `/healthz/feed`, so a deploy whose binding answers nothing passes silently and the C9 check stays a one-time manual measurement. EVIDENCE: `live-check.sh` reads only `deployments status` and the site's pages. EXPECTED: a later unit may have the live check fetch `/healthz/feed` and warn on `"ranker":"open"`. FIX: lane 3 (`.github/`), its own pull request if the coordinator wants it.
- UNIT: `src/routes/healthz/feed/+server.ts`. VERDICT: note. REQUIREMENT: none broken. REASON: the route is public and uncached, and each hit makes one RPC call to `ruken-private` (service bindings cost nothing extra, but each call is CPU on both Workers). EVIDENCE: `cache-control: no-store`, no rate limit. EXPECTED: fine at today's traffic. FIX: none now.
- UNIT: `tests/features/feed/ranker.test.ts`. VERDICT: note. REASON: there is no test that the real `cloudflarePrivateFeed` shape (an RPC stub's `feed` property) is what `createFeedService` calls; RukenPrivate's `worker/tests/rpc.test.ts` covers the other side with the same `env.PRIVATE.feed.<method>` calls, so together they cover it. FIX: none.
