# The feed's ranking goes private

Date: 2026-11-22. Status: spec and plan in one, for plan audit 1. Written against `main` at `eb655ac`, with the infinite feed (#329, head `5da37ae`) read but not yet merged. Lane: this document is lane 1; the work it plans is lane 3 (a new Worker, a CI workflow and a credential in RukenPrivate; `wrangler.jsonc` and `src/lib/` in RukenApp are lane 2).

Read with `CLAUDE.md`, `build`, `this-repo`, `release` and the learned feed spec (`2026-11-22-learned-feed-design.md`, called **the learned spec** below, with its section and unit names). If the repo is indexed in Graphify, use it to find callers and tests before changing a file.

## 0. Direction

- **Owner, 2026-11-22 20:22 UTC:** "I'm thinking we should perhaps make the algorithm private sourced". The coordinator proposed moving the ranking code into RukenPrivate and keeping the plain-words "How the feed works" page public; **Owner, 20:22 UTC:** "Yes".
- **Coordinator, 2026-11-22 20:24 UTC** (settled as a technical choice, the Owner can overrule): the ranking runs as its own private Cloudflare Worker, with a public fallback order. If it adds any cost on the Cloudflare plan, stop and ask the Owner. Leave room for more to move private later (pool and payout maths, bot detection, rate-limit thresholds, moderation rules); nothing of that is moved by this spec.

## 1. The outcome

Nobody reading RukenApp can learn how the real feed ranks games, beyond what the public "How the feed works" page says. The public app still builds, tests and runs for anyone, with a simple order of its own. The real order comes from a private Worker built from RukenPrivate, and the app works the same, only in a plainer order, when that Worker is missing, slow or broken.

It has failed, even if every test passes, if: a ranking rule, a weight, a setting key or value, a signal module, or a hidden layer's code lands in RukenApp after this; the public app cannot be built, tested or run without access to RukenPrivate; the feed errors or stalls when the private Worker is down; the consent, age and parent's-yes rules move out of public view; or the private Worker adds a cost the Owner did not approve.

## 2. What is public for good

RukenApp is public and its history stays (CLAUDE.md: never force-push). Already published and staying published: the learned spec as merged in #342 (`c80ab01`), with its rules in words (standing, first showing, taste, quiet no, surprises, spacing, echo, second try, rounds, the sky layer, high-taste players), every setting key and switch name, and the unit plan; and the interim order in `src/features/feed/order.ts`. No tuned number was ever in the learned spec. RukenPrivate #18's `feed/settings.md` records any values that reached RukenApp's history; re-tuning those is the Owner's call, raised once in the report, not here. This spec does not rewrite history.

## 3. The boundary

One interface, in the public repo, `src/features/feed/ranker.ts` (lane 2: shared code), plain data in and out, no private name in it:

```ts
/** Who is asking. Decided in public (consent, age, a parent's yes, the "Learn from what I do" switch). */
type Viewer = { kind: "crowd"; seed: string } | { kind: "full"; seed: string; id: string };

interface RankRequest {
  v: 1;
  viewer: Viewer;
  /** The cursor the ranker made, or null for a first page. Opaque to the app. */
  after: string | null;
  asOf: number;
  /** Everything the ranker may read, as plain rows; the app reads them from the database. */
  facts: FeedFacts;
}

interface RankedPage {
  /** Game ids in order, each with the clip slot to show and a key unique in the feed. */
  items: { gameId: string; slot: number; key: string }[];
  next: string | null;
  caughtUpAt: number | null;
  ask: { index: number; gameId: string } | null;
}

interface Ranker {
  page(request: RankRequest): Promise<RankedPage | "bad-cursor">;
  /** Per game, whether its maker sees "Few people have tapped Play..." (learned spec 6.4, unit F). */
  notes(request: { asOf: number; facts: FeedFacts; gameIds: string[] }): Promise<Record<string, "few-plays" | "few-taps" | null>>;
  health(): Promise<"private" | "partial" | "defaults">;
}
```

- **`FeedFacts`** are rows the app already has or the learned spec's public units add: live games (id, maker, live since, age rating, mood, genre, clip slots), play days (user, game, Chicago day, attentive beats, basis), and, for a `full` viewer, their views, likes, saves, reposts, More/Less rows, Good pick answers and reset time. It grows only by adding optional fields; `v` bumps on any other change. Which rows are read is public on purpose: it is what a person is told is collected.
- **Where it runs.** RukenApp's Worker gets a service binding `FEED_RANKER` to the private Worker `ruken-feed` and calls it over Workers RPC. `src/features/feed/services.ts` picks the ranker: the binding when present, otherwise the public ranker.
- **The public ranker** (`src/features/feed/public-ranker.ts`) is today's interim order plus the infinite feed's rounds, moved behind `Ranker` with no behaviour change: the order #329 ships is the order a contributor sees. Its cursor is #329's `day~round~offset~swapped~last`. `notes` answers null for every game; `health` answers `defaults`.
- **Falling back.** A call to `FEED_RANKER` that throws, takes longer than 800 ms, or answers something that fails the contract's shape check is logged in one line (no viewer, no value) and answered by the public ranker; a cursor the public ranker did not make then gives a fresh first page, not a 400. A `bad-cursor` answer from either ranker is the route's 400, as today.
- **What stays public:** the database reads and every migration; the consent gate and who counts as `crowd` or `full` (learned spec 4.1, 10.1); every screen and route (Your feed, the ••• sheet, Like/Save/Repost, the parent's yes, test videos, the questions for mood and genre); turning ranked ids into `FeedClip`s; `/healthz/feed`, which answers the ranker's `health()`; the "How the feed works" page.
- **What goes private (RukenPrivate `feed/`):** `learnedOrder`, every module under the learned spec's `signals/`, the settings list and its defaults, the cursor format, echo and second try, the slot pick, the few-plays and few-taps rules, the sky sums (`sky.ts`), the high-taste weights, the settings workflow, and the private learned-feed spec itself. The `FEED_SETTINGS` secret is set on `ruken-feed`, never on `ruken`.
- **Room for more.** `ruken-feed` is named for the feed, but its `src/` keeps one folder per job (`feed/` now), so pool maths or bot checks can come later as their own folder and their own RPC method, by their own spec.

## 4. The learned spec, split

The learned spec in RukenApp is replaced by a trimmed public version (same path) that keeps sections 0, 1, 3, 4.1, 4.7, 6, 10 and the public units, says plainly that the ranking is private and is built in RukenPrivate, and drops the ranking rules, the setting key list and the hidden layers' units. Its unit table becomes:

| Unit | Repo | What changes from the learned spec |
|---|---|---|
| A, the learned order | RukenPrivate (ranking, cursor, settings) and RukenApp (the play-days read, the `full`/`crowd` viewer, `/healthz/feed`, the caught-up line) | split at `Ranker`; the A7 paging invariants run in RukenPrivate against the ranker, the journey A11 in RukenApp against a stub ranker |
| B, C, D, E, G, I, L | RukenApp, as written | each writes rows and screens only; every scoring step in it (B3, B4, C3, D's taste, E2, G3) moves to RukenPrivate as that unit's private half |
| F, the few-plays note | RukenApp screen, private rule | the line shows when `notes()` says so |
| H, the sky layer | RukenPrivate only | `docs/feed-sky.md` is not written in RukenApp |
| K, high-taste players | RukenPrivate (weights, earned rule), RukenApp (a neutral `/jobs/` route and table only if the private half needs one, named in K's own plan) | |
| J1, J2 | RukenPrivate, as written, but loading `ruken-feed` | J2's check reads public defaults from RukenPrivate, not RukenApp |

The full learned spec moves, unchanged except for this split, to RukenPrivate `feed/2026-11-22-learned-feed-design.md`, with the private units' steps. `/mnt/project-files/prompts/learned-feed-unit-execution.md` is rewritten so each unit names its repo or repos, and a unit with two halves lands the private half first.

## 5. The plan

| Unit | Waits on | Owns | Output | Lane |
|---|---|---|---|---|
| P0, hooks in RukenPrivate | nothing | RukenPrivate `.claude/hooks/`, `.claude/settings.json` | pull requests in RukenPrivate are checked by the same hooks (the unchecked route in `progress.md`, hook follow-ups, 2026-11-22 16:11 UTC) | 3 |
| P1, this spec | nothing | this file; the learned spec trimmed (section 4); RukenPrivate's copy of the full one | the split written down | 1 |
| P2, the seam | #329 merged | RukenApp `src/features/feed/ranker.ts`, `public-ranker.ts`, `service.ts`, `services.ts`, `src/routes/api/feed/`, `src/routes/+page.server.ts`; tests; `order.ts` folded into `public-ranker.ts` | `page()` goes through `Ranker`; the public ranker gives exactly #329's order | 2 |
| P3, the private Worker | P0, P2 | RukenPrivate `feed-worker/` (Worker, its tests, `wrangler.jsonc`), `.github/workflows/feed-worker.yml` | `ruken-feed` deployed, answering `page`, `notes`, `health` with the public ranker's order until unit A lands there | 3 |
| P4, the binding | P3 deployed | RukenApp `wrangler.jsonc` (`services`), `services.ts`, the fallback and its tests | the live app asks `ruken-feed`, and falls back | 2 |
| P5, the prompt and records | P1 | `/mnt/project-files/prompts/learned-feed-unit-execution.md`; `progress.md` (the Owner's decision, the units) | later units build in the right repo | 1 |

**Why this order.** P2 edits the files #329 changes, so it starts from a `main` that holds #329. P3 needs P2's contract to type-check against and P0's hooks to open a pull request. P4 needs a deployed `ruken-feed`, because a binding to a Worker that does not exist cannot be called (and may fail the deploy; P4's first step checks which on the account). P1 and P5 run beside anything.

### Acceptance criteria

- **C1.** After P2, every feed test from #329 passes unchanged (named in the pull request if any moves file), and a test shows `service.page` with the public ranker gives the same clips, keys and `next` as #329 for seeded worlds of 0, 1, 2, 3 and 60 games.
- **C2.** A test with a stub ranker shows the service turns its ids, slots and keys into `FeedClip`s, passes `caughtUpAt` and `ask` through, leaves out a game no longer live, and answers 400 on `bad-cursor`.
- **C3.** Fallback, each tested: the ranker throws; it takes 801 ms; it answers a bad shape; each gives the public ranker's page and one log line without a viewer id or value. A cursor from the private ranker handed to the public one gives a fresh first page.
- **C4.** The viewer is decided in public: a test shows a browser without `rk_consent`, a signed-out visitor and an under-18 without a parent's yes each send `kind: "crowd"` and no personal facts (when the consent work and unit I have merged; until then, the cases that exist).
- **C5.** An architecture test in RukenApp fails if any file outside `ranker.ts`, `public-ranker.ts` and the tests names a learned spec setting key or `signals/`, or if `FEED_SETTINGS` appears anywhere in `src/`, `cloudflare/` or `wrangler.jsonc`.
- **C6.** RukenApp with no `FEED_RANKER` binding builds, passes `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:pg` and `pnpm test:browser`, with no access to RukenPrivate.
- **C7.** RukenPrivate's CI checks out RukenApp `main` (public, no token) and type-checks `ruken-feed` against its `ranker.ts`; a change to the contract that breaks the Worker fails RukenPrivate's check.
- **C8.** `ruken-feed` has no public address (`workers_dev: false`, no routes), is reached only by the binding, and logs no viewer or value. Its deploy runs from RukenPrivate's `main` with the Cloudflare token on RukenPrivate (the learned spec's Open 4).
- **C9.** P4, measured on the live site: the first page through `ruken-feed` in under 300 ms at the p50 of 20 loads, and `/healthz/feed` answers what the private Worker's `health()` says.
- **C10.** Cost: before P3 deploys, the Workers plan's pricing for a second Worker and for calls over a service binding is read from Cloudflare's own docs and quoted in P3's pull request; any added cost stops P3 and goes to the Owner.
- **C11.** P0: in a cloud session in RukenPrivate, the hook refuses a pull request create without "Requested by **McThayDT**" last, and a commit with the wrong author, each shown in P0's pull request.
- **C12.** P5: the prompt names, for every unit of section 4, its repo or repos and which half lands first.

## 6. Open, and what waits

1. **Not the Owner's: P0's own pull request.** Until P0 merges, a pull request create in RukenPrivate is unchecked. P0 is the one pull request opened over that route, and only after the coordinator agrees; or the coordinator chooses another way. Everything else in RukenPrivate waits for P0.
2. **Owner, access:** the Cloudflare token as a secret on RukenPrivate (the learned spec's Open 4, already in the deploy batch). P3's deploy and P4 wait for it; P2, P1 and P5 do not.
3. **Owner, money, only if C10 finds a cost.**
4. **Not the Owner's:** a pull request slot in RukenApp for P1/P2 (cap 10, full at 20:22 UTC).

## 7. Risks, and what is not checked

- The rules in words are public for good (section 2); only numbers, code and anything decided from now on are private.
- A slow or failing `ruken-feed` silently gives everyone the plain order. The fallback log line is the only sign; `/healthz/feed` answering `defaults` on the live site is how a check sees it.
- Passing facts per request may outgrow the RPC call as the catalogue grows; C9 measures it, and the learned spec's A10 cache applies on the app's side.
- Two repos must agree on one contract; C7 is the guard, and it only runs when RukenPrivate's CI runs.
- RukenPrivate has no browser journeys; the paging invariants are unit tests there, and the journeys in RukenApp run against the public ranker or a stub, never the real one.
