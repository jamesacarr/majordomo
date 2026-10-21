---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0020. Run evals against a Seerr stub with deterministic checks

Decided 2026-10-20.

## Context

Evals drive the real agent and model. Against the real Seerr they'd depend on the network and live library state, and request evals would create real downloads.

## Decision

Evals run against a fixture-backed Seerr HTTP stub (`evals/seerr-stub.ts`, fixtures in `evals/fixtures/seerr.ts`) on a fixed loopback port. The `eval` script in `package.json` sets `SEERR_URL` and a dummy `SEERR_API_KEY`, and `evals/evals.config.ts` throws when `SEERR_URL` isn't loopback.

Assertions are deterministic. There's no LLM judge.

## Consequences

- `eve eval` reloads `.env` after `setup` runs, overwriting any variable `.env` names unless the shell set it first (eve 0.81.1, `cli/dev/environment.js`). Setting `SEERR_URL` inside `setup` loses to `.env`, which is why the script sets it and the config fails closed. A bare `eve eval` refuses to run.
- eve's default judge model, `typesafe-ai/jev`, isn't available on the free tier. Checks that a judge would make are written as code instead, for example that every bold title in a recommendation reply is one the tool returned.
