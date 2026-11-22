# Flaky edit-page journey (#332): implementation audit, round 1

- Pull request: #332, branch `claude/project-thread-8e4lco`
- Commit examined: `799a269` (base `2381058`)
- Reviewer: a fresh session, Opus 5.5, medium. Lane 2: one fresh review after the build.
- Written: 2026-11-22 17:22 UTC

**Verdict: 799a269 FAIL: 1 red.** The journeys' new hold is sound and weakens no test, and the TextAnswer fix is correct for the taller box. But the same selection loss still happens in the one-line box of the same part (the name), and the pull request's title promises it for page answers.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings |
| `pnpm test` | exit 0, 129 files, 1929 tests passed |
| `edit-page.test.ts` and `make-second-look.test.ts`, tablet and computer | exit 0, 66 passed, 62 skipped (planned per device) |
| The three hold journeys (`edit-page` :490 and :521, plus :417), `--repeat-each 5`, tablet and computer | 20 of 20 passed |
| `edit-page:521` with `TextAnswer.svelte` put back to `2381058` | fails on tablet and computer: `Received: "I make small games.I make quick games."` |
| Probe: the one-line name box, selected before the screen comes alive, then typed over (below) | fails 10 of 10 on tablet and computer: `Received: "Slow OwlQuick Owl"` |

Not run here: phone (WebKit), which is CI only in this container; the full browser run (the draft's quick run was still going at 17:16 UTC).

## Exploratory checks

- **No test is weakened.** `edit-page` :490 keeps every assertion it had: the value after the screen comes alive, Save, "Saved.", and the list row, for both boxes. Only the way it holds the screen changed. `make-second-look:302` computes `above` exactly as before and compares it with the same `>= 16`; only the failure message gained the measured layout.
- **The hold cannot hide a failure.** SvelteKit's start script (`node_modules/@sveltejs/kit/src/runtime/server/page/render.js:523`) is `import(start).then(async (kit) => { kit.init(...); const app = await import(app); kit.start(app, ...) })`, so the wait put after `.then(async (kit) => {` holds `kit.init`, the app import and `kit.start`: the whole coming alive. If that text ever leaves the page, the `toContain` check fails at once; if the screen was not held, `release` times out on `__letItStart` and fails. The route stops matching once one page is held, and other requests fall back untouched.
- **The fix is right where it applies.** The component reads the sent box during hydration, while the server's DOM is still the one being claimed, and restores the selection on mount only when the words are unchanged. On the server `document` is absent and nothing runs. On a page change inside the app, the read can see the old page's focused box, but the equal-words guard makes that harmless.
- **CRUD.** The change adds nothing a user makes. The page's name and line are already created, read, updated and deleted by the existing journeys.

## Findings

### 1. Red: the one-line box still loses a selection made before the screen comes alive

- UNIT: `src/routes/make/parts/TextAnswer.svelte`, the `<input>` branch.
- VERDICT: red.
- REQUIREMENT: the pull request's own brief. Its title says "Page answers: a selection made before the screen comes alive stays", and the fix is in the part every page answer uses. A gap against the brief is a blocking defect.
- REASON: the restore is written only for the `<textarea>` (`selectionOfSentBox` looks for `textarea[name=…]`, and only the textarea has `bind:this={area}`), so the one-line box (the name, and every other one-line answer) still puts the cursor after the saved words when the screen comes alive.
- EVIDENCE: the probe below, using the pull request's own `holdNextScreen`, fails 10 of 10 on tablet and computer at `799a269`: the name "Slow Owl" was selected, the screen came alive, "Quick Owl" was typed, and the box held `"Slow OwlQuick Owl"`. A person who selects their name on a slow phone and types a new one gets both.
- EXPECTED: the box holds `"Quick Owl"`, as the line box now does.
- FIX: in `TextAnswer.svelte`, read the sent box whether it is an `input` or a `textarea` (for example `[name="…"]` with `HTMLInputElement | HTMLTextAreaElement`), and bind the `<input>` to the same element reference so `onMount` restores it too. Add the probe as a journey in `tests/browser/edit-page.test.ts`, and show it failing without the fix as was done for :521. Only those two files, plus the pull request body.

The probe (not committed):

```ts
test("probe: one-line name box, selected before alive, typing replaces", async ({ page }) => {
  const maker = await signUp(page);
  await givePage(maker, { name: "Slow Owl", oneLine: "I make small games." });
  const screen = await holdNextScreen(page); // the pull request's own, copied
  await page.goto("/make/page/name", { waitUntil: "commit" });
  const box = page.getByLabel("What should your page call you?");
  await box.selectText();
  await screen.release();
  await pageHasSettled(page);
  await page.keyboard.type("Quick Owl");
  await expect(box).toHaveValue("Quick Owl");
});
```

## Notes (not blocking, follow-ups outside this change)

1. **Other journeys still hold scripts the way this pull request shows does not hold in WebKit.** `tests/browser/join.test.ts:86` and `tests/browser/make-questions.test.ts:209` route `.js` requests to hold a screen, and `edit-page.test.ts:417` delays `/_app/immutable/*.js` by 3 s. By run 45041123880's finding, after the first page in WebKit those routes may not see the requests, so on phone those journeys may pass without having held anything, or flake. Worth a follow-up to move them to `holdNextScreen` (perhaps into `tests/browser/support/`, which is lane 2).
2. **PR body.** The last line is the tool's `Generated by Claude Code` footer, after "Requested by **McThayDT**", and the three commits are still "to come". Settle at merge time as the release skill says.
