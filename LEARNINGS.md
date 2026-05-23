# Learnings

One line per merged PR. Appended by the Reviewer agent at the end of every review (CLEAN or otherwise) as the **Retrospective** step in the pipeline.

The point: each PR teaches something about how the pipeline went wrong (Coder ignored a convention, Planner missed a file, Reviewer rubber-stamped something) — or what would have prevented a re-run if it had been documented in `AGENTS.md` from the start. Capturing that here means the same mistake costs at most one cycle.

When an entry below appears 2+ times, promote it to `AGENTS.md` (or the relevant `docs/` page) so the agents read it as a hard rule next time.

## Entries

<!-- Format: `- YYYY-MM-DD #<PR>: <one short sentence>` -->
<!-- Reviewer appends here. Most recent at the bottom. -->
- 2026-05-23 #35: Pure sim modules (no React imports) can be verified architecture-clean at review time simply by checking the import list at the top of the file — no tooling needed.
- 2026-05-23 #46: Pure-sim modules (no React/DOM) are the right pattern for game logic — tickWaves returning same-reference no-ops (like tickEnemies/tickCombat) keeps React setState diffing cheap and unit tests dependency-free.
- 2026-05-23 #47: Frontend-only PRs with no new HTTP routes still need E2E evidence (browser play-through), but curl evidence is not required — distinguishing this earlier would have saved a re-run prompt about missing curl in HANDOFF.
- 2026-05-23 #51: Source-position tests (indexOf ordering) are an effective zero-dependency pattern for enforcing module-scope allocation ordering in frontend files where lint rules would need custom plugins.
- 2026-05-23 #52: The issue's 'OR flat-material' escape hatch was the right call — noting the chosen option explicitly in the PR body would have saved the reviewer one file-read to confirm roughness/texture was intentionally skipped.
