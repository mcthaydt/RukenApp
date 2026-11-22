# Plan audit 3: what people could game goes private

- Examined: `docs/superpowers/specs/2026-11-22-private-feed-ranking-design.md` on `claude/project-thread-t02epm` at **`2ade06ef3d797eea88c55d00a5aed88c2518c293`**, as a diff against audit 2's head `8867644`, with the code it names on `main` at `eb655ac`.
- Reviewer: Opus 5.5, medium, `review` skill; the session that wrote audits 1 and 2, checking its own findings' fixes.
- **Verdict: `2ade06ef` PASS.** No red, no new notes. R1 and R11 stay open with the Owner (section 7) and block P0, P3 and P6 there, as the spec says.

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

| Finding (audit 2) | Now | Evidence at `2ade06ef` |
|---|---|---|
| R12, `env.production` dropping bindings | **Fixed** | Section 3: `env.production` repeats every non-inherited key (`hyperdrive`, `r2_buckets`, any `vars`) as well as `services`; the `wrangler.deploy.jsonc` route carries the same full list. C16: a dry run with the production config lists `HYPERDRIVE`, `GAME_FILES`, `ASSETS`, `PRIVATE`, and without it the first three and not `PRIVATE`, both shown in P4's pull request. P4's Owns matches. Checked against `wrangler.jsonc` on `main`: those are its only bindings; it has no `vars`. |
| N1, `FEED_PUBLIC` in the journeys | Taken | Section 3: `playwright.config.ts` gives `wrangler dev` a `FEED_PUBLIC` with `learned` on and placeholder values; in P4's Owns. |
| N2, the limit tests list | Taken | P6 adds the seven files and starts from the grep. |
| N3, defaults against the journeys | Taken | Section 6 and C6: journeys get exact numbers from `tests/browser/support/rate-limits.ts` (a test `LIMITS`), never from a looser public default. |
| N4, `PRIVATE` on `Env` | Taken | Section 3 and P4: declared optional by hand. |

The rest of the spec is unchanged since audit 2, which found it consistent apart from R12.
