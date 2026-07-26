# Mocha LM

Mocha LM is a notebook-first workspace: create a notebook, add sources (PDFs,
subtitles, web pages), and chat with them — with citations back to the exact
page, timestamp, or passage they came from. It's a small NotebookLM-style
clone built end-to-end: ingestion, advanced retrieval, grounded chat, and a
citation viewer.

## How it works

1. **Add sources.** Upload a PDF/`.srt`, or paste a URL. A BullMQ worker
   fetches (SSRF-guarded for URLs), extracts text, chunks it, embeds it, and
   indexes it into Qdrant — with live status/progress in the UI.
2. **Select sources and chat.** Check which ready sources should ground this
   conversation. Each question runs through an advanced retrieval pipeline
   (step-back + refined query + sub-query decomposition → per-query vector search →
   Reciprocal Rank Fusion → dedupe → LLM re-rank) before being answered.
3. **Read with citations.** Answers cite excerpts inline as `[1]`, `[2]`, …
   Clicking a citation opens the exact PDF page, subtitle cue, or web
   passage it came from in the citation pane.

## Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS v4**
- **Clerk** for authentication
- **Prisma 7** + **Postgres** (via `@prisma/adapter-pg`)
- **BullMQ** + **Redis** for background ingestion jobs
- **Qdrant** for vector search
- **OpenRouter** (`ai` SDK, OpenAI-compatible) for chat, step-back/sub-query
  reformulation, re-ranking, and embeddings
- **fusion-rank** for Reciprocal Rank Fusion
- **react-pdf** for the in-app PDF citation viewer
- **@repo/ui** — the monorepo's shared shadcn-based component library
- **@tanstack/react-query** for client data fetching/caching
- **Vitest** for unit tests, **Playwright** for e2e tests

## Prerequisites

