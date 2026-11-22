# Live state: claude/project-thread-1wvtua

- Task: unit P2 of docs/superpowers/specs/2026-11-22-private-feed-ranking-design.md (branch claude/project-thread-t02epm, plan PASS 05e6bfc): the seam. The feed asks a Ranker; an optional PRIVATE binding when present, the open (public) ranker otherwise; fallback on throw, >800 ms or bad shape; cursors p./o.; FEED_PUBLIC reader (learned, teenPersonal, windowDays) with safe defaults. Lane 2. Sonnet-tier spec execution (session runs Opus 5.5 medium).
- Last commit: 726fc664 (main, start) at 2026-11-22 20:48 UTC
- Next step: capture #329's pages as the old-versus-new yardstick, then build ranker.ts, public-ranker.ts, private-ranker.ts, feed-public.ts.
- Open decisions: none. Out of scope here (P4, lane 3): wrangler.jsonc env.production services, playwright FEED_PUBLIC, /healthz/feed.
