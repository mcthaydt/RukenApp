a83679f PASS

# Plan audit: a video's address needs a pass (cycle 1)

- Spec: `docs/superpowers/specs/2026-11-21-video-addresses-need-a-pass-design.md` on `claude/project-thread-8400fx`, commit a83679f (the branch head 4e2d60f only adds the live-state file).
- Lane 3 plan audit, read only. Graphify has RukenApp indexed; callers were also checked by text search at a83679f.
- Result: no red findings. Five notes, none blocking. Nothing in the plan needs the owner: no product choice, no new access, no money, no scope change. The deploy after the merge is the owner's usual step.

## What was checked, with evidence

**The plan closes the gap for 18+ games.** Every place a video address is built goes through `GamesServices.media` (`src/features/games/services.ts:125`). Callers at a83679f: the game page (`src/routes/g/[game]/+page.server.ts:64`, `:80`), the price card's backdrop (`src/routes/join/+page.server.ts:42`), the feed (`src/features/feed/service.ts:62-63`), the maker page (`src/routes/[handle=handle]/+page.server.ts:43`), the maker's own screens (`src/routes/make/...`), and the staff review job (`src/routes/jobs/review/+server.ts:85-95`). The 18+ filters on those routes hold. The game page refuses first (`+page.server.ts:33`), and "More from" filters at `:57-58`. The join backdrop asks `adultsOnlyRefusal` (`join/+page.server.ts:41`). The feed and the maker page drop `age_18` (`feed/service.ts:41`, `[handle=handle]/+page.server.ts:25`). The make routes are the maker's own, and the review job sits behind JOBS_SECRET. So signing in `media()` covers every address, and a person refused an 18+ game never gets that game's pass. The gate refuses before it reads the bucket (step 2, criterion 2), so a bare or old address gets nothing.

**Forgery and mix-ups.** The pass is HMAC-SHA256 over `ruken-media-pass-v1:<key>\n<expiry>`. The play pass's mac is over `ruken-play-pass-v1:<payload>` (`src/features/play/pass.ts:39,51`). The prefixes differ, so one kind of pass can never stand in for the other, even with the same secret. The key is inside the mac, so a pass cannot move to another video. The expiry is inside the mac, so it cannot be stretched. The compare is constant-time. Criterion 1 covers each of these, including 1,000 random strings that must not throw.

**Replay and sharing.** Within its 12 to 24 hours a pass plays for anyone who has the address. The spec says so ("What a pass does not do") and matches the play pass's limit. That is accepted, not a gap.

**Videos for everyone still play signed out.** The feed, maker page and game page sign every clip key, whatever the rating. Criterion 6 proves it in a journey (readyState >= 2 signed out, and the bare address gives 403).

**Cache headers.** A video gets `private, max-age=<seconds left>`, the same pattern `serveGameFile` already uses (`gate.ts:160-161`), so a browser never keeps a video past its address. Photos keep `public, max-age=31536000, immutable`. The spec says Cloudflare's edge keeps no copies. That holds: `gate.ts` has no `caches` and no outgoing `fetch`, and the site sets no `cache-control` anywhere in `src/`, `cloudflare/` or `hooks.server.ts`. So no page carrying a pass is shared through a cache either. Every visitor in one window gets the same address (`mediaPassExpiry` depends only on time), so browser caching still works within a window.

**Key rotation.** The pass reuses PLAY_PASS_SECRET, which both Workers already hold (`cloudflare/games/worker.ts:13,29`; `src/features/play/services.ts:25`). Rotating it ends every video address together with every play pass, and the next page load heals both. No new secret is needed (see note N4).

**Deploy order.** Site first, then the gate, is right. The old gate ignores `?pass=`, so the new site works with it, while a new gate in front of the old site would refuse every video. Both scripts exist (`package.json:16-17`). The gate's route is given on the command line (`cloudflare/games/wrangler.jsonc:9-11`), as the spec says.

