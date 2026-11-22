# Wishlist before launch: implementation audit 3 (re-review after main merge)

- Pull request: #338
- Commit examined: 9d625ccef060d4c8166cf7088cb015692fe4bab3 (merge of main 85916ae into the Wishlist branch, after the earlier PASS)
- Lane: 2
- Verdict: **PASS**, 0 red, 1 note

## What changed since the last PASS

The merge brings in the endless feed (#329) and resolves conflicts in four files. `git diff --cc 9d625cc` on those
files is empty: every hunk was taken whole from one side, with no hand-mixed lines. Against main 85916ae the four files
differ only by the Wishlist additions:

- `src/features/feed/Feed.svelte`: keeps main's `first: FeedPage`, `ASK_AHEAD`, paging, snapshot and spinner untouched;
  adds the `launch` prop and, inside the one `{#each clips}` loop, `WishlistButton` where Play goes when
  `launch.before`, else main's Play link unchanged (including `data-sveltekit-preload-data="off"`).
- `src/routes/+page.server.ts`: returns main's `first: await feedServices().service.page(null)` plus
  `launch: await launchServices().screenFor(userId | null, cookies)`.
- `src/routes/+page.svelte`: keeps `{#key data.first}` and passes `launch={data.launch}`.
- `tests/features/feed/empty.test.ts`: both of main's tests (empty feed; no-script ends at last clip) kept, each now
  passing `launch: { before: false }`.

## Checks

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` at 9d625cc | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 136 files, 1985 tests passed |
| CI `verify`, `postgres`, `commit-authors` on 9d625cc | success |
| CI browser shards 1–6 on 9d625cc | running when this audit was written; merge waits on them as usual |
| PR body | has `## Lane`; last line is `Requested by **McThayDT**` |

## Focus questions

1. **Endless paging still works.** Feed.svelte's paging code (`clips` state, `next`, `loadMore`, `ASK_AHEAD`, dedupe by
   key, snapshot restore) is byte-identical to main; the merge adds no line to it. Main's own paging tests
   (`tests/browser/feed-controls.test.ts`) come in unchanged with the merge.
2. **Wishlist state holds on later pages.** Later pages are appended to the same `clips` array and drawn by the same
   loop, so each later clip gets `WishlistButton` with `wished={launch.wished.includes(clip.slug)}`. `launch.wished`
   is `wishlist.slugsOf(userId)` (`src/features/launch/wishlist.ts:43`), the person's whole list with no paging, so a
   game wished earlier shows "On your wishlist" wherever it lands. Returning to the feed re-runs `load`, so a restored
   snapshot of later pages is drawn against a fresh list. Signed out, `wished` is `[]` and the press sends them to sign up.

## Notes (not blocking)

- note: no browser journey presses Wishlist on a clip from a second feed page; the claim above rests on reading the
  single render loop. If a regression here is a worry, a journey that scrolls past the first page before launch and
  checks a wished game reads "On your wishlist" would pin it. Recorded, not required.
