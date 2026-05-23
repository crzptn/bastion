---
description: Run the full delivery pipeline (planner → coder → smoke-tester → reviewer) against a GitHub issue. Bridges Claude Code's missing auto-handoff button by invoking each subagent in sequence via the Agent tool.
argument-hint: <issue-number>
---

# /pipeline — four-agent delivery loop

You are the **pipeline orchestrator**. Invoke each agent in turn via the `Agent` tool, read the `HANDOFF:*` block in their final output, and route to the next agent based on the verdict.

Issue number for this run: **$ARGUMENTS**

## How chaining works in Claude Code

`.cursor/agents/` and `.github/agents/` use frontmatter `handoffs:` to fire the next agent automatically. Claude Code does not have that mechanism — subagents return a single summary and stop. This slash command bridges the gap by reading the structured `HANDOFF:*` block at the end of each agent's output and explicitly invoking the next agent.

Every agent in this pipeline ends with one of:

- `HANDOFF:PLAN` (planner → coder)
- `HANDOFF:IMPLEMENTATION` (coder → smoke-tester)
- `HANDOFF:VERIFIED` (smoke-tester → reviewer, on pass)
- `HANDOFF:FIX` (smoke-tester or reviewer → coder, on fail)
- `HANDOFF:APPROVED` (reviewer → user, on clean)

Treat the block as canonical — pass it verbatim to the next agent in the prompt.

## Loop budget

Cap each loop at **3 retries** to prevent runaway burn:

- Smoke-tester → coder fix-cycles: max 3
- Reviewer → coder fix-cycles: max 3

If either hits the cap, **stop and surface to the user** with a one-paragraph summary of what's still failing. Do not silently keep looping.

## Sequence

### Stage 1 — planner

Invoke `Agent` with `subagent_type: planner` and the prompt:

> Run the planner workflow for issue #$ARGUMENTS. Read AGENTS.md, .claude/agents/_bastion-conventions.md, docs/backend-architecture.md, and LEARNINGS.md before drafting. Create the linked task branch via `gh issue develop`. End your response with the full `HANDOFF:PLAN` block.

Wait for return. Extract the `HANDOFF:PLAN` block. If missing or malformed → stop and surface to user.

### Stage 2 — coder

Invoke `Agent` with `subagent_type: coder` and the prompt:

> Implement the plan below. Tests-first for any change under `internal/<subsystem>/` that is pure domain logic. End with the full `HANDOFF:IMPLEMENTATION` block including the PR URL.
>
> <paste full HANDOFF:PLAN block>

Wait for return. Extract `HANDOFF:IMPLEMENTATION`.

### Stage 3 — smoke-tester

Invoke `Agent` with `subagent_type: smoke-tester` and the prompt:

> Run smoke tests against the implementation below. Observer/recorder only — no fixes. End with `HANDOFF:VERIFIED` on pass or `HANDOFF:FIX` on fail.
>
> <paste full HANDOFF:IMPLEMENTATION block>

Wait for return. Inspect verdict:

- `HANDOFF:VERIFIED` → proceed to Stage 4.
- `HANDOFF:FIX` → increment smoke-fix counter, loop back to Stage 2 (coder) with the FIX block. If counter > 3 → stop and surface.

### Stage 4 — reviewer

Invoke `Agent` with `subagent_type: reviewer` and the prompt:

> Review PR <pr_url>. Wait for CI green before reading the diff. Run the spec-conformance pass (cite `file:line` per AC or mark UNMET). On CLEAN, append the retrospective line to `LEARNINGS.md` before emitting `HANDOFF:APPROVED`.
>
> <paste full HANDOFF:VERIFIED block>

Wait for return. Inspect verdict:

- `HANDOFF:APPROVED` → report to user with PR URL + retrospective line. **Stop. Do not merge — the user merges manually.**
- `HANDOFF:FIX` → increment review-fix counter, loop back to Stage 2 (coder) with the FIX block. If counter > 3 → stop and surface.

## When to ask the user

Only ask the user if:

- The planner emits clarifying questions mid-flight (its `Agent` return will surface them).
- The retry cap is hit at any stage.
- A `HANDOFF:*` block is missing or malformed.

Do not ask for permission at stage boundaries — that defeats the purpose of orchestrating.

## What this command does NOT do

- It does **not** merge the PR — the user does that manually after reading `HANDOFF:APPROVED`.
- It does **not** invoke `issue-creator` — backlog setup is a separate flow (`Agent` with `subagent_type: issue-creator`, or just talking to the agent directly).
- It does **not** force-push, rebase, or rewrite history.

## Reporting

Throughout the run, surface a short status line at each stage boundary so the user can follow along:

```
[planner] PLAN ready for #<N> on branch task/<N>-<slug>
[coder] PR #<M> opened
[smoke-tester] PASS — 4/4 endpoints
[reviewer] APPROVED — retrospective appended to LEARNINGS.md
```

When done, paste the final `HANDOFF:APPROVED` block (or the failure summary at the retry cap) and stop.
