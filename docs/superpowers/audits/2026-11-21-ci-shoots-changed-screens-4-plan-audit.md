# Plan audit 4: CI shoots only the screens a change touches

**666c6ee PASS: 0 red, 1 note.**

- Examined: `docs/superpowers/specs/2026-11-21-ci-shoots-changed-screens-design.md` at 666c6ee (draft PR #256), the diff 140a623..666c6ee, against plan audit 3 (`docs/superpowers/audits/2026-11-21-ci-shoots-changed-screens-3-plan-audit.md`) and its newroute build evidence.
- Audit: 2026-11-21 06:35 UTC, Opus 5.5, medium, in a fresh session. Lane 3 plan audit, round 4: a wording recheck.
- Evidence: reading only. The diff touches one file, the spec, and section 2's rules change in one place (the matcher root's path, which round 3 found in the real build output), so no new build was run, as round 3 said. Graphify was not used: the questions are about spec text and build output, which it does not index.

## Round-3 red

| Red | Fixed? | Evidence |
|---|---|---|
| R12 A1's new-route case | **Yes.** | Spec line 105: "a new route (the route table in `server/manifest.js` and `server/manifest-full.js` changes, and later nodes renumber) answers `all`, naming the changed manifest". That is what round 3's newroute build gave under the rules (`all`, "`server/manifest.js` reached by root `server/manifest.js`"). Section 6 (line 141) now gives the route-table reason, with the client `app` entry as a second cause. No other line in the spec still says a new route marks only its own node (searched for "own node", "renumber"). |

## Round-3 notes

| Note | Taken in? | Where |
|---|---|---|
| N12 matcher root path | Yes | Line 47 names `server/entries/params.js`, the path round 3 saw the build write and both manifests import (`server/manifest.js:317`). The two paths that did not exist (`server/entries/matchers/`, `server/params.js`) are gone. Because the manifests are roots, this changes no answer. |
| N13 one-to-one content match | Yes | Line 106: an A1 case that names, in the log, any two base client files with equal normalised text. That is the lighter of the two options round 3 offered. |
| N14 A9 on the critical path | Yes | Line 115: the `screens` job's start-up cost is first measured on W's run. |
| N15 A3 demo path | Yes | Line 109: the demo's unit test is outside `tests/support/` and `tests/fixtures/`, both of which shoot everything. |

## Scope of the diff

Only the spec changed. Besides the above, the status line (round 4 waited on) and the Sessions line (round 4 named) were updated. Section 2's rules are otherwise word for word as round 3 verified on eight builds, so round 3's results for R8 to R11 still hold at 666c6ee.

## Note (recorded, not blocking)

- **N16. A root that is not written.** The new wording drops "where they exist". The build writes `server/entries/params.js` only while the app has a route matcher, and the endpoints folder only while it has endpoints. P's picker should treat a listed root that is missing in both builds as nothing to follow, and one present in only one build as changed (so `all`), rather than failing. An A1 case for it costs one line. The safe outcome holds either way, since a picker that errors leaves `LOOK_CHANGED` empty and `showTheOwner` shoots everything.

## Verdict

The spec is ready for the W build. No owner decision is open (section 5).
