# Implementation audit: branch T, the gate on one free address (Task 32)

Audited: pull request #125, merged to `main` as `517e853` (commits `30b01c4` red, `3bec8fa` green, `7a1d86c` main merged in, `7730bb3` tracker). Against: `docs/superpowers/plans/2026-11-15-slice-2-rest.md` (Task 32, O-B, the launch list) and its plan audit `docs/superpowers/audits/2026-11-15-slice-2-rest-plan-audit.md`.

What ran: no test, lint or typecheck (CLAUDE.md). Read: `git diff 09ec744 7730bb3` (all eleven files), the code around it on `main` (`gate.ts` whole, `addresses.ts`, `services.ts`, `sessions.ts`, `safe-path.ts`, `package.json`), branch M's `services.ts` (`origin/slice-2/submit`), and CI through the GitHub API: run 43707898531 (red, the `verify` job's log read case by case), runs 43708657112 and 43709449694 (green). `git diff 7730bb3 517e853` is empty, so run 43709449694 tested exactly the tree now on `main`. `main` has no push run of `517e853` (push runs have not run on `main` since run 43661647648); the pull request's run is the evidence.

## Verdict

**Task 32 is complete and correct. Nothing blocks.** Every interface the plan names is built as written, the red failed for the right reason, green is green on `verify`, `postgres` and `browser`, and both modes run the same two serving functions, so every header is the same. Two small fixes (I-1 in the plan, I-2 in a comment) are made in this audit's own pull request, at the coordinator's request, since neither changes behaviour. The tracker's row is corrected in this audit's own commit (I-3).

## What was checked, and holds