- Node.js >= 18, pnpm 9
- Docker (for Postgres, Redis, Qdrant)
- A [Clerk](https://clerk.com) application (publishable + secret key)
- An [OpenRouter](https://openrouter.ai) API key (for chat, retrieval, and embeddings)

## 1. Install dependencies

From the monorepo root:

```bash
pnpm install
```

## 2. Configure environment variables

```bash
cp apps/mocha-lm/.env.example apps/mocha-lm/.env
```

Fill in at minimum:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`
- `OPENROUTER_API_KEY` — required for ingestion (embeddings) and chat
  (step-back/sub-query generation, re-ranking, and the chat model itself)

The defaults for `DATABASE_URL`, `REDIS_URL`, and `QDRANT_URL` already point
at the ports used by this app's `docker-compose.yml` (chosen to avoid
colliding with other apps in the monorepo, e.g. `mocha-gpt`). On Windows,
prefer `127.0.0.1` over `localhost` — Node/Prisma often resolve `localhost`
to IPv6 (`::1`) first, which Docker Desktop may reject for published ports.
See `src/lib/env.ts` for model names (`CHAT_MODEL`, `STEP_BACK_MODEL`,
`REFINE_QUERY_MODEL`, `SUB_QUERIES_MODEL`, `RERANK_MODEL`, `EMBEDDING_MODEL`) and
`src/lib/limits.ts` for tunables.

## 3. Start infrastructure

```bash
cd apps/mocha-lm
docker compose up -d
```

This starts:

| Service  | Port(s)      | Purpose                    |
| -------- | ------------ | --------------------------- |
| postgres | `5433`       | Primary relational database |
| redis    | `6380`       | BullMQ job queues            |
| qdrant   | `6335`/`6336`| Vector store (REST/gRPC)    |

## 4. Set up the database

Apply the initial migration (requires the containers above to be running):

```bash
pnpm --filter mocha-lm exec prisma migrate dev
```

If you're only scaffolding locally without a database yet, you can still
generate the Prisma client (used by TypeScript) without connecting to a DB:

```bash
pnpm --filter mocha-lm exec prisma generate
```

## 5. Run the app

```bash
pnpm --filter mocha-lm dev
```

This starts the Next.js app at `http://localhost:3002`. The ingestion worker
is started automatically via `instrumentation.ts` when the Node.js runtime
boots — you do not need a separate process in development.

To run the worker as a standalone process (e.g. for production scaling):

```bash
pnpm --filter mocha-lm worker
```

Or from the repo root, via Turborepo:

```bash
pnpm dev --filter mocha-lm
```

Check `http://localhost:3002/api/health` to confirm Postgres, Redis, and
Qdrant are all reachable.

## Scripts

| Script         | Description                                   |
| -------------- | ---------------------------------------------- |
| `dev`          | Start the Next.js dev server on port `3002`    |
| `worker`       | Start the ingestion worker as a standalone process |
| `build`        | Production build                               |
| `start`        | Start the production server                    |
| `lint`         | Run ESLint                                     |
| `check-types`  | Type-check with `tsc --noEmit`                 |
| `test`         | Run unit tests with Vitest                     |
| `test:e2e`     | Run end-to-end tests with Playwright           |

## Project layout

```
apps/mocha-lm
├── docker-compose.yml        # postgres, redis, qdrant
├── prisma/                   # schema + migrations
├── src/
│   ├── app/                       # Next.js routes
│   │   ├── (auth)/sign-in
│   │   ├── (root)/
│   │   │   ├── page.tsx                # "/" -> redirects to /notebooks
│   │   │   └── notebooks/
│   │   │       ├── page.tsx            # notebook dashboard
│   │   │       └── [notebookId]/       # three-pane notebook workspace
│   │   └── api/
│   │       ├── chat/route.ts               # streaming, retrieval-grounded chat
│   │       ├── health/route.ts             # DB/Redis/Qdrant health check
│   │       └── sources/
│   │           ├── upload/, url/, status/  # ingestion intake + polling
│   │           └── [sourceId]/content, extracted  # citation viewer content
│   ├── components/providers/  # Clerk/Theme/Query providers
│   ├── features/
│   │   ├── auth/          # onboarding + session helpers
│   │   ├── notebooks/      # CRUD actions, hooks, dashboard, workspace shell
│   │   ├── sources/        # source pane, citation pane (PDF/SRT/web viewers)
│   │   ├── ingestion/      # fetch → extract → chunk → embed → index pipeline
│   │   ├── retrieval/      # refine, step-back, sub-queries, search, RRF, dedupe, re-rank
│   │   └── chat/           # conversation CRUD, streaming hook, citations, chat pane
│   ├── lib/                # env, db, redis, qdrant, storage, errors, limits, openrouter
│   ├── proxy.ts             # Clerk middleware
│   └── worker.ts            # ingestion worker entrypoint
└── .data/                    # local disk storage for uploads/extracted text (gitignored)
```

### Retrieval pipeline (`src/features/retrieval/`)

For each chat turn, `pipeline.ts` orchestrates:

1. `step-back.ts` — reformulates the question into one broader query.
2. `refine-query.ts` — rewrites the original into a clearer search query
   (used *instead of* the raw user text for dense search).
3. `sub-queries.ts` — decomposes the **refined** query into 2–4 focused
   sub-queries.
4. `search.ts` — runs a dense vector search per query (refined + step-back +
   sub-queries), scoped to the selected sources (filtered by `userId` +
   `notebookId` + `sourceId` + each source's current `indexVersion`).
5. `rrf.ts` — fuses the per-query result lists with Reciprocal Rank Fusion
   (via `fusion-rank`).
6. `dedupe.ts` — drops duplicate chunks.
7. `rerank.ts` — re-ranks the fused candidates against the **original**
   question with an LLM judge, then trims to the context budget.

### Citations (`src/features/chat/citations.ts`)

Retrieved chunks are numbered into a citation list before the chat model is
called; the model is instructed to cite with `[1]`/`[2]`-style markers.
After generation, `extractUsedCitations` parses which citation markers the
model actually used and persists just those on the assistant message
(`Message.metadata`). The chat pane renders them as inline, clickable chips;
clicking one opens the source passage in the citation pane (PDF page via
`react-pdf`, the matching subtitle cue, or the sanitized web snapshot).

## Notes

- Local file storage lives under `apps/mocha-lm/.data/` (`uploads/`,
  `extracted/`, `web-snapshots/`) and is gitignored aside from `.gitkeep`
  placeholders. This is a stand-in for object storage and can be swapped
  later without touching call sites (see `src/lib/storage.ts`).
- The Prisma client is generated into `src/generated/prisma` (gitignored);
  run `prisma generate` after installing dependencies or changing the schema.
- Ingestion is SSRF-guarded (`src/features/ingestion/ssrf.ts`): URL sources
  resolve DNS and re-validate every redirect hop against private/reserved/
  loopback/link-local/metadata IP ranges before fetching.
