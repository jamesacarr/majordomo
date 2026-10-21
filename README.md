# majordomo

A household agent built on [eve](https://eve.dev). Allowlisted people talk to it through a Telegram bot and it routes their requests to home services. The first capability is requesting movies and TV shows through [Seerr](https://seerr.dev), with every request confirmed before submission and made as the person's own Seerr user, so their Seerr permissions, approval rules and quota apply.

## Getting started

Copy `.env.example` to `.env` and fill in the values, then run the development server:

```bash
pnpm install
pnpm dev
```

The development TUI opens an interactive session where you can send messages to your agent.

The agent is locked down by default: the built-in shell, file, and web tools are disabled in `agent/tools/`, and the only way it can act is through the typed tools this project authors. The default landing page at `/` is disabled in `agent/channels/home.ts`; only the health route and the authenticated session routes under `/eve/v1` are served. Logic and its colocated tests live in `agent/lib/`. Files in the directories eve discovers (`tools/`, `channels/`, `instructions/`, `skills/`, `schedules/`) only bind definitions to that code, because eve treats every file there as a definition and a `*.test.ts` alongside a tool fails the build.

The design is in `docs/architecture.md`, and the reasoning behind each decision is in `docs/decisions/`.

Checks:

```bash
pnpm lint:ci
pnpm typecheck
pnpm test
pnpm build
```

## Learn more

To learn more about eve, explore these resources:

- [eve documentation](https://eve.dev/docs) — learn about eve's features and authoring APIs.
- [Build an Agent tutorial](https://eve.dev/docs/tutorial/first-agent) — build and deploy an agent step by step.
- [eve on GitHub](https://github.com/vercel/eve) — view the source and contribute.

## Setup and deployment

The agent runs on Vercel and deploys from `main`. A first deploy follows these steps, each covered in [docs/runbook.md](docs/runbook.md):

1. [Create a development bot](docs/runbook.md#development-bot) for `pnpm dev`.
2. [Generate the Seerr API key](docs/runbook.md#seerr).
3. [Set up each person's Seerr user](docs/runbook.md#seerr-users).
4. [Set the Vercel environment variables](docs/runbook.md#vercel-environment-variables).
5. [Set the AI Gateway spend cap](docs/runbook.md#ai-gateway-spend-cap).
6. [Link and deploy](docs/runbook.md#link-and-deploy).
7. [Go live](docs/runbook.md#go-live) and run the [smoke test](docs/runbook.md#smoke-test-checklist).

The runbook also covers [adding a user](docs/runbook.md#adding-a-user) and [rotating credentials](docs/runbook.md#rotating-credentials).
