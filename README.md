# majordomo

A household agent built on [eve](https://eve.dev). Allowlisted people talk to it through a Telegram bot and it routes their requests to home services. The first capability is requesting movies and TV shows through [Seerr](https://seerr.dev), with every request confirmed before submission and tagged with the requester's name.

The implementation plan and MR stack live in [`docs/plan.md`](./docs/plan.md).

## Getting started

Copy `.env.example` to `.env` and fill in the values, then run the development server:

```bash
pnpm install
pnpm dev
```

The development TUI opens an interactive session where you can send messages to your agent.

The agent is locked down by default: the built-in shell, file, and web tools are disabled in `agent/tools/`, and the only way it can act is through the typed tools this project authors. Logic and its tests live in `agent/lib/`; files in the eve-discovered directories only bind definitions to it. See the plan for why.

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

## Deploy on Vercel

Deploy your agent to [Vercel](https://vercel.com) from the project root:

```bash
eve deploy
```

`eve deploy` links a Vercel project if needed and deploys the agent to production. See the [eve deployment documentation](https://eve.dev/docs/guides/deployment/vercel) for authentication, environment variables, and deployment options.