1. **`checkAddressPattern`.** `NAME_FIRST` is the old pattern unchanged; `NAME_IN_PATH` takes `http(s)://<domain>[:port]/{name}` and nothing else. `DOMAIN` has no `{`, so a second `{name}` cannot hide in it. The `http`-only-for-localhost rule reads `match[2]`, the host, in both forms. The refusal's words are the plan's, letter for letter. Every case in the plan's two `it.each` lists is in the test file, plus one the plan did not ask for ("names both forms in its refusal"), which failed at red for the right reason.
2. **`gameAddress` is untouched,** and both its callers work with the path form: `sessions.ts:83` makes `https://HOST/g-<id>/<pass>/`, which is path mode's `/g-<id>/<pass>/`; branch M's `media(key)` (`origin/slice-2/submit:src/features/games/services.ts:101`) makes `https://HOST/media/<key>`, which is path mode's `/media/<key>`. M does not touch `addresses.ts`, `gate.ts`, `cloudflare/` or `playwright.config.ts` (`git diff --name-only origin/main...origin/slice-2/submit`), so T's versions survive M's merge.
3. **The gate's path mode.** It answers only when `url.host === pathHost` (`URL.host` is lower case with its port; the Worker lower-cases and trims the setting). The health check and `robots.txt` answer before it, as the plan says. `/media/<key>` goes to `serveMedia` with the same strict `CLIP_KEY`/`PHOTO_KEY` check, so `/media/files/…` is 404. `/g-<id>/<rest>` goes to `serveGameFile` with `folder = /g-<id>`; the pass must name this game (`claims.game !== game` is 403); the redirect puts the folder back (`/g-<id>/<pass>/`). Anything else is "Not found.". The host form passes `url.pathname.slice(1)` and `""`, exactly what it did before, so nothing changes off the free address.
4. **Climbing out of a game's folder.** The path after the pass still goes through `normalizePath` (an encoded slash or backslash, `..`, `.` and empty segments are refused before anything is read), and the file is read from `files/<claims.game>/<claims.pull>/…`: the game in the key comes from the signed pass, never from the address. Plain `../..` is folded by the URL into another game's folder, where this pass is refused. Both are tested, with game `bbbbbbbbbb`'s file in the store so a climb that got through would find something.
5. **Another host that looks like the free address** (`other.test/g-<id>/<pass>/`, or `pathHost` unset) is 404: path mode is never on by accident.
6. **The Worker** reads `PATH_HOST?: string`, trims it, lower-cases it, and leaves `pathHost` out when it is unset or empty. `wrangler.jsonc` has `workers_dev: true`, `preview_urls: false`, and its comment says when it goes back to false. The launch list in the plan carries that undo (`PATH_HOST` removed, `workers_dev` false with its test).
7. **The journeys.** `playwright.config.ts` gives the gate `PATH_HOST: "localhost:8788"`, and the site's pattern stays the host form, as plan audit N-6 decided. The new journeys check a 403 with the run-out words and a 404 for an unknown media key; the sign-up journey checks that no cookie has a `Domain`.
8. **The red was the right red.** Run 43707898531: `verify` failed 14 of 1199, every one as the plan lists: the three "accepts", "names both forms", the eight gate cases (404 where path mode should answer, and the host form's `default-src 'none'` 404 headers in the headers case), and the two worker cases. Lint and typecheck passed. `postgres` passed. `browser` failed only "the free address gives nothing without a pass".
9. **Code rules.** No new dependency, no new import in the gate (still only `src/lib/files/*` and `./pass.ts`), no clock read outside the Worker's edge, no test in `src/`. Names are descriptive and the functions small. Test comments name "Review Focus" items, as about 90 other test comments in the repository do.
10. **No screen, no copy for a person.** The only new words are the setting's refusal, for whoever sets it up. The run-out and not-found lines a player could see are unchanged. No screen review is needed, as the plan says.
11. **The shared origin.** On the free address every game shares one origin: one game can read another's saved data, and `connect-src 'self'` and `cross-origin-resource-policy: same-origin` reach every game's folder. Reaching a file still needs a pass for that game, which only the site hands out, inside that game's own frame. The plan says so and the Owner chose one shared address until launch (decision card, 2026-11-15). Not a finding.

## Findings

### I-1 (should fix, the plan): O-B's last step does not prove the setting it just set

O-B step 6 is `curl -s https://GAMES-HOST/__ruken/health`, expecting `ok`. The health check answers before path mode, on every host, so it says `ok` even when `PATH_HOST` is wrong (say `https://ruken-games…` pasted with its scheme, or a typo). Then every game on the test site is "Not found." and the cause is first seen in Task 24. One more line proves path mode is on: a game folder with no pass answers the run-out words (403) when `PATH_HOST` matches, and "Not found." (404) when it does not:

`curl -s https://GAMES-HOST/g-aaaaaaaaaa/x/` (expect "This game's link has run out. Go back and press Play again.")

Fix: add it to O-B as step 7 in the plan (and to the Owner board's O-B card, when that card is made). The plan's Task 24 step 1 can name the same line. Docs only; no code. Stripping a pasted scheme in the Worker would also work, but it is more code for a one-time step; the check is the simpler fix.

### I-2 (small, a comment): `gate.ts` says cross-site cookie blocking protects the gate, and on the free address it does not

`src/features/play/gate.ts:13`: "It never sets a cookie and never reads one: browsers block cookies in a frame from another site anyway, and a game must not be able to tell a person from one." Since Task 32 the gate also answers on `ruken-games.ACCOUNT.workers.dev`, and `workers.dev` is a public suffix, so the site and the gate are the same site there (plan finding 1, plan audit S-5). A game's cookies in its frame are not blocked there. The rule itself (the gate never sets or reads a cookie) still holds and is what matters; only the reason given is untrue until the games domain exists. The same paragraph's "It runs as its own Worker on addresses of its own" still holds.

Fix: reword the reason, for example "…: on the games' domain a browser blocks cookies in a frame from another site anyway, and on the one free address the site and the games are one site, so the gate itself must never be the thing that tells a person from one." Comment only.

### I-3 (fixed in this audit's commit): the tracker's row for T was stale and one count was off

The row said "built, in CI on a draft pull request (#125…)", and #125 is merged. It also said four gate cases passed at red; five did: the plan's four plus "answers the health check and robots.txt as on any name", a case the build added beyond the plan (the health check and `robots.txt` answer on every host before and after). Both are corrected in `docs/superpowers/progress.md` with this audit.

## Notes (no action)

- **A game must ask for its files by relative address,** on either form. `/main.js` at the root is 403 on a game's own name (the pass is the first folder) and 404 on the free address. That is not new with Task 32 and is the same at launch, so it changes nothing; Task 24's game must use relative addresses, as any game on Ruken must.
- **The plan's other planned undo** (launch list): when the games domain comes, `GAME_ADDRESS_PATTERN` goes back to the host form; `checkAddressPattern` will still take the path form. Nothing needs to remove it then: with `PATH_HOST` unset no host answers in path mode, and the site would only make path-form addresses if the setting said so.
- **The plan audit's S-5** (a game can set a cookie for `ACCOUNT.workers.dev` that the site then receives, which matters for `rk_arrival` and `rk_welcome_back`) is unchanged by this build and stays on the launch list, as planned. The sign-up journey pins only that the site's own cookies have no `Domain`; it is not meant to cover S-5.

## Fixed

I-1 and I-2 are fixed in this audit's pull request: O-B gains step 7 and Task 24 step 1 names the same check, in `docs/superpowers/plans/2026-11-15-slice-2-rest.md`; the comment at the top of `src/features/play/gate.ts` is reworded. Neither changes behaviour, so no new test; the comment change runs through CI like any push.
