# https only: implementation audit, round 1

Pull request #310, commit examined: `5aad8f7`. Lane 2 (`src/hooks.server.ts`). Reviewer: fresh session, 2026-11-22 06:55 UTC.

**Verdict: PASS.** No red findings. Two notes, recorded as follow-ups.

## What ran

- `pnpm exec vitest run tests/features/accounts/https-only.test.ts`: 7 of 7 passed.
- `pnpm typecheck`: 0 errors. `pnpm lint`: clean.
- Not run: the built Worker under `wrangler dev`, and a real phone. The post-deploy `curl -sI http://ruken.io/sign-in` (expect `308`, `location: https://ruken.io/sign-in`) is the check of the real thing.

## The six points the coordinator asked about

1. **308 on POST.** Correct status: it keeps the method and body, and a 301/302 would turn the POST into a GET. Criterion 1 is met. See note N1 for what the browser then sees.
2. **HSTS without `includeSubDomains`.** Right for now. `max-age=31536000` alone pins only the host that sent it (ruken.io, or the workers.dev address), cannot break a subdomain that is not on https, and is undone by shortening max-age. No `preload`, so nothing is sent to browser lists.
3. **`/healthz` exemption.** Checked first, before `siteOrigin()` is read, so the probe answers on either scheme and still answers when `BETTER_AUTH_URL` is missing, as before. It gets no HSTS header, which does not matter.
4. **Scheme detection, redirect loops.** The redirect fires only when `event.url` is `http:` or `x-forwarded-proto` is exactly `http`. On Workers, `request.url` carries the visitor's own scheme, and the target is always `https://` on the same host, so a browser cannot loop. The cron knocks (`cloudflare/worker.js` `knock`) build their address from `BETTER_AUTH_URL` (https) and set no `x-forwarded-proto`, so the jobs are not redirected. Journeys and local runs use an http `BETTER_AUTH_URL`, so the hook does nothing there (unit test "changes nothing"). The only loop is a client that sends `x-forwarded-proto: http` over https itself, which harms only that client.
5. **wrangler dev proxy note.** Plausible and honest: it says the local proxy rewrote the `location` header and that a probe header showed the Worker's own answer, and that the probe was removed. It is a note about the verify run, not a product claim; the post-deploy curl settles it.
6. **Does the test prove the redirect?** For the hook itself, yes: it asserts the status, the exact `location` (path and query kept, host kept), that no page ran (`resolve` not called), HSTS on https answers, and nothing on an http site. The test file fails by itself on `main` (the module does not exist there). What it does not prove is that the hook is wired first in `hooks.server.ts`; that is one line, read here (`sequence(httpsOnly(...), databasePerRequest(), createHandle(...))`), and the post-deploy curl covers the real wiring.

## Notes (not blocking, follow-ups)

**N1.** UNIT: `src/features/accounts/https-only.ts` (the 308 comment) and the POST test's name. VERDICT: note. REQUIREMENT: Report honestly. REASON: the comment and test say a form posted over http "is posted again over https, not dropped", but SvelteKit's origin check then refuses it. EVIDENCE: the browser re-POSTs to `https://ruken.io/sign-in` with `Origin: http://ruken.io` (the page's origin); `node_modules/@sveltejs/kit/src/runtime/server/respond.js:116-132` compares that with the site's own origin `https://ruken.io` and answers `403 Cross-site POST form submissions are forbidden`. This only reaches someone who had the sign-in page open over http before the deploy; after it, the GET redirect means forms are served over https. Still better than before (no cookie, no message). EXPECTED: the words match what happens, or the person lands on the https sign-in form. FIX (either): reword the comment and test name to say the POST is refused and the person signs in again over https; or answer a non-GET/HEAD http request with `303` to the same https address, so the person sees the https sign-in form instead of a plain-text 403. Files: `src/features/accounts/https-only.ts`, `tests/features/accounts/https-only.test.ts`.

**N2.** UNIT: deploy check. VERDICT: note. REASON: no journey can catch this bug (journeys run on http), as the PR body says. FIX: the post-deploy smoke check the owner already asked for (project memory, 2026-11-22 06:30 UTC) should include `curl -sI http://ruken.io/sign-in` expecting `308` to https. Separate work; not this PR.

## CRUD

The change adds nothing a user can make. No CRUD journey applies.