**Builds and layering.** Both Workers run with `nodejs_compat` (`wrangler.jsonc:11`, `cloudflare/games/wrangler.jsonc:8`), so `node:crypto` bundles into the gate, as `pass.ts` already does. `tests/architecture.test.ts` forbids `node:` only for files a `*.browser.ts` entry reaches (`:140-155`), and only server files import `media-pass.ts`. `src/lib/` imports no feature (`:94`). The test settings already carry PLAY_PASS_SECRET for the site and the gate (`playwright.config.ts:100,130`, `.env.example:58`). The only other caller of `createGamesServices` is `tests/features/games/services.test.ts`, which criterion 3 already changes.

**CRUD (owner rule).** The thing a user makes here is a game's video. Create (upload), read (page and maker screens), update (replace, and keep the old one) and delete (remove, take off, account deletion) are each covered by journeys that exist at a83679f: `make-game-crud`, `make-live-changes`, `make-questions`, `maker-page`, `join`, `review-job`. Criterion 7 and plan step 5 rerun them with their assertions unchanged. Nothing new that a user makes is added.

**Plan shape.** There is one unit, and the files it owns match the How section. It is test first, starting with a journey that fails on today's code (criterion 4). Every changed existing test must be named in the PR body (criteria 2 and 7). There is no migration (the edit to `games.prisma` is a comment only), and no new dependency, secret or setting.

## Notes (not blocking; for the implementer to take or leave)

**N1.** UNIT: criterion 9 / its unit test. VERDICT: note. REQUIREMENT: criterion 9, "fails if either contains … a call to `fetch(`". REASON: `cloudflare/games/worker.ts:24` defines the Worker's own handler, `fetch(request: Request, env: Env)`. A naive `/fetch\(/` match fails on a correct tree. EVIDENCE: `grep -n "fetch(" cloudflare/games/worker.ts` gives line 24. EXPECTED: the check catches an outgoing fetch, not the handler. FIX: in `tests/...` (the new check only), match an outgoing call such as `/(?<![\w.])fetch\((?!request: Request)/` or `/\bawait fetch\(|globalThis\.fetch|caches\./`, and say in the test why the handler is allowed.

**N2.** UNIT: spec, "What a pass does not do". VERDICT: note. REQUIREMENT: completeness of the stated limits. REASON: when a live game's rating rises to 18+, addresses handed out under the old rating keep playing until their pass runs out, at most 24 hours. EVIDENCE: the pass is bound to the key and the time only, and a rating change does not change the key. EXPECTED: the limit is written down beside the sharing limit. FIX: one sentence in the spec or the PR body. No code.

**N3.** UNIT: `tests/browser/make-questions.test.ts:598,603` and any journey that saves one address and compares it with one rendered later. VERDICT: note. REQUIREMENT: CLAUDE.md, "a test that fails once and passes on retry is a defect". REASON: journeys use the real clock, and if 00:00 or 12:00 UTC falls between the two reads the pass changes. An exact match then fails once and passes on retry. EVIDENCE: `toHaveAttribute("src", second ?? "")` at `:603` compares a full address. EXPECTED: such comparisons ignore the query. FIX: inside the criterion 7 edits, compare the address without `?pass=…` (the path is unique per upload), and name each one in the PR body as criterion 7 already asks.

**N4.** UNIT: spec, deploy section. VERDICT: note. REQUIREMENT: completeness. REASON: rotating PLAY_PASS_SECRET now ends video addresses as well as play passes. Between the two `wrangler secret put` calls (site and gate), videos are refused. EVIDENCE: one secret, two Workers. EXPECTED: whoever rotates knows that videos fail for that short time. FIX: one line in the spec or the PR body. No code.

**N5.** UNIT: `tests/features/games/services.test.ts:39-40`. VERDICT: note. REQUIREMENT: criterion 3. REASON: the existing test calls `media("clips/x/wide-1.mp4")`, which is not a valid clip key (`isClipKey` is false). After the change it gets no pass, and the test still passes while no longer testing a clip. EVIDENCE: the `CLIP_KEY` regex at `src/features/games/clips.ts:22`. EXPECTED: the clip case uses a real key shape, and the non-clip case uses a photo key. FIX: change the keys in that test only, as part of criterion 3.

## Owner

Nothing to ask. Lane 3 merge rests on the implementation audit plus the owner's recorded standing merge permission (progress.md History, 2026-11-21 19:16 UTC). Until the owner runs `pnpm run deploy && pnpm run deploy:games --route …` after the merge, the gap stays open on the live site. The implementation report should say so.
