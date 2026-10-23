---
created_at: 2026-10-23T00:58:16Z
updated_at: 2026-10-23T00:58:16Z
status: accepted
---

# 0028. Prefer Together AI, then DeepSeek, for model calls

Decided 2026-10-23, for #36.

## Context

With no routing options, the AI Gateway picks among all 18 providers that serve `deepseek/deepseek-v4.1-flash-1017` (decision 0017). Some calls get HTTP 503 from a provider and are retried on another, so the reply arrives but late. Calls can also land on providers without zero data retention (ZDR) or no-training terms.

The gateway's endpoint listing (`GET https://ai-gateway.vercel.sh/v1/models/deepseek/deepseek-v4.1-flash-1017/endpoints`, fetched 2026-10-23T00:58Z; latency and throughput over the last hour) for the providers considered:

| Provider | p50 / p95 latency | Throughput p50 | Input / output (US$/M) | ZDR / no-training |
|---|---|---|---|---|
| togetherai | 392 / 1204 ms | 420 tok/s | 0.30 / 1.20 | yes / yes |
| deepseek | 1170 / 2478 ms | 199 tok/s | 0.15 / 0.60, doubled weekdays 01:00 to 04:00 and 06:00 to 10:00 UTC | unknown / unknown |
| parasail | 296 / 652 ms | 83 tok/s | 0.30 / 1.20 | yes / yes |
| deepinfra | 2100 / 7271 ms | 62 tok/s | 0.098 / 0.294 | yes / yes |

DeepSeek's peak windows are 12:00 to 15:00 and 17:00 to 21:00 AEDT, when the household uses the bot most, and at peak it costs the same as togetherai.

## Decision

Set `modelOptions.providerOptions.gateway.order` to `['togetherai', 'deepseek']` in `agent/agent.ts`.

- togetherai goes first: it has the lowest latency of the providers with useful throughput, and it offers ZDR and no training.
- deepseek goes second: it's the model's own endpoint, costs half togetherai's rate off-peak, and had 99.97% uptime over the day.
- `order` rather than `only`. The gateway tries providers missing from `order` after the listed ones, so an outage at both still gets a reply.
- Session affinity stays on (eve's default), so the serving provider's prompt cache stays warm.

## Alternatives considered

- **`order: ['deepseek']`.** The ticket's first proposal and the smallest change. Rejected: three times slower to first token than togetherai, the same price at peak, and ZDR unknown.
- **`order: ['deepseek', 'togetherai']`.** Rejected: it halves off-peak cost, but a typical session of about 30,000 input tokens (mostly cache reads) and 2,000 output costs about US$0.005 on togetherai. Latency is what a person in the chat notices.
- **parasail first.** Rejected: the lowest latency, but 83 tok/s makes longer replies slow to stream.
- **`only`.** Rejected: every call fails while the listed providers are down, and the 503s cost latency, not replies.
- **`sort: 'ttft'`.** Rejected: it ranks on one metric and would route to providers without ZDR.
- **`sessionAffinity: false`.** Rejected: it keeps `order` exact, but each call could then land on a provider without the session's prompt cached.

## Consequences

- Affinity can move the provider that served a session's previous call ahead of `order`, so a session that fell back may stay on the fallback provider until it ends (24 hours at most, decision 0016).
- Calls on togetherai cost twice DeepSeek's off-peak rate. With decision 0016's token budgets, a session costs at most US$0.105 there.
- `order` holds for sequential calls but not for bursts. On 2026-10-23, three sequential requests all went to togetherai. In a burst of 12 concurrent requests, 11 went to gmicloud, novita or wafer. The routing metadata still planned togetherai first and recorded one successful attempt, not a failed one. `pnpm eval` runs its sessions concurrently, so it spread across 15 providers and doesn't show which provider production gets. A household chat sends one call at a time.
- The figures come from one hour of gateway data. If togetherai turns out to be the source of the 503s, swap the order. The AI Gateway logs show which provider served each call.
