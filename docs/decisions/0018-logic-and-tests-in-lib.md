---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0018. Keep logic and tests in `agent/lib/`

Decided 2026-09-03.

## Context

eve discovers every file under `agent/tools/`, `agent/channels/`, `agent/instructions/`, `agent/skills/` and `agent/schedules/` as a definition. A test file there breaks the build: `eve build` rejects `agent/tools/probe.test.ts` with "Tool filename \"probe.test\" is not a legal tool name" (eve 0.50.0, 2026-09-03). eve doesn't discover `agent/lib/`.

## Decision

Files in the discovered directories only bind eve definitions (`defineTool`, `telegramChannel`) to functions exported from `agent/lib/`. Logic and its colocated `*.test.ts` files live in `agent/lib/`.

Each function lives in its own file named after it in kebab-case, without repeating the folder name (`agent/lib/telegram/render-html.ts` exports `renderHtml`). Constants share a `constants.ts` and types a `types.ts` per directory.

## Consequences

- The thin binding files have no unit tests. Evals cover them, because evals exercise the real tool registration.
- Code under `agent/lib/` falls inside the coverage gate, so eval-only support code lives under `evals/` instead.
