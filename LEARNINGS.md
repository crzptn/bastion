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
- 2026-05-23 #60: Exporting pure helpers (fitDistance) specifically for unit testing is a clean pattern — source-reading tests via fs.readFileSync catch import/prop regressions without a full r3f render harness, worth using again for future canvas-heavy components.
- 2026-05-23 #61: Exporting tileTopY/tileCenterY as pure functions specifically to make elevation constants testable without a render harness is the right pattern for geometry-heavy canvas components — plan for it upfront to avoid source-reading tests as a last resort.
- 2026-05-23 #62: The hashId-derived phase pattern (deterministic string hash → float phase offset for useFrame animations) is reusable for any future per-instance animation desync — worth naming in AGENTS.md as a standard tool.
- 2026-05-23 #63: The slot-to-mesh index alignment in the TracerField ring buffer (slots[i] maps to meshRefs[i]) means a shift() eviction visually reassigns all subsequent meshes on the next frame — harmless for 120ms tracers but worth a comment so future reviewers don't flag it as a bug.
- 2026-05-24 #65: The snapshot-before-fan-out pattern in room.broadcast (take a slice copy under RLock, then Send outside the lock) is the correct way to avoid lock contention during WebSocket writes — worth naming in AGENTS.md as the standard fan-out pattern for any future pub/sub subsystem.
- 2026-05-24 #66: The nil-guard pattern for optional subsystems (lobbySvc nil check in handler.go before registerLobby) lets the API start without a database while still registering all routes when DB is available — a clean approach worth reusing for any future DB-dependent subsystem.
- 2026-05-24 #67: Exporting a pure canStart helper from a React page component, combined with source-read tests (fs.readFileSync) for navigation side-effects, is the right pattern for testing host/guest branching logic without a full render harness — plan for it upfront on any page with role-conditional navigation.
- 2026-05-26 #68: The TestManager_BroadcastsSnapshotsMonotonic AC4 test uses a synthetic counter (len+1) rather than extracting the actual tick field from the snapshot payload — asserting the real tick value would make it a stronger guard against off-by-one bugs in state.Tick++.
