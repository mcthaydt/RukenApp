# Loading indicators, implementation audit 1 (PR #309)

- Examined: 4ceef7d (branch `claude/project-thread-jhe4or`), against `main` at the merge base.
- Lane 2 (`src/lib/`, the layout). Reviewer: a fresh session, Opus 5.5, medium.
- Brief: the owner's rule (2026-11-22 05:52 UTC, "Make sure we have async loaders for everything that loads, now and in the future", 05:53 "images and videos too") and the seven acceptance criteria in the PR body.
- Verdict: **FAIL, 1 red, 5 notes.**

## What ran

- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0, 0 errors. `pnpm test`: 125 files, 1859 tests passed.
- `tests/loading-states.test.ts` alone: 6 passed.
- Mutation probe of that test (reverted, see red 1): still 6 passed with two new unsignalled waits added.
- CI on 4ceef7d at the time of writing: pr-rules-run, commit-authors and browser shards 2, 4, 6 green; shards 1, 3, 5, postgres and verify still running. The browser journeys were not run locally (no Postgres in this container).

## Red

### 1. The future-proof check misses two kinds of new waits

- UNIT: `tests/loading-states.test.ts`
- VERDICT: red
- REQUIREMENT: acceptance criterion 6, "A test fails when a new form with its own script, image, video, frame or fetch skips a loading sign", and the owner's "now and in the future".
- REASON: the check scans only `.svelte` files and judges enhanced forms per file, so a new fetch in a browser module and a second enhanced form in a file that already has one both pass with no loading sign.
- EVIDENCE: on 4ceef7d, appending `export async function probe() { return (await fetch("/x")).json(); }` to `src/features/feed/feed.browser.ts` and `<form method="POST" action="?/probe" use:enhance><button>Probe</button></form>` to `src/routes/make/parts/LiveScreen.svelte`, then `pnpm exec vitest run tests/loading-states.test.ts`, gives "Tests 6 passed (6)". Browser code in this repo lives in `*.browser.ts` (`feed.browser.ts`, `pages.browser.ts`, `play.browser.ts`), which the scan never reads. The enhanced-form test passes any file whose text contains `aria-busy` anywhere.
- EXPECTED: both probes make the test fail.
- FIX: in `tests/loading-states.test.ts` only: (a) also read `src/**/*.browser.ts` in the fetch test, so a `fetch(` there fails unless the module or a screen that imports it shows the wait (simplest: list the file and require an `aria-busy`/"Starting" sign in it or an explicit, commented allow-list entry); (b) in the enhanced-form test, require at least as many `aria-busy=` attributes as `use:enhance` occurrences per file. Rerun the two probes above and show both fail, then revert them.

## Notes (not blocking, recorded as follow-ups)

1. `src/lib/busy-forms.ts`: a plain form's busy state is visual plus `aria-busy`/`aria-disabled`. The button's words do not change and nothing is announced, so a screen reader user who presses again hears nothing new until focus moves. A visually hidden `role="status"` "Sending…" (or changing the words, as the enhanced forms do) would close that. Double submit itself is blocked: the second `submit` event finds the form `aria-busy` and is cancelled, whether it comes from a click, Enter or `requestSubmit`, and the journey shows one request reaching the site.
2. `src/lib/loads.ts`: an `<img>` whose `src` changes on the same node (the maker's photo on `/make/page/[room]` after a new upload through `use:enhance`) is not marked loading again; only the first load shimmers. Listening for a `src` change (or keying the image on its src) would cover it.
3. `tests/loading-states.test.ts`: `tagsOf` uses `<img\b[^>]*>`, so an attribute holding `=>` ends the tag early. That only gives false alarms (the test fails when it should not), never a miss, so it is safe, but the message would confuse.
4. `src/lib/busy-forms.ts` `clearSending()` on a back/forward restore clears every `[aria-busy="true"]` in the document, including ones Svelte owns on enhanced buttons and on "Looking up branches…". Svelte will not set them again until its state changes. Harmless today, because an enhanced send leaves the page through the router, not the back/forward cache; scoping it to `form[aria-busy]` and their buttons would be tidier.
5. `src/routes/make/parts/QuestionScreen.svelte` (unchanged here): pressing "Remove photo" or "Keep the old one" shows the busy words on Save. A wait is shown, so the rule holds; the words are just on the other button.

## Looked at and found sound

- `markSending` skips a send that is already `defaultPrevented`. SvelteKit's `use:enhance` cancels the native send on the form itself, before the event bubbles to the document, so enhanced forms keep their own busy words and are never marked twice. `submit` is not a Svelte-delegated event, so `<svelte:document onsubmit>` is a plain document listener.
- Every form in `src` is `method="POST"` (25 forms), so the client router never turns a plain form into an in-page move that would keep a button busy for the full 15 s. No form has `target` or answers with a download. A failed plain send reloads the page, which clears the marks; Back clears them through `pageshow`.
- `aria-disabled` rather than `disabled` is right: a disabled submitter drops its name and value. The button stays focusable, so focus is not lost.
- `use:loads` is on all 17 `<img>`/`<video>` tags. An image that loaded or failed before hydration is `complete` and is not marked. A video with no address, or one the browser chose not to fetch, is not marked, and `emptied`/`suspend`/`stalled` clear the mark. Reduced motion stops both animations and keeps the line whole and the box still.
- `page-loading.svelte` renders nothing on the server and starts hidden, so it hydrates with no mismatch.
- #293's hydration fix is intact: this PR does not touch `TextAnswer.svelte` or `Picks.svelte`, and `FilesQuestion.svelte` still binds the folder box (`bind:value={folderBox}`, line 242); the new `lookingUp` state only adds a status line and sets no input's value.
- CRUD: the change adds nothing a user can make.
- The PR body names its lane, criteria, journeys, visual check and verify run; it changes no existing test, golden or `verify` step.
