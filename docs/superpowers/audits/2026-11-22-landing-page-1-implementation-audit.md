# Landing page, implementation audit 1

Reviewed: `3603d00` on `claude/project-thread-2vpwcj` (the whole diff against `main` at the merge base: 13 files, +767). Lane 2 fresh review, 2026-11-22 15:10 UTC. Brief: the owner's three messages, `docs/superpowers/specs/2026-11-22-landing-page-design.md` and the pull request body draft (`pr-drafts/landing-page-pr-body.md`).

**Verdict: FAIL, 2 red.** Both are one-line word changes in `src/routes/about/sections.ts`. Everything else passes.

## Red findings

### R1. The page tells a stranger that tapping Play puts them in the game

- UNIT: `src/routes/about/sections.ts`, `HERO.lines[0]` and the players card's second point.
- VERDICT: red.
- REQUIREMENT: the spec, "Every word is a fact the product or the maker agreement already states"; `this-repo`, "nothing on it promises what is not built".
- REASON: the page is written for someone who is not a member yet, and for them Play on almost every game leads to the price card, not into the game.
- EVIDENCE: hero, "See one you like? Tap Play, and you're in the game."; players card, right under "Watching is free. You don't need an account.": "Tap Play and the game starts in your browser." But `src/routes/g/[game]/play/+page.server.ts:35` sends a non-member to `/join` unless the game is free, and the game page itself says "Members play every game." (`src/routes/g/[game]/+page.svelte:117`).
- EXPECTED: the lines say members play, as the game page and the steps section ("Members play every game.") already do.
- FIX: in `sections.ts` only, for example hero "See one you like? Members tap Play, and they're in the game." and players point "Members tap Play and the game starts in the browser. Nothing to install." Add one line to `tests/browser/about.test.ts` only if the builder wants the words pinned; not required.

### R2. "On one form" is not how a game is sent

- UNIT: `src/routes/about/sections.ts`, the makers card's first point.
- VERDICT: red.
- REQUIREMENT: as R1.
- REASON: sending a game is six questions, one per screen, then the agreement.
- EVIDENCE: "Send your game from GitHub, on one form." against `src/routes/make/new/+page.svelte` (`counter={{ n: 1, of: 6 }}`, "Question 1 of a game that does not exist yet").
- EXPECTED: words that match the flow.
- FIX: `sections.ts` only, for example "Send your game from GitHub in six short questions. A step-by-step guide shows you how."

## What passed, with evidence

- **No Lyft or YC material.** `git diff` of `src/` and `tests/` names Lyft once, in a code comment in `+page.svelte` (the source of the order); no YC or Combinator word, no image, font or logo file in the diff. All words are Ruken's own; no Lyft headline or line is reused.
- **Claims against the product.** Checked each other line against the maker agreement v2 (`src/features/make/library/maker-agreement-v2.txt`) and the code: the pay split and the bring-a-fan 12 months (point 5), statements on the 10th and paid on the 15th (point 6), a person checks every game and says why (point 3), 13 and up, 18+ adults only, no pornography or gambling (point 3), take it off any time (point 1), two videos (`review.ts:156`), cancel from your account (`/me` "Change card or cancel"), no trial (`plans.ts`), watching the feed needs no account (`/` has no sign-in redirect), a game never sees your sign-in (the gate runs on its own Worker and address and never reads a cookie, `src/features/play/gate.ts:7-15`). The price is read from `PREMIUM_PRICES_CENTS`, not typed. No social proof, so nothing invented.
- **The three links (plus Help).** `/join` (inside the join card branch, after "Not now"), `/sign-in`, `/me`, and `/help` each carry "What is Ruken?" to `/about`. `/join` is the paywall: Play sends a non-member there.
- **Feed stays at `/`.** `src/routes/+page.svelte` untouched.
- **Screen rules.** No `<style>` block; styles are in `look.css` under `.about`; the new class names (`phone`, `pair`, `links`, `plain`, `steps`, `perks`, `ways`, `news`, `forwhom`, `sitefoot`) collide with no existing selector or class elsewhere (grep of `look.css` and every `.svelte`). No `backdrop-filter` or see-through surface. One blue button (the hero's); every other button is `outline`.
- **Loading signs.** The clip has `use:loads` and `use:quietVideo` (no autoplay for reduced motion, Save-Data or small memory). `tests/loading-states.test.ts` and `tests/lib/look.test.ts` pass: 143 of 143, run here.
- **44px targets and no sideways scroll.** Measured in the journey over every `main.about a`.
- **E2E.** `tests/browser/about.test.ts`: reads the page in order, follows `/join`, `/sign-in`, `/me` and `/help` in, the hero button to `/`, "For makers" to `#makers`, keyboard to the blue button. Run here on computer and tablet together with `join` and `sign-in`: 52 of 52 passed in 1.3 min (local Postgres 16, `--trace off`). Phone (WebKit) not run here; CI runs it. CRUD: the page makes nothing a person can save, so none applies.
- **Lane.** Lane 2 is right: `src/lib/look.css` is in the lane 2 list; the `this-repo` edit takes the lane of the code it goes with and is named in the body; nothing in `src/features/money/`, `src/features/membership/` (only imported, not changed), `prisma/`, `.github/` or `cloudflare/`. The rule text does not change what needs the owner.
- **Rule-mix hook.** It does not need a split. `ruleMix.rulePaths` in `.claude/hooks/rules.json` lists `CLAUDE.md`, the shared skills and `.github/workflows/**`; `.claude/skills/this-repo/**` is not among them and `.claude/**` is a doc path, so `this-repo` may travel with code. The branch's own push already went through the hook.

## Notes (not blocking, not fixed here)

- N1. The owner's app-feel rules (no selecting the whole panel, no pinch zoom) and the frosted-glass rule are not on `main` yet, so they could not be checked against this page. When they merge, `/about` should get the same look and selection rules as the other screens; whoever merges second re-checks.
- N2. The screens page was shot at `7b949bb`, before the merge with `main` and the one-line colour fix at `3603d00`. The fix only sets the clip frame's background colour, so a reshoot is not needed for this audit; R1 and R2 change words only.
- N3. CI has not run on this branch (no pull request yet, 6 open); "CI green" stays unticked.
