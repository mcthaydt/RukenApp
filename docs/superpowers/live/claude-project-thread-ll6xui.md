# Live state: claude/project-thread-ll6xui (RukenApp)

- Task: the private Worker's binding (private-move spec, unit for the binding): `env.production` in `wrangler.jsonc` with `PRIVATE`, the deploy names it, `/healthz/feed`. Lane 3 (deploy configuration). Merges only after `ruken-private` is live (RukenPrivate, same branch name).
- Last commit: 7061b22 2026-11-27 01:10 UTC
- Next step: open a draft PR; run the healthz journey; wait for ruken-private to deploy before asking for review.
- Open decisions: none. Blocked upstream: RukenPrivate's checks need a self-hosted RunPod runner (owner chose RunPod 00:55 UTC) and the Cloudflare key on RukenPrivate.
